import express from 'express';
import { db } from '../db.js';
import { depenses, categoriesDépenses, approvalsDépenses, remboursementsEmployes, auditLogs } from '../schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const router = express.Router();

// ==========================================
// CRUD CATÉGORIES DÉPENSES
// ==========================================

router.get('/categories', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const categories = await db.query.categoriesDépenses.findMany({
      where: eq(categoriesDépenses.entrepriseId, parseInt(entrepriseId))
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { entrepriseId, nom, description, limiteApproval } = req.body;
    const result = await db.insert(categoriesDépenses).values({
      entrepriseId: parseInt(entrepriseId),
      nom,
      description,
      limiteApproval: parseFloat(limiteApproval) || 0
    }).returning();
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ENREGISTREMENT DÉPENSES
// ==========================================

router.post('/create', async (req, res) => {
  try {
    const { entrepriseId, employeId, categorieId, montant, dateDepense, description, justificatifUrl, récurrente, fréquenceRécurrence, userId, ipAddress } = req.body;
    
    const depense = await db.insert(depenses).values({
      entrepriseId: parseInt(entrepriseId),
      employeId: parseInt(employeId),
      categorieId: parseInt(categorieId),
      montant: parseFloat(montant),
      dateDepense: new Date(dateDepense),
      description,
      justificatifUrl,
      récurrente: récurrente || false,
      fréquenceRécurrence,
      statut: 'en_attente',
      montantApprouve: 0
    }).returning();

    // Créer demande d'approbation initiale
    await db.insert(approvalsDépenses).values({
      entrepriseId: parseInt(entrepriseId),
      depenseId: depense[0].id,
      etape: 'manager',
      statut: 'en_attente'
    });

    // Audit
    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'depenses',
      recordId: depense[0].id,
      description: `Dépense créée: ${description} (${montant} FCFA)`,
      ipAddress
    });

    res.json(depense[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { entrepriseId, employeId } = req.query;
    const where = [eq(depenses.entrepriseId, parseInt(entrepriseId))];
    if (employeId) where.push(eq(depenses.employeId, parseInt(employeId)));

    const depensesList = await db.query.depenses.findMany({
      where: and(...where)
    });
    res.json(depensesList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WORKFLOW D'APPROBATION
// ==========================================

router.post('/approve/:depenseId/:etape', async (req, res) => {
  try {
    const { depenseId, etape } = req.params;
    const { statut, raison, userId } = req.body;
    const depenseId_int = parseInt(depenseId);

    const depense = await db.query.depenses.findFirst({
      where: eq(depenses.id, depenseId_int)
    });

    if (!depense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Mettre à jour approbation
    const approval = await db.update(approvalsDépenses).set({
      statut: statut, // approuvée, rejetée
      dateApprobation: new Date(),
      approbateurId: userId,
      raison
    }).where(
      and(
        eq(approvalsDépenses.depenseId, depenseId_int),
        eq(approvalsDépenses.etape, etape)
      )
    ).returning();

    // Si rejetée, changer statut dépense
    if (statut === 'rejetée') {
      await db.update(depenses).set({
        statut: 'rejetée'
      }).where(eq(depenses.id, depenseId_int));
      
      return res.json({ message: 'Dépense rejetée' });
    }

    // Déterminer prochaine étape
    let prochainEtape = null;
    if (etape === 'manager') prochainEtape = 'comptable';

    if (prochainEtape) {
      await db.insert(approvalsDépenses).values({
        entrepriseId: depense.entrepriseId,
        depenseId: depenseId_int,
        etape: prochainEtape,
        statut: 'en_attente'
      });
    } else {
      // Toutes les approbations terminées
      await db.update(depenses).set({
        statut: 'approuvée',
        montantApprouve: depense.montant
      }).where(eq(depenses.id, depenseId_int));
    }

    res.json({ message: `Dépense approuvée pour l'étape: ${etape}`, approval: approval[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// REMBOURSEMENT EMPLOYÉS
// ==========================================

router.post('/remboursement', async (req, res) => {
  try {
    const { entrepriseId, depenseId, montantRembourse, dateRemboursement, methodePaiement, userId } = req.body;

    const depense = await db.query.depenses.findFirst({
      where: eq(depenses.id, parseInt(depenseId))
    });

    if (!depense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Créer remboursement
    const remboursement = await db.insert(remboursementsEmployes).values({
      entrepriseId: parseInt(entrepriseId),
      depenseId: parseInt(depenseId),
      montantRembourse: parseFloat(montantRembourse),
      dateRemboursement: new Date(dateRemboursement),
      methodePaiement,
      statut: 'complété'
    }).returning();

    // Mettre à jour montant remboursé dans dépense
    const totalRembourse = (depense.montantRembourse || 0) + parseFloat(montantRembourse);
    await db.update(depenses).set({
      montantRembourse: totalRembourse,
      statut: totalRembourse >= depense.montantApprouve ? 'remboursée' : 'partiellement_remboursée'
    }).where(eq(depenses.id, parseInt(depenseId)));

    res.json(remboursement[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EXPORT EXCEL/CSV
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const { entrepriseId, format = 'json' } = req.query;

    const dépensesList = await db.query.depenses.findMany({
      where: eq(depenses.entrepriseId, parseInt(entrepriseId))
    });

    if (format === 'csv') {
      const headers = 'Date,Employé,Catégorie,Montant,Description,Statut,Montant Remboursé\n';
      const rows = dépensesList.map(d =>
        `"${d.dateDepense}","${d.employeId}","${d.categorieId}","${d.montant}","${d.description}","${d.statut}","${d.montantRembourse || 0}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dépenses.csv"');
      res.send(headers + rows);
    } else {
      res.json(dépensesList);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
