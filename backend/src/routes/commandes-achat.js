import express from 'express';
import { db } from '../db.js';
import { commandesAchat, commandesAchatItems, produits, fournisseurs, mouvementsStock, coutsLogistiquesCommande, bonsReception } from '../schema.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

// Génération automatique du numéro de commande
async function genererNumeroCommande(entrepriseId) {
  const annee = new Date().getFullYear();
  const [lastCommande] = await db
    .select()
    .from(commandesAchat)
    .where(eq(commandesAchat.entrepriseId, entrepriseId))
    .orderBy(desc(commandesAchat.id))
    .limit(1);

  let numero = 1;
  if (lastCommande && lastCommande.numeroCommande) {
    const match = lastCommande.numeroCommande.match(/CMD-(\d{4})-(\d+)/);
    if (match && parseInt(match[1]) === annee) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `CMD-${annee}-${numero.toString().padStart(4, '0')}`;
}

// GET /api/commandes-achat - Liste des commandes d'achat
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, statut, fournisseurId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [eq(commandesAchat.entrepriseId, req.entrepriseId)];

    if (statut) {
      whereConditions.push(eq(commandesAchat.statut, statut));
    }

    if (fournisseurId) {
      whereConditions.push(eq(commandesAchat.fournisseurId, parseInt(fournisseurId)));
    }

    const results = await db
      .select({
        commande: commandesAchat,
        fournisseur: fournisseurs,
      })
      .from(commandesAchat)
      .leftJoin(fournisseurs, eq(commandesAchat.fournisseurId, fournisseurs.id))
      .where(and(...whereConditions))
      .orderBy(desc(commandesAchat.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    // Compter le total
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(commandesAchat)
      .where(and(...whereConditions));

    const formattedResults = results.map(r => ({
      ...r.commande,
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
    console.error('Erreur lors de la récupération des commandes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      error: error.message
    });
  }
});

// GET /api/commandes-achat/:id - Récupérer une commande avec détails
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [commande] = await db
      .select({
        commande: commandesAchat,
        fournisseur: fournisseurs,
      })
      .from(commandesAchat)
      .leftJoin(fournisseurs, eq(commandesAchat.fournisseurId, fournisseurs.id))
      .where(
        and(
          eq(commandesAchat.id, parseInt(id)),
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

    // Récupérer les lignes de commande
    const items = await db
      .select({
        item: commandesAchatItems,
        produit: produits,
      })
      .from(commandesAchatItems)
      .leftJoin(produits, eq(commandesAchatItems.produitId, produits.id))
      .where(eq(commandesAchatItems.commandeId, parseInt(id)));

    // Récupérer les coûts logistiques
    const couts = await db
      .select()
      .from(coutsLogistiquesCommande)
      .where(eq(coutsLogistiquesCommande.commandeAchatId, parseInt(id)));

    return res.json({
      success: true,
      data: {
        ...commande.commande,
        fournisseur: commande.fournisseur,
        items: items.map(i => ({ ...i.item, produit: i.produit })),
        coutsLogistiques: couts
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
      error: error.message
    });
  }
});

// POST /api/commandes-achat - Créer une commande d'achat
router.post('/', async (req, res) => {
  try {
    const {
      fournisseurId,
      dateCommande,
      dateLivraisonPrevue,
      items,
      coutsLogistiques,
      notes,
      conditionsLivraison,
      modeLivraison
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
    if (items.some((item) => {
      const quantity = Number(item.quantite);
      const unitPrice = Number(item.prixUnitaire);
      const discount = Number(item.remise || 0);
      return !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(discount) || discount < 0 || discount > 100 ||
        (!item.produitId && !String(item.description || '').trim());
    })) {
      return res.status(400).json({ success: false, message: 'Une ligne de commande contient des valeurs invalides.' });
    }
    if (coutsLogistiques && (!Array.isArray(coutsLogistiques) || coutsLogistiques.some((cost) =>
      !['transport', 'douane', 'manutention', 'assurance', 'autre'].includes(cost.type) ||
      !Number.isFinite(Number(cost.montant)) || Number(cost.montant) < 0
    ))) {
      return res.status(400).json({ success: false, message: 'Un coût logistique est invalide.' });
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
    const productIds = [...new Set(items.map((item) => Number(item.produitId)).filter(Number.isSafeInteger))];
    if (productIds.length) {
      const validProducts = await db.select({ id: produits.id }).from(produits).where(and(
        eq(produits.entrepriseId, req.entrepriseId),
        inArray(produits.id, productIds)
      ));
      if (validProducts.length !== productIds.length) {
        return res.status(400).json({ success: false, message: 'Un produit de la commande est introuvable dans cette entreprise.' });
      }
    }

    // Générer numéro de commande
    const numeroCommande = await genererNumeroCommande(req.entrepriseId);

    // Calculer les totaux articles
    let totalArticlesHT = 0;
    for (const item of items) {
      const quantite = parseFloat(item.quantite);
      const prixUnitaire = parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalLigne = quantite * prixUnitaire * (1 - remise / 100);
      totalArticlesHT += totalLigne;
    }

    // Calculer les coûts logistiques
    let totalLogistique = 0;
    if (coutsLogistiques && Array.isArray(coutsLogistiques)) {
      for (const cout of coutsLogistiques) {
        totalLogistique += parseFloat(cout.montant || 0);
      }
    }

    const totalHT = totalArticlesHT + totalLogistique;
    const totalTVA = totalArticlesHT * 0.18; // TVA à récupérer depuis les paramètres entreprise
    const totalTTC = totalHT + totalTVA;

    const creation = await db.transaction(async (tx) => {
      const [newCommande] = await tx.insert(commandesAchat).values({
        entrepriseId: req.entrepriseId,
        numeroCommande,
        fournisseurId: parseInt(fournisseurId),
        statut: 'brouillon',
        dateCommande: dateCommande || new Date().toISOString().split('T')[0],
        dateLivraisonPrevue: dateLivraisonPrevue || null,
        totalArticlesHT: totalArticlesHT.toFixed(2),
        totalLogistique: totalLogistique.toFixed(2),
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        notes: notes || null,
        conditionsLivraison: conditionsLivraison || null,
        modeLivraison: modeLivraison || null,
        userId: req.user.id,
      }).returning();

      const itemsToInsert = items.map(item => {
        const quantite = parseFloat(item.quantite);
        const prixUnitaire = parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        const totalLigne = quantite * prixUnitaire * (1 - remise / 100);
        return {
        entrepriseId: req.entrepriseId,
        commandeId: newCommande.id,
        produitId: item.produitId ? parseInt(item.produitId) : null,
        description: item.description,
        quantite: quantite.toString(),
        quantiteRecue: '0',
        prixUnitaire: prixUnitaire.toFixed(2),
        remise: remise.toFixed(2),
        totalLigne: totalLigne.toFixed(2),
        };
      });

      const insertedItems = await tx.insert(commandesAchatItems).values(itemsToInsert).returning();

      let insertedCouts = [];
      if (coutsLogistiques && Array.isArray(coutsLogistiques) && coutsLogistiques.length > 0) {
        const coutsToInsert = coutsLogistiques.map(cout => ({
          entrepriseId: req.entrepriseId,
          commandeAchatId: newCommande.id,
          type: cout.type,
          description: cout.description || null,
          montant: parseFloat(cout.montant).toFixed(2),
        }));
        insertedCouts = await tx.insert(coutsLogistiquesCommande).values(coutsToInsert).returning();
      }
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'commandes_achat',
        recordId: newCommande.id,
        nouvelleValeur: { commande: newCommande, items: insertedItems, coutsLogistiques: insertedCouts },
        description: `Commande d’achat créée: ${newCommande.numeroCommande}`,
        executor: tx,
        required: true
      });
      return { newCommande, insertedItems, insertedCouts };
    });

    return res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: {
        ...creation.newCommande,
        items: creation.insertedItems,
        coutsLogistiques: creation.insertedCouts
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création de la commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande',
      error: error.message
    });
  }
});

// PUT /api/commandes-achat/:id - Modifier un bon tant qu’aucune marchandise n’a été reçue
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fournisseurId, dateCommande, dateLivraisonPrevue, items, coutsLogistiques, notes, conditionsLivraison, modeLivraison } = req.body;
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Identifiant de commande invalide.' });
    }
    if (!fournisseurId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Le fournisseur et au moins un article sont obligatoires.' });
    }
    if (items.some((item) => {
      const quantity = Number(item.quantite);
      const unitPrice = Number(item.prixUnitaire);
      const discount = Number(item.remise || 0);
      return !Number.isFinite(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(discount) || discount < 0 || discount > 100 ||
        (!item.produitId && !String(item.description || '').trim());
    })) {
      return res.status(400).json({ success: false, message: 'Une ligne de commande contient des valeurs invalides.' });
    }
    if (coutsLogistiques && (!Array.isArray(coutsLogistiques) || coutsLogistiques.some((cost) =>
      !['transport', 'douane', 'manutention', 'assurance', 'autre'].includes(cost.type) ||
      !Number.isFinite(Number(cost.montant)) || Number(cost.montant) < 0
    ))) {
      return res.status(400).json({ success: false, message: 'Un coût logistique est invalide.' });
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(commandesAchat).where(and(
        eq(commandesAchat.id, id),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!order) return { status: 404 };
      if (['annulee', 'livree'].includes(String(order.statut).toLowerCase())) {
        return { status: 409, message: 'Une commande annulée ou réceptionnée ne peut plus être modifiée.' };
      }

      const [receipt] = await tx.select({ id: bonsReception.id }).from(bonsReception).where(and(
        eq(bonsReception.commandeAchatId, order.id),
        eq(bonsReception.entrepriseId, req.entrepriseId)
      )).limit(1);
      const existingItems = await tx.select().from(commandesAchatItems).where(and(
        eq(commandesAchatItems.commandeId, order.id),
        eq(commandesAchatItems.entrepriseId, req.entrepriseId)
      )).for('update');
      if (receipt || existingItems.some((line) => Number(line.quantiteRecue || 0) > 0)) {
        return { status: 409, message: 'Le bon de commande est verrouillé dès la première réception.' };
      }

      const [supplier] = await tx.select({ id: fournisseurs.id }).from(fournisseurs).where(and(
        eq(fournisseurs.id, Number(fournisseurId)),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!supplier) return { status: 400, message: 'Le fournisseur sélectionné est invalide.' };

      const productIds = [...new Set(items.map((item) => Number(item.produitId)).filter(Number.isSafeInteger))];
      if (productIds.length) {
        const validProducts = await tx.select({ id: produits.id }).from(produits).where(and(
          eq(produits.entrepriseId, req.entrepriseId),
          inArray(produits.id, productIds)
        ));
        if (validProducts.length !== productIds.length) {
          return { status: 400, message: 'Un produit de la commande est introuvable dans cette entreprise.' };
        }
      }

      const existingCosts = await tx.select().from(coutsLogistiquesCommande).where(and(
        eq(coutsLogistiquesCommande.commandeAchatId, order.id),
        eq(coutsLogistiquesCommande.entrepriseId, req.entrepriseId)
      ));
      const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
      const totalArticlesHT = roundMoney(items.reduce((sum, item) =>
        sum + Number(item.quantite) * Number(item.prixUnitaire) * (1 - Number(item.remise || 0) / 100), 0));
      const totalLogistique = roundMoney((coutsLogistiques || []).reduce((sum, cost) => sum + Number(cost.montant), 0));
      const totalTVA = roundMoney(totalArticlesHT * 0.18);
      const [updatedOrder] = await tx.update(commandesAchat).set({
        fournisseurId: Number(fournisseurId),
        dateCommande: dateCommande || order.dateCommande,
        dateLivraisonPrevue: dateLivraisonPrevue || null,
        totalArticlesHT: totalArticlesHT.toFixed(2),
        totalLogistique: totalLogistique.toFixed(2),
        totalHT: (totalArticlesHT + totalLogistique).toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: (totalArticlesHT + totalLogistique + totalTVA).toFixed(2),
        notes: notes || null,
        conditionsLivraison: conditionsLivraison || null,
        modeLivraison: modeLivraison || null,
        updatedAt: new Date(),
      }).where(and(
        eq(commandesAchat.id, order.id),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).returning();

      await tx.delete(commandesAchatItems).where(and(
        eq(commandesAchatItems.commandeId, order.id),
        eq(commandesAchatItems.entrepriseId, req.entrepriseId)
      ));
      const updatedItems = await tx.insert(commandesAchatItems).values(items.map((item) => {
        const quantity = Number(item.quantite);
        const price = Number(item.prixUnitaire);
        const discount = Number(item.remise || 0);
        return {
          entrepriseId: req.entrepriseId,
          commandeId: order.id,
          produitId: item.produitId ? Number(item.produitId) : null,
          description: String(item.description || '').trim(),
          quantite: String(quantity),
          quantiteRecue: '0',
          prixUnitaire: price.toFixed(2),
          remise: discount.toFixed(2),
          totalLigne: (quantity * price * (1 - discount / 100)).toFixed(2),
        };
      })).returning();
      await tx.delete(coutsLogistiquesCommande).where(and(
        eq(coutsLogistiquesCommande.commandeAchatId, order.id),
        eq(coutsLogistiquesCommande.entrepriseId, req.entrepriseId)
      ));
      const updatedCosts = coutsLogistiques?.length
        ? await tx.insert(coutsLogistiquesCommande).values(coutsLogistiques.map((cost) => ({
          entrepriseId: req.entrepriseId,
          commandeAchatId: order.id,
          type: cost.type,
          description: cost.description || null,
          montant: Number(cost.montant).toFixed(2),
        }))).returning()
        : [];

      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'commandes_achat',
        recordId: order.id,
        ancienneValeur: { commande: order, items: existingItems, coutsLogistiques: existingCosts },
        nouvelleValeur: { commande: updatedOrder, items: updatedItems, coutsLogistiques: updatedCosts },
        description: `Bon de commande modifié avant réception: ${order.numeroCommande}`,
        executor: tx,
        required: true,
      });
      return { status: 200, data: { ...updatedOrder, items: updatedItems, coutsLogistiques: updatedCosts } };
    });
    if (result.status !== 200) {
      return res.status(result.status).json({ success: false, message: result.message || 'Commande non trouvée.' });
    }
    return res.json({ success: true, message: 'Bon de commande mis à jour.', data: result.data });
  } catch (error) {
    console.error('Erreur lors de la modification du bon de commande:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la modification du bon de commande.', error: error.message });
  }
});

