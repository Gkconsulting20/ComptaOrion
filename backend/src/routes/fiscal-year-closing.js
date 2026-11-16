import express from 'express';
import { and, desc, eq, like, lte, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  comptesComptables,
  cloturesExercices,
  ecritures,
  journaux,
  lignesEcritures,
  entreprises,
} from '../schema.js';
import { generateNumeroEcriture } from '../services/comptabiliteService.js';
import { calculateFiscalClosing, getFiscalPeriodForYear } from '../services/fiscalYearClosing.js';
import { extractAuditInfo, logAudit } from '../utils/auditLogger.js';
import { markClosedFiscalPeriodConflict } from '../services/fiscalPeriodErrors.js';

const router = express.Router();

function fiscalPeriodFor(entreprise, fiscalYear) {
  const start = entreprise.debutAnneeFiscale || `${fiscalYear}-01-01`;
  const end = entreprise.finAnneeFiscale || `${fiscalYear}-12-31`;
  return getFiscalPeriodForYear(start, end, fiscalYear);
}

function closingReferences(period, revision = 1) {
  const suffix = revision > 1 ? `-R${revision}` : '';
  return {
    close: `CLOTURE-${period.fiscalYear}${suffix}`,
    opening: `OUVERTURE-${period.exerciceSuivant}${suffix}`
  };
}

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

async function lockFiscalPeriodWrites(executor, entrepriseId, dateDebut, dateFin) {
  const firstYear = Number(dateOnly(dateDebut).slice(0, 4));
  const lastYear = Number(dateOnly(dateFin).slice(0, 4));
  for (let year = firstYear; year <= lastYear; year += 1) {
    const key = `comptaorion:fiscal-write:${entrepriseId}:${year}`;
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }
}

async function latestOpeningDate(executor, entrepriseId, dateDebut) {
  const [opening] = await executor.select({
    dateEcriture: ecritures.dateEcriture
  }).from(ecritures)
    .innerJoin(journaux, eq(ecritures.journalId, journaux.id))
    .where(and(
      eq(ecritures.entrepriseId, entrepriseId),
      eq(journaux.entrepriseId, entrepriseId),
      eq(journaux.code, 'AN'),
      like(ecritures.numeroPiece, 'OUVERTURE-%'),
      lte(ecritures.dateEcriture, dateDebut)
    ))
    .orderBy(desc(ecritures.dateEcriture), desc(ecritures.id))
    .limit(1);
  return opening?.dateEcriture || null;
}

async function findLatestClosure(executor, entrepriseId, fiscalYear) {
  const [closure] = await executor.select().from(cloturesExercices).where(and(
    eq(cloturesExercices.entrepriseId, entrepriseId),
    eq(cloturesExercices.exercice, fiscalYear)
  )).orderBy(desc(cloturesExercices.revision)).limit(1);
  return closure || null;
}

async function findEarlierReopenedExercise(executor, entrepriseId, fiscalYear) {
  const result = await executor.execute(sql`
    SELECT c.exercice FROM clotures_exercices c
    WHERE c.entreprise_id = ${entrepriseId}
      AND c.exercice < ${fiscalYear}
      AND c.statut = 'reouvert'
      AND NOT EXISTS (
        SELECT 1 FROM clotures_exercices newer
        WHERE newer.entreprise_id = c.entreprise_id AND newer.exercice = c.exercice
          AND newer.revision > c.revision
      )
    ORDER BY c.exercice LIMIT 1
  `);
  return result.rows?.[0]?.exercice || null;
}

async function loadEntryForReversal(executor, entrepriseId, entryId, label) {
  if (!entryId) {
    throw Object.assign(new Error(`L’écriture ${label} est absente; la réouverture est impossible sans corriger d’abord la clôture.`), {
      statusCode: 409
    });
  }
  const [entry] = await executor.select().from(ecritures).where(and(
    eq(ecritures.id, entryId),
    eq(ecritures.entrepriseId, entrepriseId)
  )).limit(1);
  if (!entry) {
    throw Object.assign(new Error(`L’écriture ${label} est introuvable; la réouverture est impossible.`), {
      statusCode: 409
    });
  }
  const [journal] = await executor.select().from(journaux).where(and(
    eq(journaux.id, entry.journalId),
    eq(journaux.entrepriseId, entrepriseId)
  )).limit(1);
  if (!journal) {
    throw Object.assign(new Error(`Le journal de l’écriture ${label} est introuvable.`), {
      statusCode: 409
    });
  }
  const lines = await executor.select({
    compteComptableId: lignesEcritures.compteComptableId,
    debit: lignesEcritures.debit,
    credit: lignesEcritures.credit,
    libelle: lignesEcritures.libelle,
  }).from(lignesEcritures).where(and(
    eq(lignesEcritures.ecritureId, entry.id),
    eq(lignesEcritures.entrepriseId, entrepriseId)
  ));
  return { entry, journal, lines };
}

