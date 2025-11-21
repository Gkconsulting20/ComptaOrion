import { Router } from 'express';
import { db } from '../db.js';
import { transactionsTresorerie, comptesBancaires } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = Router();

// GET solde caisse disponible (calcul automatique)
router.get('/solde/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    
    // Calculer solde automatique à partir des transactions
    const transactions = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId)));
    
    let soldeTotal = 0;
    transactions.forEach(t => {
      if (t.type === 'encaissement') {
        soldeTotal += parseFloat(t.montant || 0);
      } else if (t.type === 'decaissement') {
        soldeTotal -= parseFloat(t.montant || 0);
      }
    });
    
    res.json({ soldeTotal, devise: 'XOF' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET toutes les transactions trésorerie
router.get('/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const transactions = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId)));
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer encaissement (argent qui rentre)
router.post('/encaissement', async (req, res) => {
  try {
    const { entrepriseId, description, montant, date, referenceFacture } = req.body;
    
    const result = await db.insert(transactionsTresorerie).values({
      entrepriseId: parseInt(entrepriseId),
      type: 'encaissement',
      description,
      montant: parseFloat(montant),
      date: new Date(date),
      referenceFacture,
      statut: 'validee',
      createdAt: new Date()
    }).returning();
    
    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer décaissement (argent qui sort)
router.post('/decaissement', async (req, res) => {
  try {
    const { entrepriseId, description, montant, date, referenceFournisseur } = req.body;
    
    const result = await db.insert(transactionsTresorerie).values({
      entrepriseId: parseInt(entrepriseId),
      type: 'decaissement',
      description,
      montant: parseFloat(montant),
      date: new Date(date),
      referenceFournisseur,
      statut: 'validee',
      createdAt: new Date()
    }).returning();
    
    res.status(201).json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET comptes bancaires
router.get('/comptes/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const comptes = await db.select().from(comptesBancaires)
      .where(eq(comptesBancaires.entrepriseId, parseInt(entrepriseId)));
    res.json(comptes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
