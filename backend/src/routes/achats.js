import express from 'express';
import { db } from '../db.js';
import { 
  facturesAchat, 
  factureAchatItems,
  paiementsFournisseurs,
  fournisseurs,
  commandesAchat,
  commandesAchatItems,
  transactionsTresorerie,
  comptesBancaires,
  mouvementsStock,
  produits
} from '../schema.js';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { createEcritureFactureAchat, createEcriturePaiementFournisseur } from '../services/comptabiliteService.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import {
  allocateLogisticsByWeight,
  applySupplierInvoiceCostsToRemainingLayers,
  convertQuantityToBase,
  convertUnitPriceToBase,
  createStockValuationLayer,
  ensureOpeningValuationLayer,
  splitCostVariance,
} from '../services/stockValuation.js';

const router = express.Router();

// Génération automatique du numéro de facture achat
async function genererNumeroFactureAchat(entrepriseId) {
  const annee = new Date().getFullYear();
  const [lastFacture] = await db
    .select()
    .from(facturesAchat)
    .where(eq(facturesAchat.entrepriseId, entrepriseId))
    .orderBy(desc(facturesAchat.id))
    .limit(1);

  let numero = 1;
  if (lastFacture && lastFacture.numeroFacture) {
    const match = lastFacture.numeroFacture.match(/FACT-ACH-(\d{4})-(\d+)/);
    if (match && parseInt(match[1]) === annee) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `FACT-ACH-${annee}-${numero.toString().padStart(4, '0')}`;
}

// =========================================
// FACTURES FOURNISSEURS
// =========================================

// GET /api/achats/factures - Liste des factures fournisseurs
router.get('/factures', async (req, res) => {
  try {
    const { page = 1, limit = 50, statut, fournisseurId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [eq(facturesAchat.entrepriseId, req.entrepriseId)];

    if (statut) {
      whereConditions.push(eq(facturesAchat.statut, statut));
    }

    if (fournisseurId) {
      whereConditions.push(eq(facturesAchat.fournisseurId, parseInt(fournisseurId)));
    }

    const results = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(and(...whereConditions))
      .orderBy(desc(facturesAchat.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(facturesAchat)
      .where(and(...whereConditions));

    const formattedResults = results.map(r => ({
      ...r.facture,
      fournisseur: r.fournisseur
    }));

    return res.json({
      success: true,
      data: formattedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures',
      error: error.message
    });
  }
});

// GET /api/achats/factures/:id - Détails d'une facture fournisseur
router.get('/factures/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [facture] = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(
        and(
          eq(facturesAchat.id, parseInt(id)),
          eq(facturesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Récupérer les lignes de facture
    const items = await db
      .select()
      .from(factureAchatItems)
      .where(eq(factureAchatItems.factureId, parseInt(id)));

    // Récupérer les paiements
    const paiements = await db
      .select()
      .from(paiementsFournisseurs)
      .where(eq(paiementsFournisseurs.factureId, parseInt(id)));

    return res.json({
      success: true,
      data: {
        ...facture.facture,
        fournisseur: facture.fournisseur,
        items,
        paiements
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture',
      error: error.message
    });
  }
});

// POST /api/achats/factures - Créer une facture fournisseur
router.post('/factures', async (req, res) => {
  try {
    const {
      fournisseurId,
      commandeId, // Optionnel - si depuis une commande
      numeroFactureFournisseur, // Numéro de facture du fournisseur
      dateFacture,
      dateEcheance,
      items,
      totalHT: totalHTDeclare,
      totalTVA: totalTVADeclare,
      totalTTC: totalTTCDeclare,
      notes
    } = req.body;

    // Validation
    if (!fournisseurId) {
      return res.status(400).json({
        success: false,
        message: 'Le fournisseur est obligatoire'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un article est obligatoire'
      });
    }

    const lignesNormalisees = [];
    for (const item of items) {
      const quantite = Number(item.quantite);
      const prixUnitaire = Number(item.prixUnitaire);
      const remise = Number(item.remise || 0);
      const description = String(item.description || '').trim();
      if (!description || !Number.isFinite(quantite) || quantite <= 0 ||
          !Number.isFinite(prixUnitaire) || prixUnitaire < 0 ||
          !Number.isFinite(remise) || remise < 0 || remise > 100) {
        return res.status(400).json({
          success: false,
          message: 'Chaque ligne doit avoir une description, une quantité positive, un prix valide et une remise entre 0 et 100 %.'
        });
      }

      const produitId = item.produitId ? Number(item.produitId) : null;
      let inputUnit = String(item.uniteSaisie || '').trim();
      let quantityInStockUnit = quantite;
      let priceInStockUnit = prixUnitaire;
      if (produitId !== null) {
        if (!Number.isSafeInteger(produitId) || produitId <= 0) {
          return res.status(400).json({ success: false, message: 'Produit invalide.' });
        }
        const [produit] = await db
          .select({ id: produits.id, uniteMesure: produits.uniteMesure })
          .from(produits)
          .where(and(eq(produits.id, produitId), eq(produits.entrepriseId, req.entrepriseId)))
          .limit(1);
        if (!produit) {
          return res.status(400).json({ success: false, message: 'Un produit de la facture n’appartient pas à cette entreprise.' });
        }
        inputUnit = inputUnit || produit.uniteMesure || 'pièce';
        try {
          quantityInStockUnit = convertQuantityToBase(quantite, inputUnit, produit.uniteMesure || 'pièce');
          priceInStockUnit = convertUnitPriceToBase(prixUnitaire, inputUnit, produit.uniteMesure || 'pièce');
        } catch (error) {
          return res.status(400).json({ success: false, message: error.message, produitId });
        }
      } else {
        inputUnit = inputUnit || 'unité';
      }
      lignesNormalisees.push({
        ...item,
        produitId,
        description,
        quantite: quantityInStockUnit,
        quantiteSaisie: quantite,
        uniteSaisie: inputUnit,
        prixUnitaire: priceInStockUnit,
        prixUnitaireSaisi: prixUnitaire,
        remise,
      });
    }

    // Vérifier que le fournisseur existe
    const [fournisseur] = await db
      .select()
      .from(fournisseurs)
      .where(
        and(
          eq(fournisseurs.id, parseInt(fournisseurId)),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!fournisseur) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    const numeroExterne = String(numeroFactureFournisseur || '').trim();
    if (numeroExterne) {
      const [duplicate] = await db
        .select({ id: facturesAchat.id })
        .from(facturesAchat)
        .where(and(
          eq(facturesAchat.entrepriseId, req.entrepriseId),
          eq(facturesAchat.fournisseurId, Number(fournisseurId)),
          eq(facturesAchat.numeroFactureFournisseur, numeroExterne)
        ))
        .limit(1);
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Cette facture fournisseur est déjà enregistrée pour ce fournisseur.'
        });
      }
    }

    // Générer numéro de facture
    const numeroFacture = await genererNumeroFactureAchat(req.entrepriseId);

    // Calculer les totaux
    const totalHTCalcule = lignesNormalisees.reduce(
      (sum, item) => sum + item.quantite * item.prixUnitaire * (1 - item.remise / 100),
      0
    );
    const totalHT = totalHTDeclare === undefined ? totalHTCalcule : Number(totalHTDeclare);
    const totalTVA = totalTVADeclare === undefined ? 0 : Number(totalTVADeclare);
    const totalTTC = totalTTCDeclare === undefined ? totalHT + totalTVA : Number(totalTTCDeclare);
    if (!Number.isFinite(totalHT) || totalHT <= 0 ||
        !Number.isFinite(totalTVA) || totalTVA < 0 ||
        !Number.isFinite(totalTTC) || totalTTC <= 0 ||
        Math.abs(totalHT - totalHTCalcule) > 1 ||
        Math.abs(totalTTC - (totalHT + totalTVA)) > 1) {
      return res.status(400).json({
        success: false,
        message: 'Les montants HT, TVA et TTC doivent être positifs et cohérents. Vérifiez les lignes et les totaux de la facture.'
      });
    }

    const { newFacture, insertedItems } = await db.transaction(async (tx) => {
      const [created] = await tx.insert(facturesAchat).values({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        numeroFactureFournisseur: numeroExterne || null,
        fournisseurId: parseInt(fournisseurId),
        commandeId: commandeId ? parseInt(commandeId) : null,
        statut: 'brouillon',
        dateFacture: dateFacture || new Date().toISOString().split('T')[0],
        dateEcheance: dateEcheance || null,
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        montantPaye: '0',
        soldeRestant: totalTTC.toFixed(2),
        notes: notes || null,
        userId: req.user.id,
      }).returning();
      const itemsToInsert = lignesNormalisees.map(item => {
        const totalLigne = item.quantite * item.prixUnitaire * (1 - item.remise / 100);
        return {
          entrepriseId: req.entrepriseId,
          factureId: created.id,
          produitId: item.produitId,
          description: item.description,
          quantite: item.quantite.toString(),
          quantiteSaisie: item.quantiteSaisie.toString(),
          uniteSaisie: item.uniteSaisie,
          prixUnitaire: item.prixUnitaire.toFixed(2),
          prixUnitaireSaisi: item.prixUnitaireSaisi.toFixed(2),
          remise: item.remise.toFixed(2),
          totalLigne: totalLigne.toFixed(2),
        };
      });
      const inserted = await tx.insert(factureAchatItems).values(itemsToInsert).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'factures_achat',
        recordId: created.id,
        nouvelleValeur: { facture: created, items: inserted },
        description: `Facture fournisseur créée: ${created.numeroFacture}`,
        executor: tx,
        required: true
      });
      return { newFacture: created, insertedItems: inserted };
    });

    return res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: {
        ...newFacture,
        items: insertedItems
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture',
      error: error.message
    });
  }
});

