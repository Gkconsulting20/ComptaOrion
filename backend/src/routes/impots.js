import express from 'express';
import { db } from '../db.js';
import { parametresFiscaux, declarationsFiscales } from '../schema.js';
import { and, eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

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
  const tvaCollecteeData = await db.execute(sql`
    SELECT COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) as montant
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId}
      AND e.valide = true
      AND cc.numero LIKE '4431%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
  `);
  const tvaDeductibleData = await db.execute(sql`
    SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) as montant
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId}
      AND e.valide = true
      AND cc.numero LIKE '4452%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
  `);

  const rowsCollectee = tvaCollecteeData.rows || tvaCollecteeData || [];
  const rowsDeductible = tvaDeductibleData.rows || tvaDeductibleData || [];
  const tvaCollectee = Number(rowsCollectee[0]?.montant || 0);
  const tvaDeductible = Number(rowsDeductible[0]?.montant || 0);

  return {
    tvaCollectee,
    tvaDeductible,
    tvaADecaisser: tvaCollectee - tvaDeductible,
    creditTVA: Math.max(0, tvaDeductible - tvaCollectee)
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

    const [existing] = await db
      .select()
      .from(parametresFiscaux)
      .where(eq(parametresFiscaux.entrepriseId, req.entrepriseId))
      .limit(1);

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

    let savedParams;

    if (existing) {
      [savedParams] = await db
        .update(parametresFiscaux)
        .set(dataToSave)
        .where(eq(parametresFiscaux.id, existing.id))
        .returning();
    } else {
      [savedParams] = await db
        .insert(parametresFiscaux)
        .values(dataToSave)
        .returning();
    }

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
      source: 'écritures comptables',
      comptes: ['4431* (TVA collectée)', '4452* (TVA déductible)'],
      tvaCollectee: totals.tvaCollectee,
      tvaDeductible: totals.tvaDeductible,
      tvaADecaisser: totals.tvaADecaisser,
      creditTVA: totals.creditTVA,
      avertissement: 'Brouillon préparatoire uniquement; vérifier les comptes et le régime fiscal avant tout dépôt.'
    });
    const [draft] = await db
      .insert(declarationsFiscales)
      .values({
        entrepriseId: req.entrepriseId,
        type: 'tva',
        periode,
        montant: totals.tvaADecaisser.toFixed(2),
        statut: 'brouillon',
        notes
      })
      .returning();

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
    const [declaration] = await db
      .select()
      .from(declarationsFiscales)
      .where(and(
        eq(declarationsFiscales.id, declarationId),
        eq(declarationsFiscales.entrepriseId, req.entrepriseId)
      ))
      .limit(1);
    if (!declaration) {
      return res.status(404).json({ success: false, message: 'Déclaration introuvable.' });
    }
    if (declaration.type !== 'tva' || declaration.statut !== 'brouillon') {
      return res.status(400).json({ success: false, message: 'Seul un brouillon TVA peut être marqué comme déposé.' });
    }

    const [updated] = await db
      .update(declarationsFiscales)
      .set({
        statut: 'soumise',
        numeroDeclaration: numeroDeclaration.trim(),
        dateDeclaration,
        dateSoumission: new Date(),
        updatedAt: new Date()
      })
      .where(and(
        eq(declarationsFiscales.id, declaration.id),
        eq(declarationsFiscales.entrepriseId, req.entrepriseId)
      ))
      .returning();

    return res.json({
      success: true,
      message: 'Le dépôt manuel déclaré par l’utilisateur a été enregistré; aucune connexion à l’OTR n’a été effectuée.',
      data: updated
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
