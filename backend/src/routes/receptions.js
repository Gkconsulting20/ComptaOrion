import express from 'express';
import { db } from '../db.js';
import {
  commandesAchat,
  commandesAchatItems,
  coutsLogistiquesCommande,
  produits,
  mouvementsStock,
  fournisseurs,
  entrepots,
  stockParEntrepot,
  bonsReception,
  lignesReception,
  stockPending,
  logistiquePending,
} from '../schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { createEcritureReception } from '../services/comptabiliteService.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { allocateLogisticsByWeight, createStockValuationLayer, ensureOpeningValuationLayer } from '../services/stockValuation.js';

const router = express.Router();

// POST /api/receptions - Enregistrer une réception de marchandises
router.post('/', async (req, res) => {
  try {
    const {
      commandeId,
      dateReception,
      items, // [{ commandeItemId, quantiteRecue }]
      notes,
      numeroLivraison,
      entrepotId
    } = req.body;

    // Validation
    if (!commandeId) {
      return res.status(400).json({
        success: false,
        message: 'La commande est obligatoire'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un article est obligatoire'
      });
    }

    const receipt = await db.transaction(async (tx) => {
      const [commande] = await tx.select().from(commandesAchat).where(and(
        eq(commandesAchat.id, parseInt(commandeId)),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!commande) throw Object.assign(new Error('Commande non trouvée'), { status: 404 });
      if (!['confirmee', 'preparee'].includes(commande.statut)) {
        throw Object.assign(new Error('Seules les commandes confirmées ou en préparation peuvent être reçues'), { status: 400 });
      }

      const movements = [];
      const changedLines = [];
      const changedProducts = [];
      const pendingStockRows = [];
      const pendingLogisticsRows = [];
      let toutRecu = true;
      let totalHTReception = 0;
      let totalArticlesReception = 0;
      const date = dateReception || new Date().toISOString().split('T')[0];
      let warehouseId = Number(entrepotId) || null;
      if (warehouseId) {
        const [warehouse] = await tx.select({ id: entrepots.id }).from(entrepots).where(and(
          eq(entrepots.id, warehouseId),
          eq(entrepots.entrepriseId, req.entrepriseId),
          eq(entrepots.actif, true)
        )).limit(1);
        if (!warehouse) throw Object.assign(new Error('L’entrepôt sélectionné est invalide.'), { status: 400 });
      } else {
        const [warehouse] = await tx.select({ id: entrepots.id }).from(entrepots).where(and(
          eq(entrepots.entrepriseId, req.entrepriseId),
          eq(entrepots.actif, true)
        )).limit(1);
        if (!warehouse) {
          throw Object.assign(new Error('Créez un entrepôt avant de réceptionner une commande.'), { status: 400 });
        }
        warehouseId = warehouse.id;
      }
      const orderLines = await tx.select().from(commandesAchatItems).where(and(
        eq(commandesAchatItems.commandeId, commande.id),
        eq(commandesAchatItems.entrepriseId, req.entrepriseId)
      ));
      const logisticsRows = await tx.select().from(coutsLogistiquesCommande).where(and(
        eq(coutsLogistiquesCommande.commandeAchatId, commande.id),
        eq(coutsLogistiquesCommande.entrepriseId, req.entrepriseId)
      ));
      const totalLogistics = logisticsRows.reduce(
        (sum, cost) => sum + Math.max(0, Number(cost.montant) || 0),
        0
      );
      const freightByOrderLine = new Map();
      const logisticsAllocationByCost = new Map();
      if (totalLogistics > 0) {
        const stockableLines = orderLines.filter(line => line.produitId);
        const productIds = [...new Set(stockableLines.map(line => Number(line.produitId)))];
        const weightProducts = productIds.length
          ? await tx.select({
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
        const productsById = new Map(weightProducts.map(product => [product.id, product]));
        const weightedLines = stockableLines.map(line => {
          const product = productsById.get(line.produitId);
          return {
            commandeItemId: line.id,
            quantite: Number(line.quantite),
            uniteMesure: product?.uniteMesure,
            poidsParUnite: product?.poidsParUnite,
            unitePoids: product?.unitePoids,
          };
        });
        for (const cost of logisticsRows) {
          const costAmount = Math.max(0, Number(cost.montant) || 0);
          if (!costAmount) continue;
          const allocation = allocateLogisticsByWeight(weightedLines, costAmount);
          if (allocation.missingWeightIndexes.length || allocation.unallocated > 0.009) {
            const missingProducts = allocation.missingWeightIndexes
              .map(index => productsById.get(stockableLines[index]?.produitId)?.nom || `ligne ${stockableLines[index]?.id}`)
              .join(', ');
            throw Object.assign(new Error(
              missingProducts
                ? `Poids manquant ou invalide pour répartir les frais logistiques : ${missingProducts}.`
                : 'Aucun article avec un poids valide ne permet de répartir les frais logistiques.'
            ), { status: 400 });
          }
          const allocationByLine = new Map();
          weightedLines.forEach((line, index) => {
            const allocated = allocation.allocations[index] || 0;
            allocationByLine.set(line.commandeItemId, allocated);
            freightByOrderLine.set(
              line.commandeItemId,
              (freightByOrderLine.get(line.commandeItemId) || 0) + allocated
            );
          });
          logisticsAllocationByCost.set(cost.id, allocationByLine);
        }
      }

      const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
      const [receiptHeader] = await tx.insert(bonsReception).values({
        entrepriseId: req.entrepriseId,
        numero: null,
        fournisseurId: commande.fournisseurId,
        dateReception: date,
        statut: 'validee',
        entrepotId: warehouseId,
        commandeAchatId: commande.id,
        totalHT: '0.00',
        notes: [notes, numeroLivraison ? `Bon de livraison: ${numeroLivraison}` : null].filter(Boolean).join('\n') || null,
        userId: req.user.id,
      }).returning();
      const receiptNumber = `BR-${new Date(date).getFullYear()}-${String(receiptHeader.id).padStart(6, '0')}`;
      await tx.update(bonsReception).set({ numero: receiptNumber }).where(and(
        eq(bonsReception.id, receiptHeader.id),
        eq(bonsReception.entrepriseId, req.entrepriseId)
      ));
      const pendingLogisticsByType = new Map();
      for (const item of items) {
        const quantiteRecue = Number(item.quantiteRecue);
        if (!Number.isFinite(quantiteRecue) || quantiteRecue < 0) {
          throw Object.assign(new Error('Une quantité reçue est invalide.'), { status: 400 });
        }
        if (quantiteRecue === 0) continue;
        const [commandeItem] = await tx.select().from(commandesAchatItems).where(and(
          eq(commandesAchatItems.id, parseInt(item.commandeItemId)),
          eq(commandesAchatItems.commandeId, commande.id),
          eq(commandesAchatItems.entrepriseId, req.entrepriseId)
        )).for('update').limit(1);
        if (!commandeItem) {
          throw Object.assign(new Error(`Ligne de commande ${item.commandeItemId} non trouvée`), { status: 404 });
        }
        const ordered = Number(commandeItem.quantite);
        const alreadyReceived = Number(commandeItem.quantiteRecue || '0');
        if (!Number.isFinite(ordered) || ordered <= 0) {
          throw Object.assign(new Error(`La quantité commandée est invalide pour ${commandeItem.description}.`), { status: 409 });
        }
        const newReceived = alreadyReceived + quantiteRecue;
        if (newReceived > ordered) {
          throw Object.assign(new Error(`La quantité reçue (${newReceived}) dépasse la quantité commandée (${ordered}) pour ${commandeItem.description}`), { status: 400 });
        }
        const [updatedLine] = await tx.update(commandesAchatItems).set({
          quantiteRecue: newReceived.toString()
        }).where(and(
          eq(commandesAchatItems.id, commandeItem.id),
          eq(commandesAchatItems.entrepriseId, req.entrepriseId)
        )).returning();
        changedLines.push({ before: commandeItem, after: updatedLine });
        if (newReceived < ordered) toutRecu = false;
        const purchaseUnitCost = Number(commandeItem.prixUnitaire || 0) *
          (1 - Number(commandeItem.remise || 0) / 100);
        const lineFreightTotal = freightByOrderLine.get(commandeItem.id) || 0;
        const freightAppliedBefore = roundMoney(lineFreightTotal * alreadyReceived / ordered);
        const freightAppliedAfter = newReceived >= ordered - 0.0005
          ? lineFreightTotal
          : roundMoney(lineFreightTotal * newReceived / ordered);
        const freightForThisReceipt = roundMoney(freightAppliedAfter - freightAppliedBefore);
        const freightPerReceivedUnit = quantiteRecue > 0 ? freightForThisReceipt / quantiteRecue : 0;
        const actualUnitCost = purchaseUnitCost + freightPerReceivedUnit;
        totalHTReception += quantiteRecue * purchaseUnitCost + freightForThisReceipt;
        totalArticlesReception += quantiteRecue * purchaseUnitCost;

        for (const cost of logisticsRows) {
          const allocatedForLine = logisticsAllocationByCost.get(cost.id)?.get(commandeItem.id) || 0;
          if (!allocatedForLine) continue;
          const allocatedBefore = roundMoney(allocatedForLine * alreadyReceived / ordered);
          const allocatedAfter = newReceived >= ordered - 0.0005
            ? allocatedForLine
            : roundMoney(allocatedForLine * newReceived / ordered);
          const incrementalAmount = roundMoney(allocatedAfter - allocatedBefore);
          if (incrementalAmount <= 0) continue;
          const pending = pendingLogisticsByType.get(cost.type) || { amount: 0, descriptions: new Set() };
          pending.amount = roundMoney(pending.amount + incrementalAmount);
          if (cost.description) pending.descriptions.add(cost.description);
          pendingLogisticsByType.set(cost.type, pending);
        }

        if (commandeItem.produitId) {
          const [product] = await tx.select().from(produits).where(and(
            eq(produits.id, commandeItem.produitId),
            eq(produits.entrepriseId, req.entrepriseId)
          )).for('update').limit(1);
          if (!product) throw Object.assign(new Error(`Produit ${commandeItem.produitId} introuvable`), { status: 409 });
          await ensureOpeningValuationLayer(tx, {
            entrepriseId: req.entrepriseId,
            produitId: product.id,
            productSnapshot: product,
          });
          const [updatedProduct] = await tx.update(produits).set({
            quantite: (Number(product.quantite) + quantiteRecue).toString(),
            updatedAt: new Date()
          }).where(and(
            eq(produits.id, product.id),
            eq(produits.entrepriseId, req.entrepriseId)
          )).returning();
          changedProducts.push({ before: product, after: updatedProduct });
          const [warehouseStock] = await tx.select().from(stockParEntrepot).where(and(
            eq(stockParEntrepot.entrepriseId, req.entrepriseId),
            eq(stockParEntrepot.produitId, product.id),
            eq(stockParEntrepot.entrepotId, warehouseId)
          )).for('update').limit(1);
          if (warehouseStock) {
            const present = Number(warehouseStock.quantitePresente || 0) + quantiteRecue;
            const reserved = Number(warehouseStock.quantiteReservee || 0);
            await tx.update(stockParEntrepot).set({
              quantitePresente: present.toString(),
              quantiteDisponible: (present - reserved).toString(),
              updatedAt: new Date(),
            }).where(and(
              eq(stockParEntrepot.id, warehouseStock.id),
              eq(stockParEntrepot.entrepriseId, req.entrepriseId)
            ));
          } else {
            await tx.insert(stockParEntrepot).values({
              entrepriseId: req.entrepriseId,
              produitId: product.id,
              entrepotId: warehouseId,
              quantitePresente: quantiteRecue.toString(),
              quantiteReservee: '0',
              quantiteDisponible: quantiteRecue.toString(),
              updatedAt: new Date(),
            });
          }
          const [movement] = await tx.insert(mouvementsStock).values({
            entrepriseId: req.entrepriseId,
            produitId: product.id,
            type: 'entree',
            quantite: quantiteRecue.toString(),
            dateMouvement: date,
            reference: receiptNumber,
            notes: notes || `Réception commande ${commande.numeroCommande}${numeroLivraison ? ` - BL ${numeroLivraison}` : ''}`,
            userId: req.user.id,
          }).returning();
          movements.push(movement);
          const [receiptLine] = await tx.insert(lignesReception).values({
            entrepriseId: req.entrepriseId,
            bonReceptionId: receiptHeader.id,
            produitId: product.id,
            quantiteCommandee: commandeItem.quantite,
            quantiteRecue: quantiteRecue.toString(),
            quantiteSaisie: quantiteRecue.toString(),
            uniteSaisie: product.uniteMesure || 'pièce',
            prixUnitaireEstime: purchaseUnitCost.toFixed(2),
            prixUnitaireSaisi: Number(commandeItem.prixUnitaire || 0).toFixed(2),
            mouvementStockId: movement.id,
          }).returning();
          const [pendingRow] = await tx.insert(stockPending).values({
            entrepriseId: req.entrepriseId,
            bonReceptionId: receiptHeader.id,
            ligneReceptionId: receiptLine.id,
            produitId: product.id,
            fournisseurId: commande.fournisseurId,
            quantitePending: quantiteRecue.toString(),
            prixEstime: purchaseUnitCost.toFixed(2),
            valeurEstimee: (quantiteRecue * purchaseUnitCost).toFixed(2),
            dateReception: date,
            entrepotId: warehouseId,
            statut: 'pending',
          }).returning();
          pendingStockRows.push(pendingRow);
          await createStockValuationLayer(tx, {
            entrepriseId: req.entrepriseId,
            produitId: product.id,
            mouvementId: movement.id,
            quantity: quantiteRecue,
            unitCost: actualUnitCost,
            productSnapshot: product,
            ensureOpening: false,
          });
        }
      }
      if (changedLines.length === 0) {
        throw Object.assign(new Error('Indiquez au moins une quantité reçue supérieure à zéro.'), { status: 400 });
      }
      for (const [type, pending] of pendingLogisticsByType) {
        if (pending.amount <= 0) continue;
        const [pendingRow] = await tx.insert(logistiquePending).values({
          entrepriseId: req.entrepriseId,
          bonReceptionId: receiptHeader.id,
          commandeAchatId: commande.id,
          fournisseurId: commande.fournisseurId,
          type,
          description: [...pending.descriptions].join('; ') || null,
          montantEstime: pending.amount.toFixed(2),
          dateReception: date,
          statut: 'pending',
        }).returning();
        pendingLogisticsRows.push(pendingRow);
      }
      const [updatedReceiptHeader] = await tx.update(bonsReception).set({
        totalHT: totalArticlesReception.toFixed(2),
        updatedAt: new Date(),
      }).where(and(
        eq(bonsReception.id, receiptHeader.id),
        eq(bonsReception.entrepriseId, req.entrepriseId)
      )).returning();
      const allOrderLines = await tx.select().from(commandesAchatItems).where(and(
        eq(commandesAchatItems.commandeId, commande.id),
        eq(commandesAchatItems.entrepriseId, req.entrepriseId)
      ));
      toutRecu = allOrderLines.every(line => Number(line.quantiteRecue || 0) >= Number(line.quantite));

      const nouveauStatut = toutRecu ? 'livree' : 'preparee';
      const [updatedCommande] = await tx.update(commandesAchat).set({
        statut: nouveauStatut,
        updatedAt: new Date()
      }).where(and(
        eq(commandesAchat.id, commande.id),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).returning();

      let ecritureComptable = null;
      if (totalHTReception > 0) {
        const [fourn] = await tx.select().from(fournisseurs).where(and(
          eq(fournisseurs.id, commande.fournisseurId),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )).limit(1);
        ecritureComptable = await createEcritureReception({
          entrepriseId: req.entrepriseId,
          receptionNumero: `REC-${commande.numeroCommande}-${Date.now()}`,
          dateReception: date,
          fournisseurNom: fourn?.raisonSociale || 'Fournisseur',
          totalHT: totalHTReception,
          executor: tx
        });
      }
      const [receiptWithEntry] = await tx.update(bonsReception).set({
        ecritureStockId: ecritureComptable?.id || null,
        updatedAt: new Date(),
      }).where(and(
        eq(bonsReception.id, receiptHeader.id),
        eq(bonsReception.entrepriseId, req.entrepriseId)
      )).returning();

      for (const change of changedLines) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'UPDATE',
          table: 'commandes_achat_items',
          recordId: change.after.id,
          ancienneValeur: change.before,
          nouvelleValeur: change.after,
          description: `Quantité reçue modifiée pour la commande ${commande.numeroCommande}`,
          executor: tx,
          required: true
        });
      }
      for (const change of changedProducts) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'UPDATE',
          table: 'produits',
          recordId: change.after.id,
          ancienneValeur: change.before,
          nouvelleValeur: change.after,
          description: `Stock mis à jour après réception ${commande.numeroCommande}`,
          executor: tx,
          required: true
        });
      }
      for (const movement of movements) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'mouvements_stock',
          recordId: movement.id,
          nouvelleValeur: movement,
          description: `Entrée de stock enregistrée pour ${commande.numeroCommande}`,
          executor: tx,
          required: true
        });
      }
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'commandes_achat',
        recordId: updatedCommande.id,
        ancienneValeur: commande,
        nouvelleValeur: { ...updatedCommande, mouvementsStock: movements, ecritureComptable },
        description: `Réception de marchandises enregistrée: ${commande.numeroCommande}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'bons_reception',
        recordId: receiptHeader.id,
        nouvelleValeur: receiptWithEntry || updatedReceiptHeader,
        description: `Bon de réception créé depuis la commande ${commande.numeroCommande}`,
        executor: tx,
        required: true,
      });
      for (const pendingRow of pendingStockRows) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'stock_pending',
          recordId: pendingRow.id,
          nouvelleValeur: pendingRow,
          description: `Stock non facturé enregistré pour la réception ${receiptNumber}`,
          executor: tx,
          required: true,
        });
      }
      for (const pendingRow of pendingLogisticsRows) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'logistique_pending',
          recordId: pendingRow.id,
          nouvelleValeur: pendingRow,
          description: `Coût logistique non facturé enregistré pour la réception ${receiptNumber}`,
          executor: tx,
          required: true,
        });
      }
      if (ecritureComptable) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'ecritures',
          recordId: ecritureComptable.id,
          nouvelleValeur: ecritureComptable,
          description: `Écriture comptable créée pour réception ${commande.numeroCommande}`,
          executor: tx,
          required: true
        });
      }
      return {
        commandeId: commande.id,
        receptionId: receiptHeader.id,
        receptionNumero: receiptNumber,
        statut: nouveauStatut,
        mouvementsStock: movements.length,
        toutRecu,
        ecritureComptableId: ecritureComptable?.id || null
      };
    });

    return res.json({
      success: true,
      message: receipt.toutRecu ? 'Réception complète enregistrée' : 'Réception partielle enregistrée',
      data: receipt
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la réception:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la réception',
      error: error.message
    });
  }
});

// GET /api/receptions/commande/:commandeId - Historique des réceptions pour une commande
router.get('/commande/:commandeId', async (req, res) => {
  try {
    const { commandeId } = req.params;

    // Récupérer les mouvements de stock liés à cette commande
    const [commande] = await db
      .select()
      .from(commandesAchat)
      .where(
        and(
          eq(commandesAchat.id, parseInt(commandeId)),
          eq(commandesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!commande) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Récupérer les mouvements de stock
    const mouvements = await db
      .select({
        mouvement: mouvementsStock,
        produit: produits,
      })
      .from(mouvementsStock)
      .leftJoin(produits, eq(mouvementsStock.produitId, produits.id))
      .where(
        and(
          eq(mouvementsStock.entrepriseId, req.entrepriseId),
          sql`${mouvementsStock.reference} LIKE ${`%${commande.numeroCommande}%`}`
        )
      );

    // Récupérer l'état des lignes de commande
    const items = await db
      .select({
        item: commandesAchatItems,
        produit: produits,
      })
      .from(commandesAchatItems)
      .leftJoin(produits, eq(commandesAchatItems.produitId, produits.id))
      .where(eq(commandesAchatItems.commandeId, parseInt(commandeId)));

    return res.json({
      success: true,
      data: {
        commande,
        items: items.map(i => ({
          ...i.item,
          produit: i.produit,
          quantiteRestante: parseFloat(i.item.quantite) - parseFloat(i.item.quantiteRecue || '0')
        })),
        mouvements: mouvements.map(m => ({ ...m.mouvement, produit: m.produit }))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des réceptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réceptions',
      error: error.message
    });
  }
});

export default router;