// PUT /api/commandes-achat/:id/confirmer - Confirmer une commande (valider)
router.put('/:id/confirmer', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.transaction(async (tx) => {
      const [commande] = await tx.select().from(commandesAchat).where(and(
        eq(commandesAchat.id, parseInt(id)),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!commande) return { status: 404 };
      if (commande.statut !== 'brouillon') return { status: 400 };
      const [updated] = await tx.update(commandesAchat).set({
        statut: 'confirmee',
        updatedAt: new Date()
      }).where(and(
        eq(commandesAchat.id, commande.id),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'commandes_achat',
        recordId: updated.id,
        ancienneValeur: commande,
        nouvelleValeur: updated,
        description: `Commande d’achat confirmée: ${updated.numeroCommande}`,
        executor: tx,
        required: true
      });
      return { status: 200, updated };
    });
    if (result.status !== 200) {
      return res.status(result.status).json({
        success: false,
        message: result.status === 404 ? 'Commande non trouvée' : 'Seules les commandes en brouillon peuvent être confirmées'
      });
    }

    return res.json({
      success: true,
      message: 'Commande confirmée avec succès',
      data: result.updated
    });
  } catch (error) {
    console.error('Erreur lors de la confirmation de la commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation de la commande',
      error: error.message
    });
  }
});

