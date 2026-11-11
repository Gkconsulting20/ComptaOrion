import express from 'express';
import { and, desc, eq, like, lte, or, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { comptesComptables, ecritures, journaux, lignesEcritures, entreprises } from '../schema.js';
import { generateNumeroEcriture } from '../services/comptabiliteService.js';
import { calculateFiscalClosing, getFiscalPeriodForYear } from '../services/fiscalYearClosing.js';
import { extractAuditInfo, logAudit } from '../utils/auditLogger.js';

const router = express.Router();

function fiscalPeriodFor(entreprise, fiscalYear) {
  const start = entreprise.debutAnneeFiscale || `${fiscalYear}-01-01`;
  const end = entreprise.finAnneeFiscale || `${fiscalYear}-12-31`;
  return getFiscalPeriodForYear(start, end, fiscalYear);
}

function closingReferences(period) {
  return {
    close: `CLOTURE-${period.fiscalYear}`,
    opening: `OUVERTURE-${period.exerciceSuivant}`
  };
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

async function findExistingClosure(executor, entrepriseId, period) {
  const refs = closingReferences(period);
  const [existing] = await executor.select({
    id: ecritures.id,
    numeroPiece: ecritures.numeroPiece
  }).from(ecritures).where(and(
    eq(ecritures.entrepriseId, entrepriseId),
    or(eq(ecritures.numeroPiece, refs.close), eq(ecritures.numeroPiece, refs.opening))
  )).limit(1);
  return existing || null;
}

async function loadLedgerRows(executor, entrepriseId, dateFin) {
  return executor.select({
    dateEcriture: ecritures.dateEcriture,
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
    const period = {
      ...basePeriod,
      balanceStartDate: await latestOpeningDate(db, entrepriseId, basePeriod.dateDebut)
    };
    const existing = await findExistingClosure(db, entrepriseId, period);
    const rows = await loadLedgerRows(db, entrepriseId, period.dateFin);
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
    const alreadyClosed = Boolean(existing);
    const endDateReached = period.dateFin <= today;
    const openingBalanced = summary.totalDebitOuvertureCents === summary.totalCreditOuvertureCents;

    return res.json({
      annee: fiscalYear,
      dateDebut: period.dateDebut,
      dateFin: period.dateFin,
      dateOuvertureSuivante: period.dateOuvertureSuivante,
      exerciceSuivant: period.exerciceSuivant,
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
      canClose: !alreadyClosed && endDateReached && openingBalanced,
      messageBlocage: alreadyClosed
        ? 'Cet exercice a déjà une écriture de clôture ou une écriture d’ouverture associée.'
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
      const period = {
        ...basePeriod,
        balanceStartDate: await latestOpeningDate(tx, entrepriseId, basePeriod.dateDebut)
      };
      const refs = closingReferences(period);
      const existing = await findExistingClosure(tx, entrepriseId, period);
      if (existing) {
        throw Object.assign(new Error(
          `Clôture déjà enregistrée (${existing.numeroPiece}). Aucune nouvelle écriture n’a été créée.`
        ), { statusCode: 409 });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (period.dateFin > today) {
        throw Object.assign(new Error(
          `La période se termine le ${period.dateFin}; elle ne peut pas encore être clôturée.`
        ), { statusCode: 400 });
      }

      const rows = await loadLedgerRows(tx, entrepriseId, period.dateFin);
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

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CLOTURE_EXERCICE',
        table: 'ecritures',
        nouvelleValeur: {
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
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
