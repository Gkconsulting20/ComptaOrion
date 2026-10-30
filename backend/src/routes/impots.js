import express from 'express';
import { db } from '../db.js';
import { parametresFiscaux, declarationsFiscales } from '../schema.js';
import { and, eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

const ENCRYPTION_KEY = process.env.FISCAL_ENCRYPTION_KEY;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const getEncryptionKey = () => {
  if (!ENCRYPTION_KEY) throw new Error('FISCAL_ENCRYPTION_KEY doit être configurée pour enregistrer des identifiants fiscaux');
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function calculerTva(entrepriseId, dateDebut, dateFin) {
  const [collecteeData, deductibleData] = await Promise.all([
    db.execute(sql`
    SELECT cc.numero AS "numero", cc.nom AS "nom",
      COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS "montant",
      COUNT(DISTINCT e.id)::int AS "nombreEcritures"
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId}
      AND e.valide = true
      AND cc.numero LIKE '443%'
      AND cc.numero NOT LIKE '4434%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    GROUP BY cc.numero, cc.nom
    ORDER BY cc.numero
  `),
    db.execute(sql`
    SELECT cc.numero AS "numero", cc.nom AS "nom",
      COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS "montant",
      COUNT(DISTINCT e.id)::int AS "nombreEcritures"
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId}
      AND e.valide = true
      AND cc.numero LIKE '445%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    GROUP BY cc.numero, cc.nom
    ORDER BY cc.numero
  `)
  ]);

  const comptesCollectee = collecteeData.rows || collecteeData || [];
  const comptesDeductible = deductibleData.rows || deductibleData || [];
  const tvaCollectee = comptesCollectee.reduce((sum, account) => sum + Number(account.montant || 0), 0);
  const tvaDeductible = comptesDeductible.reduce((sum, account) => sum + Number(account.montant || 0), 0);

  return {
    tvaCollectee,
    tvaDeductible,
    tvaADecaisser: tvaCollectee - tvaDeductible,
    creditTVA: Math.max(0, tvaDeductible - tvaCollectee),
    comptesCollectee,
    comptesDeductible
  };
}

async function getTvaMovements(entrepriseId, type, dateDebut, dateFin) {
  const collected = type === 'collectee';
  const accountFilter = collected
    ? sql`cc.numero LIKE '443%' AND cc.numero NOT LIKE '4434%'`
    : sql`cc.numero LIKE '445%'`;
  const result = await db.execute(sql`
    SELECT e.id AS "ecritureId", e.date_ecriture AS "date", j.code AS "journal",
      COALESCE(e.numero_piece, e.numero_ecriture) AS "reference", e.libelle AS "libelle",
      cc.numero AS "compteNumero", cc.nom AS "compteNom",
      le.debit AS "debit", le.credit AS "credit"
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN journaux j ON j.id = e.journal_id AND j.entreprise_id = e.entreprise_id
    JOIN comptes_comptables cc ON cc.id = le.compte_comptable_id
      AND cc.entreprise_id = e.entreprise_id
    WHERE e.entreprise_id = ${entrepriseId}
      AND e.valide = true
      AND ${accountFilter}
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    ORDER BY e.date_ecriture, e.id, le.id
  `);
  const rows = result.rows || result || [];
  let soldeCumule = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const mouvements = rows.map((row) => {
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);
    totalDebit += debit;
    totalCredit += credit;
    soldeCumule += collected ? credit - debit : debit - credit;
    return { ...row, debit, credit, soldeCumule };
  });
  return {
    mouvements,
    totaux: {
      totalDebit,
      totalCredit,
      solde: soldeCumule
    }
  };
}

// API pour récupérer les montants de TVA depuis les écritures comptables
router.get('/tva/resume', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    if ((dateDebut && !isValidISODate(dateDebut)) || (dateFin && !isValidISODate(dateFin))) {
      return res.status(400).json({ success: false, message: 'Les dates doivent être au format AAAA-MM-JJ.' });
    }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      return res.status(400).json({ success: false, message: 'La date de début doit précéder la date de fin.' });
    }
    const totals = await calculerTva(req.entrepriseId, dateDebut, dateFin);

    res.json({
      success: true,
      periode: { dateDebut, dateFin },
      ...totals
    });
  } catch (error) {
    console.error('Erreur GET /api/impots/tva/resume:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de la TVA',
      error: error.message
    });
  }
});