// PUT /api/achats/factures/:id/valider - Valider une facture fournisseur
router.put('/factures/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.transaction(async (tx) => {
      const [facture] = await tx.select().from(facturesAchat).where(and(
        eq(facturesAchat.id, parseInt(id)),
        eq(facturesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!facture) return { status: 404, error: 'Facture non trouvée' };
      if (facture.statut !== 'brouillon') {
        return { status: 400, error: 'Seules les factures en brouillon peuvent être validées' };
      }

      const [fournisseur] = await tx.select().from(fournisseurs).where(and(
        eq(fournisseurs.id, facture.fournisseurId),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!fournisseur) return { status: 409, error: 'Fournisseur de la facture introuvable.' };

      const factureItems = await tx.select().from(factureAchatItems).where(and(
        eq(factureAchatItems.factureId, facture.id),
        eq(factureAchatItems.entrepriseId, req.entrepriseId)
      ));
      const stockItems = factureItems.filter((item) => Number(item.produitId) > 0);
      const logisticsItems = factureItems.filter((item) =>
        !item.produitId && /frais|transport|douane|manutention|assurance|logistique/i.test(item.description || '')
      );
      const directLogisticsTotal = logisticsItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.totalLigne) || 0),
        0
      );
      const weightProducts = stockItems.length
        ? await tx.select({
          id: produits.id,
          uniteMesure: produits.uniteMesure,
          poidsParUnite: produits.poidsParUnite,
          unitePoids: produits.unitePoids,
        }).from(produits).where(and(
          eq(produits.entrepriseId, req.entrepriseId),
          inArray(produits.id, stockItems.map((item) => item.produitId))
        ))
        : [];
      const weightsByProduct = new Map(weightProducts.map((product) => [product.id, product]));
      const directLogisticsAllocation = allocateLogisticsByWeight(
        stockItems.map((item) => ({
          ...item,
          uniteMesure: weightsByProduct.get(item.produitId)?.uniteMesure,
          poidsParUnite: weightsByProduct.get(item.produitId)?.poidsParUnite,
          unitePoids: weightsByProduct.get(item.produitId)?.unitePoids,
        })),
        directLogisticsTotal
      );
      const logisticsByItemId = new Map(stockItems.map((item, index) => [
        item.id,
        directLogisticsAllocation.allocations[index] || 0,
      ]));
      const montantStockDirect = stockItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.totalLigne) || 0) + (logisticsByItemId.get(item.id) || 0),
        0
      );
      const [updated] = await tx.update(facturesAchat).set({
        statut: 'validee',
        updatedAt: new Date()
      }).where(and(
        eq(facturesAchat.id, facture.id),
        eq(facturesAchat.entrepriseId, req.entrepriseId)
      )).returning();
      await tx.update(fournisseurs).set({
        soldeDu: sql`${fournisseurs.soldeDu} + ${updated.totalTTC}`,
        updatedAt: new Date()
      }).where(and(
        eq(fournisseurs.id, fournisseur.id),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      ));

      const movements = [];
      for (const item of factureItems) {
        if (!item.produitId) continue;
        const [product] = await tx.select().from(produits).where(and(
          eq(produits.id, item.produitId),
          eq(produits.entrepriseId, req.entrepriseId)
        )).for('update').limit(1);
        if (!product) throw Object.assign(new Error(`Produit ${item.produitId} introuvable ou non autorisé.`), { status: 409 });
        await ensureOpeningValuationLayer(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          productSnapshot: product,
        });
        const [movement] = await tx.insert(mouvementsStock).values({
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          type: 'entree',
          quantite: item.quantite,
          prixUnitaire: item.prixUnitaire,
          reference: `Facture ${updated.numeroFacture}`,
          notes: `Réception depuis facture fournisseur ${updated.numeroFactureFournisseur || updated.numeroFacture}`,
          userId: req.user.id
        }).returning();
        movements.push(movement);
        const itemCost = Math.max(0, Number(item.totalLigne) || Number(item.quantite) * Number(item.prixUnitaire));
        const landedCost = itemCost + (logisticsByItemId.get(item.id) || 0);
        await createStockValuationLayer(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          mouvementId: movement.id,
          quantity: item.quantite,
          totalCost: landedCost,
          unitCost: Number(item.quantite) > 0 ? landedCost / Number(item.quantite) : Number(item.prixUnitaire),
          productSnapshot: product,
          ensureOpening: false,
        });
        await tx.update(produits).set({
          quantite: sql`${produits.quantite} + ${item.quantite}`,
          updatedAt: new Date()
        }).where(and(
          eq(produits.id, product.id),
          eq(produits.entrepriseId, req.entrepriseId)
        ));
      }

      let accountingEntry = null;
      try {
        accountingEntry = await createEcritureFactureAchat({
          entrepriseId: req.entrepriseId,
          numeroFacture: updated.numeroFacture,
          dateFacture: updated.dateFacture,
          fournisseurNom: fournisseur.raisonSociale || fournisseur.nom || 'Fournisseur',
          totalHT: updated.totalHT,
          totalTVA: updated.totalTVA,
          totalTTC: updated.totalTTC,
          montantStockDirect,
          executor: tx
        });
      } catch (accountingError) {
        console.error('Erreur création de l’écriture de facture fournisseur:', accountingError.message);
        throw accountingError;
      }

      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'factures_achat',
        recordId: updated.id,
        ancienneValeur: facture,
        nouvelleValeur: { facture: updated, items: factureItems, mouvementsStock: movements, accountingEntry },
        description: `Facture fournisseur validée: ${updated.numeroFacture}`,
        executor: tx,
        required: true
      });
      return {
        status: 200,
        updated,
        movementsCount: movements.length,
        montantStockDirect,
        fraisLogistiquesAlloues: directLogisticsAllocation.allocations.reduce((sum, amount) => sum + amount, 0),
        fraisLogistiquesNonAlloues: directLogisticsAllocation.unallocated,
        poidsTotalKg: directLogisticsAllocation.totalWeightKg,
      };
    });
    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    const updated = result.updated;
    console.log(`✅ Facture ${updated.numeroFacture} validée - ${result.movementsCount} mouvements de stock créés`);

    return res.json({
      success: true,
      message: 'Facture validée avec succès et stock mis à jour',
      data: updated,
      coutRevient: {
        valeurStockCapitalisee: result.montantStockDirect,
        fraisLogistiquesAlloues: result.fraisLogistiquesAlloues,
        fraisLogistiquesNonAlloues: result.fraisLogistiquesNonAlloues,
        poidsTotalKg: result.poidsTotalKg,
        avertissements: result.fraisLogistiquesNonAlloues > 0
          ? ['Frais logistiques non répartis : renseignez le poids par unité de stock des produits concernés.']
          : [],
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation de la facture',
      error: error.message
    });
  }
});

