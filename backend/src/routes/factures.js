import express from 'express';
import { db } from '../db.js';
import { factures, factureItems, paiements, clients, produits, transactionsTresorerie, comptesBancaires, ecritures, lignesEcritures, journaux, comptesComptables, mouvementsStock, entreprises, notesCredit, notesCreditItems } from '../schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import emailService from '../services/emailService.js';
import {
  createEcritureCoutVente,
  createEcritureFactureVente,
  createEcritureAnnulationFactureVente,
  createEcriturePaiementClient,
  createEcritureAvoirClient,
  createEcritureNoteDebitClient,
  createEcritureEncaissementCheque,
} from '../services/comptabiliteService.js';
import { claimIdempotentOperation } from '../middleware/idempotency.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { consumeStockValuation, createStockValuationLayer, updateProductAverageCost } from '../services/stockValuation.js';
import { addDaysToIsoDate, calculateCashDiscount } from '../services/paymentTerms.js';
import { calculateCreditNoteVat, calculateReturnedLine } from '../services/creditNoteCalculations.js';
import { generateCreditNoteNumber } from '../services/creditNoteNumbering.js';

const router = express.Router();

/**
 * Génère le prochain numéro de facture
 * (cloisonné à l'entreprise : FACT-AAAA-{id entreprise}-NNNN ;
 * exporté pour la conversion devis→facture dans routes/devis.js)
 */
