import express from 'express';
import { db } from '../db.js';
import { clients, factures, paiements, produitPrix, produits } from '../schema.js';
import { eq, and, desc, sql, gte, lte, between, gt, isNull, or } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import emailService from '../services/emailService.js';
import {
  calculateSellingPriceFromMarkup,
  synchronizeActiveProductPrices,
} from '../services/stockValuation.js';

const router = express.Router();

/**
 * GET /api/clients
 * Récupère la liste de tous les clients de l'entreprise (avec pagination)
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const clientsList = await db
      .select()
      .from(clients)
      .where(eq(clients.entrepriseId, req.entrepriseId))
      .orderBy(desc(clients.createdAt))
      .limit(Math.min(limit, 100)) // Max absolu de 100
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(clients)
      .where(eq(clients.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: clientsList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: clientsList,
    });
  } catch (error) {
    console.error('Erreur GET /api/clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients',
      error: error.message,
    });
  }
});

/**
 * GET /api/clients/comptes-a-recevoir
 * Génère un rapport détaillé des comptes à recevoir avec échéances
 * IMPORTANT: Doit être avant /:id pour ne pas être capturé par la route dynamique
 */
router.get('/comptes-a-recevoir', async (req, res) => {
  try {
    const { periode } = req.query; // '7j', '30j', '90j', 'tout'
    
    // Récupérer toutes les factures avec solde restant > 0 (impayées ou partiellement payées)
    // Note: L'enum invoice_status contient: 'brouillon', 'envoyee', 'payee', 'annulee', 'retard'
    // Les factures partiellement payées ont toujours statut 'envoyee' ou 'retard' avec soldeRestant > 0
    const facturesImpayees = await db
      .select({
        factureId: factures.id,
        numeroFacture: factures.numeroFacture,
        clientId: factures.clientId,
        clientNom: clients.nom,
        clientEmail: clients.email,
        dateFacture: factures.dateFacture,
        dateEcheance: factures.dateEcheance,
        totalTTC: factures.totalTTC,
        montantPaye: factures.montantPaye,
        soldeRestant: factures.soldeRestant,
        statut: factures.statut
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} IN ('envoyee', 'retard')`,
        sql`${factures.soldeRestant} > 0`
      ))
      .orderBy(factures.dateEcheance);

    // Calculer totaux par période d'ancienneté
    const now = new Date();
    const totaux = {
      total: 0,
      enRetard: 0,
      de0a30jours: 0,
      de31a60jours: 0,
      de61a90jours: 0,
      plus90jours: 0
    };

    const facturesParPeriode = {
      enRetard: [],
      de0a30jours: [],
      de31a60jours: [],
      de61a90jours: [],
      plus90jours: []
    };

    facturesImpayees.forEach(facture => {
      const solde = parseFloat(facture.soldeRestant || 0);
      totaux.total += solde;
      
      const echeance = new Date(facture.dateEcheance);
      const joursAvantEcheance = Math.ceil((echeance - now) / (1000 * 60 * 60 * 24));

      const factureFormatee = {
        ...facture,
        soldeRestant: solde,
        totalTTC: parseFloat(facture.totalTTC || 0),
        montantPaye: parseFloat(facture.montantPaye || 0),
        joursAvantEcheance
      };

      // Catégorisation par ancienneté d'échéance
      if (joursAvantEcheance < 0) {
        // En retard (échéance dépassée)
        totaux.enRetard += solde;
        facturesParPeriode.enRetard.push(factureFormatee);
      } else if (joursAvantEcheance >= 0 && joursAvantEcheance <= 30) {
        // Échéance dans les 0-30 prochains jours
        totaux.de0a30jours += solde;
        facturesParPeriode.de0a30jours.push(factureFormatee);
      } else if (joursAvantEcheance >= 31 && joursAvantEcheance <= 60) {
        // Échéance dans les 31-60 prochains jours
        totaux.de31a60jours += solde;
        facturesParPeriode.de31a60jours.push(factureFormatee);
      } else if (joursAvantEcheance >= 61 && joursAvantEcheance <= 90) {
        // Échéance dans les 61-90 prochains jours
        totaux.de61a90jours += solde;
        facturesParPeriode.de61a90jours.push(factureFormatee);
      } else {
        // Échéance dans plus de 90 jours
        totaux.plus90jours += solde;
        facturesParPeriode.plus90jours.push(factureFormatee);
      }
    });

    res.json({
      success: true,
      data: {
        totaux,
        facturesParPeriode,
        resume: {
          nombreFacturesImpayees: facturesImpayees.length,
          montantTotal: totaux.total,
          tauxRecouvrement: 0 // TODO: Calculer basé sur historique
        }
      }
    });

  } catch (error) {
    console.error('Erreur GET /api/clients/comptes-a-recevoir:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport de comptes à recevoir',
      error: error.message
    });
  }
});

/**
 * GET /api/clients/rapports
 * Génère des rapports analytiques sur les clients
 * IMPORTANT: Doit être avant /:id pour ne pas être capturé par la route dynamique
 */
router.get('/rapports', async (req, res) => {
  try {
    // 1. Top 10 clients par chiffre d'affaires
    const topClients = await db
      .select({
        clientId: factures.clientId,
        clientNom: clients.nom,
        totalCA: sql`SUM(${factures.totalTTC})::numeric`,
        nombreFactures: sql`COUNT(${factures.id})::int`
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} != 'annulee'`
      ))
      .groupBy(factures.clientId, clients.nom)
      .orderBy(sql`SUM(${factures.totalTTC}) DESC`)
      .limit(10);

    // 2. Clients avec retards de paiement
    const clientsRetard = await db
      .select({
        clientId: factures.clientId,
        clientNom: clients.nom,
        clientEmail: clients.email,
        nombreFacturesRetard: sql`COUNT(${factures.id})::int`,
        montantRetard: sql`SUM(${factures.totalTTC})::numeric`
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        eq(factures.statut, 'retard')
      ))
      .groupBy(factures.clientId, clients.nom, clients.email)
      .orderBy(sql`SUM(${factures.totalTTC}) DESC`);

    // 3. Chiffre d'affaires total
    const [caTotal] = await db
      .select({
        total: sql`COALESCE(SUM(${factures.totalTTC}), 0)::numeric`
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} NOT IN ('annulee', 'brouillon')`
      ));

    // 4. Analyse des échéances (factures à venir par période)
    const now = new Date();
    const dans7jours = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dans30jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [echeances7j] = await db
      .select({
        count: sql`COUNT(*)::int`,
        montant: sql`COALESCE(SUM(${factures.totalTTC}), 0)::numeric`
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        eq(factures.statut, 'envoyee'),
        sql`${factures.dateEcheance} BETWEEN ${now.toISOString()} AND ${dans7jours.toISOString()}`
      ));

    const [echeances30j] = await db
      .select({
        count: sql`COUNT(*)::int`,
        montant: sql`COALESCE(SUM(${factures.totalTTC}), 0)::numeric`
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        eq(factures.statut, 'envoyee'),
        sql`${factures.dateEcheance} BETWEEN ${now.toISOString()} AND ${dans30jours.toISOString()}`
      ));

    // 5. Distribution des paiements par client (pour graphiques)
    const distributionPaiements = await db
      .select({
        clientId: paiements.clientId,
        clientNom: clients.nom,
        totalPaye: sql`SUM(${paiements.montant})::numeric`,
        nombrePaiements: sql`COUNT(${paiements.id})::int`
      })
      .from(paiements)
      .leftJoin(clients, eq(paiements.clientId, clients.id))
      .where(eq(paiements.entrepriseId, req.entrepriseId))
      .groupBy(paiements.clientId, clients.nom)
      .orderBy(sql`SUM(${paiements.montant}) DESC`)
      .limit(10);

    res.json({
      success: true,
      data: {
        topClients: topClients.map(c => ({
          clientId: c.clientId,
          nom: c.clientNom || 'Client inconnu',
          chiffreAffaires: parseFloat(c.totalCA || 0),
          nombreFactures: c.nombreFactures
        })),
        clientsRetard: clientsRetard.map(c => ({
          clientId: c.clientId,
          nom: c.clientNom || 'Client inconnu',
          email: c.clientEmail,
          nombreFactures: c.nombreFacturesRetard,
          montantRetard: parseFloat(c.montantRetard || 0)
        })),
        chiffreAffaireTotal: parseFloat(caTotal.total || 0),
        echeances: {
          prochains7jours: {
            count: echeances7j.count,
            montant: parseFloat(echeances7j.montant || 0)
          },
          prochains30jours: {
            count: echeances30j.count,
            montant: parseFloat(echeances30j.montant || 0)
          }
        },
        distributionPaiements: distributionPaiements.map(d => ({
          clientId: d.clientId,
          nom: d.clientNom || 'Client inconnu',
          totalPaye: parseFloat(d.totalPaye || 0),
          nombrePaiements: d.nombrePaiements
        }))
      }
    });

  } catch (error) {
    console.error('Erreur GET /api/clients/rapports:', error);
    res.json({
      success: false,
      message: 'Erreur lors de la génération des rapports clients',
      error: error.message
    });
  }
});

/**
 * GET /api/clients/rapport-periode
 * Génère un rapport client pour une période donnée
 */
router.get('/rapport-periode', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;

    if (!dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'Les dates de début et fin sont requises'
      });
    }

    // Valider le format des dates
    const dateDebutObj = new Date(dateDebut);
    const dateFinObj = new Date(dateFin);
    
    if (isNaN(dateDebutObj.getTime()) || isNaN(dateFinObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Format de date invalide. Utilisez le format YYYY-MM-DD'
      });
    }

    if (dateDebutObj > dateFinObj) {
      return res.status(400).json({
        success: false,
        message: 'La date de début doit être antérieure à la date de fin'
      });
    }

    // 1. Chiffre d'affaires de la période
    const [caData] = await db
      .select({
        chiffreAffaires: sql`COALESCE(SUM(${factures.totalTTC}), 0)::numeric`,
        nombreFactures: sql`COUNT(${factures.id})::int`
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} NOT IN ('annulee', 'brouillon')`,
        sql`${factures.dateFacture} BETWEEN ${dateDebut} AND ${dateFin}`
      ));

    // 2. Paiements reçus durant la période
    const [paiementsData] = await db
      .select({
        paiementsRecus: sql`COALESCE(SUM(${paiements.montant}), 0)::numeric`,
        nombrePaiements: sql`COUNT(${paiements.id})::int`
      })
      .from(paiements)
      .where(and(
        eq(paiements.entrepriseId, req.entrepriseId),
        sql`${paiements.datePaiement} BETWEEN ${dateDebut} AND ${dateFin}`
      ));

    // 3. Soldes impayés (factures de la période non encore payées)
    const [soldesData] = await db
      .select({
        soldesImpayes: sql`COALESCE(SUM(COALESCE(${factures.soldeRestant}, 0)), 0)::numeric`
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} IN ('envoyee', 'retard')`,
        sql`${factures.dateFacture} BETWEEN ${dateDebut} AND ${dateFin}`,
        sql`COALESCE(${factures.soldeRestant}, 0) > 0`
      ));

    // 4. Top clients de la période
    const topClients = await db
      .select({
        clientId: factures.clientId,
        clientNom: clients.nom,
        chiffreAffaires: sql`SUM(${factures.totalTTC})::numeric`,
        nombreFactures: sql`COUNT(${factures.id})::int`
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        sql`${factures.statut} NOT IN ('annulee', 'brouillon')`,
        sql`${factures.dateFacture} BETWEEN ${dateDebut} AND ${dateFin}`
      ))
      .groupBy(factures.clientId, clients.nom)
      .orderBy(sql`SUM(${factures.totalTTC}) DESC`)
      .limit(10);

    res.json({
      success: true,
      data: {
        chiffreAffaires: parseFloat(caData.chiffreAffaires || 0),
        nombreFactures: caData.nombreFactures || 0,
        paiementsRecus: parseFloat(paiementsData.paiementsRecus || 0),
        nombrePaiements: paiementsData.nombrePaiements || 0,
        soldesImpayes: parseFloat(soldesData.soldesImpayes || 0),
        topClients: topClients.map(c => ({
          clientId: c.clientId,
          nom: c.clientNom || 'Client inconnu',
          chiffreAffaires: parseFloat(c.chiffreAffaires || 0),
          nombreFactures: c.nombreFactures
        })),
        periode: {
          dateDebut,
          dateFin
        }
      }
    });

  } catch (error) {
    console.error('Erreur GET /api/clients/rapport-periode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport par période',
      error: error.message
    });
  }
});

// ==========================================
// TABLE DE PRIX PRODUITS (Marge Brute)
// ==========================================

/**
 * GET /api/clients/prix-produits
 * Liste tous les prix produits avec calcul de marge
 */
router.get('/prix-produits', async (req, res) => {
  try {
    const { categorieClient, canalVente, actifOnly } = req.query;
    
    let conditions = [eq(produitPrix.entrepriseId, req.entrepriseId)];
    
    if (categorieClient) {
      conditions.push(eq(produitPrix.categorieClient, categorieClient));
    }
    if (canalVente) {
      conditions.push(eq(produitPrix.canalVente, canalVente));
    }
    if (actifOnly === 'true') {
      conditions.push(eq(produitPrix.actif, true));
      conditions.push(or(
        isNull(produitPrix.dateExpiration),
        gte(produitPrix.dateExpiration, sql`CURRENT_DATE`)
      ));
    }
    
    const prixList = await db
      .select({
        id: produitPrix.id,
        produitId: produitPrix.produitId,
        produitNom: produits.nom,
        produitReference: produits.reference,
        coutCMV: sql`COALESCE(NULLIF(${produits.coutMoyen}, 0), ${produits.prixAchat}, 0)`,
        coutAchat: produitPrix.coutAchat,
        margeBruteCible: produitPrix.margeBruteCible,
        prixVenteCalcule: produitPrix.prixVenteCalcule,
        prixVenteManuel: produitPrix.prixVenteManuel,
        categorieClient: produitPrix.categorieClient,
        canalVente: produitPrix.canalVente,
        dateEffet: produitPrix.dateEffet,
        dateExpiration: produitPrix.dateExpiration,
        devise: produitPrix.devise,
        actif: produitPrix.actif,
        createdAt: produitPrix.createdAt
      })
      .from(produitPrix)
      .leftJoin(produits, and(
        eq(produitPrix.produitId, produits.id),
        eq(produitPrix.entrepriseId, produits.entrepriseId)
      ))
      .where(and(...conditions))
      .orderBy(desc(produitPrix.createdAt));
    
    res.json({
      success: true,
      count: prixList.length,
      data: prixList
    });
  } catch (error) {
    console.error('Erreur GET /api/clients/prix-produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/clients/prix-produits/calculer
 * Calculer le prix de vente sans enregistrer (preview)
 */
router.post('/prix-produits/calculer', async (req, res) => {
  try {
    const { coutAchat, margeBruteCible } = req.body;
    
    if (coutAchat === undefined || margeBruteCible === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'coutAchat et margeBruteCible sont requis' 
      });
    }
    
    const marge = Number(margeBruteCible);
    const cout = Number(coutAchat);
    if (!Number.isFinite(marge) || marge < 0 || marge > 1000) {
      return res.status(400).json({ 
        success: false, 
        error: 'La majoration du CMV doit être comprise entre 0% et 1000%.'
      });
    }
    if (!Number.isFinite(cout) || cout < 0) {
      return res.status(400).json({ success: false, error: 'Le CMV doit être un montant positif ou nul.' });
    }

    const prixVenteCalcule = calculateSellingPriceFromMarkup(cout, marge);
    const beneficeBrut = prixVenteCalcule - cout;
    
    res.json({
      success: true,
      data: {
        coutAchat: cout,
        margeBruteCible: marge,
        prixVenteCalcule: Math.round(prixVenteCalcule * 100) / 100,
        beneficeBrut: Math.round(beneficeBrut * 100) / 100,
        formule: `${cout} × (1 + ${marge}/100) = ${prixVenteCalcule.toFixed(2)}`
      }
    });
  } catch (error) {
    console.error('Erreur calcul prix:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/clients/prix-produits
 * Créer un nouveau prix produit avec calcul automatique
 */
router.post('/prix-produits', async (req, res) => {
  try {
    const { 
      produitId, 
      coutAchat, 
      margeBruteCible, 
      prixVenteManuel,
      categorieClient = 'standard',
      canalVente = 'tous',
      dateEffet,
      dateExpiration,
      devise = 'FCFA'
    } = req.body;
    
    if (!produitId || coutAchat === undefined || margeBruteCible === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'produitId, coutAchat et margeBruteCible sont requis' 
      });
    }
    
    const marge = Number(margeBruteCible);
    if (!Number.isFinite(marge) || marge < 0 || marge > 1000) {
      return res.status(400).json({ 
        success: false, 
        error: 'La majoration du CMV doit être comprise entre 0% et 1000%.'
      });
    }
    const [product] = await db.select().from(produits).where(and(
      eq(produits.id, parseInt(produitId, 10)),
      eq(produits.entrepriseId, req.entrepriseId)
    )).limit(1);
    if (!product) return res.status(404).json({ success: false, error: 'Produit non trouvé dans cette entreprise.' });

    const cout = Math.max(0, Number(product.coutMoyen || product.prixAchat || 0));
    const prixVenteCalcule = calculateSellingPriceFromMarkup(cout, marge);
    const manualPrice = prixVenteManuel === undefined || prixVenteManuel === null || prixVenteManuel === ''
      ? null
      : Number(prixVenteManuel);
    if (manualPrice !== null && (!Number.isFinite(manualPrice) || manualPrice < 0)) {
      return res.status(400).json({ success: false, error: 'Le prix manuel doit être positif ou nul.' });
    }

    const effet = dateEffet || new Date().toISOString().split('T')[0];
    const expiration = dateExpiration || null;
    const [newPrix] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(produitPrix).values({
        entrepriseId: req.entrepriseId,
        produitId: parseInt(produitId, 10),
        coutAchat: cout.toFixed(2),
        margeBruteCible: marge.toFixed(2),
        prixVenteCalcule: prixVenteCalcule.toFixed(2),
        prixVenteManuel: manualPrice === null ? null : manualPrice.toFixed(2),
        categorieClient,
        canalVente,
        dateEffet: effet,
        dateExpiration: expiration,
        devise,
        actif: true
      }).returning();

      await synchronizeActiveProductPrices(tx, req.entrepriseId, product.id, cout);

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'produit_prix',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Prix calculé pour le produit ${product.nom}`,
        executor: tx,
        required: true,
      });
      return [created];
    });
    
    res.status(201).json({
      success: true,
      data: newPrix,
      message: `Prix calculé: ${prixVenteCalcule.toFixed(2)} ${devise} (majoration ${marge}% du CMV)`
    });
  } catch (error) {
    console.error('Erreur POST /api/clients/prix-produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/clients/prix-produits/:id
 * Mettre à jour un prix produit
 */
router.put('/prix-produits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      margeBruteCible,
      prixVenteManuel,
      categorieClient,
      canalVente,
      dateEffet,
      dateExpiration,
      actif
    } = req.body;

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(produitPrix).where(and(
        eq(produitPrix.id, parseInt(id, 10)),
        eq(produitPrix.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!existing) return { status: 404 };

      const [product] = await tx.select().from(produits).where(and(
        eq(produits.id, existing.produitId),
        eq(produits.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!product) return { status: 404 };

      const margin = margeBruteCible === undefined
        ? Number(existing.margeBruteCible)
        : Number(margeBruteCible);
      if (!Number.isFinite(margin) || margin < 0 || margin > 1000) {
        return { status: 400, error: 'La majoration du CMV doit être comprise entre 0% et 1000%.' };
      }

      const manualPrice = prixVenteManuel === undefined
        ? existing.prixVenteManuel
        : (prixVenteManuel === null || prixVenteManuel === '' ? null : Number(prixVenteManuel));
      if (manualPrice !== null && (!Number.isFinite(Number(manualPrice)) || Number(manualPrice) < 0)) {
        return { status: 400, error: 'Le prix manuel doit être positif ou nul.' };
      }

      const cmv = Math.max(0, Number(product.coutMoyen || product.prixAchat || 0));
      const calculatedPrice = calculateSellingPriceFromMarkup(cmv, margin);
      const updates = {
        coutAchat: cmv.toFixed(2),
        margeBruteCible: margin.toFixed(2),
        prixVenteCalcule: calculatedPrice.toFixed(2),
        prixVenteManuel: manualPrice === null ? null : Number(manualPrice).toFixed(2),
        updatedAt: new Date(),
      };
      if (categorieClient !== undefined) updates.categorieClient = categorieClient;
      if (canalVente !== undefined) updates.canalVente = canalVente;
      if (dateEffet !== undefined) updates.dateEffet = dateEffet;
      if (dateExpiration !== undefined) updates.dateExpiration = dateExpiration || null;
      if (actif !== undefined) updates.actif = actif;

      const [updated] = await tx.update(produitPrix).set(updates).where(and(
        eq(produitPrix.id, existing.id),
        eq(produitPrix.entrepriseId, req.entrepriseId)
      )).returning();
      await synchronizeActiveProductPrices(tx, req.entrepriseId, product.id, cmv);
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'produit_prix',
        recordId: updated.id,
        ancienneValeur: existing,
        nouvelleValeur: updated,
        description: `Prix de vente recalculé pour le produit ${product.nom}`,
        executor: tx,
        required: true,
      });
      return { status: 200, updated };
    });

    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, error: result.error || 'Prix ou produit non trouvé.' });
    }
    res.json({ success: true, data: result.updated });
  } catch (error) {
    console.error('Erreur PUT /api/clients/prix-produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/clients/prix-produits/:id
 * Supprimer un prix produit
 */
router.delete('/prix-produits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db
      .delete(produitPrix)
      .where(and(eq(produitPrix.id, parseInt(id)), eq(produitPrix.entrepriseId, req.entrepriseId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Prix non trouvé' });
    }
    
    res.json({ success: true, message: 'Prix supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /api/clients/prix-produits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/clients/:id
 * Récupère un client spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé',
      });
    }

    res.json({
      success: true,
      data: client[0],
    });
  } catch (error) {
    console.error('Erreur GET /api/clients/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du client',
      error: error.message,
    });
  }
});

