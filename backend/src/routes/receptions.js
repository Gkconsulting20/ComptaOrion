import express from 'express';
import { db } from '../db.js';
import { commandesAchat, commandesAchatItems, produits, mouvementsStock, fournisseurs } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { createEcritureReception } from '../services/comptabiliteService.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

// POST /api/receptions - Enregistrer une réception de marchandises
router.post('/', async (req, res) => {
  try {
    const {
      commandeId,
      dateReception,
      items, // [{ commandeItemId, quantiteRecue }]
      notes,
      numeroLivraison
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
      let toutRecu = true;
      let totalHTReception = 0;
      const date = dateReception || new Date().toISOString().split('T')[0];
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
        totalHTReception += quantiteRecue * Number(commandeItem.prixUnitaire || 0);

        if (commandeItem.produitId) {
          const [product] = await tx.select().from(produits).where(and(
            eq(produits.id, commandeItem.produitId),
            eq(produits.entrepriseId, req.entrepriseId)
          )).for('update').limit(1);
          if (!product) throw Object.assign(new Error(`Produit ${commandeItem.produitId} introuvable`), { status: 409 });
          const [updatedProduct] = await tx.update(produits).set({
            quantite: (Number(product.quantite) + quantiteRecue).toString(),
            updatedAt: new Date()
          }).where(and(
            eq(produits.id, product.id),
            eq(produits.entrepriseId, req.entrepriseId)
          )).returning();
          changedProducts.push({ before: product, after: updatedProduct });
          const [movement] = await tx.insert(mouvementsStock).values({
            entrepriseId: req.entrepriseId,
            produitId: product.id,
            type: 'entree',
            quantite: quantiteRecue.toString(),
            dateMouvement: date,
            reference: `Réception ${commande.numeroCommande}`,
            notes: notes || `Réception commande ${commande.numeroCommande}${numeroLivraison ? ` - BL ${numeroLivraison}` : ''}`,
            userId: req.user.id,
          }).returning();
          movements.push(movement);
        }
      }
      if (changedLines.length === 0) {
        throw Object.assign(new Error('Indiquez au moins une quantité reçue supérieure à zéro.'), { status: 400 });
      }
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
