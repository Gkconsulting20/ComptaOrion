import express from 'express';
import db from '../db.js';
import { factures, paiements, facturesAchat, paiementsFournisseurs, stockParEntrepot, produits, mouvementsStock } from '../schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const router = express.Router();

// Fonction utilitaire pour obtenir dates du mois
function getMonthDates() {
  const now = new Date();
  const debut = new Date(now.getFullYear(), now.getMonth(), 1);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { debut, fin };
}

// Dashboard global - tous les KPIs
router.get('/global', async (req, res) => {
  try {
    const { entrepriseId, startDate, endDate } = req.query;
    const eId = parseInt(entrepriseId);
    
    const { debut, fin } = getMonthDates();
    const dateStart = startDate ? new Date(startDate) : debut;
    const dateEnd = endDate ? new Date(endDate) : fin;

    // Ventes du mois (factures payées/envoyées)
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.createdAt, dateStart),
        lte(factures.createdAt, dateEnd)
      )
    });
    const ventesMois = ventesData.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);

    // Dépenses du mois (factures fournisseurs)
    const depensesData = await db.query.facturesAchat.findMany({
      where: and(
        eq(facturesAchat.entrepriseId, eId),
        gte(facturesAchat.createdAt, dateStart),
        lte(facturesAchat.createdAt, dateEnd)
      )
    });
    const depensesMois = depensesData.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);

    // Factures en retard (statut = 'retard')
    const factulesRetard = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        eq(factures.statut, 'retard')
      )
    });
    const facturesRetardTotal = factulesRetard.length;
    const montantRetard = factulesRetard.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);

    // Stock faible (quantité < seuil minimum)
    const stockFaible = await db.query.produits.findMany({
      where: eq(produits.entrepriseId, eId)
    });
    const produitsFaibles = stockFaible.filter(p => {
      return parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0);
    });

    // Marge brute = (Ventes - Coût des ventes) / Ventes
    const margeBrute = ventesMois > 0 ? ((ventesMois - depensesMois) / ventesMois * 100).toFixed(2) : 0;

    // Cashflow = Ventes - Dépenses
    const cashflow = ventesMois - depensesMois;

    res.json({
      ventesMois: parseFloat(ventesMois).toFixed(2),
      depensesMois: parseFloat(depensesMois).toFixed(2),
      facturesEnRetard: {
        nombre: facturesRetardTotal,
        montant: parseFloat(montantRetard).toFixed(2)
      },
      stockFaible: {
        nombre: produitsFaibles.length,
        produits: produitsFaibles.slice(0, 5)
      },
      margeBrute: parseFloat(margeBrute),
      cashflow: parseFloat(cashflow).toFixed(2),
      dateRange: { debut: dateStart, fin: dateEnd }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ventes par mois (historique 12 mois)
router.get('/ventes-mensuelles', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const eId = parseInt(entrepriseId);
    const data = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const debut = new Date(date.getFullYear(), date.getMonth(), 1);
      const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const ventes = await db.query.factures.findMany({
        where: and(
          eq(factures.entrepriseId, eId),
          gte(factures.createdAt, debut),
          lte(factures.createdAt, fin)
        )
      });

      const total = ventes.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);
      data.push({
        mois: debut.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        ventes: parseFloat(total).toFixed(2)
      });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Répartition dépenses par catégorie
router.get('/depenses-categories', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const eId = parseInt(entrepriseId);

    const depenses = await db.query.facturesAchat.findMany({
      where: eq(facturesAchat.entrepriseId, eId)
    });

    // Grouper par fournisseur (comme catégorie)
    const byFournisseur = {};
    depenses.forEach(d => {
      const key = d.fournisseurId || 'Autre';
      byFournisseur[key] = (byFournisseur[key] || 0) + parseFloat(d.totalTTC || 0);
    });

    const data = Object.entries(byFournisseur).map(([id, total]) => ({
      fournisseurId: id,
      total: parseFloat(total).toFixed(2)
    }));

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// KPIs avancés
router.get('/kpis', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const eId = parseInt(entrepriseId);

    // Délai paiement client (jours entre facture et paiement)
    const factulesClients = await db.query.factures.findMany({
      where: eq(factures.entrepriseId, eId)
    });
    const paiementsClients = await db.query.paiements.findMany({
      where: eq(paiements.entrepriseId, eId)
    });

    let delaiClientTotal = 0;
    let delaiClientCount = 0;
    factulesClients.forEach(f => {
      const paiement = paiementsClients.find(p => p.factureId === f.id);
      if (paiement) {
        const delai = (new Date(paiement.datePaiement) - new Date(f.createdAt)) / (1000 * 60 * 60 * 24);
        delaiClientTotal += delai;
        delaiClientCount++;
      }
    });
    const delaiPaiementClient = delaiClientCount > 0 ? (delaiClientTotal / delaiClientCount).toFixed(0) : 0;

    // Délai paiement fournisseur
    const facturesFournisseurs = await db.query.facturesAchat.findMany({
      where: eq(facturesAchat.entrepriseId, eId)
    });
    const paiementsFournisseurs_data = await db.query.paiementsFournisseurs.findMany({
      where: eq(paiementsFournisseurs.entrepriseId, eId)
    });

    let delaiFournisseurTotal = 0;
    let delaiCount = 0;
    facturesFournisseurs.forEach(f => {
      const paiement = paiementsFournisseurs_data.find(p => p.factureId === f.id);
      if (paiement) {
        const delai = (new Date(paiement.datePaiement) - new Date(f.createdAt)) / (1000 * 60 * 60 * 24);
        delaiFournisseurTotal += delai;
        delaiCount++;
      }
    });
    const delaiPaiementFournisseur = delaiCount > 0 ? (delaiFournisseurTotal / delaiCount).toFixed(0) : 0;

    res.json({
      delaiPaiementClient: parseInt(delaiPaiementClient),
      delaiPaiementFournisseur: parseInt(delaiPaiementFournisseur),
      nombreFacturesEnCours: factulesClients.filter(f => f.statut !== 'payee').length,
      nombreFacturesRetard: factulesClients.filter(f => f.statut === 'retard').length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