// PUT /api/commandes-achat/:id/annuler - Annuler une commande
router.put('/:id/annuler', async (req, res) => {
  try {
    const { id } = req.params;
    const { motifAnnulation } = req.body;

    const result = await db.transaction(async (tx) => {
      const [commande] = await tx.select().from(commandesAchat).where(and(
        eq(commandesAchat.id, parseInt(id)),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!commande) return { status: 404 };
      if (commande.statut === 'livree') return { status: 400 };
      const [updated] = await tx.update(commandesAchat).set({
        statut: 'annulee',
        notes: motifAnnulation ? `${commande.notes || ''}\n\nAnnulation: ${motifAnnulation}` : commande.notes,
        updatedAt: new Date()
      }).where(and(
        eq(commandesAchat.id, commande.id),
        eq(commandesAchat.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'commandes_achat',
        recordId: updated.id,
        ancienneValeur: commande,
        nouvelleValeur: updated,
        description: `Commande d’achat annulée: ${updated.numeroCommande}`,
        executor: tx,
        required: true
      });
      return { status: 200, updated };
    });
    if (result.status !== 200) {
      return res.status(result.status).json({
        success: false,
        message: result.status === 404 ? 'Commande non trouvée' : 'Une commande livrée ne peut pas être annulée'
      });
    }

    return res.json({
      success: true,
      message: 'Commande annulée avec succès',
      data: result.updated
    });
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la commande:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la commande',
      error: error.message
    });
  }
});

export default router;
