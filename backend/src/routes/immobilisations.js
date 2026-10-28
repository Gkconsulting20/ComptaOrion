import express from 'express';
import { db } from '../db.js';
import { immobilisations, categoriesImmobilisations, amortissements, cessionsImmobilisations } from '../schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

// ==========================================
// CRUD CATÉGORIES IMMOBILISATIONS
// ==========================================

router.get('/categories', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const categories = await db.query.categoriesImmobilisations.findMany({
      where: eq(categoriesImmobilisations.entrepriseId, parseInt(entrepriseId))
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { nom, dureeVie, methodeAmortissement, compteAmortissement, compte } = req.body;
    const result = await db.transaction(async (tx) => {
      const [category] = await tx.insert(categoriesImmobilisations).values({
        entrepriseId: req.entrepriseId,
        nom,
        dureeVie: parseInt(dureeVie),
        methodeAmortissement,
        compteAmortissement,
        compte
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'categories_immobilisations',
        recordId: category.id,
        nouvelleValeur: category,
        description: `Catégorie d’immobilisation créée: ${category.nom}`,
        executor: tx,
        required: true
      });
      return category;
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD IMMOBILISATIONS
// ==========================================

router.get('/list', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const immobsList = await db.query.immobilisations.findMany({
      where: eq(immobilisations.entrepriseId, parseInt(entrepriseId))
    });
    res.json(immobsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { reference, description, categorieId, dateAcquisition, valeurAcquisition } = req.body;
    const immo = await db.transaction(async (tx) => {
      const [created] = await tx.insert(immobilisations).values({
        entrepriseId: req.entrepriseId,
        reference,
        description,
        categorieId: parseInt(categorieId),
        dateAcquisition: new Date(dateAcquisition),
        valeurAcquisition: parseFloat(valeurAcquisition),
        valeurNetteComptable: parseFloat(valeurAcquisition),
        amortissementCumule: 0,
        statut: 'actif'
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'immobilisations',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Immobilisation créée: ${created.reference}`,
        executor: tx,
        required: true
      });
      return created;
    });

    res.json(immo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CALCUL AMORTISSEMENT
// ==========================================

async function calculerAmortissementMensuel(entrepriseId, immobilisationId, mois) {
  try {
    const immo = await db.query.immobilisations.findFirst({
      where: eq(immobilisations.id, immobilisationId)
    });

    if (!immo || immo.statut !== 'actif') return null;

    const categorie = await db.query.categoriesImmobilisations.findFirst({
      where: eq(categoriesImmobilisations.id, immo.categorieId)
    });

    if (!categorie) return null;

    let amortissementMensuel = 0;

    if (categorie.methodeAmortissement === 'linéaire') {
      // Amortissement linéaire : Valeur / Durée de vie en mois
      amortissementMensuel = parseFloat(immo.valeurAcquisition) / (categorie.dureeVie * 12);
    } else if (categorie.methodeAmortissement === 'dégressif') {
      // Amortissement dégressif (1.5x ou 2x selon la durée)
      const tauxDegressif = categorie.dureeVie <= 5 ? 2 : 1.5;
      const tauxLinéaire = 1 / (categorie.dureeVie * 12);
      const valeurRestante = parseFloat(immo.valeurNetteComptable);
      amortissementMensuel = valeurRestante * tauxLinéaire * tauxDegressif;
    }

    return {
      immobilisationId,
      monthDate: new Date(),
      montant: parseFloat(amortissementMensuel).toFixed(2),
      methode: categorie.methodeAmortissement
    };
  } catch (error) {
    console.error('Erreur calcul amortissement:', error);
    return null;
  }
}

router.post('/calculer-amortissements', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    const resultats = await db.transaction(async (tx) => {
      const immobsList = await tx.select().from(immobilisations).where(and(
        eq(immobilisations.entrepriseId, eId),
        eq(immobilisations.statut, 'actif')
      )).for('update');
      const records = [];
      for (const immo of immobsList) {
        const [categorie] = await tx.select().from(categoriesImmobilisations).where(and(
          eq(categoriesImmobilisations.id, immo.categorieId),
          eq(categoriesImmobilisations.entrepriseId, eId)
        )).limit(1);
        if (!categorie) continue;

        let montant = 0;
        if (categorie.methodeAmortissement === 'linéaire') {
          montant = Number(immo.valeurAcquisition) / (Number(categorie.dureeVie) * 12);
        } else if (categorie.methodeAmortissement === 'dégressif') {
          const factor = Number(categorie.dureeVie) <= 5 ? 2 : 1.5;
          montant = Number(immo.valeurNetteComptable) / (Number(categorie.dureeVie) * 12) * factor;
        }
        if (!Number.isFinite(montant) || montant <= 0) continue;

        const [amort] = await tx.insert(amortissements).values({
          entrepriseId: eId,
          immobilisationId: immo.id,
          dateAmortissement: new Date(),
          montant: Number(montant.toFixed(2))
        }).returning();
        const [updated] = await tx.update(immobilisations).set({
          amortissementCumule: Number((Number(immo.amortissementCumule) + montant).toFixed(2)),
          valeurNetteComptable: Number((Number(immo.valeurNetteComptable) - montant).toFixed(2))
        }).where(and(
          eq(immobilisations.id, immo.id),
          eq(immobilisations.entrepriseId, eId)
        )).returning();

        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'amortissements',
          recordId: amort.id,
          nouvelleValeur: amort,
          description: `Amortissement enregistré pour ${immo.reference}`,
          executor: tx,
          required: true
        });
        await logAudit({
          ...extractAuditInfo(req),
          action: 'UPDATE',
          table: 'immobilisations',
          recordId: updated.id,
          ancienneValeur: immo,
          nouvelleValeur: updated,
          description: `Valeur nette mise à jour après amortissement: ${immo.reference}`,
          executor: tx,
          required: true
        });
        records.push(amort);
      }
      return records;
    });

    res.json({
      message: `${resultats.length} amortissements calculés et comptabilisés`,
      resultats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SORTIE / CESSION IMMOBILISATION
// ==========================================

router.post('/cession', async (req, res) => {
  try {
    const { immobilisationId, dateCession, prixVente } = req.body;
    const cession = await db.transaction(async (tx) => {
      const [immo] = await tx.select().from(immobilisations).where(and(
        eq(immobilisations.id, parseInt(immobilisationId)),
        eq(immobilisations.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!immo) return null;
      const gainPerte = parseFloat(prixVente) - parseFloat(immo.valeurNetteComptable);
      const [created] = await tx.insert(cessionsImmobilisations).values({
        entrepriseId: req.entrepriseId,
        immobilisationId: immo.id,
        dateCession: new Date(dateCession),
        valeurNetteComptable: immo.valeurNetteComptable,
        prixVente: parseFloat(prixVente),
        gainPerte,
        comptabilisee: false
      }).returning();
      const [updated] = await tx.update(immobilisations).set({
        statut: 'cédée',
        dateCession: new Date(dateCession)
      }).where(and(
        eq(immobilisations.id, immo.id),
        eq(immobilisations.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'cessions_immobilisations',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Cession enregistrée pour ${immo.reference}; gain/perte ${gainPerte}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'immobilisations',
        recordId: updated.id,
        ancienneValeur: immo,
        nouvelleValeur: updated,
        description: `Immobilisation cédée: ${immo.reference}`,
        executor: tx,
        required: true
      });
      return created;
    });
    if (!cession) return res.status(404).json({ error: 'Immobilisation non trouvée' });
    res.json(cession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// REGISTRE IMMOBILISATIONS
// ==========================================

router.get('/registre', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const eId = parseInt(entrepriseId);

    const registre = await db.query.immobilisations.findMany({
      where: eq(immobilisations.entrepriseId, eId)
    });

    const resultats = registre.map(immo => ({
      reference: immo.reference,
      description: immo.description,
      dateAcquisition: immo.dateAcquisition,
      valeurAcquisition: immo.valeurAcquisition,
      amortissementCumule: immo.amortissementCumule,
      valeurNetteComptable: immo.valeurNetteComptable,
      statut: immo.statut,
      dateCession: immo.dateCession
    }));

    res.json(resultats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
