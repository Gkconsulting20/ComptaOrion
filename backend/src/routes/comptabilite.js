import express from 'express';
import { db } from '../db.js';
import { 
  plansComptables, comptes, journaux, ecritures, lignesEcritures, 
  soldesComptes, auditLogs, entreprises 
} from '../schema.js';
import { eq, and, desc, gte, lte, sum, sql } from 'drizzle-orm';

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

    const conditions = [
      eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (compteId) conditions.push(eq(lignesEcritures.compteId, parseInt(compteId)));
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        id: lignesEcritures.id,
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type,
        description: lignesEcritures.description,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.reference
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

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

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée')
        )
      );

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
// RAPPORTS FINANCIERS
// ==========================================

// Bilan Comptable
router.get('/bilan', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;
    
    // Récupérer tous les comptes et leurs soldes
    const comptesData = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });

    // Calculer les soldes basés sur les écritures validées avec JOIN
    let query = db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée')
        )
      );
    
    if (dateDebut) {
      query = query.where(
        and(
          eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
          eq(ecritures.statut, 'validée'),
          gte(ecritures.dateEcriture, new Date(dateDebut))
        )
      );
    }
    if (dateFin) {
      const conditions = [
        eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
        eq(ecritures.statut, 'validée'),
        lte(ecritures.dateEcriture, new Date(dateFin))
      ];
      if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
      query = query.where(and(...conditions));
    }
    
    const lignes = await query;

    const soldesComptes = {};
    lignes.forEach(ligne => {
      if (!soldesComptes[ligne.compteId]) {
        soldesComptes[ligne.compteId] = 0;
      }
      if (ligne.type === 'debit') {
        soldesComptes[ligne.compteId] += parseFloat(ligne.montant);
      } else {
        soldesComptes[ligne.compteId] -= parseFloat(ligne.montant);
      }
    });

    // Classifier les comptes
    const bilan = {
      actif: {
        immobilisations: [],
        stocksCreances: [],
        tresorerie: [],
        total: 0
      },
      passif: {
        capitauxPropres: [],
        dettes: [],
        total: 0
      }
    };

    comptesData.forEach(compte => {
      const solde = soldesComptes[compte.id] || 0;
      const item = { compte: compte.numero, nom: compte.nom, montant: solde };

      if (compte.categorie === 'Actif') {
        if (compte.numero.startsWith('2')) bilan.actif.immobilisations.push(item);
        else if (compte.numero.startsWith('3') || compte.numero.startsWith('4')) bilan.actif.stocksCreances.push(item);
        else if (compte.numero.startsWith('5')) bilan.actif.tresorerie.push(item);
        bilan.actif.total += solde;
      } else if (compte.categorie === 'Passif' || compte.categorie === 'Capitaux propres') {
        if (compte.numero.startsWith('1')) bilan.passif.capitauxPropres.push(item);
        else bilan.passif.dettes.push(item);
        bilan.passif.total += Math.abs(solde);
      }
    });

    res.json(bilan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compte de Résultat
router.get('/compte-resultat', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;

    const comptesData = await db.query.comptes.findMany({
      where: eq(comptes.entrepriseId, parseInt(entrepriseId))
    });

    // Construire les conditions de filtrage
    const conditions = [
      eq(lignesEcritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const lignes = await db
      .select({
        compteId: lignesEcritures.compteId,
        montant: lignesEcritures.montant,
        type: lignesEcritures.type
      })
      .from(lignesEcritures)
      .innerJoin(ecritures, eq(lignesEcritures.ecritureId, ecritures.id))
      .where(and(...conditions));

    const soldesComptes = {};
    lignes.forEach(ligne => {
      if (!soldesComptes[ligne.compteId]) {
        soldesComptes[ligne.compteId] = 0;
      }
      if (ligne.type === 'debit') {
        soldesComptes[ligne.compteId] += parseFloat(ligne.montant);
      } else {
        soldesComptes[ligne.compteId] -= parseFloat(ligne.montant);
      }
    });

    const resultat = {
      produits: {
        ventesMarchandises: [],
        prestationsServices: [],
        autresProduits: [],
        total: 0
      },
      charges: {
        achats: [],
        services: [],
        personnel: [],
        autresCharges: [],
        total: 0
      },
      resultatNet: 0
    };

    comptesData.forEach(compte => {
      const solde = Math.abs(soldesComptes[compte.id] || 0);
      const item = { compte: compte.numero, nom: compte.nom, montant: solde };

      if (compte.categorie === 'Produits') {
        if (compte.numero.startsWith('70')) resultat.produits.ventesMarchandises.push(item);
        else if (compte.numero.startsWith('71') || compte.numero.startsWith('72')) resultat.produits.prestationsServices.push(item);
        else resultat.produits.autresProduits.push(item);
        resultat.produits.total += solde;
      } else if (compte.categorie === 'Charges') {
        if (compte.numero.startsWith('60')) resultat.charges.achats.push(item);
        else if (compte.numero.startsWith('61') || compte.numero.startsWith('62')) resultat.charges.services.push(item);
        else if (compte.numero.startsWith('63') || compte.numero.startsWith('64')) resultat.charges.personnel.push(item);
        else resultat.charges.autresCharges.push(item);
        resultat.charges.total += solde;
      }
    });

    resultat.resultatNet = resultat.produits.total - resultat.charges.total;

    res.json(resultat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rapport des Journaux
router.get('/rapport-journaux', async (req, res) => {
  try {
    const { entrepriseId, dateDebut, dateFin } = req.query;

    const conditions = [
      eq(ecritures.entrepriseId, parseInt(entrepriseId)),
      eq(ecritures.statut, 'validée')
    ];
    if (dateDebut) conditions.push(gte(ecritures.dateEcriture, new Date(dateDebut)));
    if (dateFin) conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));

    const ecrituresData = await db
      .select({
        id: ecritures.id,
        journalId: ecritures.journalId,
        dateEcriture: ecritures.dateEcriture,
        reference: ecritures.reference,
        description: ecritures.description,
        totalDebit: ecritures.totalDebit,
        totalCredit: ecritures.totalCredit
      })
      .from(ecritures)
      .where(and(...conditions));

    const journauxData = await db.query.journaux.findMany({
      where: eq(journaux.entrepriseId, parseInt(entrepriseId))
    });

    const rapportParJournal = {};
    journauxData.forEach(journal => {
      rapportParJournal[journal.id] = {
        code: journal.code,
        nom: journal.nom,
        ecritures: [],
        totalDebit: 0,
        totalCredit: 0,
        nombreEcritures: 0
      };
    });

    ecrituresData.forEach(ecriture => {
      if (rapportParJournal[ecriture.journalId]) {
        rapportParJournal[ecriture.journalId].ecritures.push(ecriture);
        rapportParJournal[ecriture.journalId].totalDebit += parseFloat(ecriture.totalDebit || 0);
        rapportParJournal[ecriture.journalId].totalCredit += parseFloat(ecriture.totalCredit || 0);
        rapportParJournal[ecriture.journalId].nombreEcritures++;
      }
    });

    res.json({
      journaux: Object.values(rapportParJournal),
      totaux: {
        debit: ecrituresData.reduce((sum, e) => sum + parseFloat(e.totalDebit || 0), 0),
        credit: ecrituresData.reduce((sum, e) => sum + parseFloat(e.totalCredit || 0), 0),
        nombreEcritures: ecrituresData.length
      }
    });
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