export async function genererNumeroFacture(entrepriseId, executor = db) {
  const annee = new Date().getFullYear();
  const [lastFacture] = await executor
    .select({ numeroFacture: factures.numeroFacture })
    .from(factures)
    .where(and(
      eq(factures.entrepriseId, entrepriseId),
      sql`EXTRACT(YEAR FROM ${factures.dateFacture}::date) = ${annee}`
    ))
    .orderBy(desc(factures.createdAt))
    .limit(1);

  let numero = 1;
  if (lastFacture?.numeroFacture) {
    const match = lastFacture.numeroFacture.match(/FACT-(\d{4})-(?:\d+-)?(\d+)$/);
    if (match) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `FACT-${annee}-${entrepriseId}-${numero.toString().padStart(4, '0')}`;
}

/**
 * GET /api/factures
 * Récupère la liste de toutes les factures
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const facturesList = await db
      .select({
        facture: factures,
        client: {
          id: clients.id,
          nom: clients.nom,
          email: clients.email,
          telephone: clients.telephone,
        }
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(eq(factures.entrepriseId, req.entrepriseId))
      .orderBy(desc(factures.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(factures)
      .where(eq(factures.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: facturesList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: facturesList,
    });
  } catch (error) {
    console.error('Erreur GET /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures',
      error: error.message,
    });
  }
});



/**
 * GET /api/factures/:id
 * Récupère une facture spécifique avec ses lignes et paiements
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [factureData] = await db
      .select({
        facture: factures,
        client: clients,
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    const items = await db
      .select()
      .from(factureItems)
      .where(eq(factureItems.factureId, parseInt(id)));

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(eq(paiements.factureId, parseInt(id)))
      .orderBy(desc(paiements.datePaiement));

    res.json({
      success: true,
      data: {
        ...factureData.facture,
        client: factureData.client,
        items,
        paiements: paiementsList,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures
 * Crée une nouvelle facture
 */
router.post('/', async (req, res) => {
  try {
    const {
      clientId,
      dateFacture,
      dateEcheance,
      notes,
      items,
    } = req.body;

    // Validation
    if (!clientId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client et au moins un article sont obligatoires',
      });
    }
    const [ownedClient] = await db.select({
      id: clients.id,
      delaiPaiement: clients.delaiPaiement,
      escomptePourcentage: clients.escomptePourcentage,
      delaiEscompte: clients.delaiEscompte,
    }).from(clients)
      .where(and(eq(clients.id, parseInt(clientId)), eq(clients.entrepriseId, req.entrepriseId))).limit(1);
    if (!ownedClient) return res.status(400).json({ success: false, message: 'Client non trouvé ou non autorisé' });
    const productIds = [...new Set(items.filter(item => item.produitId).map(item => parseInt(item.produitId)))];
    if (productIds.some(id => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ success: false, message: 'Produit invalide' });
    }
    const productNames = new Map();
    for (const productId of productIds) {
      const [ownedProduct] = await db.select({ id: produits.id, nom: produits.nom }).from(produits)
        .where(and(eq(produits.id, productId), eq(produits.entrepriseId, req.entrepriseId))).limit(1);
      if (!ownedProduct) return res.status(400).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
      productNames.set(productId, ownedProduct.nom);
    }
    if (items.some(item => !Number.isFinite(Number(item.quantite)) || Number(item.quantite) <= 0 || !Number.isFinite(Number(item.prixUnitaire)) || Number(item.prixUnitaire) < 0)) {
      return res.status(400).json({ success: false, message: 'Quantité et prix doivent être valides' });
    }
    if (items.some(item => !Number.isFinite(Number(item.remise || 0)) || Number(item.remise || 0) < 0 || Number(item.remise || 0) > 100)) {
      return res.status(400).json({ success: false, message: 'La remise doit être comprise entre 0 et 100' });
    }

    // Calculer les totaux
    let totalHT = 0;
    items.forEach(item => {
      const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalApresRemise = totalLigne * (1 - remise / 100);
      totalHT += totalApresRemise;
    });

    // Récupérer le taux TVA
    const [entreprise] = await db
      .select({ tauxTva: sql`taux_tva` })
      .from(sql`entreprises`)
      .where(sql`id = ${req.entrepriseId}`);

    const tauxTva = parseFloat(entreprise?.tauxTva ?? 18);
    const totalTVA = totalHT * (tauxTva / 100);
    const totalTTC = totalHT + totalTVA;

    const newFacture = await db.transaction(async tx => {
    // Serialize numbering for this company; header, lines and accounting commit together.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${req.entrepriseId}::integer, 42)`);
    const numeroFacture = await genererNumeroFacture(req.entrepriseId, tx);
    const effectiveDateFacture = dateFacture || new Date().toISOString().slice(0, 10);

    // Créer la facture
    const [newFacture] = await tx
      .insert(factures)
      .values({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        clientId: parseInt(clientId),
        statut: 'brouillon',
        dateFacture: effectiveDateFacture,
        dateEcheance: addDaysToIsoDate(effectiveDateFacture, ownedClient.delaiPaiement ?? 30),
        escomptePourcentage: String(ownedClient.escomptePourcentage || 0),
        dateLimiteEscompte: Number(ownedClient.escomptePourcentage || 0) > 0
          ? addDaysToIsoDate(effectiveDateFacture, ownedClient.delaiEscompte || 0)
          : null,
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        montantPaye: '0',
        soldeRestant: totalTTC.toFixed(2),
        notes: notes || null,
        userId: req.user.id,
      })
      .returning();

    // Créer les lignes de facture
    const factureItemsData = items.map(item => {
      const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalApresRemise = totalLigne * (1 - remise / 100);

      return {
        entrepriseId: req.entrepriseId,
        factureId: newFacture.id,
        produitId: item.produitId || null,
        description: item.description || productNames.get(Number(item.produitId)) || 'Article',
        quantite: item.quantite,
        prixUnitaire: item.prixUnitaire,
        remise: item.remise || '0',
        totalLigne: totalApresRemise.toFixed(2),
      };
    });

    await tx.insert(factureItems).values(factureItemsData);

    // Impact automatique sur COMPTABILITÉ - Journal des Ventes
    // Débit: Client (411) - Crédit: Ventes (701) + TVA (443)
      const clientData = await tx.select().from(clients).where(and(eq(clients.id, parseInt(clientId)), eq(clients.entrepriseId, req.entrepriseId))).limit(1);
      const clientInfo = clientData[0] || {};
      
      const ecriture = await createEcritureFactureVente({
        entrepriseId: req.entrepriseId,
        clientId: Number(clientId),
        numeroFacture,
        dateFacture: dateFacture || new Date().toISOString().split('T')[0],
        clientNom: clientInfo.nom || 'Client',
        totalHT,
        totalTVA,
        totalTTC,
        executor: tx
      });
      if (!ecriture) throw new Error('Configurez le compte collectif client 4111/4112, les ventes et la TVA avant de facturer.');
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'factures',
        recordId: newFacture.id,
        nouvelleValeur: { facture: newFacture, items: factureItemsData, ecritureId: ecriture.id },
        description: `Facture créée: ${numeroFacture}`,
        executor: tx,
        required: true
      });
      return newFacture;
    });

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: newFacture,
    });
  } catch (error) {
    console.error('Erreur POST /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures/:id/paiement
 * Enregistre un paiement pour une facture
 * Impact automatique sur comptabilité et trésorerie
 */
router.post('/:id/paiement', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      montant,
      modePaiement, // mobile_money, carte_bancaire, virement, especes
      reference,
      datePaiement,
      compteBancaireId,
      notes,
      appliquerEscompte = false,
    } = req.body;

    // Validation
    if (!Number.isFinite(Number(montant)) || Number(montant) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant du paiement doit être positif',
      });
    }

    if (!modePaiement) {
      return res.status(400).json({
        success: false,
        message: 'Le mode de paiement est obligatoire',
      });
    }
    if (modePaiement === 'cheque' && !String(reference || '').trim()) {
      return res.status(400).json({ success: false, message: 'Le numéro du chèque est obligatoire.' });
    }

    const result = await db.transaction(async tx => {
    // Lock before checking the balance, so concurrent payments cannot overpay.
    const [factureData] = await tx
      .select()
      .from(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1).for('update');

    if (!factureData) {
      throw Object.assign(new Error('Facture non trouvée'), { status: 404 });
    }

    const montantPaiement = parseFloat(montant);
    const soldeRestant = parseFloat(factureData.soldeRestant);
    const effectivePaymentDate = String(datePaiement || new Date().toISOString().slice(0, 10)).slice(0, 10);
    let discount = null;
    if (appliquerEscompte) {
      discount = calculateCashDiscount({
        totalHT: factureData.totalHT,
        totalTVA: factureData.totalTVA,
        totalTTC: factureData.totalTTC,
        rate: factureData.escomptePourcentage,
        discountDeadline: factureData.dateLimiteEscompte,
        paymentDate: effectivePaymentDate,
        hasPriorPayments: Number(factureData.montantPaye || 0) > 0 || Number(factureData.montantEscompte || 0) > 0,
      });
      if (!discount) {
        throw Object.assign(new Error('Cet escompte n’est pas applicable : il faut régler toute la facture avant sa date limite, sans paiement antérieur.'), { status: 400 });
      }
      if (Math.abs(montantPaiement - discount.montantNetTTC) > 0.01) {
        throw Object.assign(new Error(`Pour appliquer l’escompte, le paiement doit être de ${discount.montantNetTTC.toFixed(2)} XOF.`), { status: 400 });
      }
    }

    const discountTTC = discount?.montantTTC || 0;
    if (montantPaiement + discountTTC > soldeRestant + 0.01) {
      throw Object.assign(new Error('Le paiement dépasse le solde restant'), { status: 400 });
    }
    if (factureData.statut === 'annulee') throw Object.assign(new Error('Facture annulée'), { status:400 });
    let compte;
    if (compteBancaireId && modePaiement !== 'cheque') {
      [compte] = await tx.select().from(comptesBancaires)
        .where(and(eq(comptesBancaires.id, Number(compteBancaireId)), eq(comptesBancaires.entrepriseId, req.entrepriseId)))
        .limit(1).for('update');
      if (!compte) throw Object.assign(new Error('Compte bancaire non trouvé ou non autorisé'), { status:400 });
    }

    // Enregistrer le paiement
    const [newPaiement] = await tx
      .insert(paiements)
      .values({
        entrepriseId: req.entrepriseId,
        factureId: parseInt(id),
        clientId: factureData.clientId,
        montant: montantPaiement.toFixed(2),
        montantEscompteHT: (discount?.montantHT || 0).toFixed(2),
        montantEscompteTVA: (discount?.montantTVA || 0).toFixed(2),
        montantEscompteTTC: discountTTC.toFixed(2),
        modePaiement,
        reference: reference || null,
        datePaiement: datePaiement || new Date().toISOString().split('T')[0],
        notes: notes || null,
        statutCheque: modePaiement === 'cheque' ? 'en_attente' : 'non_applicable',
        compteBancaireId: modePaiement === 'cheque' && compteBancaireId ? parseInt(compteBancaireId) : null,
        userId: req.user.id,
      })
      .returning();

    // Mettre à jour la facture
    const nouveauMontantPaye = parseFloat(factureData.montantPaye) + montantPaiement;
    const nouveauMontantEscompte = Number(factureData.montantEscompte || 0) + discountTTC;
    const nouveauSoldeRestant = parseFloat(factureData.totalTTC) - nouveauMontantPaye - nouveauMontantEscompte;
    const nouveauStatut = nouveauSoldeRestant <= 0.01 ? 'payee' : 'envoyee';

    await tx
      .update(factures)
      .set({
        montantPaye: nouveauMontantPaye.toFixed(2),
        montantEscompte: nouveauMontantEscompte.toFixed(2),
        soldeRestant: Math.max(0, nouveauSoldeRestant).toFixed(2),
        statut: nouveauStatut,
        updatedAt: new Date(),
      })
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ));

    // Impact automatique sur TRÉSORERIE
    if (compteBancaireId && modePaiement !== 'cheque') {
      // Enregistrer la transaction de trésorerie
      await tx.insert(transactionsTresorerie).values({
        entrepriseId: req.entrepriseId,
        compteBancaireId: parseInt(compteBancaireId),
        type: 'encaissement',
        montant: montantPaiement.toFixed(2),
        dateTransaction: datePaiement || new Date().toISOString().split('T')[0],
        categorie: 'Vente',
        description: `Paiement facture ${factureData.numeroFacture}`,
        tiersNom: null,
        numeroPiece: reference || `PAI-${newPaiement.id}`,
        userId: req.user.id,
      });

      // Mettre à jour le solde du compte bancaire
      if (compte) {
        const nouveauSolde = parseFloat(compte.soldeActuel) + montantPaiement;
        await tx
          .update(comptesBancaires)
          .set({
            soldeActuel: nouveauSolde.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(comptesBancaires.id, parseInt(compteBancaireId)));
      }
    }

    // Impact automatique sur COMPTABILITÉ
    // Débit: Banque/Caisse - Crédit: Client (411)
      const clientData = await tx.select().from(clients).where(and(eq(clients.id, factureData.clientId),eq(clients.entrepriseId,req.entrepriseId))).limit(1);
      const clientInfo = clientData[0] || {};
      
      const ecriture = await createEcriturePaiementClient({
        entrepriseId: req.entrepriseId,
        clientId: factureData.clientId,
        reference: reference || `PAI-${newPaiement.id}`,
        datePaiement: datePaiement || new Date().toISOString().split('T')[0],
        clientNom: clientInfo.nom || 'Client',
        montant: montantPaiement,
        escompteHT: discount?.montantHT || 0,
        modePaiement: modePaiement === 'cheque' ? 'cheque' : modePaiement === 'especes' ? 'especes' : 'banque',
        compteBancaireId: compteBancaireId ? parseInt(compteBancaireId) : null,
        executor: tx
      });
      if (!ecriture) throw new Error('Configurez les comptes de trésorerie et le compte collectif client 4111/4112 avant de payer.');
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'paiements',
        recordId: newPaiement.id,
        nouvelleValeur: { paiement: newPaiement, factureId: factureData.id, ecritureId: ecriture.id },
        description: `Paiement ${montantPaiement.toFixed(2)} enregistré pour la facture ${factureData.numeroFacture}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'factures',
        recordId: factureData.id,
        ancienneValeur: {
          montantPaye: factureData.montantPaye,
          soldeRestant: factureData.soldeRestant,
          statut: factureData.statut
        },
        nouvelleValeur: {
          montantPaye: nouveauMontantPaye.toFixed(2),
          soldeRestant: Math.max(0, nouveauSoldeRestant).toFixed(2),
          statut: nouveauStatut
        },
        description: `Paiement reçu pour la facture ${factureData.numeroFacture}`,
        executor: tx,
        required: true
      });

      return {
        paiement: newPaiement,
        facture: {
          montantPaye: nouveauMontantPaye.toFixed(2),
          soldeRestant: Math.max(0, nouveauSoldeRestant).toFixed(2),
          statut: nouveauStatut,
        },
      };
    });
    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: result,
    });
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/paiement:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du paiement',
      error: error.message,
    });
  }
});

/**
 * PUT /api/factures/:id
 * Met à jour une facture
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      statut,
      dateFacture,
      dateEcheance,
      notes,
      items,
    } = req.body;

    // Vérifier que la facture existe
    const [existingFacture] = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingFacture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }
    if (
      existingFacture.statut !== 'brouillon' &&
      ['brouillon', 'annulee'].includes(statut)
    ) {
      return res.status(409).json({
        success: false,
        message: 'Une facture déjà validée ne peut pas être remise en brouillon ou annulée directement; créez un avoir pour conserver le stock et la comptabilité cohérents.',
      });
    }
    // Une facture brouillon déjà (partiellement) payée ne peut pas être
    // annulée directement : le paiement doit être remboursé via un avoir.
    if (
      statut === 'annulee' &&
      existingFacture.statut === 'brouillon' &&
      Number(existingFacture.montantPaye || 0) > 0
    ) {
      return res.status(409).json({
        success: false,
        message: 'Une facture déjà payée ne peut pas être annulée directement; créez un avoir pour rembourser le client.',
      });
    }
    const existingItems = await db.select().from(factureItems)
      .where(and(
        eq(factureItems.factureId, parseInt(id)),
        eq(factureItems.entrepriseId, req.entrepriseId)
      ));
    if (items !== undefined && existingFacture.statut !== 'brouillon') {
      return res.status(409).json({
        success: false,
        message: 'Les lignes d’une facture validée ne peuvent pas être modifiées; créez un avoir puis une nouvelle facture.',
      });
    }

    let updateData = {
      updatedAt: new Date(),
    };

    if (statut !== undefined) updateData.statut = statut;
    if (dateFacture !== undefined) updateData.dateFacture = dateFacture;
    if (dateEcheance !== undefined) updateData.dateEcheance = dateEcheance;
    if (notes !== undefined) updateData.notes = notes;

    // Si les items sont fournis, recalculer les totaux
    if (items && items.length > 0) {
      const itemProductIds = [...new Set(items.filter(item => item.produitId).map(item => parseInt(item.produitId)))];
      for (const productId of itemProductIds) {
        const [ownedProduct] = await db.select({ id: produits.id }).from(produits)
          .where(and(eq(produits.id, productId), eq(produits.entrepriseId, req.entrepriseId))).limit(1);
        if (!ownedProduct) return res.status(400).json({ success: false, message: 'Produit non trouvé ou non autorisé' });
      }
      // Supprimer les anciennes lignes
      await db
        .delete(factureItems)
        .where(eq(factureItems.factureId, parseInt(id)));

      // Calculer les nouveaux totaux
      let totalHT = 0;
      items.forEach(item => {
        const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        const totalApresRemise = totalLigne * (1 - remise / 100);
        totalHT += totalApresRemise;
      });

      const [entreprise] = await db
        .select({ tauxTva: sql`taux_tva` })
        .from(sql`entreprises`)
        .where(sql`id = ${req.entrepriseId}`);

      const tauxTva = parseFloat(entreprise?.tauxTva || 18);
      const totalTVA = totalHT * (tauxTva / 100);
      const totalTTC = totalHT + totalTVA;

      updateData.totalHT = totalHT.toFixed(2);
      updateData.totalTVA = totalTVA.toFixed(2);
      updateData.totalTTC = totalTTC.toFixed(2);
      updateData.soldeRestant = (totalTTC - parseFloat(existingFacture.montantPaye)).toFixed(2);

      // Créer les nouvelles lignes
      const newItemsData = items.map(item => {
        const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        const totalApresRemise = totalLigne * (1 - remise / 100);

        return {
          entrepriseId: req.entrepriseId,
          factureId: parseInt(id),
          produitId: item.produitId || null,
          description: item.description,
          quantite: item.quantite,
          prixUnitaire: item.prixUnitaire,
          remise: item.remise || '0',
          totalLigne: totalApresRemise.toFixed(2),
        };
      });

      await db.insert(factureItems).values(newItemsData);
    }

    // Mettre à jour la facture
    const updateConditions = [
      eq(factures.id, parseInt(id)),
      eq(factures.entrepriseId, req.entrepriseId),
    ];
    const isFulfillmentTransition = statut && ['envoyee', 'payee'].includes(statut) && existingFacture.statut === 'brouillon';
    if (isFulfillmentTransition) updateConditions.push(eq(factures.statut, 'brouillon'));

    const [updatedFacture] = await db
      .update(factures)
      .set(updateData)
      .where(and(...updateConditions))
      .returning();
    if (!updatedFacture) {
      return res.status(409).json({ success: false, message: 'La facture a été modifiée par une autre requête; rechargez-la puis réessayez.' });
    }

    // *** INTÉGRATION STOCK AUTOMATIQUE ***
    // Si le statut change vers 'envoyee' ou 'payee', générer mouvements SORTIE
    let montantCMVFacture = null;
    let ecritureAnnulation = null;
    // Annulation d'une facture brouillon : la création avait déjà passé
    // l'écriture de vente (D 411 / C 701 + C 443) ; on la contre-passe
    // exactement (D 701 / D 443 / C 411) pour que 701, 443 et le solde
    // client reviennent à leur valeur d'avant la facture. Sans cette
    // écriture, le résultat et la TVA restaient surévalués (exercice
    // 2026 : 701 +75 000, 443 +13 500, 4112 soldé 88 500).
    // Une facture validée ne passe pas ici : l'annulation directe est
    // refusée plus haut, il faut créer un avoir.
    const isAnnulation = statut === 'annulee' && existingFacture.statut === 'brouillon';
    // Une facture à 0 n'a pas d'écriture de vente à contre-passer.
    if (isAnnulation && Number(existingFacture.totalTTC || 0) > 0) {
      try {
        const [clientAnnulation] = await db.select().from(clients).where(and(
          eq(clients.id, existingFacture.clientId),
          eq(clients.entrepriseId, req.entrepriseId)
        )).limit(1);
        ecritureAnnulation = await db.transaction(async (tx) => {
          const entry = await createEcritureAnnulationFactureVente({
            entrepriseId: req.entrepriseId,
            clientId: existingFacture.clientId,
            numeroFacture: existingFacture.numeroFacture,
            dateFacture: existingFacture.dateFacture,
            clientNom: clientAnnulation?.nom || '',
            totalHT: Number(existingFacture.totalHT || 0),
            totalTVA: Number(existingFacture.totalTVA || 0),
            totalTTC: Number(existingFacture.totalTTC || 0),
            executor: tx,
          });
          if (!entry) {
            throw new Error('Configurez le compte collectif client 4111/4112, les ventes et la TVA avant d’annuler la facture.');
          }
          return entry;
        });
      } catch (annulationError) {
        // La contrepassation a échoué : on remet la facture en brouillon
        // plutôt que de la laisser annulée avec sa vente en comptabilité.
        await db.update(factures).set({
          statut: existingFacture.statut,
          updatedAt: new Date(),
        }).where(and(
          eq(factures.id, parseInt(id)),
          eq(factures.entrepriseId, req.entrepriseId)
        ));
        throw annulationError;
      }
    }
    if (isFulfillmentTransition) {
      const factureItemsList = await db.select().from(factureItems).where(and(
        eq(factureItems.factureId, parseInt(id)),
        eq(factureItems.entrepriseId, req.entrepriseId)
      ));

      try {
        montantCMVFacture = await db.transaction(async (tx) => {
          let totalCMV = 0;
          const stockItems = factureItemsList
            .filter((item) => item.produitId)
            .sort((a, b) => Number(a.produitId) - Number(b.produitId));

          for (const item of stockItems) {
            const quantity = Number(item.quantite);
            const [product] = await tx.select().from(produits).where(and(
              eq(produits.id, item.produitId),
              eq(produits.entrepriseId, req.entrepriseId)
            )).for('update').limit(1);
            if (!product) throw Object.assign(new Error(`Produit ${item.produitId} introuvable.`), { status: 409 });
            if (Number(product.quantite || 0) + 0.001 < quantity) {
              throw Object.assign(new Error(`Stock insuffisant pour le produit ${product.nom}.`), { status: 409 });
            }

            const costing = await consumeStockValuation(tx, {
              entrepriseId: req.entrepriseId,
              produitId: item.produitId,
              quantity,
            });
            if (costing.untrackedQuantity > 0.001) {
              throw Object.assign(new Error(`Le CMV du stock restant de ${product.nom} ne peut pas être établi; vente annulée.`), { status: 409 });
            }
            totalCMV += costing.coutConsomme;
            await tx.update(factureItems).set({
              coutUnitaireCMV: quantity > 0 ? (costing.coutConsomme / quantity).toFixed(4) : '0.0000',
            }).where(and(
              eq(factureItems.id, item.id),
              eq(factureItems.entrepriseId, req.entrepriseId)
            ));

            await tx.insert(mouvementsStock).values({
              entrepriseId: req.entrepriseId,
              produitId: item.produitId,
              type: 'sortie',
              quantite: quantity,
              prixUnitaire: Number(item.prixUnitaire),
              reference: `Facture ${updatedFacture.numeroFacture}`,
              notes: `Vente client - Facture ${updatedFacture.numeroFacture}`,
              userId: req.user?.id || null
            });
            await tx.update(produits).set({
              quantite: sql`${produits.quantite} - ${quantity}`,
              updatedAt: new Date()
            }).where(and(
              eq(produits.id, item.produitId),
              eq(produits.entrepriseId, req.entrepriseId),
              sql`${produits.quantite} >= ${quantity}`
            ));
          }

          await createEcritureCoutVente({
            entrepriseId: req.entrepriseId,
            numeroFacture: updatedFacture.numeroFacture,
            dateFacture: updatedFacture.dateFacture,
            montantCMV: totalCMV,
            executor: tx,
          });
          return Number(totalCMV.toFixed(2));
        });
      } catch (stockError) {
        await db.update(factures).set({
          statut: existingFacture.statut,
          updatedAt: new Date(),
        }).where(and(
          eq(factures.id, parseInt(id)),
          eq(factures.entrepriseId, req.entrepriseId)
        ));
        throw stockError;
      }
    }

    const updatedItems = await db.select().from(factureItems)
      .where(and(
        eq(factureItems.factureId, parseInt(id)),
        eq(factureItems.entrepriseId, req.entrepriseId)
      ));
    await logAudit({
      ...extractAuditInfo(req),
      action: 'UPDATE',
      table: 'factures',
      recordId: parseInt(id),
      ancienneValeur: { facture: existingFacture, items: existingItems },
      nouvelleValeur: { facture: updatedFacture, items: updatedItems, montantCMV: montantCMVFacture, ecritureAnnulationId: ecritureAnnulation?.id || null },
      description: `Facture modifiée: ${updatedFacture.numeroFacture}${ecritureAnnulation ? ` (annulation contre-passée, écriture ${ecritureAnnulation.id})` : ''}`,
      required: false
    });

    res.json({
      success: true,
      message: 'Facture mise à jour avec succès',
      data: updatedFacture,
      ...(montantCMVFacture !== null ? { montantCMV: montantCMVFacture } : {}),
      ...(ecritureAnnulation ? { ecritureAnnulation } : {}),
    });
  } catch (error) {
    console.error('Erreur PUT /api/factures/:id:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la facture',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/factures/:id
 * Supprime une facture
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.transaction(async (tx) => {
      const [existingFacture] = await tx.select().from(factures).where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!existingFacture) {
        throw Object.assign(new Error('Facture non trouvée'), { status: 404 });
      }
      if (existingFacture.statut !== 'brouillon') {
        throw Object.assign(new Error('Une facture validée ne peut pas être supprimée; passez par un avoir ou une procédure d’annulation.'), { status: 409 });
      }

      const [paiement] = await tx.select().from(paiements).where(and(
        eq(paiements.factureId, parseInt(id)),
        eq(paiements.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (paiement) {
        throw Object.assign(new Error('Impossible de supprimer une facture qui a des paiements enregistrés'), { status: 400 });
      }

      const items = await tx.select().from(factureItems).where(and(
        eq(factureItems.factureId, parseInt(id)),
        eq(factureItems.entrepriseId, req.entrepriseId)
      ));
      // La création avait passé l'écriture de vente (D 411 / C 701 +
      // C 443) : supprimer la facture sans la contre-passer laisserait
      // la vente en comptabilité, comme l'annulation avant correction.
      // Une facture à 0 n'a pas d'écriture à contre-passer.
      if (Number(existingFacture.totalTTC || 0) > 0) {
        const [clientSuppression] = await tx.select().from(clients).where(and(
          eq(clients.id, existingFacture.clientId),
          eq(clients.entrepriseId, req.entrepriseId)
        )).limit(1);
        const ecritureAnnulation = await createEcritureAnnulationFactureVente({
          entrepriseId: req.entrepriseId,
          clientId: existingFacture.clientId,
          numeroFacture: existingFacture.numeroFacture,
          dateFacture: existingFacture.dateFacture,
          clientNom: clientSuppression?.nom || '',
          totalHT: Number(existingFacture.totalHT || 0),
          totalTVA: Number(existingFacture.totalTVA || 0),
          totalTTC: Number(existingFacture.totalTTC || 0),
          executor: tx,
        });
        if (!ecritureAnnulation) {
          throw Object.assign(
            new Error('Configurez le compte collectif client 4111/4112, les ventes et la TVA avant de supprimer la facture.'),
            { status: 409 },
          );
        }
      }
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'factures',
        recordId: parseInt(id),
        ancienneValeur: { facture: existingFacture, items },
        description: `Facture supprimée: ${existingFacture.numeroFacture}`,
        executor: tx,
        required: true
      });

      await tx.delete(factureItems).where(eq(factureItems.factureId, parseInt(id)));
      await tx.delete(factures).where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ));
    });

    res.json({
      success: true,
      message: 'Facture supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/factures/:id:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de la suppression de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures/:id/send-email
 * Envoie une facture par email au client
 */
router.post('/:id/send-email', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const [factureData] = await db
      .select({
        facture: factures,
        client: clients,
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée ou accès non autorisé',
      });
    }

    if (!factureData.client?.email) {
      return res.status(400).json({
        success: false,
        message: 'Le client n\'a pas d\'adresse email renseignée',
      });
    }

    const [entrepriseData] = await db
      .select()
      .from(entreprises)
      .where(eq(entreprises.id, req.entrepriseId))
      .limit(1);

    if (!entrepriseData) {
      return res.status(500).json({
        success: false,
        message: 'Données entreprise non disponibles',
      });
    }

    const result = await emailService.sendInvoiceEmail({
      facture: factureData.facture,
      client: factureData.client,
      entreprise: entrepriseData,
      pdfBase64: null,
      userId,
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/send-email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email',
      error: error.message,
    });
  }
});

/**
 * GET /api/factures/export/csv
 * Export CSV de toutes les factures
 */
router.get('/export/csv', async (req, res) => {
  try {
    const facturesList = await db
      .select({
        facture: factures,
        client: { nom: clients.nom }
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(eq(factures.entrepriseId, req.entrepriseId))
      .orderBy(desc(factures.createdAt));

    const csv = [
      'Numero;Client;Date;Echeance;Total HT;Total TTC;Paye;Solde;Statut',
      ...facturesList.map(f => 
        `${f.facture.numeroFacture || ''};${f.client?.nom || ''};${f.facture.dateFacture ? new Date(f.facture.dateFacture).toLocaleDateString('fr-FR') : ''};${f.facture.dateEcheance ? new Date(f.facture.dateEcheance).toLocaleDateString('fr-FR') : ''};${f.facture.totalHT || 0};${f.facture.totalTTC || 0};${f.facture.montantPaye || 0};${f.facture.soldeRestant || 0};${f.facture.statut || ''}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=factures.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Erreur export factures:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/note-debit', async (req, res) => {
  try {
    const factureId = Number(req.params.id);
    const totalHT = Number(req.body.totalHT);
    const motif = String(req.body.motif || '').trim();
    const dateNote = String(req.body.dateNote || new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!Number.isSafeInteger(factureId) || factureId <= 0 || !Number.isFinite(totalHT) || totalHT <= 0 || !motif) {
      return res.status(400).json({ success: false, message: 'Facture, montant HT positif et motif sont obligatoires.' });
    }
    const result = await db.transaction(async tx => {
      const [invoice] = await tx.select().from(factures).where(and(
        eq(factures.id, factureId),
        eq(factures.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!invoice || ['brouillon', 'annulee'].includes(String(invoice.statut).toLowerCase())) {
        throw Object.assign(new Error('Facture validée introuvable.'), { status: 404 });
      }
      const [client] = await tx.select().from(clients).where(and(
        eq(clients.id, invoice.clientId),
        eq(clients.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!client) throw Object.assign(new Error('Client introuvable.'), { status: 409 });
      const totalTVA = calculateCreditNoteVat(totalHT, invoice.totalHT, invoice.totalTVA);
      const totalTTC = Number((totalHT + totalTVA).toFixed(2));
      const number = await generateCreditNoteNumber(tx, {
        entrepriseId: req.entrepriseId,
        type: 'client',
        operation: 'debit',
        dateAvoir: dateNote,
      });
      const [note] = await tx.insert(notesCredit).values({
        entrepriseId: req.entrepriseId,
        type: 'client',
        operation: 'debit',
        nature: 'ajustement',
        ...number,
        clientId: client.id,
        factureId: invoice.id,
        dateAvoir: dateNote,
        montantHT: totalHT.toFixed(2),
        montantTVA: totalTVA.toFixed(2),
        montantTTC: totalTTC.toFixed(2),
        soldeRestant: totalTTC.toFixed(2),
        motif,
        statut: 'validee',
        userId: req.user.id,
      }).returning();
      await tx.insert(notesCreditItems).values({
        entrepriseId: req.entrepriseId,
        noteCreditId: note.id,
        description: motif,
        quantite: '1',
        prixUnitaire: totalHT.toFixed(2),
        totalHT: totalHT.toFixed(2),
        montantTVA: totalTVA.toFixed(2),
        coutStock: '0',
      });
      const newClientBalance = Number((Number(client.soldeDu || 0) + totalTTC).toFixed(2));
      await tx.update(clients).set({
        soldeDu: newClientBalance.toFixed(2),
        updatedAt: new Date(),
      }).where(and(eq(clients.id, client.id), eq(clients.entrepriseId, req.entrepriseId)));
      const entry = await createEcritureNoteDebitClient({
        entrepriseId: req.entrepriseId,
        clientId: client.id,
        numeroNote: note.numero,
        dateNote,
        clientNom: client.nom,
        totalHT,
        totalTVA,
        totalTTC,
        sourceId: note.id,
        executor: tx,
      });
      if (!entry) throw new Error('L’écriture comptable de la note de débit n’a pas été créée.');
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'notes_credit',
        recordId: note.id,
        nouvelleValeur: { note, ecritureId: entry.id },
        description: `Note de débit client ${note.numero} créée`,
        executor: tx,
        required: true,
      });
      return { note, entry };
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur création note de débit client:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Erreur lors de la création de la note de débit.' });
  }
});

router.post('/notes-debit/:id/paiement', async (req, res) => {
  try {
    const noteId = Number(req.params.id);
    const amount = Number(req.body.montant);
    const modePaiement = String(req.body.modePaiement || '');
    const datePaiement = String(req.body.datePaiement || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const reference = String(req.body.reference || '').trim();
    if (!Number.isSafeInteger(noteId) || noteId <= 0 || !Number.isFinite(amount) || amount <= 0 ||
        !['mobile_money', 'carte_bancaire', 'virement', 'especes', 'cheque'].includes(modePaiement)) {
      return res.status(400).json({ success: false, message: 'Note, montant et mode de paiement valides obligatoires.' });
    }
    if (modePaiement === 'cheque' && !reference) {
      return res.status(400).json({ success: false, message: 'Le numéro du chèque est obligatoire.' });
    }
    const result = await db.transaction(async tx => {
      const [note] = await tx.select().from(notesCredit).where(and(
        eq(notesCredit.id, noteId),
        eq(notesCredit.entrepriseId, req.entrepriseId),
        eq(notesCredit.type, 'client'),
        eq(notesCredit.operation, 'debit')
      )).for('update').limit(1);
      if (!note) throw Object.assign(new Error('Note de débit introuvable.'), { status: 404 });
      const balance = Number(note.soldeRestant || 0);
      if (amount > balance + 0.005) throw Object.assign(new Error('Le paiement dépasse le solde de la note.'), { status: 400 });
      const [client] = await tx.select().from(clients).where(and(
        eq(clients.id, note.clientId),
        eq(clients.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!client) throw Object.assign(new Error('Client introuvable.'), { status: 409 });
      let bank = null;
      if (req.body.compteBancaireId && modePaiement !== 'cheque') {
        [bank] = await tx.select().from(comptesBancaires).where(and(
          eq(comptesBancaires.id, Number(req.body.compteBancaireId)),
          eq(comptesBancaires.entrepriseId, req.entrepriseId)
        )).for('update').limit(1);
        if (!bank) throw Object.assign(new Error('Compte bancaire introuvable ou non autorisé.'), { status: 400 });
      }
      const [payment] = await tx.insert(paiements).values({
        entrepriseId: req.entrepriseId,
        factureId: null,
        noteCreditId: note.id,
        clientId: client.id,
        montant: amount.toFixed(2),
        modePaiement,
        reference: reference || null,
        datePaiement,
        notes: req.body.notes || null,
        statutCheque: modePaiement === 'cheque' ? 'en_attente' : 'non_applicable',
        compteBancaireId: req.body.compteBancaireId ? Number(req.body.compteBancaireId) : null,
        userId: req.user.id,
      }).returning();
      const nextBalance = Number(Math.max(0, balance - amount).toFixed(2));
      await tx.update(notesCredit).set({ soldeRestant: nextBalance.toFixed(2) })
        .where(and(eq(notesCredit.id, note.id), eq(notesCredit.entrepriseId, req.entrepriseId)));
      await tx.update(clients).set({
        soldeDu: sql`${clients.soldeDu} - ${amount}`,
        updatedAt: new Date(),
      }).where(and(eq(clients.id, client.id), eq(clients.entrepriseId, req.entrepriseId)));
      if (bank && modePaiement !== 'cheque') {
        await tx.insert(transactionsTresorerie).values({
          entrepriseId: req.entrepriseId,
          compteBancaireId: bank.id,
          type: 'encaissement',
          montant: amount.toFixed(2),
          dateTransaction: datePaiement,
          categorie: 'Vente',
          description: `Règlement de la note ${note.numero}`,
          tiersNom: client.nom,
          numeroPiece: reference || `PAI-${payment.id}`,
          userId: req.user.id,
        });
        await tx.update(comptesBancaires).set({
          soldeActuel: sql`${comptesBancaires.soldeActuel} + ${amount}`,
          updatedAt: new Date(),
        }).where(and(eq(comptesBancaires.id, bank.id), eq(comptesBancaires.entrepriseId, req.entrepriseId)));
      }
      const entry = await createEcriturePaiementClient({
        entrepriseId: req.entrepriseId,
        clientId: client.id,
        reference: reference || `PAI-${payment.id}`,
        datePaiement,
        clientNom: client.nom,
        montant: amount,
        modePaiement: modePaiement === 'cheque' ? 'cheque' : modePaiement === 'especes' ? 'especes' : 'banque',
        compteBancaireId: req.body.compteBancaireId ? Number(req.body.compteBancaireId) : null,
        executor: tx,
      });
      if (!entry) throw new Error('L’écriture comptable du règlement de la note n’a pas été créée.');
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'paiements',
        recordId: payment.id,
        nouvelleValeur: { payment, noteId: note.id, nouveauSolde: nextBalance, ecritureId: entry.id },
        description: `Règlement de la note de débit ${note.numero}`,
        executor: tx,
        required: true,
      });
      return { payment, soldeRestant: nextBalance };
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erreur paiement note de débit client:', error);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Erreur lors du règlement de la note.' });
  }
});

router.post('/:id/avoir', async (req, res) => {
  try {
    const factureId = Number(req.params.id);
    const dateAvoir = String(req.body.dateAvoir || new Date().toISOString().slice(0, 10));
    const requestedLines = Array.isArray(req.body.items) ? req.body.items : [];
    if (!Number.isInteger(factureId) || requestedLines.length === 0) {
      return res.status(400).json({ success: false, message: 'Sélectionnez au moins une ligne à retourner.' });
    }

    const result = await db.transaction(async tx => {
      const [facture] = await tx.select().from(factures).where(and(
        eq(factures.id, factureId),
        eq(factures.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!facture) throw Object.assign(new Error('Facture client introuvable.'), { status: 404 });
      if (['brouillon', 'annulee'].includes(String(facture.statut).toLowerCase())) {
        throw Object.assign(new Error('Un avoir ne peut viser qu’une facture envoyée ou payée.'), { status: 409 });
      }

      const invoiceLines = await tx.select().from(factureItems).where(and(
        eq(factureItems.factureId, factureId),
        eq(factureItems.entrepriseId, req.entrepriseId)
      )).for('update');
      const lineById = new Map(invoiceLines.map(line => [Number(line.id), line]));
      const itemIds = requestedLines.map(line => Number(line.factureItemId));
      if (itemIds.some(id => !Number.isInteger(id)) || new Set(itemIds).size !== itemIds.length) {
        throw Object.assign(new Error('Les lignes du retour sont invalides ou répétées.'), { status: 400 });
      }
      const priorReturns = await tx.select({
        factureItemId: notesCreditItems.factureItemId,
        quantite: notesCreditItems.quantite,
      }).from(notesCreditItems).where(and(
        eq(notesCreditItems.entrepriseId, req.entrepriseId),
        inArray(notesCreditItems.factureItemId, itemIds)
      ));
      const returnedByItemId = new Map();
      for (const row of priorReturns) {
        const id = Number(row.factureItemId);
        returnedByItemId.set(id, (returnedByItemId.get(id) || 0) + Number(row.quantite || 0));
      }

      const computedLines = requestedLines.map(request => {
        const original = lineById.get(Number(request.factureItemId));
        if (!original) throw Object.assign(new Error('Une ligne ne fait pas partie de cette facture.'), { status: 400 });
        if (!original.produitId) throw Object.assign(new Error(`La ligne « ${original.description} » n’est pas un article stockable.`), { status: 409 });
        if (original.coutUnitaireCMV == null || !Number.isFinite(Number(original.coutUnitaireCMV))) {
          throw Object.assign(new Error(`Le coût historique de « ${original.description} » n’est pas enregistré. Cet ancien article ne peut pas être retourné automatiquement.`), { status: 409 });
        }
        return {
          original,
          ...calculateReturnedLine({
            quantityOriginal: original.quantite,
            quantityAlreadyReturned: returnedByItemId.get(Number(original.id)) || 0,
            quantityRequested: request.quantite,
            totalOriginalHT: original.totalLigne,
            historicalUnitCost: original.coutUnitaireCMV,
          }),
        };
      });
      const totalHT = Number(computedLines.reduce((sum, line) => sum + line.totalHT, 0).toFixed(2));
      if (totalHT <= 0) throw Object.assign(new Error('Le montant de l’avoir doit être positif.'), { status: 400 });
      const totalTVA = calculateCreditNoteVat(totalHT, facture.totalHT, facture.totalTVA);
      const totalTTC = Number((totalHT + totalTVA).toFixed(2));
      const totalStockCost = Number(computedLines.reduce((sum, line) => sum + Number(line.coutStock || 0), 0).toFixed(2));
      const [client] = await tx.select().from(clients).where(and(
        eq(clients.id, facture.clientId),
        eq(clients.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!client) throw Object.assign(new Error('Client de la facture introuvable.'), { status: 409 });

      const number = await generateCreditNoteNumber(tx, { entrepriseId: req.entrepriseId, type: 'client', dateAvoir });
      const [note] = await tx.insert(notesCredit).values({
        entrepriseId: req.entrepriseId,
        type: 'client',
        ...number,
        clientId: client.id,
        factureId: facture.id,
        dateAvoir,
        montantHT: totalHT.toFixed(2),
        montantTVA: totalTVA.toFixed(2),
        montantTTC: totalTTC.toFixed(2),
        motif: req.body.motif || null,
        statut: 'validee',
        userId: req.user.id,
      }).returning();

      const noteLines = [];
      for (const line of computedLines) {
        const [product] = await tx.select().from(produits).where(and(
          eq(produits.id, line.original.produitId),
          eq(produits.entrepriseId, req.entrepriseId)
        )).for('update').limit(1);
        if (!product) throw Object.assign(new Error('Produit retourné introuvable dans cette entreprise.'), { status: 409 });
        const [movement] = await tx.insert(mouvementsStock).values({
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          type: 'entree',
          quantite: line.quantite.toFixed(3),
          prixUnitaire: (Number(line.coutStock || 0) / line.quantite).toFixed(4),
          reference: note.numero,
          notes: `Retour client lié à la facture ${facture.numeroFacture}`,
          userId: req.user.id,
        }).returning();
        await createStockValuationLayer(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          mouvementId: movement.id,
          quantity: line.quantite,
          totalCost: line.coutStock,
          unitCost: Number(line.coutStock || 0) / line.quantite,
          productSnapshot: product,
        });
        const oldProductQuantity = Number(product.quantite || 0);
        const newProductQuantity = Number((oldProductQuantity + line.quantite).toFixed(3));
        await tx.update(produits).set({
          quantite: newProductQuantity.toFixed(3),
          updatedAt: new Date(),
        }).where(and(eq(produits.id, product.id), eq(produits.entrepriseId, req.entrepriseId)));
        await updateProductAverageCost(tx, req.entrepriseId, product.id);
        await logAudit({
          ...extractAuditInfo(req),
          action: 'UPDATE',
          table: 'produits',
          recordId: product.id,
          ancienneValeur: { quantite: product.quantite },
          nouvelleValeur: { quantite: newProductQuantity.toFixed(3), mouvementStockId: movement.id, avoirId: note.id },
          description: `Stock augmenté par retour client ${note.numero}`,
          executor: tx,
          required: true,
        });
        noteLines.push({
          entrepriseId: req.entrepriseId,
          noteCreditId: note.id,
          factureItemId: line.original.id,
          produitId: product.id,
          description: line.original.description,
          quantite: line.quantite.toFixed(3),
          prixUnitaire: (line.totalHT / line.quantite).toFixed(4),
          totalHT: line.totalHT.toFixed(2),
          montantTVA: '0.00',
          coutStock: Number(line.coutStock || 0).toFixed(2),
          mouvementStockId: movement.id,
        });
      }
      let taxAllocatedCents = 0;
      noteLines.forEach((line, index) => {
        const taxCents = index === noteLines.length - 1
          ? Math.round(totalTVA * 100) - taxAllocatedCents
          : Math.round(totalTVA * 100 * (Number(line.totalHT) / totalHT));
        line.montantTVA = (taxCents / 100).toFixed(2);
        taxAllocatedCents += taxCents;
      });
      await tx.insert(notesCreditItems).values(noteLines);

      const oldBalance = Number(facture.soldeRestant || 0);
      const updatedBalance = Math.max(0, oldBalance - totalTTC);
      const updatedClientBalance = Number((Number(client.soldeDu || 0) - totalTTC).toFixed(2));
      await tx.update(factures).set({
        soldeRestant: updatedBalance.toFixed(2),
        updatedAt: new Date(),
      }).where(and(eq(factures.id, facture.id), eq(factures.entrepriseId, req.entrepriseId)));
      await tx.update(clients).set({
        soldeDu: updatedClientBalance.toFixed(2),
        updatedAt: new Date(),
      }).where(and(eq(clients.id, client.id), eq(clients.entrepriseId, req.entrepriseId)));

      const entry = await createEcritureAvoirClient({
        entrepriseId: req.entrepriseId,
        clientId: client.id,
        numeroAvoir: note.numero,
        dateAvoir,
        clientNom: client.nom,
        totalHT,
        totalTVA,
        totalTTC,
        coutStock: totalStockCost,
        sourceId: note.id,
        executor: tx,
      });
      if (!entry) throw new Error('L’écriture comptable de l’avoir client n’a pas été créée.');
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'notes_credit',
        recordId: note.id,
        nouvelleValeur: { note, lignes: noteLines, ecritureId: entry?.id },
        description: `Avoir client ${note.numero} créé pour la facture ${facture.numeroFacture}`,
        executor: tx,
        required: true,
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'factures',
        recordId: facture.id,
        ancienneValeur: { soldeRestant: facture.soldeRestant },
        nouvelleValeur: { soldeRestant: updatedBalance.toFixed(2), avoirId: note.id },
        description: `Solde réduit par l’avoir ${note.numero}`,
        executor: tx,
        required: true,
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'clients',
        recordId: client.id,
        ancienneValeur: { soldeDu: client.soldeDu },
        nouvelleValeur: { soldeDu: updatedClientBalance.toFixed(2), avoirId: note.id },
        description: `Solde client réduit par l’avoir ${note.numero}`,
        executor: tx,
        required: true,
      });
      return { note, lignes: noteLines, ecritureId: entry?.id };
    });
    res.status(201).json({ success: true, message: 'Avoir client créé; stock et comptabilité mis à jour.', data: result });
  } catch (error) {
    console.error('Erreur création avoir client:', error);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Erreur lors de la création de l’avoir client.' });
  }
});

router.get('/paiements/cheques/en-attente', async (req, res) => {
  try {
    const data = await db.select().from(paiements).where(and(
      eq(paiements.entrepriseId, req.entrepriseId),
      eq(paiements.modePaiement, 'cheque'),
      eq(paiements.statutCheque, 'en_attente')
    )).orderBy(desc(paiements.datePaiement));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Impossible de charger les chèques en attente.' });
  }
});

router.post('/paiements/:id/encaisser-cheque', async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    const bankAccountId = Number(req.body.compteBancaireId);
    const dateEncaissement = String(req.body.dateEncaissement || new Date().toISOString().slice(0, 10));
    if (!Number.isInteger(paymentId) || !Number.isInteger(bankAccountId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateEncaissement)) {
      return res.status(400).json({ success: false, message: 'Sélectionnez un compte bancaire et une date valides.' });
    }
    const result = await db.transaction(async tx => {
      const [payment] = await tx.select().from(paiements).where(and(
        eq(paiements.id, paymentId),
        eq(paiements.entrepriseId, req.entrepriseId),
        eq(paiements.modePaiement, 'cheque')
      )).for('update').limit(1);
      if (!payment) throw Object.assign(new Error('Chèque client introuvable.'), { status: 404 });
      if (payment.statutCheque !== 'en_attente') throw Object.assign(new Error('Ce chèque a déjà été traité.'), { status: 409 });
      const [bank] = await tx.select().from(comptesBancaires).where(and(
        eq(comptesBancaires.id, bankAccountId),
        eq(comptesBancaires.entrepriseId, req.entrepriseId),
        eq(comptesBancaires.actif, true)
      )).for('update').limit(1);
      if (!bank) throw Object.assign(new Error('Compte bancaire introuvable ou inactif.'), { status: 409 });

      const entry = await createEcritureEncaissementCheque({
        entrepriseId: req.entrepriseId,
        reference: payment.reference || `CHEQUE-${payment.id}`,
        dateEncaissement,
        montant: Number(payment.montant),
        compteBancaireId: bankAccountId,
        sourceId: payment.id,
        executor: tx,
      });
      const [updated] = await tx.update(paiements).set({
        statutCheque: 'encaisse',
        compteBancaireId: bankAccountId,
        dateEncaissementCheque: dateEncaissement,
      }).where(and(eq(paiements.id, payment.id), eq(paiements.entrepriseId, req.entrepriseId))).returning();
      await tx.insert(transactionsTresorerie).values({
        entrepriseId: req.entrepriseId,
        compteBancaireId: bankAccountId,
        type: 'encaissement',
        montant: payment.montant,
        dateTransaction: dateEncaissement,
        categorie: 'Encaissement chèque client',
        description: `Encaissement du chèque ${payment.reference || payment.id}`,
        numeroPiece: payment.reference || `CHEQUE-${payment.id}`,
        userId: req.user.id,
      });
      await tx.update(comptesBancaires).set({
        soldeActuel: sql`${comptesBancaires.soldeActuel} + ${payment.montant}`,
        updatedAt: new Date(),
      }).where(and(eq(comptesBancaires.id, bankAccountId), eq(comptesBancaires.entrepriseId, req.entrepriseId)));
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'paiements',
        recordId: payment.id,
        ancienneValeur: payment,
        nouvelleValeur: { ...updated, ecritureEncaissementId: entry?.id },
        description: `Chèque ${payment.reference || payment.id} encaissé en banque`,
        executor: tx,
        required: true,
      });
      return { paiement: updated, ecritureId: entry?.id };
    });
    res.json({ success: true, message: 'Chèque encaissé et transféré au compte bancaire.', data: result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Impossible d’encaisser ce chèque.' });
  }
});

export default router;