/**
 * POST /api/clients
 * Crée un nouveau client
 */
router.post('/', async (req, res) => {
  try {
    const {
      numeroClient,
      nom,
      type,
      email,
      telephone,
      adresse,
      ville,
      pays,
      categorieClient,
      limiteCredit,
      delaiPaiement,
      remise,
      soldeDu,
      actif,
      compteComptableId,
      echeancesPersonnalisees,
      modesPaiementPreferes,
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || nom.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom du client est obligatoire',
      });
    }

    // Validation du type
    if (type && !['particulier', 'entreprise'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Le type doit être "particulier" ou "entreprise"',
      });
    }

    // Validation de l'email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide',
      });
    }

    // Validation des montants
    if (limiteCredit && (isNaN(limiteCredit) || limiteCredit < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La limite de crédit doit être un nombre positif',
      });
    }

    if (remise && (isNaN(remise) || remise < 0 || remise > 100)) {
      return res.status(400).json({
        success: false,
        message: 'La remise doit être un pourcentage entre 0 et 100',
      });
    }

    if (delaiPaiement && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif',
      });
    }

    // Validation des champs JSONB
    if (echeancesPersonnalisees && !Array.isArray(echeancesPersonnalisees)) {
      return res.status(400).json({
        success: false,
        message: 'Les échéances doivent être un tableau',
      });
    }

    if (echeancesPersonnalisees) {
      for (const ech of echeancesPersonnalisees) {
        if (!ech.jours || !ech.pourcentage || isNaN(ech.jours) || isNaN(ech.pourcentage)) {
          return res.status(400).json({
            success: false,
            message: 'Chaque échéance doit avoir jours et pourcentage valides',
          });
        }
        if (ech.pourcentage < 0 || ech.pourcentage > 100) {
          return res.status(400).json({
            success: false,
            message: 'Le pourcentage d\'échéance doit être entre 0 et 100',
          });
        }
      }
    }

    if (modesPaiementPreferes && !Array.isArray(modesPaiementPreferes)) {
      return res.status(400).json({
        success: false,
        message: 'Les modes de paiement doivent être un tableau',
      });
    }

    // Créer le client avec l'entrepriseId automatique
    const newClient = await db
      .insert(clients)
      .values({
        entrepriseId: req.entrepriseId,
        numeroClient: numeroClient || null,
        nom: nom.trim(),
        type: type || 'particulier',
        email: email || null,
        telephone: telephone || null,
        adresse: adresse || null,
        ville: ville || null,
        pays: pays || null,
        categorieClient: categorieClient || 'standard',
        limiteCredit: limiteCredit || '0',
        delaiPaiement: delaiPaiement || 30,
        remise: remise || '0',
        soldeDu: soldeDu || '0',
        actif: actif !== undefined ? actif : true,
        compteComptableId: compteComptableId || null,
        echeancesPersonnalisees: echeancesPersonnalisees || null,
        modesPaiementPreferes: modesPaiementPreferes || null,
      })
      .returning();

    // Générer et assigner le code auxiliaire automatiquement
    const codeAuxiliaire = 'CLI' + String(newClient[0].id).padStart(5, '0');
    await db.update(clients)
      .set({ codeAuxiliaire })
      .where(eq(clients.id, newClient[0].id));
    newClient[0].codeAuxiliaire = codeAuxiliaire;

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'clients',
      recordId: newClient[0].id,
      nouvelleValeur: newClient[0],
      description: `Client créé: ${nom}`
    });

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: newClient[0],
    });
  } catch (error) {
    console.error('Erreur POST /api/clients:', error);
    
    // Gestion des erreurs de contraintes
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: 'Ce numéro de client existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du client',
      error: error.message,
    });
  }
});

