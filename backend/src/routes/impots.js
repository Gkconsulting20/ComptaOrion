import express from 'express';
import { db } from '../db.js';
import { parametresFiscaux, declarationsFiscales } from '../schema.js';
import { eq, sql } from 'drizzle-orm';
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

// API pour récupérer les montants de TVA depuis les écritures comptables
router.get('/tva/resume', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    // Calculer TVA Collectée (compte 4431) - solde crédit
    const tvaCollecteeData = await db.execute(sql`
      SELECT COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) as montant
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE '4431%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    `);
    
    // Calculer TVA Déductible (compte 4452) - solde débit
    const tvaDeductibleData = await db.execute(sql`
      SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) as montant
      FROM lignes_ecriture le
      JOIN ecritures e ON le.ecriture_id = e.id
      JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
      WHERE e.entreprise_id = ${eId}
      AND cc.numero LIKE '4452%'
      ${dateDebut ? sql`AND e.date_ecriture >= ${dateDebut}` : sql``}
      ${dateFin ? sql`AND e.date_ecriture <= ${dateFin}` : sql``}
    `);
    
    const rowsCollectee = tvaCollecteeData.rows || tvaCollecteeData || [];
    const rowsDeductible = tvaDeductibleData.rows || tvaDeductibleData || [];
    
    const tvaCollectee = parseFloat(rowsCollectee[0]?.montant || 0);
    const tvaDeductible = parseFloat(rowsDeductible[0]?.montant || 0);
    const tvaADecaisser = tvaCollectee - tvaDeductible;
    
    res.json({
      success: true,
      periode: { dateDebut, dateFin },
      tvaCollectee,
      tvaDeductible,
      tvaADecaisser,
      creditTVA: tvaADecaisser < 0 ? Math.abs(tvaADecaisser) : 0
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

router.post('/declarations/tva', (_req, res) => res.status(501).json({
  success: false,
  message: 'La télédéclaration TVA n’est pas disponible. Aucun dépôt n’a été effectué.'
}));

// ==========================================
// PAIEMENT DES IMPÔTS
// ==========================================

router.post('/declarations/:id/payer', (_req, res) => res.status(501).json({
  success: false,
  message: 'Le paiement des impôts depuis ComptaOrion n’est pas disponible. Aucun paiement ni écriture comptable n’a été créé.'
}));

export default router;