function reversedLines(lines) {
  return lines.map((line) => ({
    compteComptableId: line.compteComptableId,
    debitCents: Math.round(Number(line.credit || 0) * 100),
    creditCents: Math.round(Number(line.debit || 0) * 100),
    libelle: `Contrepassation — ${line.libelle || 'ligne comptable'}`
  }));
}

async function loadLedgerRows(executor, entrepriseId, dateFin, excludedEntryId = null) {
  const rows = await executor.select({
    dateEcriture: ecritures.dateEcriture,
    ecritureId: ecritures.id,
    compteComptableId: lignesEcritures.compteComptableId,
    numero: comptesComptables.numero,
    nom: comptesComptables.nom,
    debit: lignesEcritures.debit,
    credit: lignesEcritures.credit
  })
    .from(lignesEcritures)
    .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
    .innerJoin(comptesComptables, eq(lignesEcritures.compteComptableId, comptesComptables.id))
    .where(and(
      eq(ecritures.entrepriseId, entrepriseId),
      eq(comptesComptables.entrepriseId, entrepriseId),
      lte(ecritures.dateEcriture, dateFin)
    ));
  return excludedEntryId
    ? rows.filter((row) => Number(row.ecritureId) !== Number(excludedEntryId))
    : rows;
}

async function findOrCreateResultAccount(executor, entrepriseId, numero) {
  let [account] = await executor.select().from(comptesComptables).where(and(
    eq(comptesComptables.entrepriseId, entrepriseId),
    eq(comptesComptables.numero, numero)
  )).limit(1);
  if (account) return account;

  [account] = await executor.insert(comptesComptables).values({
    entrepriseId,
    numero,
    nom: numero === '120' ? 'Résultat de l’exercice (bénéfice)' : 'Résultat de l’exercice (perte)',
    type: 'detail',
    categorie: 'Capitaux propres',
    actif: true
  }).returning();
  return account;
}

function assertBalanced(lines, debitKey, creditKey, label) {
  const totals = lines.reduce((sum, line) => ({
    debit: sum.debit + line[debitKey],
    credit: sum.credit + line[creditKey]
  }), { debit: 0, credit: 0 });
  if (totals.debit !== totals.credit) {
    throw Object.assign(new Error(
      `${label} déséquilibrée : débit ${totals.debit} centimes, crédit ${totals.credit} centimes. Vérifiez les soldes avant de clôturer.`
    ), { statusCode: 409 });
  }
  return totals;
}

function toEntryLines(entrepriseId, ecritureId, lines) {
  return lines.map((line) => ({
    entrepriseId,
    ecritureId,
    compteComptableId: line.compteComptableId,
    debit: (line.debitCents / 100).toFixed(2),
    credit: (line.creditCents / 100).toFixed(2),
    libelle: line.libelle
  }));
}

async function createEntry(executor, {
  entrepriseId,
  journal,
  date,
  libelle,
  numeroPiece,
  userId,
  lines
}) {
  const numeroEcriture = await generateNumeroEcriture(
    entrepriseId,
    journal,
    new Date(`${date}T00:00:00.000Z`),
    executor
  );
  const [entry] = await executor.insert(ecritures).values({
    entrepriseId,
    journalId: journal.id,
    numeroEcriture,
    dateEcriture: new Date(`${date}T00:00:00.000Z`),
    libelle,
    numeroPiece,
    valide: true,
    userId: userId || null
  }).returning();

  if (lines.length) {
    await executor.insert(lignesEcritures).values(toEntryLines(entrepriseId, entry.id, lines));
  }
  return { entry, lineCount: lines.length };
}

