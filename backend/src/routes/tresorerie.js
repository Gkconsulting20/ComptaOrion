import { Router } from 'express';
import { db } from '../db.js';
import { transactionsTresorerie, comptesBancaires, factures, facturesAchat, employes } from '../schema.js';
import { eq, and } from 'drizzle-orm';

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
    const entId = parseInt(entrepriseId);
    
    // Factures clients à venir (non payées)
    const facturesAVenir = await db.select().from(factures)
      .where(and(
        eq(factures.entrepriseId, entId),
        eq(factures.statut, 'en_attente')
      ));
    
    const totalFactures = facturesAVenir.reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
    
    // Échéances fournisseur (factures non payées)
    const echancesFS = await db.select().from(achats)
      .where(and(
        eq(achats.entrepriseId, entId),
        eq(achats.statut, 'en_attente_paiement')
      ));
    
    const totalEchances = echancesFS.reduce((sum, a) => sum + parseFloat(a.montantTTC || 0), 0);
    
    res.json({
      facturesAVenir: {
        count: facturesAVenir.length,
        total: totalFactures,
        items: facturesAVenir.slice(0, 5)
      },
      echancesFournisseur: {
        count: echancesFS.length,
        total: totalEchances,
        items: echancesFS.slice(0, 5)
      },
      fluxFuturs: {
        semaine: totalFactures - totalEchances,
        mois: (totalFactures - totalEchances) * 4,
        trimestre: (totalFactures - totalEchances) * 13
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
