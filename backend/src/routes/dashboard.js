import express from 'express';
import { db } from '../db.js';
import {
  factures,
  paiements,
  facturesAchat,
  paiementsFournisseurs,
  stockParEntrepot,
  produits,
  mouvementsStock,
  factureItems,
  entreprises,
  depenses as depensesTable,
  categoriesDepenses,
  ecritures,
  lignesEcritures,
  comptesComptables,
  valorisationsStock,
} from '../schema.js';
import { eq, and, gte, lte, desc, sql, inArray, like } from 'drizzle-orm';
import {
  VALID_SALES_STATUSES,
  VALID_PURCHASE_STATUSES,
  calculateCashConversionCycle,
  calculateCurrentInventoryValue,
  calculateGrossMargin,
  calculateNetCashflow,
  calculateWorkingCapitalDays,
  countInclusiveDays,
  dateOnly,
  outstandingBalanceAt,
  sumMoney,
} from '../services/dashboardMetrics.js';

const router = express.Router();
const SALES_STATUS_VALUES = [...VALID_SALES_STATUSES];
const PURCHASE_STATUS_VALUES = [...VALID_PURCHASE_STATUSES];

// Fonction utilitaire pour obtenir dates de l'année fiscale par défaut (année civile)
function getDefaultFiscalYearDates() {
  const now = new Date();
  const debut = new Date(now.getFullYear(), 0, 1); // 1er janvier
  const fin = new Date(now.getFullYear(), 11, 31); // 31 décembre
  return { debut, fin };
}

// Fonction pour obtenir l'année fiscale de l'entreprise
async function getFiscalYearDatesForEntreprise(entrepriseId) {
  try {
    const entreprise = await db.query.entreprises.findFirst({
      where: eq(entreprises.id, entrepriseId)
    });
    
    if (entreprise && entreprise.debutAnneeFiscale && entreprise.finAnneeFiscale) {
      return {
        debut: new Date(entreprise.debutAnneeFiscale),
        fin: new Date(entreprise.finAnneeFiscale)
      };
    }
  } catch (error) {
    console.error('Erreur récupération année fiscale:', error.message);
  }
  
  // Fallback: année civile courante
  return getDefaultFiscalYearDates();
}

