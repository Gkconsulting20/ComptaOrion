import express from 'express';
import { db } from '../db.js';
import { 
  plansComptables, comptes, journaux, ecritures, lignesEcritures, 
  soldesComptes, auditLogs, entreprises 
} from '../schema.js';
import { eq, and, desc, gte, lte, sum } from 'drizzle-orm';

const router = express.Router();

// ==========================================
// GESTION DU PLAN COMPTABLE
// ==========================================

router.get('/plans', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const plans = await db.query.plansComptables.findMany({
      where: eq(plansComptables.entrepriseId, parseInt(entrepriseId))
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { entrepriseId, nom, systeme, description } = req.body;
    const plan = await db.insert(plansComptables).values({
      entrepriseId: parseInt(entrepriseId),
      nom,
      systeme, // SYSCOHADA, IFRS, PCG
      description,
      actif: true
    }).returning();
    res.json(plan[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD COMPTES COMPTABLES
// ==========================================

router.post('/comptes', async (req, res) => {
  try {
    const { entrepriseId, numero, nom, categorie, sousCategorie, devise, userId, ipAddress } = req.body;

    const compte = await db.insert(comptes).values({
      entrepriseId: parseInt(entrepriseId),
      numero,
      nom,
      categorie, // Actif, Passif, Capitaux propres, Charges, Produits
      sousCategorie,
      devise: devise || 'XOF',
      solde: 0,
      actif: true
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'comptes',
      recordId: compte[0].id,
      description: `Compte créé: ${numero} - ${nom}`,
      ipAddress
    });

    res.json(compte[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/comptes', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const accounts = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GESTION DES JOURNAUX
// ==========================================

router.post('/journaux', async (req, res) => {
  try {
    const { entrepriseId, code, nom, type } = req.body;
    const journal = await db.insert(journaux).values({
      entrepriseId: parseInt(entrepriseId),
      code,
      nom,
      type, // Achats, Ventes, Banque, Caisse, OD
      actif: true
    }).returning();
    res.json(journal[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/journaux', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const journals = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, parseInt(entrepriseId))
    });
    res.json(journals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRÉATION D'ÉCRITURES COMPTABLES
// ==========================================

router.post('/ecritures', async (req, res) => {
  try {
    const { entrepriseId, journalId, dateEcriture, reference, description, userId, ipAddress } = req.body;

    const ecriture = await db.insert(ecritures).values({
      entrepriseId: parseInt(entrepriseId),
      journalId: parseInt(journalId),
      dateEcriture: new Date(dateEcriture),
      reference,
      description,
      statut: 'brouillon',
      totalDebit: 0,
      totalCredit: 0
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'ecritures',
      recordId: ecriture[0].id,
      description: `Écriture créée: ${reference}`,
      ipAddress
    });

    res.json(ecriture[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ecritures', async (req, res) => {
  try {
    const { entrepriseId, journalId } = req.query;
    const where = [eq(ecritures.entrepriseId, parseInt(entrepriseId))];
    if (journalId) where.push(eq(ecritures.journalId, parseInt(journalId)));

    const entries = await db.query.ecritures.findMany({
      where: and(...where),
      orderBy: desc(ecritures.dateEcriture)
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// LIGNES D'ÉCRITURES (DÉBIT/CRÉDIT)
// ==========================================

router.post('/lignes', async (req, res) => {
  try {
    const { entrepriseId, ecritureId, compteId, montant, type, description } = req.body;

    const ligne = await db.insert(lignesEcritures).values({
      entrepriseId: parseInt(entrepriseId),
      ecritureId: parseInt(ecritureId),
      compteId: parseInt(compteId),
      montant: parseFloat(montant),
      type, // debit ou credit
      description
    }).returning();

    // Mettre à jour totaux de l'écriture
    const ecriture = await db.query.ecritures.findFirst({
      where: eq(ecritures.id, parseInt(ecritureId))
    });

    const lignes = await db.query.lignesEcritures.findMany({
      where: eq(lignesEcritures.ecritureId, parseInt(ecritureId))
    });

    let totalDebit = 0, totalCredit = 0;
    lignes.forEach(l => {
      if (l.type === 'debit') totalDebit += parseFloat(l.montant);
      else totalCredit += parseFloat(l.montant);
    });

    await db.update(ecritures).set({
      totalDebit,
      totalCredit
    }).where(eq(ecritures.id, parseInt(ecritureId)));

    res.json(ligne[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/lignes/:ecritureId', async (req, res) => {
  try {
    const { ecritureId } = req.params;
    const lines = await db.query.lignesEcritures.findMany({
      where: eq(lignesEcritures.ecritureId, parseInt(ecritureId))
    });
    res.json(lines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VALIDATION & MODIFICATION
// ==========================================

router.post('/ecritures/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;
    const ecriture = await db.query.ecritures.findFirst({
      where: eq(ecritures.id, parseInt(id))
    });

    if (!ecriture) return res.status(404).json({ error: 'Écriture non trouvée' });

    // Vérifier l'équilibre (débit = crédit)
    if (parseFloat(ecriture.totalDebit) !== parseFloat(ecriture.totalCredit)) {
      return res.status(400).json({ error: 'Écriture non équilibrée', debit: ecriture.totalDebit, credit: ecriture.totalCredit });
    }

    const updated = await db.update(ecritures).set({
      statut: 'validée'
    }).where(eq(ecritures.id, parseInt(id))).returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateEcriture, reference, description, userId } = req.body;

    const updated = await db.update(ecritures).set({
      dateEcriture: dateEcriture ? new Date(dateEcriture) : undefined,
      reference,
      description
    }).where(eq(ecritures.id, parseInt(id))).returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/ecritures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ipAddress } = req.body;

    // Supprimer les lignes d'abord
    await db.delete(lignesEcritures).where(eq(lignesEcritures.ecritureId, parseInt(id)));

    // Puis l'écriture
    await db.delete(ecritures).where(eq(ecritures.id, parseInt(id)));

    res.json({ message: 'Écriture supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GRAND LIVRE
// ==========================================

router.get('/grand-livre', async (req, res) => {
  try {
    const { entrepriseId, compteId, dateDebut, dateFin } = req.query;

    const where = [
      eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (compteId) where.push(eq(lignesEcritures.compteId, parseInt(compteId)));
    if (dateDebut) where.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) where.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db.query.lignesEcritures.findMany({
      where: and(...where),
      orderBy: [lignesEcritures.compteId, ecritures.dateEcriture]
    });

    res.json(lignes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// BALANCE GÉNÉRALE
// ==========================================

router.get('/balance', async (req, res) => {
  try {
    const { entrepriseId } = req.query;

    const lignes = await db.query.lignesEcritures.findMany({
      where: and(
        eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
        eq(ecritures.statut, 'validée')
      )
    });

    const balance = {};
    lignes.forEach(ligne => {
      if (!balance[ligne.compteId]) {
        balance[ligne.compteId] = { debit: 0, credit: 0 };
      }
      if (ligne.type === 'debit') {
        balance[ligne.compteId].debit += parseFloat(ligne.montant);
      } else {
        balance[ligne.compteId].credit += parseFloat(ligne.montant);
      }
    });

    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EXPORT
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const { entrepriseId, type } = req.query; // type: ecritures, grand-livre, balance

    if (type === 'ecritures') {
      const entries = await db.query.ecritures.findMany({
        where: eq(ecritures.entrepriseId, parseInt(entrepriseId))
      });
      const headers = 'Date,Journal,Référence,Description,Débit,Crédit,Statut\n';
      const rows = entries.map(e =>
        `"${e.dateEcriture}","${e.journalId}","${e.reference}","${e.description}","${e.totalDebit}","${e.totalCredit}","${e.statut}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ecritures.csv"');
      res.send(headers + rows);
    }
    res.json({ message: 'Export généré' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