/**
 * PUT /api/clients/:id
 * Met à jour un client existant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numeroClient,
      nom,
      type,
      email,
      telephone,
      adresse,
      ville,
      pays,
      categorieClient,
      limiteCredit,
      delaiPaiement,
      remise,
      soldeDu,
      actif,
      compteComptableId,
      echeancesPersonnalisees,
      modesPaiementPreferes,
    } = req.body;

    // Vérifier que le client existe et appartient à l'entreprise
    const existingClient = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé ou accès non autorisé',
      });
    }

    // Validation du type
    if (type && !['particulier', 'entreprise'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Le type doit être "particulier" ou "entreprise"',
      });
    }

    // Validation de l'email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide',
      });
    }

    // Validation des montants
    if (limiteCredit !== undefined && (isNaN(limiteCredit) || limiteCredit < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La limite de crédit doit être un nombre positif',
      });
    }

    if (remise !== undefined && (isNaN(remise) || remise < 0 || remise > 100)) {
      return res.status(400).json({
        success: false,
        message: 'La remise doit être un pourcentage entre 0 et 100',
      });
    }

    if (delaiPaiement !== undefined && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif',
      });
    }

    if (soldeDu !== undefined && isNaN(soldeDu)) {
      return res.status(400).json({
        success: false,
        message: 'Le solde dû doit être un nombre valide',
      });
    }

    // Validation des champs JSONB
    if (echeancesPersonnalisees !== undefined) {
      if (!Array.isArray(echeancesPersonnalisees)) {
        return res.status(400).json({
          success: false,
          message: 'Les échéances doivent être un tableau',
        });
      }
      for (const ech of echeancesPersonnalisees) {
        if (!ech.jours || !ech.pourcentage || isNaN(ech.jours) || isNaN(ech.pourcentage)) {
          return res.status(400).json({
            success: false,
            message: 'Chaque échéance doit avoir jours et pourcentage valides',
          });
        }
        if (ech.pourcentage < 0 || ech.pourcentage > 100) {
          return res.status(400).json({
            success: false,
            message: 'Le pourcentage d\'échéance doit être entre 0 et 100',
          });
        }
      }
    }

    if (modesPaiementPreferes !== undefined && !Array.isArray(modesPaiementPreferes)) {
      return res.status(400).json({
        success: false,
        message: 'Les modes de paiement doivent être un tableau',
      });
    }

    // Construire l'objet de mise à jour (seulement les champs fournis)
    const updateData = {
      updatedAt: new Date(),
    };

    if (numeroClient !== undefined) updateData.numeroClient = numeroClient;
    if (nom !== undefined) updateData.nom = nom.trim();
    if (type !== undefined) updateData.type = type;
    if (email !== undefined) updateData.email = email;
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresse !== undefined) updateData.adresse = adresse;
    if (ville !== undefined) updateData.ville = ville;
    if (pays !== undefined) updateData.pays = pays;
    if (categorieClient !== undefined) updateData.categorieClient = categorieClient;
    if (limiteCredit !== undefined) updateData.limiteCredit = limiteCredit;
    if (delaiPaiement !== undefined) updateData.delaiPaiement = delaiPaiement;
    if (remise !== undefined) updateData.remise = remise;
    if (soldeDu !== undefined) updateData.soldeDu = soldeDu;
    if (actif !== undefined) updateData.actif = actif;
    if (compteComptableId !== undefined) updateData.compteComptableId = compteComptableId;
    if (echeancesPersonnalisees !== undefined) updateData.echeancesPersonnalisees = echeancesPersonnalisees;
    if (modesPaiementPreferes !== undefined) updateData.modesPaiementPreferes = modesPaiementPreferes;

    // Mettre à jour le client
    const updatedClient = await db
      .update(clients)
      .set(updateData)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'UPDATE',
      table: 'clients',
      recordId: parseInt(id),
      ancienneValeur: existingClient[0],
      nouvelleValeur: updatedClient[0],
      description: `Client modifié: ${updatedClient[0].nom}`
    });

    res.json({
      success: true,
      message: 'Client mis à jour avec succès',
      data: updatedClient[0],
    });
  } catch (error) {
    console.error('Erreur PUT /api/clients/:id:', error);
    
    // Gestion des erreurs de contraintes
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ce numéro de client existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du client',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Supprime un client
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le client existe et appartient à l'entreprise
    const existingClient = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé ou accès non autorisé',
      });
    }

    // Audit log avant suppression
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'DELETE',
      table: 'clients',
      recordId: parseInt(id),
      ancienneValeur: existingClient[0],
      description: `Client supprimé: ${existingClient[0].nom}`
    });

    // Supprimer le client
    await db
      .delete(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ));

    res.json({
      success: true,
      message: 'Client supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/clients/:id:', error);
    
    // Gestion des erreurs de contraintes (ex: client utilisé dans factures)
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce client car il est utilisé dans d\'autres enregistrements (factures, commandes, etc.)',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du client',
      error: error.message,
    });
  }
});

/**
 * POST /api/clients/etat-compte
 * Génère un état de compte client sur une période donnée
 */