router.get('/tva/mouvements', async (req, res) => {
  try {
    const { type, dateDebut, dateFin } = req.query;
    if (!['collectee', 'deductible'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Le type doit être collectee ou deductible.' });
    }
    if ((dateDebut && !isValidISODate(dateDebut)) || (dateFin && !isValidISODate(dateFin))) {
      return res.status(400).json({ success: false, message: 'Les dates doivent être au format AAAA-MM-JJ.' });
    }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      return res.status(400).json({ success: false, message: 'La date de début doit précéder la date de fin.' });
    }
    const data = await getTvaMovements(req.entrepriseId, type, dateDebut, dateFin);
    return res.json({ success: true, periode: { dateDebut, dateFin }, ...data });
  } catch (error) {
    console.error('Erreur GET /api/impots/tva/mouvements:', error);
    return res.status(500).json({ success: false, message: 'Impossible de charger le détail des mouvements TVA.' });
  }
});

router.get('/is/resultat', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    if ((dateDebut && !isValidISODate(dateDebut)) || (dateFin && !isValidISODate(dateFin))) {
      return res.status(400).json({ success: false, message: 'Les dates doivent être au format AAAA-MM-JJ.' });
    }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      return res.status(400).json({ success: false, message: 'La date de début doit précéder la date de fin.' });
    }

    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN cc.numero LIKE '7%' THEN le.credit - le.debit ELSE 0 END), 0) AS produits,
        COALESCE(SUM(CASE WHEN cc.numero LIKE '6%' THEN le.debit - le.credit ELSE 0 END), 0) AS charges
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${req.entrepriseId}
        AND e.valide = true
        ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
        ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    `);
    const row = (result.rows || result || [])[0] || {};
    const produits = Number(row.produits || 0);
    const charges = Number(row.charges || 0);

    return res.json({
      success: true,
      periode: { dateDebut, dateFin },
      produits,
      charges,
      resultatComptable: produits - charges,
      nature: 'résultat comptable avant retraitements fiscaux'
    });
  } catch (error) {
    console.error('Erreur GET /api/impots/is/resultat:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul du résultat comptable',
      error: error.message
    });
  }
});

router.get('/parametres', async (req, res) => {
  try {
    const [params] = await db
      .select()
      .from(parametresFiscaux)
      .where(eq(parametresFiscaux.entrepriseId, req.entrepriseId))
      .limit(1);

    if (!params) {
      return res.json({
        success: true,
        data: null
      });
    }

    const paramsDecryptes = {
      ...params,
      apiCleSecrete: params.apiCleSecrete ? '••••••••' : null
    };

    res.json({
      success: true,
      data: paramsDecryptes
    });
  } catch (error) {
    console.error('Erreur GET /api/impots/parametres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paramètres fiscaux',
      error: error.message
    });
  }
});

router.post('/parametres', async (req, res) => {
  try {
    const {
      pays,
      administrationNom,
      numeroIFU,
      numeroNIF,
      centreImpots,
      regimeImposition,
      apiUrl,
      apiIdentifiant,
      apiCleSecrete
    } = req.body;

    if (!pays) {
      return res.status(400).json({
        success: false,
        message: 'Le pays est requis'
      });
    }

    const savedParams = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(parametresFiscaux)
        .where(eq(parametresFiscaux.entrepriseId, req.entrepriseId))
        .for('update').limit(1);
      const dataToSave = {
        entrepriseId: req.entrepriseId,
        pays,
        administrationNom,
        numeroIFU,
        numeroNIF,
        centreImpots,
        regimeImposition,
        apiUrl,
        apiIdentifiant,
        apiCleSecrete: apiCleSecrete && apiCleSecrete !== '••••••••' ? encrypt(apiCleSecrete) : existing?.apiCleSecrete,
        connexionActive: false,
        updatedAt: new Date()
      };
      const [saved] = existing
        ? await tx.update(parametresFiscaux).set(dataToSave)
            .where(eq(parametresFiscaux.id, existing.id)).returning()
        : await tx.insert(parametresFiscaux).values(dataToSave).returning();
      const safeValue = (value) => value ? { ...value, apiCleSecrete: value.apiCleSecrete ? '••••••••' : null } : value;
      await logAudit({
        ...extractAuditInfo(req),
        action: existing ? 'UPDATE' : 'CREATE',
        table: 'parametres_fiscaux',
        recordId: saved.id,
        ancienneValeur: safeValue(existing),
        nouvelleValeur: safeValue(saved),
        description: 'Paramètres fiscaux modifiés',
        executor: tx,
        required: true
      });
      return saved;
    });

    res.json({
      success: true,
      message: 'Paramètres fiscaux enregistrés avec succès',
      data: {
        ...savedParams,
        apiCleSecrete: savedParams.apiCleSecrete ? '••••••••' : null
      }
    });
  } catch (error) {
    console.error('Erreur POST /api/impots/parametres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement des paramètres fiscaux',
      error: error.message
    });
  }
});

router.post('/parametres/tester-connexion', (_req, res) => res.status(501).json({
  success: false,
  message: 'La connexion aux administrations fiscales n’est pas encore intégrée.'
}));

router.get('/declarations', async (req, res) => {
  try {
    const declarations = await db
      .select()
      .from(declarationsFiscales)
      .where(eq(declarationsFiscales.entrepriseId, req.entrepriseId))
      .orderBy(sql`${declarationsFiscales.createdAt} DESC`)
      .limit(50);

    res.json({
      success: true,
      count: declarations.length,
      data: declarations
    });
  } catch (error) {
    console.error('Erreur GET /api/impots/declarations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des déclarations',
      error: error.message
    });
  }
});

router.post('/declarations/tva', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.body;
    if (!isValidISODate(dateDebut) || !isValidISODate(dateFin) || dateDebut > dateFin) {
      return res.status(400).json({
        success: false,
        message: 'Indiquez une période valide avec une date de début et de fin au format AAAA-MM-JJ.'
      });
    }

    const [taxProfile] = await db
      .select()
      .from(parametresFiscaux)
      .where(eq(parametresFiscaux.entrepriseId, req.entrepriseId))
      .limit(1);
    if (taxProfile?.pays?.toLowerCase() !== 'togo') {
      return res.status(400).json({
        success: false,
        message: 'Configurez d’abord le pays Togo dans les paramètres fiscaux. Le calcul ne couvre actuellement que le Togo.'
      });
    }

    const periode = `${dateDebut}..${dateFin}`;
    const [existingDraft] = await db
      .select()
      .from(declarationsFiscales)
      .where(and(
        eq(declarationsFiscales.entrepriseId, req.entrepriseId),
        eq(declarationsFiscales.type, 'tva'),
        eq(declarationsFiscales.periode, periode)
      ))
      .limit(1);
    if (existingDraft) {
      return res.status(409).json({
        success: false,
        message: 'Un dossier TVA existe déjà pour cette période.',
        data: existingDraft
      });
    }

    const totals = await calculerTva(req.entrepriseId, dateDebut, dateFin);
    const notes = JSON.stringify({
      version: 1,
      pays: 'togo',
      dateDebut,
      dateFin,
      source: 'écritures comptables validées',
      comptes: {
        tvaCollectee: '443* hors 4434 (TVA facturée)',
        tvaDeductible: '445* (TVA récupérable)',
        detailCollectee: totals.comptesCollectee,
        detailDeductible: totals.comptesDeductible
      },
      tvaCollectee: totals.tvaCollectee,
      tvaDeductible: totals.tvaDeductible,
      tvaADecaisser: totals.tvaADecaisser,
      creditTVA: totals.creditTVA,
      avertissement: 'Dossier préparatoire uniquement; vérifier le régime, les pièces, les comptes et les règles OTR applicables avant tout dépôt.'
    });
    const draft = await db.transaction(async (tx) => {
      const [created] = await tx.insert(declarationsFiscales).values({
        entrepriseId: req.entrepriseId,
        type: 'tva',
        periode,
        montant: totals.tvaADecaisser.toFixed(2),
        statut: 'brouillon',
        notes
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'declarations_fiscales',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Brouillon de déclaration TVA créé pour ${periode}`,
        executor: tx,
        required: true
      });
      return created;
    });

    return res.status(201).json({
      success: true,
      message: 'Brouillon TVA créé. Aucun dépôt ni paiement n’a été effectué.',
      data: draft
    });
  } catch (error) {
    console.error('Erreur POST /api/impots/declarations/tva:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la préparation du brouillon TVA',
      error: error.message
    });
  }
});

