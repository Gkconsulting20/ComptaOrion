import { Router } from 'express';
import { db } from '../db.js';
import { transactionsTresorerie, comptesBancaires, factures, facturesAchat, employes, comptesComptables } from '../schema.js';
import { eq, and, like } from 'drizzle-orm';

const router = Router();

// GET solde caisse + banque avec solde initial
router.get('/comptes/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const comptes = await db.select().from(comptesBancaires)
      .where(eq(comptesBancaires.entrepriseId, parseInt(entrepriseId)));
    
    const comptesAvecMouvements = await Promise.all(comptes.map(async (compte) => {
      const mouvements = await db.select().from(transactionsTresorerie)
        .where(and(
          eq(transactionsTresorerie.compteBancaireId, compte.id),
          eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId))
        ));
      
      let soldeCalcule = parseFloat(compte.soldeInitial || 0);
      mouvements.forEach(m => {
        if (m.type === 'encaissement') {
          soldeCalcule += parseFloat(m.montant || 0);
        } else if (m.type === 'decaissement') {
          soldeCalcule -= parseFloat(m.montant || 0);
        }
      });
      
      return {
        ...compte,
        soldeInitial: parseFloat(compte.soldeInitial || 0),
        soldeActuel: soldeCalcule,
        mouvementsCount: mouvements.length
      };
    }));
    
    res.json(comptesAvecMouvements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET mouvements trésorerie par catégorie
router.get('/mouvements/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId, categorie } = req.query;
    const query = eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId));
    const mouvements = await db.select().from(transactionsTresorerie)
      .where(query);
    res.json(mouvements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET encaissements
router.get('/encaissements/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const encaissements = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId)),
        eq(transactionsTresorerie.type, 'encaissement')
      ));
    
    const total = encaissements.reduce((sum, e) => sum + parseFloat(e.montant || 0), 0);
    res.json({ encaissements, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET décaissements
router.get('/decaissements/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const decaissements = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.entrepriseId, parseInt(entrepriseId)),
        eq(transactionsTresorerie.type, 'decaissement')
      ));
    
    const total = decaissements.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
    res.json({ decaissements, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET catégories de flux
router.get('/categories/:entrepriseId', async (req, res) => {
  try {
    const categories = [
      { id: 1, nom: 'Ventes', icon: '💰', color: '#28a745' },
      { id: 2, nom: 'Charges', icon: '💸', color: '#dc3545' },
      { id: 3, nom: 'Salaires', icon: '👨‍💼', color: '#007bff' },
      { id: 4, nom: 'Taxes', icon: '🏛️', color: '#ffc107' },
      { id: 5, nom: 'Investissements', icon: '🏗️', color: '#6f42c1' },
      { id: 6, nom: 'Financement', icon: '🏦', color: '#17a2b8' }
    ];
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET prévisions: flux futurs, échéances fournisseur, factures à venir
router.get('/previsions/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const { periode } = req.query;
    const entId = parseInt(entrepriseId);
    
    const joursProj = parseInt(periode) || 30;
    const dateAujourdhui = new Date();
    dateAujourdhui.setHours(0, 0, 0, 0);
    const dateLimite = new Date(dateAujourdhui);
    dateLimite.setDate(dateLimite.getDate() + joursProj);
    
    const comptesData = await db.select().from(comptesBancaires)
      .where(and(
        eq(comptesBancaires.entrepriseId, entId),
        eq(comptesBancaires.actif, true)
      ));
    
    const mouvementsData = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.entrepriseId, entId));
    
    let soldeActuel = 0;
    comptesData.forEach(compte => {
      const mouvements = mouvementsData.filter(m => m.compteBancaireId === compte.id);
      let soldeCompte = parseFloat(compte.soldeInitial || 0);
      mouvements.forEach(m => {
        if (m.type === 'encaissement') {
          soldeCompte += parseFloat(m.montant || 0);
        } else if (m.type === 'decaissement') {
          soldeCompte -= parseFloat(m.montant || 0);
        }
      });
      soldeActuel += soldeCompte;
    });
    
    const facturesClients = await db.select().from(factures)
      .where(and(
        eq(factures.entrepriseId, entId),
        eq(factures.statut, 'en_attente')
      ));
    
    const facturesClientsPeriode = facturesClients.filter(f => {
      if (!f.dateEcheance) return false;
      const echeance = new Date(f.dateEcheance);
      return echeance >= dateAujourdhui && echeance <= dateLimite;
    });
    
    const totalCreances = facturesClientsPeriode.reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
    
    const facturesFournisseurs = await db.select().from(facturesAchat)
      .where(and(
        eq(facturesAchat.entrepriseId, entId),
        eq(facturesAchat.statut, 'en_attente')
      ));
    
    const facturesFournisseursPeriode = facturesFournisseurs.filter(f => {
      if (!f.dateEcheance) return false;
      const echeance = new Date(f.dateEcheance);
      return echeance >= dateAujourdhui && echeance <= dateLimite;
    });
    
    const totalDettes = facturesFournisseursPeriode.reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
    
    const soldePrevu = soldeActuel + totalCreances - totalDettes;
    
    const projectionParSemaine = [];
    const nbSemaines = Math.ceil(joursProj / 7);
    
    for (let semaine = 1; semaine <= nbSemaines; semaine++) {
      const debutSemaine = new Date(dateAujourdhui);
      debutSemaine.setDate(debutSemaine.getDate() + (semaine - 1) * 7);
      const finSemaine = new Date(debutSemaine);
      finSemaine.setDate(finSemaine.getDate() + 6);
      
      const encaissementsSemaine = facturesClientsPeriode
        .filter(f => {
          const echeance = new Date(f.dateEcheance);
          return echeance >= debutSemaine && echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const decaissementsSemaine = facturesFournisseursPeriode
        .filter(f => {
          const echeance = new Date(f.dateEcheance);
          return echeance >= debutSemaine && echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const encaissementsCumules = facturesClientsPeriode
        .filter(f => {
          const echeance = new Date(f.dateEcheance);
          return echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const decaissementsCumules = facturesFournisseursPeriode
        .filter(f => {
          const echeance = new Date(f.dateEcheance);
          return echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const soldeSemaine = soldeActuel + encaissementsCumules - decaissementsCumules;
      
      projectionParSemaine.push({
        semaine,
        periode: `Semaine ${semaine} (${debutSemaine.toLocaleDateString('fr-FR')} - ${finSemaine.toLocaleDateString('fr-FR')})`,
        encaissements: encaissementsSemaine,
        decaissements: decaissementsSemaine,
        soldePrevu: soldeSemaine
      });
    }
    
    res.json({
      soldeActuel,
      soldePrevu,
      periode: joursProj,
      creances: {
        total: totalCreances,
        count: facturesClientsPeriode.length,
        factures: facturesClientsPeriode.map(f => ({
          id: f.id,
          numero: f.numeroFacture,
          montant: parseFloat(f.montantTTC || 0),
          dateEcheance: f.dateEcheance,
          clientId: f.clientId
        }))
      },
      dettes: {
        total: totalDettes,
        count: facturesFournisseursPeriode.length,
        factures: facturesFournisseursPeriode.map(f => ({
          id: f.id,
          numero: f.numeroFacture,
          montant: parseFloat(f.montantTTC || 0),
          dateEcheance: f.dateEcheance,
          fournisseurId: f.fournisseurId
        }))
      },
      projection: projectionParSemaine,
      variation: soldePrevu - soldeActuel
    });
  } catch (err) {
    console.error('Erreur prévisions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST créer un compte bancaire
router.post('/comptes/:entrepriseId/create', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const { nomCompte, numeroCompte, banque, soldeInitial, type, compteComptableId } = req.body;

    if (compteComptableId) {
      const compteExists = await db.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, parseInt(compteComptableId)),
          eq(comptesComptables.entrepriseId, parseInt(entrepriseId))
        ))
        .limit(1);
      
      if (compteExists.length === 0) {
        return res.status(400).json({ 
          error: 'Le compte comptable sélectionné n\'appartient pas à votre entreprise' 
        });
      }
    }

    const newCompte = await db.insert(comptesBancaires).values({
      entrepriseId: parseInt(entrepriseId),
      nomCompte,
      numeroCompte,
      banque,
      soldeInitial: soldeInitial || '0',
      soldeActuel: soldeInitial || '0',
      type: type || 'banque',
      compteComptableId: compteComptableId ? parseInt(compteComptableId) : null,
      actif: true
    }).returning();

    res.json(newCompte[0]);
  } catch (err) {
    console.error('Erreur création compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier un compte bancaire
router.put('/comptes/:entrepriseId/:id', async (req, res) => {
  try {
    const { entrepriseId, id } = req.params;
    const { nomCompte, numeroCompte, banque, type, compteComptableId, actif } = req.body;

    if (compteComptableId) {
      const compteExists = await db.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, parseInt(compteComptableId)),
          eq(comptesComptables.entrepriseId, parseInt(entrepriseId))
        ))
        .limit(1);
      
      if (compteExists.length === 0) {
        return res.status(400).json({ 
          error: 'Le compte comptable sélectionné n\'appartient pas à votre entreprise' 
        });
      }
    }

    const updated = await db.update(comptesBancaires)
      .set({
        nomCompte,
        numeroCompte,
        banque,
        type,
        compteComptableId: compteComptableId ? parseInt(compteComptableId) : null,
        actif,
        updatedAt: new Date()
      })
      .where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, parseInt(entrepriseId))
      ))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Compte bancaire introuvable ou non autorisé' });
    }

    res.json(updated[0]);
  } catch (err) {
    console.error('Erreur modification compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer un compte bancaire
router.delete('/comptes/:entrepriseId/:id', async (req, res) => {
  try {
    const { entrepriseId, id } = req.params;

    const compte = await db.select().from(comptesBancaires)
      .where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, parseInt(entrepriseId))
      ))
      .limit(1);

    if (compte.length === 0) {
      return res.status(404).json({ error: 'Compte bancaire introuvable ou non autorisé' });
    }

    const transactions = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.compteBancaireId, parseInt(id)))
      .limit(1);

    if (transactions.length > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer ce compte car il contient des transactions. Désactivez-le plutôt.' 
      });
    }

    await db.delete(comptesBancaires)
      .where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, parseInt(entrepriseId))
      ));
    
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (err) {
    console.error('Erreur suppression compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET comptes comptables classe 5 (trésorerie)
router.get('/comptes-comptables/:entrepriseId', async (req, res) => {
  try {
    const { entrepriseId } = req.params;
    const comptes = await db.select().from(comptesComptables)
      .where(and(
        eq(comptesComptables.entrepriseId, parseInt(entrepriseId)),
        like(comptesComptables.numero, '5%')
      ));
    
    res.json(comptes);
  } catch (err) {
    console.error('Erreur récupération comptes comptables:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