router.post('/etat-compte', async (req, res) => {
  try {
    const { clientId, dateDebut, dateFin } = req.body;

    if (!clientId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'clientId, dateDebut et dateFin sont requis'
      });
    }

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(clientId)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const facturesList = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.clientId, parseInt(clientId)),
        eq(factures.entrepriseId, req.entrepriseId),
        gte(factures.dateFacture, dateDebut),
        lte(factures.dateFacture, dateFin)
      ))
      .orderBy(factures.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(and(
        eq(paiements.entrepriseId, req.entrepriseId),
        gte(paiements.datePaiement, dateDebut),
        lte(paiements.datePaiement, dateFin)
      ))
      .orderBy(paiements.datePaiement);

    const paiementsClient = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);
    const totalPaye = paiementsClient.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    res.json({
      success: true,
      data: {
        client: client[0],
        factures: facturesList,
        paiements: paiementsClient,
        totalFacture,
        totalPaye,
        solde,
        periode: { dateDebut, dateFin }
      }
    });

  } catch (error) {
    console.error('Erreur POST /api/clients/etat-compte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'état de compte',
      error: error.message
    });
  }
});

/**
 * POST /api/clients/etat-compte/email
 * Envoie un état de compte client par email
 */
router.post('/etat-compte/email', async (req, res) => {
  try {
    const { clientId, dateDebut, dateFin } = req.body;

    if (!clientId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'clientId, dateDebut et dateFin sont requis'
      });
    }

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(clientId)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    if (!client[0].email) {
      return res.status(400).json({
        success: false,
        message: 'Ce client n\'a pas d\'adresse email configurée'
      });
    }

    const facturesList = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.clientId, parseInt(clientId)),
        eq(factures.entrepriseId, req.entrepriseId),
        gte(factures.dateFacture, dateDebut),
        lte(factures.dateFacture, dateFin)
      ))
      .orderBy(factures.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(and(
        eq(paiements.entrepriseId, req.entrepriseId),
        gte(paiements.datePaiement, dateDebut),
        lte(paiements.datePaiement, dateFin)
      ))
      .orderBy(paiements.datePaiement);

    const paiementsClient = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + parseFloat(f.totalTTC || 0), 0);
    const totalPaye = paiementsClient.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    const dateDebutFr = new Date(dateDebut).toLocaleDateString('fr-FR');
    const dateFinFr = new Date(dateFin).toLocaleDateString('fr-FR');

    let facturesHtml = '';
    if (facturesList.length > 0) {
      facturesHtml = `
        <h3>📋 Factures</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px; text-align: left;">N° Facture</th>
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: right;">Montant TTC</th>
              <th style="padding: 12px; text-align: center;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${facturesList.map(f => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${f.numeroFacture}</td>
                <td style="padding: 12px;">${new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold;">${(f.totalTTC || 0).toLocaleString('fr-FR')} FCFA</td>
                <td style="padding: 12px; text-align: center;">
                  <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; background-color: ${f.statut === 'payee' ? '#d4edda' : '#fff3cd'}; color: ${f.statut === 'payee' ? '#155724' : '#856404'};">
                    ${f.statut === 'payee' ? '✅ Payée' : '⏳ En attente'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let paiementsHtml = '';
    if (paiementsClient.length > 0) {
      paiementsHtml = `
        <h3>💳 Paiements</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: left;">Référence</th>
              <th style="padding: 12px; text-align: left;">Mode</th>
              <th style="padding: 12px; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${paiementsClient.map(p => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px;">${p.reference || '-'}</td>
                <td style="padding: 12px;">${p.modePaiement || '-'}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #27ae60;">${(p.montant || 0).toLocaleString('fr-FR')} FCFA</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3498db; padding-bottom: 20px;">
          <h1 style="color: #3498db; margin: 0 0 10px 0;">ÉTAT DE COMPTE CLIENT</h1>
          <p style="margin: 5px 0; font-size: 16px;"><strong>${client[0].nom}</strong></p>
          <p style="margin: 5px 0; color: #666;">Période: ${dateDebutFr} au ${dateFinFr}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="padding: 15px; background-color: #e8f4f8; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Facturé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3498db;">${totalFacture.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div style="padding: 15px; background-color: #e8f8f0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Payé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #27ae60;">${totalPaye.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div style="padding: 15px; background-color: #fff3e0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Solde Restant</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${solde > 0 ? '#e74c3c' : '#27ae60'};">${solde.toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>

        ${facturesHtml}
        ${paiementsHtml}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
          <p>Cet état de compte a été généré automatiquement par ComptaOrion</p>
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: client[0].email,
      subject: `État de Compte - ${client[0].nom} (${dateDebutFr} au ${dateFinFr})`,
      html: emailHtml,
      entrepriseId: req.entrepriseId,
      typeEmail: 'etat_compte'
    });

    res.json({
      success: true,
      message: `État de compte envoyé à ${client[0].email} avec succès`
    });

  } catch (error) {
    console.error('Erreur POST /api/clients/etat-compte/email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'état de compte',
      error: error.message
    });
  }
});