router.post('/declarations/:id/depot-manuel', async (req, res) => {
  try {
    const { numeroDeclaration, dateDeclaration } = req.body;
    if (typeof numeroDeclaration !== 'string' || !numeroDeclaration.trim() || !isValidISODate(dateDeclaration)) {
      return res.status(400).json({
        success: false,
        message: 'La référence OTR et la date réelle du dépôt sont obligatoires.'
      });
    }

    const declarationId = Number(req.params.id);
    if (!Number.isSafeInteger(declarationId) || declarationId <= 0) {
      return res.status(400).json({ success: false, message: 'Identifiant de déclaration invalide.' });
    }
    const result = await db.transaction(async (tx) => {
      const [declaration] = await tx.select().from(declarationsFiscales).where(and(
        eq(declarationsFiscales.id, declarationId),
        eq(declarationsFiscales.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!declaration) return { status: 404 };
      if (declaration.type !== 'tva' || declaration.statut !== 'brouillon') return { status: 400 };
      const [updated] = await tx.update(declarationsFiscales).set({
        statut: 'soumise',
        numeroDeclaration: numeroDeclaration.trim(),
        dateDeclaration,
        dateSoumission: new Date(),
        updatedAt: new Date()
      }).where(and(
        eq(declarationsFiscales.id, declaration.id),
        eq(declarationsFiscales.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'declarations_fiscales',
        recordId: updated.id,
        ancienneValeur: declaration,
        nouvelleValeur: updated,
        description: `Dépôt manuel déclaré pour la période ${declaration.periode}`,
        executor: tx,
        required: true
      });
      return { status: 200, updated };
    });
    if (result.status !== 200) {
      return res.status(result.status).json({
        success: false,
        message: result.status === 404 ? 'Déclaration introuvable.' : 'Seul un brouillon TVA peut être marqué comme déposé.'
      });
    }

    return res.json({
      success: true,
      message: 'Le dépôt manuel déclaré par l’utilisateur a été enregistré; aucune connexion à l’OTR n’a été effectuée.',
      data: result.updated
    });
  } catch (error) {
    console.error('Erreur POST /api/impots/declarations/:id/depot-manuel:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’enregistrement du dépôt manuel',
      error: error.message
    });
  }
});

// ==========================================
// PAIEMENT DES IMPÔTS
// ==========================================

router.post('/declarations/:id/payer', (_req, res) => res.status(501).json({
  success: false,
  message: 'Le paiement des impôts depuis ComptaOrion n’est pas disponible. Aucun paiement ni écriture comptable n’a été créé.'
}));

export default router;