async function getDashboardPeriod(req, entrepriseId) {
  const defaults = await getFiscalYearDatesForEntreprise(entrepriseId);
  const start = dateOnly(req.query.dateDebut || req.query.startDate || defaults.debut);
  const end = dateOnly(req.query.dateFin || req.query.endDate || defaults.fin);
  if (!start || !end || start > end) {
    throw Object.assign(new Error('La période sélectionnée est invalide.'), { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const effectiveEnd = end < today ? end : today;
  return {
    start,
    end,
    effectiveEnd,
    days: countInclusiveDays(start, effectiveEnd),
  };
}

async function getCostOfSalesForInvoices(entrepriseId, salesInvoices) {
  if (!salesInvoices.length) return { cmv: 0, complete: true };

  const invoiceIds = salesInvoices.map((invoice) => invoice.id);
  const pieces = salesInvoices
    .filter((invoice) => invoice.numeroFacture)
    .map((invoice) => `${invoice.numeroFacture}-CMV`);

  const [items, costRows] = await Promise.all([
    db.select({
      factureId: factureItems.factureId,
      produitId: factureItems.produitId,
    }).from(factureItems).where(and(
      eq(factureItems.entrepriseId, entrepriseId),
      inArray(factureItems.factureId, invoiceIds),
    )),
    pieces.length
      ? db.select({
        numeroPiece: ecritures.numeroPiece,
        montant: sql`COALESCE(SUM(${lignesEcritures.debit} - ${lignesEcritures.credit}), 0)`,
      })
        .from(ecritures)
        .innerJoin(lignesEcritures, eq(lignesEcritures.ecritureId, ecritures.id))
        .innerJoin(comptesComptables, eq(comptesComptables.id, lignesEcritures.compteComptableId))
        .where(and(
          eq(ecritures.entrepriseId, entrepriseId),
          inArray(ecritures.numeroPiece, pieces),
          like(comptesComptables.numero, '603%'),
        ))
        .groupBy(ecritures.numeroPiece)
      : Promise.resolve([]),
  ]);

  const itemsByInvoice = new Map();
  for (const item of items) {
    const rows = itemsByInvoice.get(Number(item.factureId)) || [];
    rows.push(item);
    itemsByInvoice.set(Number(item.factureId), rows);
  }
  const costByPiece = new Map(costRows.map((row) => [row.numeroPiece, Number(row.montant || 0)]));

  let complete = true;
  let cmv = 0;
  for (const invoice of salesInvoices) {
    const invoiceItems = itemsByInvoice.get(Number(invoice.id)) || [];
    const piece = invoice.numeroFacture ? `${invoice.numeroFacture}-CMV` : null;
    const hasRecordedCost = piece ? costByPiece.has(piece) : false;
    const hasStockItems = invoiceItems.some((item) => item.produitId != null);
    if ((invoiceItems.length === 0 && Number(invoice.totalHT || 0) > 0 && !hasRecordedCost) ||
        (hasStockItems && !hasRecordedCost)) {
      complete = false;
    }
    if (hasRecordedCost) cmv += costByPiece.get(piece);
  }

  return { cmv: complete ? Math.round(cmv * 100) / 100 : null, complete };
}

// Dashboard global - tous les KPIs
router.get('/global', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    
    if (!eId) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    
    const period = await getDashboardPeriod(req, eId);
    const dateFilter = (column) => and(
      gte(column, period.start),
      lte(column, period.effectiveEnd),
    );
    const [salesHistory, purchasesHistory, clientPaymentHistory, supplierPaymentHistory, allProducts, valuationLayers] = await Promise.all([
      db.select({
        id: factures.id,
        numeroFacture: factures.numeroFacture,
        statut: factures.statut,
        dateFacture: factures.dateFacture,
        totalHT: factures.totalHT,
        totalTTC: factures.totalTTC,
        soldeRestant: factures.soldeRestant,
      }).from(factures).where(and(
        eq(factures.entrepriseId, eId),
        lte(factures.dateFacture, period.effectiveEnd),
        inArray(factures.statut, SALES_STATUS_VALUES),
      )),
      db.select({
        id: facturesAchat.id,
        statut: facturesAchat.statut,
        dateFacture: facturesAchat.dateFacture,
        totalHT: facturesAchat.totalHT,
        totalTTC: facturesAchat.totalTTC,
        fournisseurId: facturesAchat.fournisseurId,
      }).from(facturesAchat).where(and(
        eq(facturesAchat.entrepriseId, eId),
        lte(facturesAchat.dateFacture, period.effectiveEnd),
        inArray(facturesAchat.statut, PURCHASE_STATUS_VALUES),
      )),
      db.select({
        factureId: paiements.factureId,
        montant: paiements.montant,
        datePaiement: paiements.datePaiement,
      }).from(paiements).where(and(
        eq(paiements.entrepriseId, eId),
        lte(paiements.datePaiement, period.effectiveEnd),
      )),
      db.select({
        factureId: paiementsFournisseurs.factureId,
        montant: paiementsFournisseurs.montant,
        datePaiement: paiementsFournisseurs.datePaiement,
      }).from(paiementsFournisseurs).where(and(
        eq(paiementsFournisseurs.entrepriseId, eId),
        lte(paiementsFournisseurs.datePaiement, period.effectiveEnd),
      )),
      db.query.produits.findMany({ where: eq(produits.entrepriseId, eId) }),
      db.select({
        produitId: valorisationsStock.produitId,
        quantite: valorisationsStock.quantite,
        coutTotal: valorisationsStock.coutTotal,
      }).from(valorisationsStock).where(eq(valorisationsStock.entrepriseId, eId)),
    ]);
    const inPeriod = (date) => {
      const normalized = dateOnly(date);
      return normalized && normalized >= period.start && normalized <= period.effectiveEnd;
    };
    const ventesData = salesHistory.filter((invoice) => inPeriod(invoice.dateFacture));
    const achatsData = purchasesHistory.filter((invoice) => inPeriod(invoice.dateFacture));
    const approvedExpenseRows = await db.select({
      montant: depensesTable.montant,
      montantApprouve: depensesTable.montantApprouve,
    }).from(depensesTable).where(and(
      eq(depensesTable.entrepriseId, eId),
      eq(depensesTable.statut, 'approuvée'),
      dateFilter(depensesTable.dateDepense),
    ));
    const approvedExpenseTotal = approvedExpenseRows.reduce(
      (sum, expense) => sum + Number(expense.montantApprouve || expense.montant || 0),
      0,
    );
    const ventesMois = sumMoney(ventesData, 'totalTTC');
    const depensesMois = sumMoney(achatsData, 'totalTTC') + approvedExpenseTotal;
    const ventesHT = sumMoney(ventesData, 'totalHT');

    // Factures en retard (statut = 'retard') - dans la période sélectionnée
    const facturesRetard = ventesData.filter((invoice) => invoice.statut === 'retard');
    const facturesRetardTotal = facturesRetard.length;
    const montantRetard = facturesRetard.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.soldeRestant || 0)), 0);

    // Stock faible (quantité < seuil minimum)
    const produitsFaibles = allProducts.filter((product) =>
      Number(product.quantite || 0) < Number(product.stockMinimum || 0)
    );

    const costOfSales = await getCostOfSalesForInvoices(eId, ventesData);
    const grossMargin = calculateGrossMargin(ventesHT, costOfSales.cmv, costOfSales.complete);
    const clientPaymentsInPeriod = clientPaymentHistory.filter((payment) => inPeriod(payment.datePaiement));
    const supplierPaymentsInPeriod = supplierPaymentHistory.filter((payment) => inPeriod(payment.datePaiement));
    const cashflow = calculateNetCashflow([
      ...clientPaymentsInPeriod.map((payment) => ({ ...payment, type: 'encaissement' })),
      ...supplierPaymentsInPeriod.map((payment) => ({ ...payment, type: 'decaissement' })),
    ]);

    const arOpening = outstandingBalanceAt(
      salesHistory, clientPaymentHistory, period.start, SALES_STATUS_VALUES, false,
    );
    const arClosing = outstandingBalanceAt(
      salesHistory, clientPaymentHistory, period.effectiveEnd, SALES_STATUS_VALUES, true,
    );
    const apOpening = outstandingBalanceAt(
      purchasesHistory, supplierPaymentHistory, period.start, PURCHASE_STATUS_VALUES, false,
    );
    const apClosing = outstandingBalanceAt(
      purchasesHistory, supplierPaymentHistory, period.effectiveEnd, PURCHASE_STATUS_VALUES, true,
    );
    const dso = calculateWorkingCapitalDays(arOpening, arClosing, sumMoney(ventesData, 'totalTTC'), period.days);
    const dpo = calculateWorkingCapitalDays(apOpening, apClosing, sumMoney(achatsData, 'totalTTC'), period.days);
    const inventoryValue = calculateCurrentInventoryValue(allProducts, valuationLayers);

    // Il n'existe pas encore d'instantanés historiques permettant d'obtenir le stock moyen de la période.
    const dio = null;
    const ccc = calculateCashConversionCycle(dso, dio, dpo);

    res.json({
      ventesMois: ventesMois.toFixed(2),
      depensesMois: depensesMois.toFixed(2),
      facturesEnRetard: {
        nombre: facturesRetardTotal,
        montant: montantRetard.toFixed(2)
      },
      stockFaible: {
        nombre: produitsFaibles.length,
        produits: produitsFaibles.slice(0, 5)
      },
      margeBrute: grossMargin.marginPercent,
      cmv: grossMargin.cmv,
      cmvDisponible: costOfSales.complete,
      ventesHT: Math.round(ventesHT * 100) / 100,
      cashflow: cashflow.toFixed(2),
      cashflowDefinition: 'Paiements clients reçus moins paiements fournisseurs effectués',
      dateRange: { debut: period.start, fin: period.end },
      dso,
      dpo,
      dio,
      ccc,
      valeurStock: inventoryValue.value,
      valeurStockDisponible: inventoryValue.complete,
      dioIndisponibleRaison: 'L’application ne conserve pas encore de valorisations historiques du stock.',
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Ventes par mois (dans la période sélectionnée)
router.get('/ventes-mensuelles', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const periodStart = new Date(`${period.start}T00:00:00.000Z`);
    const periodEnd = new Date(`${period.effectiveEnd}T00:00:00.000Z`);
    
    const data = [];
    const current = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
    
    while (current <= periodEnd) {
      const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const start = monthStart < period.start ? period.start : monthStart;
      const end = monthEnd > period.effectiveEnd ? period.effectiveEnd : monthEnd;

      const ventes = await db.query.factures.findMany({
        where: and(
          eq(factures.entrepriseId, eId),
          gte(factures.dateFacture, start),
          lte(factures.dateFacture, end),
          inArray(factures.statut, SALES_STATUS_VALUES),
        )
      });

      const total = sumMoney(ventes, 'totalTTC');
      data.push({
        mois: current.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        ventes: total.toFixed(2),
      });
      current.setUTCMonth(current.getUTCMonth() + 1);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Répartition dépenses par catégorie (dans la période sélectionnée)
router.get('/depenses-categories', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const [purchaseBills, expenseClaims] = await Promise.all([
      db.query.facturesAchat.findMany({
        where: and(
          eq(facturesAchat.entrepriseId, eId),
          gte(facturesAchat.dateFacture, period.start),
          lte(facturesAchat.dateFacture, period.effectiveEnd),
          inArray(facturesAchat.statut, PURCHASE_STATUS_VALUES),
        ),
        with: { fournisseur: true },
      }),
      db.select({
        montant: depensesTable.montant,
        montantApprouve: depensesTable.montantApprouve,
        categorie: categoriesDepenses.nom,
      }).from(depensesTable)
        .leftJoin(categoriesDepenses, eq(categoriesDepenses.id, depensesTable.categorieId))
        .where(and(
          eq(depensesTable.entrepriseId, eId),
          eq(depensesTable.statut, 'approuvée'),
          gte(depensesTable.dateDepense, period.start),
          lte(depensesTable.dateDepense, period.effectiveEnd),
        )),
    ]);

    const byCategory = new Map();
    for (const bill of purchaseBills) {
      const category = bill.fournisseur?.nom || 'Achats fournisseurs';
      byCategory.set(category, (byCategory.get(category) || 0) + Number(bill.totalTTC || 0));
    }
    for (const expense of expenseClaims) {
      const category = expense.categorie || 'Autres dépenses approuvées';
      byCategory.set(category, (byCategory.get(category) || 0) + Number(expense.montantApprouve || expense.montant || 0));
    }

    const data = [...byCategory.entries()]
      .map(([categorie, montant]) => ({ categorie, montant: montant.toFixed(2) }))
      .sort((a, b) => Number(b.montant) - Number(a.montant));

    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// KPIs avancés
router.get('/kpis', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });

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

// Détail ventes de la période
router.get('/detail/ventes', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.dateFacture, period.start),
        lte(factures.dateFacture, period.effectiveEnd),
        inArray(factures.statut, SALES_STATUS_VALUES),
      ),
      with: { client: true },
      orderBy: [desc(factures.dateFacture)]
    });
    
    const result = ventesData.map(f => ({
      id: f.id,
      numero: f.numeroFacture,
      dateFacture: f.dateFacture,
      clientNom: f.client?.nom || f.client?.raisonSociale || 'Client inconnu',
      montantTTC: Number(f.totalTTC || 0),
      statut: f.statut
    }));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail dépenses de la période
router.get('/detail/depenses', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const [purchaseBills, expenseClaims] = await Promise.all([
      db.query.facturesAchat.findMany({
        where: and(
          eq(facturesAchat.entrepriseId, eId),
          gte(facturesAchat.dateFacture, period.start),
          lte(facturesAchat.dateFacture, period.effectiveEnd),
          inArray(facturesAchat.statut, PURCHASE_STATUS_VALUES),
        ),
        with: { fournisseur: true },
        orderBy: [desc(facturesAchat.dateFacture)]
      }),
      db.select({
        id: depensesTable.id,
        date: depensesTable.dateDepense,
        description: depensesTable.description,
        montant: depensesTable.montant,
        montantApprouve: depensesTable.montantApprouve,
        categorie: categoriesDepenses.nom,
      }).from(depensesTable)
        .leftJoin(categoriesDepenses, eq(categoriesDepenses.id, depensesTable.categorieId))
        .where(and(
          eq(depensesTable.entrepriseId, eId),
          eq(depensesTable.statut, 'approuvée'),
          gte(depensesTable.dateDepense, period.start),
          lte(depensesTable.dateDepense, period.effectiveEnd),
        )),
    ]);

    const result = purchaseBills.map(f => ({
      id: f.id,
      date: f.dateFacture,
      description: f.numero || `Facture #${f.id}`,
      categorie: f.fournisseur?.nom || 'Achats fournisseurs',
      montant: Number(f.totalTTC || 0)
    })).concat(expenseClaims.map((expense) => ({
      id: `depense-${expense.id}`,
      date: expense.date,
      description: expense.description || `Dépense #${expense.id}`,
      categorie: expense.categorie || 'Autres dépenses approuvées',
      montant: Number(expense.montantApprouve || expense.montant || 0),
    }))).sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Détail factures en retard (dans la période sélectionnée)
router.get('/detail/factures-retard', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const now = new Date();
    
    const facturesRetard = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        eq(factures.statut, 'retard'),
        gte(factures.dateFacture, period.start),
        lte(factures.dateFacture, period.effectiveEnd),
      ),
      with: { client: true },
      orderBy: [desc(factures.dateEcheance)]
    });
    
    const result = facturesRetard.map(f => {
      const echeance = new Date(f.dateEcheance);
      const joursRetard = Math.max(0, Math.floor((now - echeance) / (1000 * 60 * 60 * 24)));
      return {
        id: f.id,
        numero: f.numeroFacture,
        dateFacture: f.dateFacture,
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
// NOTE TECHNIQUE: Le stock faible est un état instantané (quantité actuelle vs seuil minimum).
// Contrairement aux ventes/dépenses qui sont des flux historiques, le stock représente
// toujours l'état ACTUEL de l'inventaire. Le filtrage par période n'a pas de sens sémantique
// pour cette donnée - on veut toujours voir quels produits sont actuellement en rupture,
// peu importe la période fiscale sélectionnée. Les paramètres dateDebut/dateFin sont
// acceptés pour la cohérence API mais ne sont pas appliqués.
router.get('/detail/stock-faible', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    
    // Paramètres acceptés pour cohérence API (non utilisés - stock = état actuel)
    const { dateDebut, dateFin } = req.query;
    
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

// Détail cashflow de la période
router.get('/detail/cashflow', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    if (!eId || isNaN(eId)) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    
    // Récupérer paiements clients (entrées)
    const paiementsClients = await db.query.paiements.findMany({
      where: and(
        eq(paiements.entrepriseId, eId),
        gte(paiements.datePaiement, period.start),
        lte(paiements.datePaiement, period.effectiveEnd)
      ),
      orderBy: [desc(paiements.datePaiement)]
    });
    
    // Récupérer paiements fournisseurs (sorties)
    const paiementsFourn = await db.query.paiementsFournisseurs.findMany({
      where: and(
        eq(paiementsFournisseurs.entrepriseId, eId),
        gte(paiementsFournisseurs.datePaiement, period.start),
        lte(paiementsFournisseurs.datePaiement, period.effectiveEnd)
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
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.dateFacture, period.start),
        lte(factures.dateFacture, period.effectiveEnd),
        inArray(factures.statut, SALES_STATUS_VALUES),
      ),
    });
    const salesHT = sumMoney(ventesData, 'totalHT');
    const costOfSales = await getCostOfSalesForInvoices(eId, ventesData);
    const grossMargin = calculateGrossMargin(salesHT, costOfSales.cmv, costOfSales.complete);
    const marginAmount = grossMargin.cmv == null ? null : Math.round((salesHT - grossMargin.cmv) * 100) / 100;

    res.json([
      { type: 'Chiffre d’affaires HT', description: `Factures comptabilisées sur la période (${ventesData.length})`, montant: salesHT, impact: '+' },
      {
        type: 'CMV',
        description: costOfSales.complete ? 'Coût enregistré au moment des ventes' : 'Coût manquant pour au moins une vente de produits',
        montant: grossMargin.cmv == null ? null : -grossMargin.cmv,
        impact: '-',
      },
      {
        type: 'Marge brute',
        description: grossMargin.marginPercent == null ? 'Non calculable avec les données de coût disponibles' : `Taux de marge : ${grossMargin.marginPercent}%`,
        montant: marginAmount,
        impact: '=',
      },
    ]);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Drill-down: Ventes d'un mois spécifique (dans la période sélectionnée)
router.get('/detail/ventes-mois', async (req, res) => {
  try {
    const { mois, dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    
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
    
    const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1)).toISOString().slice(0, 10);
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).toISOString().slice(0, 10);
    const debut = monthStart < period.start ? period.start : monthStart;
    const fin = monthEnd > period.effectiveEnd ? period.effectiveEnd : monthEnd;
    
    const ventesData = await db.query.factures.findMany({
      where: and(
        eq(factures.entrepriseId, eId),
        gte(factures.dateFacture, debut),
        lte(factures.dateFacture, fin),
        inArray(factures.statut, SALES_STATUS_VALUES),
      ),
      orderBy: [desc(factures.dateFacture)]
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
      numero: f.numeroFacture,
      dateFacture: f.dateFacture,
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
    const { categorie } = req.query;
    const eId = req.entrepriseId;
    if (!eId) return res.status(400).json({ error: 'entrepriseId requis' });
    const period = await getDashboardPeriod(req, eId);
    const [purchaseBills, expenseClaims] = await Promise.all([
      db.query.facturesAchat.findMany({
        where: and(
          eq(facturesAchat.entrepriseId, eId),
          gte(facturesAchat.dateFacture, period.start),
          lte(facturesAchat.dateFacture, period.effectiveEnd),
          inArray(facturesAchat.statut, PURCHASE_STATUS_VALUES),
        ),
        with: { fournisseur: true },
        orderBy: [desc(facturesAchat.dateFacture)],
      }),
      db.select({
        id: depensesTable.id,
        date: depensesTable.dateDepense,
        description: depensesTable.description,
        montant: depensesTable.montant,
        montantApprouve: depensesTable.montantApprouve,
        categorie: categoriesDepenses.nom,
      }).from(depensesTable)
        .leftJoin(categoriesDepenses, eq(categoriesDepenses.id, depensesTable.categorieId))
        .where(and(
          eq(depensesTable.entrepriseId, eId),
          eq(depensesTable.statut, 'approuvée'),
          gte(depensesTable.dateDepense, period.start),
          lte(depensesTable.dateDepense, period.effectiveEnd),
        )),
    ]);

    const purchaseRows = purchaseBills
      .filter((bill) => !categorie || (bill.fournisseur?.nom || 'Achats fournisseurs') === categorie)
      .map((bill) => ({
        id: bill.id,
        date: bill.dateFacture,
        description: bill.description || `Facture ${bill.numero || bill.id}`,
        categorie: bill.fournisseur?.nom || 'Achats fournisseurs',
        fournisseur: bill.fournisseur?.nom || 'Fournisseur inconnu',
        montant: Number(bill.totalTTC || 0),
      }));
    const expenseRows = expenseClaims
      .filter((expense) => !categorie || (expense.categorie || 'Autres dépenses approuvées') === categorie)
      .map((expense) => ({
        id: `depense-${expense.id}`,
        date: expense.date,
        description: expense.description || `Dépense #${expense.id}`,
        categorie: expense.categorie || 'Autres dépenses approuvées',
        fournisseur: 'Dépense approuvée',
        montant: Number(expense.montantApprouve || expense.montant || 0),
      }));
    const result = [...purchaseRows, ...expenseRows].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
