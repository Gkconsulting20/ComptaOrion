import express from 'express';
import { db } from '../db.js';
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
    const { startDate, endDate } = req.query;
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    
    if (!eId) {
      return res.status(400).json({ error: 'entrepriseId requis' });
    }
    
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

// =====================
// DRILL-DOWN ENDPOINTS
// =====================

// Détail ventes du mois
router.get('/detail/ventes', async (req, res) => {
  try {
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    const { debut, fin } = getMonthDates();
    
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.createdAt, debut),
        lte(factures.createdAt, fin)
      ),
      with: { client: true },
      orderBy: [desc(factures.createdAt)]
    });
    
    const result = ventesData.map(f => ({
      id: f.id,
      numero: f.numero,
      dateFacture: f.dateFacture || f.createdAt,
      clientNom: f.client?.nom || f.client?.raisonSociale || 'Client inconnu',
      montantTTC: parseFloat(f.totalTTC || f.montantTTC || 0),
      statut: f.statut
    }));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail dépenses du mois
router.get('/detail/depenses', async (req, res) => {
  try {
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    const { debut, fin } = getMonthDates();
    
    const depensesData = await db.query.facturesAchat.findMany({
      where: and(
        eq(facturesAchat.entrepriseId, eId),
        gte(facturesAchat.createdAt, debut),
        lte(facturesAchat.createdAt, fin)
      ),
      with: { fournisseur: true },
      orderBy: [desc(facturesAchat.createdAt)]
    });
    
    const result = depensesData.map(f => ({
      id: f.id,
      date: f.dateFacture || f.createdAt,
      description: f.numero || `Facture #${f.id}`,
      categorie: f.fournisseur?.nom || 'Fournisseur',
      montant: parseFloat(f.totalTTC || 0)
    }));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail factures en retard
router.get('/detail/factures-retard', async (req, res) => {
  try {
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    const now = new Date();
    
    const facturesRetard = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        eq(factures.statut, 'retard')
      ),
      with: { client: true },
      orderBy: [desc(factures.dateEcheance)]
    });
    
    const result = facturesRetard.map(f => {
      const echeance = new Date(f.dateEcheance);
      const joursRetard = Math.max(0, Math.floor((now - echeance) / (1000 * 60 * 60 * 24)));
      return {
        id: f.id,
        numero: f.numero,
        dateFacture: f.dateFacture || f.createdAt,
        clientNom: f.client?.nom || f.client?.raisonSociale || 'Client inconnu',
        dateEcheance: f.dateEcheance,
        joursRetard,
        soldeRestant: parseFloat(f.soldeRestant || f.totalTTC || 0)
      };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail stock faible
router.get('/detail/stock-faible', async (req, res) => {
  try {
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    const allProduits = await db.query.produits.findMany({
      where: eq(produits.entrepriseId, eId)
    });
    
    const produitsFaibles = allProduits
      .filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0))
      .map(p => ({
        id: p.id,
        reference: p.reference || p.code,
        nom: p.nom || p.designation,
        quantite: parseFloat(p.quantite || 0),
        seuilMin: parseFloat(p.stockMinimum || 0),
        entrepot: p.entrepot || 'Principal'
      }));
    
    res.json(produitsFaibles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail cashflow
router.get('/detail/cashflow', async (req, res) => {
  try {
    const eId = req.entrepriseId || parseInt(req.query.entrepriseId);
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    const { debut, fin } = getMonthDates();
    
    // Récupérer paiements clients (entrées)
    const paiementsClients = await db.query.paiements.findMany({
      where: and(
        eq(paiements.entrepriseId, eId),
        gte(paiements.datePaiement, debut),
        lte(paiements.datePaiement, fin)
      ),
      orderBy: [desc(paiements.datePaiement)]
    });
    
    // Récupérer paiements fournisseurs (sorties)
    const paiementsFourn = await db.query.paiementsFournisseurs.findMany({
      where: and(
        eq(paiementsFournisseurs.entrepriseId, eId),
        gte(paiementsFournisseurs.datePaiement, debut),
        lte(paiementsFournisseurs.datePaiement, fin)
      ),
      orderBy: [desc(paiementsFournisseurs.datePaiement)]
    });
    
    // Combiner et trier par date
    const mouvements = [
      ...paiementsClients.map(p => ({
        id: p.id,
        date: p.datePaiement,
        type: 'Encaissement client',
        description: `Paiement ${p.reference || '#' + p.id}`,
        entree: parseFloat(p.montant || 0),
        sortie: 0
      })),
      ...paiementsFourn.map(p => ({
        id: 'f' + p.id,
        date: p.datePaiement,
        type: 'Paiement fournisseur',
        description: `Règlement ${p.reference || '#' + p.id}`,
        entree: 0,
        sortie: parseFloat(p.montant || 0)
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculer solde cumulé
    let solde = 0;
    const result = mouvements.map(m => {
      solde += m.entree - m.sortie;
      return { ...m, solde };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Drill-down: Marge brute détaillée
router.get('/detail/marge', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const eId = parseInt(entrepriseId);
    const { debut, fin } = getMonthDates();
    
    // Ventes du mois
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.createdAt, debut),
        lte(factures.createdAt, fin)
      )
    });
    const ventesMois = ventesData.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);

    // Dépenses du mois
    const depensesData = await db.query.facturesAchat.findMany({
      where: and(
        eq(facturesAchat.entrepriseId, eId),
        gte(facturesAchat.createdAt, debut),
        lte(facturesAchat.createdAt, fin)
      )
    });
    const depensesMois = depensesData.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);
    
    const marge = ventesMois - depensesMois;
    const margePercent = ventesMois > 0 ? ((marge / ventesMois) * 100).toFixed(2) : 0;
    
    res.json([
      { type: 'Chiffre d\'affaires', description: `Total des ventes du mois (${ventesData.length} factures)`, montant: ventesMois, impact: '+' },
      { type: 'Coût des ventes', description: `Achats fournisseurs (${depensesData.length} factures)`, montant: -depensesMois, impact: '-' },
      { type: 'Marge brute', description: `Résultat: ${margePercent}% de marge`, montant: marge, impact: '=' }
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Drill-down: Ventes d'un mois spécifique
router.get('/detail/ventes-mois', async (req, res) => {
  try {
    const { entrepriseId, mois } = req.query;
    const eId = parseInt(entrepriseId);
    
    // Parser le mois (format: "janv. 24")
    const moisMap = {
      'janv.': 0, 'févr.': 1, 'mars': 2, 'avr.': 3, 'mai': 4, 'juin': 5,
      'juil.': 6, 'août': 7, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'déc.': 11
    };
    
    let targetYear, targetMonth;
    if (mois) {
      const parts = mois.split(' ');
      const moisNom = parts[0];
      const annee = parts[1] ? parseInt('20' + parts[1]) : new Date().getFullYear();
      targetMonth = moisMap[moisNom] !== undefined ? moisMap[moisNom] : new Date().getMonth();
      targetYear = annee;
    } else {
      const now = new Date();
      targetMonth = now.getMonth();
      targetYear = now.getFullYear();
    }
    
    const debut = new Date(targetYear, targetMonth, 1);
    const fin = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.createdAt, debut),
        lte(factures.createdAt, fin)
      ),
      orderBy: [desc(factures.createdAt)]
    });
    
    // Récupérer les noms des clients
    const { clients } = await import('../schema.js');
    const clientsData = await db.query.clients.findMany({
      where: eq(clients.entrepriseId, eId)
    });
    const clientMap = {};
    clientsData.forEach(c => clientMap[c.id] = c.nom);
    
    const result = ventesData.map(f => ({
      id: f.id,
      numero: f.numero,
      dateFacture: f.dateFacture || f.createdAt,
      clientNom: clientMap[f.clientId] || 'Client inconnu',
      montantTTC: parseFloat(f.totalTTC || 0),
      statut: f.statut
    }));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Drill-down: Dépenses par catégorie
router.get('/detail/depenses-categorie', async (req, res) => {
  try {
    const { entrepriseId, categorie } = req.query;
    const eId = parseInt(entrepriseId);
    const { debut, fin } = getMonthDates();
    
    let whereCondition = and(
      eq(facturesAchat.entrepriseId, eId),
      gte(facturesAchat.createdAt, debut),
      lte(facturesAchat.createdAt, fin)
    );
    
    // Si une catégorie est spécifiée, filtrer par catégorie
    if (categorie && categorie !== 'Autre') {
      whereCondition = and(
        whereCondition,
        eq(facturesAchat.categorie, categorie)
      );
    } else if (categorie === 'Autre') {
      // Catégorie null ou vide
    }
    
    const depensesData = await db.query.facturesAchat.findMany({
      where: whereCondition,
      orderBy: [desc(facturesAchat.createdAt)]
    });
    
    // Récupérer les noms des fournisseurs
    const { fournisseurs } = await import('../schema.js');
    const fournisseursData = await db.query.fournisseurs.findMany({
      where: eq(fournisseurs.entrepriseId, eId)
    });
    const fournisseurMap = {};
    fournisseursData.forEach(f => fournisseurMap[f.id] = f.nom);
    
    const result = depensesData.map(f => ({
      id: f.id,
      date: f.dateFacture || f.createdAt,
      description: f.description || `Facture ${f.numero || f.id}`,
      categorie: f.categorie || 'Autre',
      fournisseur: fournisseurMap[f.fournisseurId] || 'Fournisseur inconnu',
      montant: parseFloat(f.totalTTC || 0)
    }));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