// =========================================
// PAIEMENTS FOURNISSEURS
// =========================================

// POST /api/achats/factures/:id/paiement - Enregistrer un paiement fournisseur
router.post('/factures/:id/paiement', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      montant,
      modePaiement,
      reference,
      datePaiement,
      compteBancaireId,
      notes
    } = req.body;

    // Validation
    if (!montant || parseFloat(montant) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant est obligatoire et doit être supérieur à 0'
      });
    }

    const montantPaiement = Number(montant);
    const date = datePaiement || new Date().toISOString().split('T')[0];
    if (!Number.isFinite(montantPaiement) || montantPaiement <= 0 || Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ success: false, message: 'Le montant et la date du paiement sont invalides.' });
    }

    const result = await db.transaction(async (tx) => {
      const [factureData] = await tx.select().from(facturesAchat).where(and(
        eq(facturesAchat.id, parseInt(id)),
        eq(facturesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!factureData) throw Object.assign(new Error('Facture non trouvée'), { status: 404 });
      const soldeRestant = Number(factureData.soldeRestant);
      if (montantPaiement > soldeRestant + 0.005) {
        throw Object.assign(new Error(`Le montant du paiement (${montantPaiement}) dépasse le solde restant (${soldeRestant})`), { status: 400 });
      }

      const [fournisseurInfo] = await tx.select().from(fournisseurs).where(and(
        eq(fournisseurs.id, factureData.fournisseurId),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!fournisseurInfo) throw Object.assign(new Error('Fournisseur de la facture introuvable.'), { status: 409 });

      let bankAccount = null;
      if (compteBancaireId) {
        [bankAccount] = await tx.select().from(comptesBancaires).where(and(
          eq(comptesBancaires.id, parseInt(compteBancaireId)),
          eq(comptesBancaires.entrepriseId, req.entrepriseId)
        )).for('update').limit(1);
        if (!bankAccount) throw Object.assign(new Error('Compte bancaire introuvable ou non autorisé.'), { status: 400 });
      }

      const [paiement] = await tx.insert(paiementsFournisseurs).values({
        entrepriseId: req.entrepriseId,
        factureId: parseInt(id),
        fournisseurId: factureData.fournisseurId,
        montant: montantPaiement.toFixed(2),
        modePaiement: modePaiement || null,
        reference: reference || null,
        datePaiement: date,
        notes: notes || null,
        userId: req.user.id,
      }).returning();

      const nouveauMontantPaye = Number(factureData.montantPaye) + montantPaiement;
      const nouveauSolde = Math.max(0, Number(factureData.totalTTC) - nouveauMontantPaye);
      const [factureUpdated] = await tx.update(facturesAchat).set({
        montantPaye: nouveauMontantPaye.toFixed(2),
        soldeRestant: nouveauSolde.toFixed(2),
        statut: nouveauSolde <= 0.01 ? 'payee' : 'partiellement_payee',
        updatedAt: new Date()
      }).where(and(
        eq(facturesAchat.id, parseInt(id)),
        eq(facturesAchat.entrepriseId, req.entrepriseId)
      )).returning();

      await tx.update(fournisseurs).set({
        soldeDu: sql`${fournisseurs.soldeDu} - ${montantPaiement}`,
        updatedAt: new Date()
      }).where(and(
        eq(fournisseurs.id, factureData.fournisseurId),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      ));

      let cashTransaction = null;
      if (bankAccount) {
        [cashTransaction] = await tx.insert(transactionsTresorerie).values({
          entrepriseId: req.entrepriseId,
          compteBancaireId: bankAccount.id,
          type: 'decaissement',
          montant: montantPaiement.toFixed(2),
          dateTransaction: date,
          categorie: 'Achat',
          description: `Paiement facture ${factureData.numeroFacture}`,
          tiersNom: fournisseurInfo.raisonSociale || fournisseurInfo.nom || null,
          numeroPiece: reference || `PAI-F-${paiement.id}`,
          modePaiement: modePaiement || null,
          userId: req.user.id,
        }).returning();
        await tx.update(comptesBancaires).set({
          soldeActuel: sql`${comptesBancaires.soldeActuel} - ${montantPaiement}`,
          updatedAt: new Date()
        }).where(and(
          eq(comptesBancaires.id, bankAccount.id),
          eq(comptesBancaires.entrepriseId, req.entrepriseId)
        ));
      }

      let accountingEntry = null;
      try {
        accountingEntry = await createEcriturePaiementFournisseur({
          entrepriseId: req.entrepriseId,
          reference: reference || `PAI-F-${paiement.id}`,
          datePaiement: date,
          fournisseurNom: fournisseurInfo.raisonSociale || fournisseurInfo.nom || 'Fournisseur',
          montant: montantPaiement,
          modePaiement: modePaiement === 'especes' ? 'especes' : 'banque',
          compteBancaireId: bankAccount?.id || null,
          executor: tx
        });
      } catch (comptaError) {
        console.warn('Avertissement: Écriture comptable paiement fournisseur non générée:', comptaError.message);
      }

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'paiements_fournisseurs',
        recordId: paiement.id,
        nouvelleValeur: { paiement, factureAvant: factureData, factureApres: factureUpdated, accountingEntry, cashTransaction },
        description: `Paiement fournisseur enregistré: ${montantPaiement.toFixed(2)} pour ${factureData.numeroFacture}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'factures_achat',
        recordId: factureUpdated.id,
        ancienneValeur: factureData,
        nouvelleValeur: factureUpdated,
        description: `Solde mis à jour après paiement de ${factureData.numeroFacture}`,
        executor: tx,
        required: true
      });
      return { paiement, factureUpdated };
    });

    return res.json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: {
        paiement: result.paiement,
        facture: {
          montantPaye: result.factureUpdated.montantPaye,
          soldeRestant: result.factureUpdated.soldeRestant,
          statut: result.factureUpdated.statut
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du paiement:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du paiement',
      error: error.message
    });
  }
});

// GET /api/achats/echeances - Échéancier des factures fournisseurs
router.get('/echeances', async (req, res) => {
  try {
    const { debutPeriode, finPeriode } = req.query;

    let whereConditions = [
      eq(facturesAchat.entrepriseId, req.entrepriseId),
      sql`${facturesAchat.statut} != 'payee'`,
      sql`${facturesAchat.dateEcheance} IS NOT NULL`
    ];

    if (debutPeriode) {
      whereConditions.push(sql`${facturesAchat.dateEcheance} >= ${debutPeriode}`);
    }

    if (finPeriode) {
      whereConditions.push(sql`${facturesAchat.dateEcheance} <= ${finPeriode}`);
    }

    const results = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(and(...whereConditions))
      .orderBy(facturesAchat.dateEcheance);

    const formattedResults = results.map(r => ({
      ...r.facture,
      fournisseur: r.fournisseur,
      retard: new Date(r.facture.dateEcheance) < new Date() ? true : false
    }));

    return res.json({
      success: true,
      data: formattedResults
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des échéances:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des échéances',
      error: error.message
    });
  }
});

// =========================================
// COSTING - RAPPROCHEMENT RECEPTIONS/FACTURES
// =========================================

// GET /api/achats/receptions-en-attente - Réceptions en attente de facturation pour un fournisseur
router.get('/receptions-en-attente', async (req, res) => {
  try {
    const fournisseurId = req.query.fournisseurId ? parseInt(req.query.fournisseurId, 10) : null;
    const entrepriseId = parseInt(req.entrepriseId, 10);
    
    // Construire la requête avec sql template literals (sécurisé)
    let query = sql`
      SELECT br.*, f.raison_sociale as fournisseur_nom,
             (SELECT json_agg(lr.*) FROM lignes_reception lr WHERE lr.bon_reception_id = br.id) as lignes
      FROM bons_reception br
      LEFT JOIN fournisseurs f ON br.fournisseur_id = f.id
      WHERE br.entreprise_id = ${entrepriseId} AND br.statut = 'validee' AND br.facture_achat_id IS NULL
    `;
    
    if (fournisseurId && !isNaN(fournisseurId)) {
      query = sql`${query} AND br.fournisseur_id = ${fournisseurId}`;
    }
    
    query = sql`${query} ORDER BY br.date_reception ASC`;
    
    const result = await db.execute(query);
    
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    console.error('Erreur récupération réceptions en attente:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/achats/logistique-pending/:receptionId - Coûts logistiques pending pour une réception
router.get('/logistique-pending/:receptionId', async (req, res) => {
  try {
    const receptionId = parseInt(req.params.receptionId);
    
    const result = await db.execute(sql`
      SELECT * FROM logistique_pending 
      WHERE entreprise_id = ${req.entrepriseId} 
        AND bon_reception_id = ${receptionId}
        AND statut = 'pending'
    `);
    
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/achats/factures-avec-rapprochement - Créer facture avec rapprochement des réceptions
router.post('/factures-avec-rapprochement', async (req, res) => {
  try {
    const {
      fournisseurId,
      numeroFactureFournisseur,
      dateFacture,
      dateEcheance,
      receptionsIds, // Array des IDs de bons de réception à rapprocher
      lignes, // Lignes avec coûts réels: { produitId, quantite, prixUnitaireReel, description }
      coutsLogistiques, // Coûts logistiques réels: { type, montantReel, description }
      totalTVA: totalTVADeclare,
      notes
    } = req.body;

    // Validation
    if (!fournisseurId) {
      return res.status(400).json({ success: false, message: 'Le fournisseur est obligatoire' });
    }
    if (!receptionsIds || receptionsIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Au moins une réception à rapprocher est obligatoire' });
    }
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ success: false, message: 'Ajoutez au moins une ligne d’article à la facture.' });
    }
    if (totalTVADeclare === undefined || totalTVADeclare === null || String(totalTVADeclare).trim() === '') {
      return res.status(400).json({ success: false, message: 'Saisissez la TVA figurant sur la facture; saisissez 0 si elle est exonérée.' });
    }
    const totalTVA = Number(totalTVADeclare);
    if (!Number.isFinite(totalTVA) || totalTVA < 0) {
      return res.status(400).json({ success: false, message: 'Le montant de TVA doit être un nombre positif ou nul.' });
    }
    const ligneInvalide = lignes.some((ligne) => {
      const quantite = Number(ligne.quantite);
      const prix = Number(ligne.prixUnitaireReel);
      return !Number.isFinite(quantite) || quantite <= 0 || !Number.isFinite(prix) || prix < 0;
    });
    if (ligneInvalide) {
      return res.status(400).json({ success: false, message: 'Chaque ligne doit avoir une quantité positive et un prix valide.' });
    }
    const coutsInvalides = (coutsLogistiques || []).some((cout) => {
      const montant = Number(cout.montantReel);
      return !Number.isFinite(montant) || montant < 0;
    });
    if (coutsInvalides) {
      return res.status(400).json({ success: false, message: 'Chaque frais logistique doit être un montant positif ou nul.' });
    }

    // Vérifier que le fournisseur existe
    const fournisseurResult = await db.execute(sql`
      SELECT * FROM fournisseurs WHERE id = ${parseInt(fournisseurId)} AND entreprise_id = ${req.entrepriseId}
    `);
    if (!fournisseurResult.rows?.length) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }
    const fournisseur = fournisseurResult.rows[0];

    // Vérifier que les réceptions existent et appartiennent au fournisseur
    for (const recId of receptionsIds) {
      const recResult = await db.execute(sql`
        SELECT * FROM bons_reception 
        WHERE id = ${parseInt(recId)} 
          AND entreprise_id = ${req.entrepriseId}
          AND fournisseur_id = ${parseInt(fournisseurId)}
          AND statut = 'validee'
          AND facture_achat_id IS NULL
      `);
      if (!recResult.rows?.length) {
        return res.status(400).json({ success: false, message: `Réception ${recId} invalide ou déjà facturée` });
      }
    }

    const productIds = [...new Set(lignes
      .map((ligne) => parseInt(ligne.produitId, 10))
      .filter((id) => Number.isSafeInteger(id) && id > 0))];
    const weightProducts = productIds.length
      ? await db.select({
        id: produits.id,
        nom: produits.nom,
        uniteMesure: produits.uniteMesure,
        poidsParUnite: produits.poidsParUnite,
        unitePoids: produits.unitePoids,
      }).from(produits).where(and(
        eq(produits.entrepriseId, req.entrepriseId),
        inArray(produits.id, productIds)
      ))
      : [];
    if (weightProducts.length !== productIds.length ||
        lignes.some((ligne) => ligne.produitId && !Number.isSafeInteger(parseInt(ligne.produitId, 10)))) {
      return res.status(400).json({ success: false, message: 'Un ou plusieurs produits de la facture sont introuvables dans cette entreprise.' });
    }
    const weightsByProductId = new Map(weightProducts.map((product) => [product.id, product]));
    let totalArticlesHT = 0;
    const lignesProcessed = [];
    for (const ligne of lignes) {
      const quantityInput = Number(ligne.quantite);
      const unitPriceInput = Number(ligne.prixUnitaireReel);
      const productId = parseInt(ligne.produitId, 10);
      const product = Number.isSafeInteger(productId) ? weightsByProductId.get(productId) : null;
      const inputUnit = String(ligne.uniteSaisie || product?.uniteMesure || 'unité');
      let quantityInStockUnit = quantityInput;
      let priceInStockUnit = unitPriceInput;
      if (product) {
        try {
          quantityInStockUnit = convertQuantityToBase(quantityInput, inputUnit, product.uniteMesure || 'pièce');
          priceInStockUnit = convertUnitPriceToBase(unitPriceInput, inputUnit, product.uniteMesure || 'pièce');
        } catch (error) {
          return res.status(400).json({ success: false, message: error.message, produitId: productId });
        }
      }
      const total = quantityInput * unitPriceInput;
      totalArticlesHT += total;
      lignesProcessed.push({
        ...ligne,
        produitId: product ? productId : null,
        quantite: quantityInStockUnit,
        quantiteSaisie: quantityInput,
        uniteSaisie: inputUnit,
        prixUnitaireReel: priceInStockUnit,
        prixUnitaireSaisi: unitPriceInput,
        totalLigne: total,
      });
    }

    // Générer numéro de facture
    const numeroFacture = await genererNumeroFactureAchat(req.entrepriseId);

    // Calculer totaux coûts logistiques
    let totalLogistique = 0;
    const coutsProcessed = (coutsLogistiques || []).map(c => {
      const montant = parseFloat(c.montantReel);
      totalLogistique += montant;
      return { ...c, montant };
    });

    const totalHT = totalArticlesHT + totalLogistique;
    const totalTTC = totalHT + totalTVA;
    const lignesArticles = lignesProcessed.filter((ligne) => Number.isSafeInteger(parseInt(ligne.produitId, 10)) && parseInt(ligne.produitId, 10) > 0);
    const lignesPourRepartition = lignesArticles.map((ligne) => ({
      ...ligne,
      poidsParUnite: weightsByProductId.get(parseInt(ligne.produitId, 10))?.poidsParUnite,
      unitePoids: weightsByProductId.get(parseInt(ligne.produitId, 10))?.unitePoids,
      uniteMesure: weightsByProductId.get(parseInt(ligne.produitId, 10))?.uniteMesure,
    }));
    const repartitionLogistique = allocateLogisticsByWeight(lignesPourRepartition, totalLogistique);
    const produitsSansPoids = repartitionLogistique.missingWeightIndexes
      .map((index) => weightsByProductId.get(parseInt(lignesArticles[index]?.produitId, 10))?.nom)
      .filter(Boolean);
    const invoiceCostsByProduct = new Map();
    for (const [index, ligne] of lignesArticles.entries()) {
      const produitId = parseInt(ligne.produitId, 10);
      const current = invoiceCostsByProduct.get(produitId) || { quantity: 0, totalCost: 0 };
      current.quantity += Number(ligne.quantite);
      current.totalCost += Number(ligne.totalLigne) + Number(repartitionLogistique.allocations[index] || 0);
      invoiceCostsByProduct.set(produitId, current);
    }

    // Créer la facture
    const factureResult = await db.execute(sql`
      INSERT INTO factures_achat (entreprise_id, numero_facture, numero_facture_fournisseur, fournisseur_id, statut, date_facture, date_echeance, total_ht, total_tva, total_ttc, montant_paye, solde_restant, notes, user_id)
      VALUES (${req.entrepriseId}, ${numeroFacture}, ${numeroFactureFournisseur || null}, ${parseInt(fournisseurId)}, 'brouillon', ${dateFacture || new Date().toISOString().split('T')[0]}, ${dateEcheance || null}, ${totalHT.toFixed(2)}, ${totalTVA.toFixed(2)}, ${totalTTC.toFixed(2)}, '0', ${totalTTC.toFixed(2)}, ${notes || null}, ${req.user?.id || null})
      RETURNING *
    `);
    const newFacture = factureResult.rows[0];

    // Créer les lignes de facture
    for (const ligne of lignesProcessed) {
      await db.execute(sql`
        INSERT INTO facture_achat_items (
          entreprise_id, facture_id, produit_id, description, quantite,
          quantite_saisie, unite_saisie, prix_unitaire, prix_unitaire_saisi, total_ligne
        )
        VALUES (
          ${req.entrepriseId}, ${newFacture.id}, ${ligne.produitId ? parseInt(ligne.produitId) : null},
          ${ligne.description}, ${ligne.quantite}, ${ligne.quantiteSaisie}, ${ligne.uniteSaisie},
          ${ligne.prixUnitaireReel}, ${ligne.prixUnitaireSaisi}, ${ligne.totalLigne.toFixed(2)}
        )
      `);
    }

    // Créer les lignes de coûts logistiques dans la facture
    for (const cout of coutsProcessed) {
      await db.execute(sql`
        INSERT INTO facture_achat_items (entreprise_id, facture_id, produit_id, description, quantite, prix_unitaire, total_ligne)
        VALUES (${req.entrepriseId}, ${newFacture.id}, ${null}, ${`Frais ${cout.type}: ${cout.description || ''}`}, ${1}, ${cout.montant.toFixed(2)}, ${cout.montant.toFixed(2)})
      `);
    }

    // Lier les réceptions à la facture et mettre à jour les stock_pending
    for (const recId of receptionsIds) {
      // Mettre à jour le bon de réception
      await db.execute(sql`
        UPDATE bons_reception
        SET facture_achat_id = ${newFacture.id}, updated_at = NOW()
        WHERE id = ${parseInt(recId)} AND entreprise_id = ${req.entrepriseId}
      `);

      // Mettre à jour les stock_pending -> invoiced
      await db.execute(sql`
        UPDATE stock_pending 
        SET statut = 'invoiced', facture_achat_id = ${newFacture.id}, date_facturation = NOW(), updated_at = NOW()
        WHERE entreprise_id = ${req.entrepriseId}
          AND bon_reception_id = ${parseInt(recId)}
          AND statut = 'pending'
      `);

      // Mettre à jour les logistique_pending -> invoiced
      await db.execute(sql`
        UPDATE logistique_pending 
        SET statut = 'invoiced', facture_achat_id = ${newFacture.id}, date_facturation = NOW(), updated_at = NOW()
        WHERE entreprise_id = ${req.entrepriseId}
          AND bon_reception_id = ${parseInt(recId)}
          AND statut = 'pending'
      `);
    }

    // Mettre à jour les coûts réels dans stock_pending (prix réel vs estimé)
    for (const ligne of lignesProcessed) {
      if (ligne.produitId) {
        await db.execute(sql`
          UPDATE stock_pending 
          SET prix_reel = ${ligne.prixUnitaireReel}, ecart_prix = ${ligne.prixUnitaireReel} - prix_estime
          WHERE entreprise_id = ${req.entrepriseId}
            AND facture_achat_id = ${newFacture.id}
            AND produit_id = ${parseInt(ligne.produitId)}
        `);
      }
    }

    // Mettre à jour les coûts réels dans logistique_pending
    for (const cout of coutsProcessed) {
      await db.execute(sql`
        UPDATE logistique_pending 
        SET montant_reel = ${cout.montant.toFixed(2)}, ecart_montant = ${cout.montant} - montant_estime
        WHERE entreprise_id = ${req.entrepriseId}
          AND facture_achat_id = ${newFacture.id}
          AND type = ${cout.type}
      `);
    }

    // *** INTÉGRATION COMPTABLE AUTOMATIQUE ***
    // Calculer le montant pending (estimé à la réception) pour régulariser le compte 408
    const pendingResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(sp.valeur_estimee), 0) as total_stock_pending,
        COALESCE(SUM(lp.montant_estime), 0) as total_logistique_pending
      FROM (
        SELECT COALESCE(SUM(valeur_estimee), 0) as valeur_estimee 
        FROM stock_pending WHERE facture_achat_id = ${newFacture.id}
      ) sp,
      (
        SELECT COALESCE(SUM(montant_estime), 0) as montant_estime 
        FROM logistique_pending WHERE facture_achat_id = ${newFacture.id}
      ) lp
    `);
    
    const totalPending = parseFloat(pendingResult.rows?.[0]?.total_stock_pending || 0) + parseFloat(pendingResult.rows?.[0]?.total_logistique_pending || 0);
    const ecartPrix = totalHT - totalPending;

    let coutRevient = {
      ajustementStock: 0,
      produitsRevalorises: [],
      avertissements: [],
    };
    let comptabiliteAvertissement = null;
    try {
      const result = await db.transaction(async (tx) => {
        const pendingRowsResult = await tx.execute(sql`
          SELECT sp.produit_id, sp.quantite_pending, lr.mouvement_stock_id
          FROM stock_pending sp
          JOIN lignes_reception lr
            ON lr.id = sp.ligne_reception_id
           AND lr.entreprise_id = sp.entreprise_id
          WHERE sp.entreprise_id = ${req.entrepriseId}
            AND sp.facture_achat_id = ${newFacture.id}
          ORDER BY sp.id
        `);
        const valuation = await applySupplierInvoiceCostsToRemainingLayers(tx, {
          entrepriseId: req.entrepriseId,
          receiptRows: pendingRowsResult.rows || [],
          invoiceCostsByProduct,
        });
        const variance = splitCostVariance(ecartPrix, valuation.ajustementStock);
        const ecriture = await createEcritureFactureAchat({
          entrepriseId: req.entrepriseId,
          numeroFacture,
          dateFacture: dateFacture || new Date().toISOString().split('T')[0],
          fournisseurNom: fournisseur.raison_sociale || fournisseur.nom,
          totalHT,
          totalTVA,
          totalTTC,
          montantPending: totalPending,
          ecartPrix: variance.expenseVariance,
          montantValorisationStock: variance.inventoryAdjustment,
          executor: tx,
        });

        if (!ecriture && variance.inventoryAdjustment !== 0) {
          throw new Error('La correction du stock n’a pas pu être enregistrée dans le journal comptable.');
        }
        if (ecriture) {
          await tx.execute(sql`
            UPDATE factures_achat
            SET ecriture_comptable_id = ${ecriture.id}
            WHERE id = ${newFacture.id} AND entreprise_id = ${req.entrepriseId}
          `);
        }
        for (const layer of valuation.couchesRevalorisees) {
          await logAudit({
            ...extractAuditInfo(req),
            action: 'UPDATE',
            table: 'valorisations_stock',
            recordId: layer.layerId,
            ancienneValeur: {
              produitId: layer.produitId,
              mouvementId: layer.mouvementId,
              quantiteRestante: layer.quantiteRestante,
              coutTotal: layer.ancienCoutTotal,
            },
            nouvelleValeur: {
              produitId: layer.produitId,
              mouvementId: layer.mouvementId,
              quantiteRestante: layer.quantiteRestante,
              coutTotal: layer.nouveauCoutTotal,
              factureFournisseurId: newFacture.id,
            },
            description: `Correction du coût de revient du stock restant pour la facture ${numeroFacture}`,
            executor: tx,
            required: true,
          });
        }
        return { valuation, ecriture };
      });
      coutRevient = result.valuation;
      if (!result.ecriture) comptabiliteAvertissement = 'L’écriture comptable n’a pas été créée : vérifiez les comptes configurés.';
    } catch (comptaError) {
      comptabiliteAvertissement = comptaError.message;
      coutRevient.avertissements.push(
        `La correction de valorisation et l’écriture comptable ont été annulées ensemble : ${comptaError.message}`
      );
      console.warn('Avertissement: valorisation ou écriture comptable non générée:', comptaError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Facture créée avec rapprochement réussi',
      data: {
        ...newFacture,
        totalArticles: totalArticlesHT,
        totalLogistique,
        receptionsRapprochees: receptionsIds.length,
        coutRevient: {
          ...coutRevient,
          fraisLogistiquesAlloues: totalLogistique - repartitionLogistique.unallocated,
          fraisLogistiquesNonAlloues: repartitionLogistique.unallocated,
          poidsTotalKg: repartitionLogistique.totalWeightKg,
          avertissements: [
            ...coutRevient.avertissements,
            ...(repartitionLogistique.unallocated > 0
              ? [`${repartitionLogistique.unallocated.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF de frais restent non répartis : renseignez le poids par unité de stock${produitsSansPoids.length ? ` pour ${[...new Set(produitsSansPoids)].join(', ')}` : ''}.`]
              : []),
            ...(comptabiliteAvertissement ? [comptabiliteAvertissement] : []),
          ],
        }
      }
    });
  } catch (error) {
    console.error('Erreur création facture avec rapprochement:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: Sanitize date (remove query string artifacts)
function sanitizeDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = dateStr.split('?')[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
  return cleaned;
}

// GET /api/achats/ecarts-costing - Rapport des écarts de costing
router.get('/ecarts-costing', async (req, res) => {
  try {
    const dateDebut = sanitizeDate(req.query.dateDebut);
    const dateFin = sanitizeDate(req.query.dateFin);
    const fournisseurId = req.query.fournisseurId ? parseInt(req.query.fournisseurId, 10) : null;
    const entrepriseId = parseInt(req.entrepriseId, 10);
    
    // Stock écarts - requête sécurisée avec sql template literals
    let stockQuery = sql`
      SELECT sp.*, p.nom as produit_nom, p.reference as produit_reference, f.raison_sociale as fournisseur_nom
      FROM stock_pending sp
      LEFT JOIN produits p ON sp.produit_id = p.id
      LEFT JOIN fournisseurs f ON sp.fournisseur_id = f.id
      WHERE sp.entreprise_id = ${entrepriseId} 
        AND sp.statut = 'invoiced' 
        AND sp.ecart_prix IS NOT NULL 
        AND sp.ecart_prix != 0
    `;
    
    if (fournisseurId && !isNaN(fournisseurId)) {
      stockQuery = sql`${stockQuery} AND sp.fournisseur_id = ${fournisseurId}`;
    }
    if (dateDebut) {
      stockQuery = sql`${stockQuery} AND sp.date_facturation >= ${dateDebut}`;
    }
    if (dateFin) {
      stockQuery = sql`${stockQuery} AND sp.date_facturation <= ${dateFin}`;
    }
    
    stockQuery = sql`${stockQuery} ORDER BY ABS(sp.ecart_prix) DESC`;

    const stockEcarts = await db.execute(stockQuery);

    // Logistique écarts - requête sécurisée avec sql template literals
    let logQuery = sql`
      SELECT lp.*, f.raison_sociale as fournisseur_nom
      FROM logistique_pending lp
      LEFT JOIN fournisseurs f ON lp.fournisseur_id = f.id
      WHERE lp.entreprise_id = ${entrepriseId} 
        AND lp.statut = 'invoiced' 
        AND lp.ecart_montant IS NOT NULL 
        AND lp.ecart_montant != 0
    `;
    
    if (fournisseurId && !isNaN(fournisseurId)) {
      logQuery = sql`${logQuery} AND lp.fournisseur_id = ${fournisseurId}`;
    }
    if (dateDebut) {
      logQuery = sql`${logQuery} AND lp.date_facturation >= ${dateDebut}`;
    }
    if (dateFin) {
      logQuery = sql`${logQuery} AND lp.date_facturation <= ${dateFin}`;
    }
    
    logQuery = sql`${logQuery} ORDER BY ABS(lp.ecart_montant) DESC`;

    const logEcarts = await db.execute(logQuery);

    const totalEcartStock = (stockEcarts.rows || []).reduce((sum, r) => sum + parseFloat(r.ecart_prix || 0), 0);
    const totalEcartLogistique = (logEcarts.rows || []).reduce((sum, r) => sum + parseFloat(r.ecart_montant || 0), 0);

    res.json({
      success: true,
      data: {
        ecartsStock: stockEcarts.rows || [],
        ecartsLogistique: logEcarts.rows || [],
        totaux: {
          ecartStock: totalEcartStock,
          ecartLogistique: totalEcartLogistique,
          ecartTotal: totalEcartStock + totalEcartLogistique
        }
      }
    });
  } catch (error) {
    console.error('Erreur rapport écarts costing:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