router.get('/preview', async (req, res) => {
  try {
    const entrepriseId = Number(req.entrepriseId);
    const fiscalYear = Number(req.query.annee);
    if (!Number.isSafeInteger(entrepriseId) || entrepriseId <= 0) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9999) {
      return res.status(400).json({ error: 'Indiquez une année de début d’exercice valide.' });
    }

    const [entreprise] = await db.select({
      debutAnneeFiscale: entreprises.debutAnneeFiscale,
      finAnneeFiscale: entreprises.finAnneeFiscale
    }).from(entreprises).where(eq(entreprises.id, entrepriseId)).limit(1);
    if (!entreprise) return res.status(404).json({ error: 'Entreprise non trouvée.' });

    const basePeriod = fiscalPeriodFor(entreprise, fiscalYear);
    const latestClosure = await findLatestClosure(db, entrepriseId, fiscalYear);
    const earlierReopened = await findEarlierReopenedExercise(db, entrepriseId, fiscalYear);
    const period = {
      ...basePeriod,
      balanceStartDate: await latestOpeningDate(db, entrepriseId, basePeriod.dateDebut)
    };
    const excludedOpeningReversal = latestClosure?.statut === 'reouvert'
      ? latestClosure.ecritureContrepassationOuvertureId
      : null;
    const rows = await loadLedgerRows(db, entrepriseId, period.dateFin, excludedOpeningReversal);
    const previewResultAccount = {
      id: -1,
      numero: '120',
      nom: 'Résultat de l’exercice (bénéfice)'
    };
    const withoutResultAccount = calculateFiscalClosing(rows, period);
    const resultAccount = {
      ...previewResultAccount,
      numero: withoutResultAccount.compteResultatNumero,
      nom: withoutResultAccount.compteResultatNumero === '120'
        ? 'Résultat de l’exercice (bénéfice)'
        : 'Résultat de l’exercice (perte)'
    };
    const summary = calculateFiscalClosing(rows, period, resultAccount);
    const today = new Date().toISOString().slice(0, 10);
    const alreadyClosed = latestClosure?.statut === 'ferme';
    const endDateReached = period.dateFin <= today;
    const openingBalanced = summary.totalDebitOuvertureCents === summary.totalCreditOuvertureCents;

    return res.json({
      annee: fiscalYear,
      dateDebut: period.dateDebut,
      dateFin: period.dateFin,
      dateOuvertureSuivante: period.dateOuvertureSuivante,
      exerciceSuivant: period.exerciceSuivant,
      statut: latestClosure?.statut || 'ouvert',
      revision: latestClosure?.revision || null,
      derniereClotureLe: latestClosure?.fermeLe || null,
      reouvertLe: latestClosure?.reouvertLe || null,
      motifReouverture: latestClosure?.motifReouverture || null,
      comptesResultat: summary.comptesResultat,
      resultatNet: summary.resultatNet,
      typeResultat: summary.typeResultat,
      compteResultat: summary.compteResultatNumero,
      comptesBilan: summary.comptesBilan,
      nombreComptesOuverture: summary.lignesOuverture.length,
      totalDebitOuverture: summary.totalDebitOuvertureCents / 100,
      totalCreditOuverture: summary.totalCreditOuvertureCents / 100,
      openingBalanced,
      alreadyClosed,
      canClose: !alreadyClosed && !earlierReopened && endDateReached && openingBalanced,
      messageBlocage: alreadyClosed
        ? 'Cet exercice est fermé. Seul un administrateur peut le réouvrir.'
        : earlierReopened
          ? `Reclôturez d’abord l’exercice ${earlierReopened}, qui a été réouvert, pour rétablir ses soldes d’ouverture.`
        : latestClosure?.statut === 'reouvert'
          ? `Cet exercice a été réouvert le ${dateOnly(latestClosure.reouvertLe)}; il peut être clôturé de nouveau après les corrections.`
        : !endDateReached
          ? `La période se termine le ${period.dateFin}; elle ne peut pas encore être clôturée.`
          : !openingBalanced
            ? 'Le bilan d’ouverture prévisionnel ne s’équilibre pas. Vérifiez les écritures de l’exercice et les clôtures antérieures.'
          : null,
      message: summary.resultatNet >= 0
        ? `Bénéfice de ${summary.resultatNet.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à reporter sur le compte 120`
        : `Perte de ${Math.abs(summary.resultatNet).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} à reporter sur le compte 129`
    });
  } catch (error) {
    console.error('Erreur preview clôture exercice:', error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.get('/historique', async (req, res) => {
  try {
    const entrepriseId = Number(req.entrepriseId);
    if (!Number.isSafeInteger(entrepriseId) || entrepriseId <= 0) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    const history = await db.select({
      id: cloturesExercices.id,
      exercice: cloturesExercices.exercice,
      revision: cloturesExercices.revision,
      dateDebut: cloturesExercices.dateDebut,
      dateFin: cloturesExercices.dateFin,
      dateOuvertureSuivante: cloturesExercices.dateOuvertureSuivante,
      statut: cloturesExercices.statut,
      ecritureClotureId: cloturesExercices.ecritureClotureId,
      ecritureOuvertureId: cloturesExercices.ecritureOuvertureId,
      ecritureContrepassationClotureId: cloturesExercices.ecritureContrepassationClotureId,
      ecritureContrepassationOuvertureId: cloturesExercices.ecritureContrepassationOuvertureId,
      fermePar: cloturesExercices.fermePar,
      fermeLe: cloturesExercices.fermeLe,
      reouvertPar: cloturesExercices.reouvertPar,
      reouvertLe: cloturesExercices.reouvertLe,
      motifReouverture: cloturesExercices.motifReouverture,
    }).from(cloturesExercices).where(eq(cloturesExercices.entrepriseId, entrepriseId))
      .orderBy(desc(cloturesExercices.exercice), desc(cloturesExercices.revision));
    return res.json(history);
  } catch (error) {
    console.error('Erreur historique clôtures exercice:', error);
    return res.status(500).json({ error: 'Impossible de charger l’historique des exercices.' });
  }
});

router.post('/:annee/reouverture', async (req, res) => {
  try {
    const entrepriseId = Number(req.entrepriseId);
    const fiscalYear = Number(req.params.annee);
    const userId = Number(req.user?.id || req.userId);
    const reason = String(req.body?.motif || '').trim();
    if (!Number.isSafeInteger(entrepriseId) || entrepriseId <= 0) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Seul l’administrateur de l’entreprise peut réouvrir un exercice.' });
    }
    if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9999) {
      return res.status(400).json({ error: 'Indiquez une année de début d’exercice valide.' });
    }
    if (reason.length < 10 || reason.length > 500) {
      return res.status(400).json({ error: 'Indiquez un motif de réouverture de 10 à 500 caractères.' });
    }

    const result = await db.transaction(async (tx) => {
      const closureLockKey = `comptaorion:cloture:${entrepriseId}:${fiscalYear}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${closureLockKey}, 0))`);
      const [closure] = await tx.select().from(cloturesExercices).where(and(
        eq(cloturesExercices.entrepriseId, entrepriseId),
        eq(cloturesExercices.exercice, fiscalYear),
        eq(cloturesExercices.statut, 'ferme')
      )).orderBy(desc(cloturesExercices.revision)).limit(1);
      if (!closure) {
        throw Object.assign(new Error(`L’exercice ${fiscalYear} n’est pas actuellement fermé.`), { statusCode: 409 });
      }

      await lockFiscalPeriodWrites(tx, entrepriseId, closure.dateDebut, closure.dateOuvertureSuivante);
      const closing = await loadEntryForReversal(
        tx, entrepriseId, closure.ecritureClotureId, 'de clôture'
      );
      const opening = await loadEntryForReversal(
        tx, entrepriseId, closure.ecritureOuvertureId, 'd’ouverture'
      );

      const [reopened] = await tx.update(cloturesExercices).set({
        statut: 'reouvert',
        reouvertPar: Number.isSafeInteger(userId) && userId > 0 ? userId : null,
        reouvertLe: new Date(),
        motifReouverture: reason,
        updatedAt: new Date(),
      }).where(and(
        eq(cloturesExercices.id, closure.id),
        eq(cloturesExercices.entrepriseId, entrepriseId),
        eq(cloturesExercices.statut, 'ferme')
      )).returning();
      if (!reopened) {
        throw Object.assign(new Error('La clôture a changé pendant la demande. Rechargez l’historique et réessayez.'), {
          statusCode: 409
        });
      }

      const suffix = `R${closure.revision}`;
      const closingReversal = await createEntry(tx, {
        entrepriseId,
        journal: closing.journal,
        date: dateOnly(closing.entry.dateEcriture),
        libelle: `Contrepassation de la clôture de l’exercice ${fiscalYear}`,
        numeroPiece: `REOUVERTURE-CLOTURE-${fiscalYear}-${suffix}`,
        userId: Number.isSafeInteger(userId) && userId > 0 ? userId : null,
        lines: reversedLines(closing.lines),
      });
      const openingReversal = await createEntry(tx, {
        entrepriseId,
        journal: opening.journal,
        date: dateOnly(opening.entry.dateEcriture),
        libelle: `Contrepassation de l’ouverture de l’exercice ${fiscalYear + 1}`,
        numeroPiece: `REOUVERTURE-OUVERTURE-${fiscalYear}-${suffix}`,
        userId: Number.isSafeInteger(userId) && userId > 0 ? userId : null,
        lines: reversedLines(opening.lines),
      });
      const [reopenedWithReversals] = await tx.update(cloturesExercices).set({
        ecritureContrepassationClotureId: closingReversal.entry.id,
        ecritureContrepassationOuvertureId: openingReversal.entry.id,
        updatedAt: new Date(),
      }).where(and(
        eq(cloturesExercices.id, closure.id),
        eq(cloturesExercices.entrepriseId, entrepriseId)
      )).returning();

      await logAudit({
        ...extractAuditInfo(req),
        action: 'REOUVERTURE_EXERCICE',
        table: 'clotures_exercices',
        recordId: closure.id,
        ancienneValeur: closure,
        nouvelleValeur: {
          cloture: reopenedWithReversals || reopened,
          motif: reason,
          ecritureContrepassationCloture: closingReversal.entry.numeroEcriture,
          ecritureContrepassationOuverture: openingReversal.entry.numeroEcriture,
        },
        description: `Réouverture de l’exercice ${fiscalYear}: ${reason}`,
        executor: tx,
        required: true,
      });

      return {
        success: true,
        message: `L’exercice ${fiscalYear} est réouvert. Les écritures de clôture et d’ouverture ont été contrepassées.`,
        details: {
          exercice: fiscalYear,
          revision: closure.revision,
          motif: reason,
          ecritureContrepassationCloture: closingReversal.entry.numeroEcriture,
          ecritureContrepassationOuverture: openingReversal.entry.numeroEcriture,
        },
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Erreur réouverture exercice:', error);
    markClosedFiscalPeriodConflict(error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const entrepriseId = Number(req.entrepriseId);
    const fiscalYear = Number(req.body?.annee);
    if (!Number.isSafeInteger(entrepriseId) || entrepriseId <= 0) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9999) {
      return res.status(400).json({ error: 'Indiquez une année de début d’exercice valide.' });
    }

    const result = await db.transaction(async (tx) => {
      const lockKey = `comptaorion:cloture:${entrepriseId}:${fiscalYear}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

      const [entreprise] = await tx.select({
        debutAnneeFiscale: entreprises.debutAnneeFiscale,
        finAnneeFiscale: entreprises.finAnneeFiscale
      }).from(entreprises).where(eq(entreprises.id, entrepriseId)).limit(1);
      if (!entreprise) throw Object.assign(new Error('Entreprise non trouvée.'), { statusCode: 404 });

      const basePeriod = fiscalPeriodFor(entreprise, fiscalYear);
      await lockFiscalPeriodWrites(tx, entrepriseId, basePeriod.dateDebut, basePeriod.dateOuvertureSuivante);
      const period = {
        ...basePeriod,
        balanceStartDate: await latestOpeningDate(tx, entrepriseId, basePeriod.dateDebut)
      };
      const latestClosure = await findLatestClosure(tx, entrepriseId, fiscalYear);
      if (latestClosure?.statut === 'ferme') {
        throw Object.assign(new Error(
          `L’exercice ${fiscalYear} est déjà fermé. Aucune nouvelle écriture n’a été créée.`
        ), { statusCode: 409 });
      }
      const earlierReopened = await findEarlierReopenedExercise(tx, entrepriseId, fiscalYear);
      if (earlierReopened) {
        throw Object.assign(new Error(
          `Reclôturez d’abord l’exercice ${earlierReopened}, qui a été réouvert, pour rétablir ses soldes d’ouverture.`
        ), { statusCode: 409 });
      }
      const revision = Number(latestClosure?.revision || 0) + 1;
      const refs = closingReferences(period, revision);

      const today = new Date().toISOString().slice(0, 10);
      if (period.dateFin > today) {
        throw Object.assign(new Error(
          `La période se termine le ${period.dateFin}; elle ne peut pas encore être clôturée.`
        ), { statusCode: 400 });
      }

      const excludedOpeningReversal = latestClosure?.statut === 'reouvert'
        ? latestClosure.ecritureContrepassationOuvertureId
        : null;
      const rows = await loadLedgerRows(tx, entrepriseId, period.dateFin, excludedOpeningReversal);
      const firstPass = calculateFiscalClosing(rows, period);
      const resultAccount = firstPass.resultatNet === 0
        ? null
        : await findOrCreateResultAccount(tx, entrepriseId, firstPass.compteResultatNumero);
      const summary = calculateFiscalClosing(rows, period, resultAccount);
      assertBalanced(summary.lignesCloture, 'debitCents', 'creditCents', 'Écriture de clôture');
      assertBalanced(summary.lignesOuverture, 'debitCents', 'creditCents', 'Bilan d’ouverture');

      const [journalOD] = await tx.select().from(journaux).where(and(
        eq(journaux.entrepriseId, entrepriseId),
        eq(journaux.code, 'OD')
      )).limit(1);
      const [journalAN] = await tx.select().from(journaux).where(and(
        eq(journaux.entrepriseId, entrepriseId),
        eq(journaux.code, 'AN')
      )).limit(1);
      if (!journalOD || !journalAN) {
        throw Object.assign(new Error('Les journaux OD et AN doivent être configurés avant la clôture.'), { statusCode: 400 });
      }

      const closeEntry = await createEntry(tx, {
        entrepriseId,
        journal: journalOD,
        date: period.dateFin,
        libelle: `Clôture des comptes de résultat exercice ${fiscalYear}`,
        numeroPiece: refs.close,
        userId: req.user?.id || req.userId,
        lines: summary.lignesCloture
      });
      const openingEntry = await createEntry(tx, {
        entrepriseId,
        journal: journalAN,
        date: period.dateOuvertureSuivante,
        libelle: `Bilan d’ouverture exercice ${period.exerciceSuivant}`,
        numeroPiece: refs.opening,
        userId: req.user?.id || req.userId,
        lines: summary.lignesOuverture
      });

      const [closureRecord] = await tx.insert(cloturesExercices).values({
        entrepriseId,
        exercice: fiscalYear,
        revision,
        dateDebut: period.dateDebut,
        dateFin: period.dateFin,
        dateOuvertureSuivante: period.dateOuvertureSuivante,
        statut: 'ferme',
        ecritureClotureId: closeEntry.entry.id,
        ecritureOuvertureId: openingEntry.entry.id,
        fermePar: req.user?.id || req.userId || null,
        fermeLe: new Date(),
        updatedAt: new Date(),
      }).returning();

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CLOTURE_EXERCICE',
        table: 'clotures_exercices',
        recordId: closureRecord.id,
        nouvelleValeur: {
          cloture: closureRecord,
          annee: fiscalYear,
          dateDebut: period.dateDebut,
          dateFin: period.dateFin,
          resultatNet: summary.resultatNet,
          typeResultat: summary.typeResultat,
          compteResultat: summary.compteResultatNumero,
          ecritureCloture: closeEntry.entry.numeroEcriture,
          ecritureOuverture: openingEntry.entry.numeroEcriture
        },
        description: `Clôture de l’exercice ${fiscalYear} et ouverture de ${period.exerciceSuivant}`,
        executor: tx,
        required: true
      });

      return {
        success: true,
        message: `Exercice ${fiscalYear} clôturé et exercice ${period.exerciceSuivant} ouvert.`,
        details: {
          revision,
          dateDebut: period.dateDebut,
          dateFin: period.dateFin,
          dateOuvertureSuivante: period.dateOuvertureSuivante,
          resultatNet: summary.resultatNet,
          typeResultat: summary.typeResultat,
          compteResultat: summary.compteResultatNumero,
          ecritureCloture: {
            numero: closeEntry.entry.numeroEcriture,
            lignes: closeEntry.lineCount
          },
          ecritureOuverture: {
            numero: openingEntry.entry.numeroEcriture,
            lignes: openingEntry.lineCount,
            totalDebit: summary.totalDebitOuvertureCents / 100,
            totalCredit: summary.totalCreditOuvertureCents / 100
          }
        }
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Erreur clôture exercice:', error);
    markClosedFiscalPeriodConflict(error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