/**
 * GET /api/clients/export/csv
 * Export CSV de tous les clients
 */
router.get('/export/csv', async (req, res) => {
  try {
    const clientsList = await db
      .select()
      .from(clients)
      .where(eq(clients.entrepriseId, req.entrepriseId))
      .orderBy(desc(clients.createdAt));

    const csv = [
      'Nom;Email;Telephone;Adresse;Ville;Pays;NIF;Date Creation',
      ...clientsList.map(c => 
        `${c.nom || ''};${c.email || ''};${c.telephone || ''};${c.adresse || ''};${c.ville || ''};${c.pays || ''};${c.nif || ''};${c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : ''}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Erreur export clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DRILL-DOWN ENDPOINTS
// ==========================================

/**
 * GET /api/clients/detail/chiffre-affaires
 * Détail des factures pour le chiffre d'affaires
 */
router.get('/detail/chiffre-affaires', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    let whereConditions = [eq(factures.entrepriseId, eId)];
    if (dateDebut) whereConditions.push(gte(factures.dateFacture, new Date(dateDebut)));
    if (dateFin) whereConditions.push(lte(factures.dateFacture, new Date(dateFin)));
    
    const facturesData = await db
      .select({
        id: factures.id,
        numero: factures.numero,
        date: factures.dateFacture,
        montant: factures.totalTTC,
        statut: factures.statut,
        clientId: factures.clientId
      })
      .from(factures)
      .where(and(...whereConditions))
      .orderBy(desc(factures.dateFacture));
    
    // Récupérer les noms des clients
    const clientIds = [...new Set(facturesData.map(f => f.clientId))];
    const clientsData = clientIds.length > 0 ? await db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.entrepriseId, eId)) : [];
    
    const clientMap = {};
    clientsData.forEach(c => clientMap[c.id] = c.nom);
    
    const result = facturesData.map(f => ({
      ...f,
      client: clientMap[f.clientId] || 'Client inconnu'
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Erreur drill-down CA:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/detail/factures
 * Détail des factures émises
 */
router.get('/detail/factures', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    let whereConditions = [eq(factures.entrepriseId, eId)];
    if (dateDebut) whereConditions.push(gte(factures.dateFacture, new Date(dateDebut)));
    if (dateFin) whereConditions.push(lte(factures.dateFacture, new Date(dateFin)));
    
    const facturesData = await db
      .select({
        id: factures.id,
        numero: factures.numero,
        date: factures.dateFacture,
        montant: factures.totalTTC,
        statut: factures.statut,
        clientId: factures.clientId
      })
      .from(factures)
      .where(and(...whereConditions))
      .orderBy(desc(factures.dateFacture));
    
    const clientIds = [...new Set(facturesData.map(f => f.clientId))];
    const clientsData = clientIds.length > 0 ? await db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.entrepriseId, eId)) : [];
    
    const clientMap = {};
    clientsData.forEach(c => clientMap[c.id] = c.nom);
    
    res.json(facturesData.map(f => ({ ...f, client: clientMap[f.clientId] || 'Client inconnu' })));
  } catch (error) {
    console.error('Erreur drill-down factures:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/detail/paiements
 * Détail des paiements reçus
 */
router.get('/detail/paiements', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    let whereConditions = [eq(paiements.entrepriseId, eId)];
    if (dateDebut) whereConditions.push(gte(paiements.datePaiement, new Date(dateDebut)));
    if (dateFin) whereConditions.push(lte(paiements.datePaiement, new Date(dateFin)));
    
    const paiementsData = await db
      .select({
        id: paiements.id,
        date: paiements.datePaiement,
        montant: paiements.montant,
        modePaiement: paiements.modePaiement,
        reference: paiements.reference,
        factureId: paiements.factureId
      })
      .from(paiements)
      .where(and(...whereConditions))
      .orderBy(desc(paiements.datePaiement));
    
    // Récupérer les factures pour avoir les clients
    const factureIds = [...new Set(paiementsData.map(p => p.factureId))];
    const facturesData = factureIds.length > 0 ? await db
      .select({ id: factures.id, clientId: factures.clientId })
      .from(factures)
      .where(eq(factures.entrepriseId, eId)) : [];
    
    const clientIds = [...new Set(facturesData.map(f => f.clientId))];
    const clientsData = clientIds.length > 0 ? await db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.entrepriseId, eId)) : [];
    
    const factureMap = {};
    facturesData.forEach(f => factureMap[f.id] = f.clientId);
    const clientMap = {};
    clientsData.forEach(c => clientMap[c.id] = c.nom);
    
    res.json(paiementsData.map(p => ({
      ...p,
      client: clientMap[factureMap[p.factureId]] || 'Client inconnu'
    })));
  } catch (error) {
    console.error('Erreur drill-down paiements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/detail/impayes
 * Détail des soldes impayés
 */
router.get('/detail/impayes', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    
    const facturesData = await db
      .select({
        id: factures.id,
        numero: factures.numero,
        date: factures.dateFacture,
        echeance: factures.dateEcheance,
        solde: factures.soldeRestant,
        clientId: factures.clientId,
        statut: factures.statut
      })
      .from(factures)
      .where(and(
        eq(factures.entrepriseId, eId),
        gt(factures.soldeRestant, 0)
      ))
      .orderBy(desc(factures.dateEcheance));
    
    const clientIds = [...new Set(facturesData.map(f => f.clientId))];
    const clientsData = clientIds.length > 0 ? await db
      .select({ id: clients.id, nom: clients.nom })
      .from(clients)
      .where(eq(clients.entrepriseId, eId)) : [];
    
    const clientMap = {};
    clientsData.forEach(c => clientMap[c.id] = c.nom);
    
    res.json(facturesData.map(f => ({
      ...f,
      client: clientMap[f.clientId] || 'Client inconnu'
    })));
  } catch (error) {
    console.error('Erreur drill-down impayés:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
