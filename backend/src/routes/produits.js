import express from 'express';
import { db } from '../db.js';
import { produits, mouvementsStock } from '../schema.js';
import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import {
  consumeStockValuation,
  convertWeightToKg,
  createStockValuationLayer,
  ensureOpeningValuationLayer,
} from '../services/stockValuation.js';

const router = express.Router();

/**
 * GET /api/produits
 * Récupère la liste de tous les produits de l'entreprise (avec pagination)
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const produitsList = await db
      .select()
      .from(produits)
      .where(eq(produits.entrepriseId, req.entrepriseId))
      .orderBy(desc(produits.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(produits)
      .where(eq(produits.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: produitsList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: produitsList,
    });
  } catch (error) {
    console.error('Erreur GET /api/produits:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des produits',
      error: error.message,
    });
  }
});

/**
 * GET /api/produits/stock-faible
 * Récupère les produits dont le stock est inférieur au stock minimum
 */
router.get('/stock-faible', async (req, res) => {
  try {
    const produitsStockFaible = await db
      .select()
      .from(produits)
      .where(and(
        eq(produits.entrepriseId, req.entrepriseId),
        sql`${produits.quantite} <= ${produits.stockMinimum}`
      ))
      .orderBy(desc(produits.quantite));

    res.json({
      success: true,
      count: produitsStockFaible.length,
      data: produitsStockFaible,
    });
  } catch (error) {
    console.error('Erreur GET /api/produits/stock-faible:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des produits à stock faible',
      error: error.message,
    });
  }
});

/**
 * GET /api/produits/:id
 * Récupère un produit spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const produit = await db
      .select()
      .from(produits)
      .where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!produit || produit.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé',
      });
    }

    res.json({
      success: true,
      data: produit[0],
    });
  } catch (error) {
    console.error('Erreur GET /api/produits/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du produit',
      error: error.message,
    });
  }
});

/**
 * POST /api/produits
 * Crée un nouveau produit
 */
router.post('/', async (req, res) => {
  try {
    const {
      reference,
      nom,
      description,
      categorie,
      uniteMesure,
      poidsParUnite,
      unitePoids,
      quantite,
      stockMinimum,
      prixAchat,
      prixVente,
      fournisseurId,
      emplacement,
      actif,
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || nom.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom du produit est obligatoire',
      });
    }

    // Validation des nombres
    if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La quantité doit être un nombre positif',
      });
    }

    if (stockMinimum !== undefined && (isNaN(stockMinimum) || stockMinimum < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le stock minimum doit être un nombre positif',
      });
    }

    if (prixAchat !== undefined && (isNaN(prixAchat) || prixAchat < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le prix d\'achat doit être un nombre positif',
      });
    }

    if (prixVente !== undefined && (isNaN(prixVente) || prixVente < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le prix de vente doit être un nombre positif',
      });
    }
    const normalizedWeight = poidsParUnite === undefined || poidsParUnite === null || poidsParUnite === ''
      ? null
      : Number(poidsParUnite);
    if (normalizedWeight !== null) {
      if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
        return res.status(400).json({ success: false, message: 'Le poids par unité doit être supérieur à zéro.' });
      }
      try {
        convertWeightToKg(normalizedWeight, unitePoids || 'kg');
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    // Créer le produit avec l'entrepriseId automatique
    const newProduit = await db.transaction(async (tx) => {
      const [product] = await tx.insert(produits).values({
        entrepriseId: req.entrepriseId,
        reference: reference || null,
        nom: nom.trim(),
        description: description || null,
        categorie: categorie || null,
        uniteMesure: uniteMesure || 'pièce',
        poidsParUnite: normalizedWeight === null ? null : normalizedWeight.toFixed(6),
        unitePoids: unitePoids || 'kg',
        quantite: quantite || '0',
        stockMinimum: stockMinimum || '0',
        prixAchat: prixAchat || '0',
        prixVente: prixVente || '0',
        fournisseurId: fournisseurId || null,
        emplacement: emplacement || null,
        actif: actif !== undefined ? actif : true,
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'produits',
        recordId: product.id,
        nouvelleValeur: product,
        description: `Produit créé: ${product.nom}`,
        executor: tx,
        required: true
      });
      return product;
    });

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: newProduit,
    });
  } catch (error) {
    console.error('Erreur POST /api/produits:', error);

    // Gestion des erreurs de contraintes
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Cette référence produit existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du produit',
      error: error.message,
    });
  }
});

/**
 * PUT /api/produits/:id
 * Met à jour un produit existant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      reference,
      nom,
      description,
      categorie,
      uniteMesure,
      poidsParUnite,
      unitePoids,
      quantite,
      stockMinimum,
      prixAchat,
      prixVente,
      fournisseurId,
      emplacement,
      actif,
    } = req.body;

    // Vérifier que le produit existe et appartient à l'entreprise
    const existingProduit = await db
      .select()
      .from(produits)
      .where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingProduit || existingProduit.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé ou accès non autorisé',
      });
    }

    // Validations
    if (quantite !== undefined && (isNaN(quantite) || quantite < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La quantité doit être un nombre positif',
      });
    }

    if (stockMinimum !== undefined && (isNaN(stockMinimum) || stockMinimum < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le stock minimum doit être un nombre positif',
      });
    }

    if (prixAchat !== undefined && (isNaN(prixAchat) || prixAchat < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le prix d\'achat doit être un nombre positif',
      });
    }

    if (prixVente !== undefined && (isNaN(prixVente) || prixVente < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le prix de vente doit être un nombre positif',
      });
    }
    const normalizedWeight = poidsParUnite === undefined
      ? undefined
      : (poidsParUnite === null || poidsParUnite === '' ? null : Number(poidsParUnite));
    if (normalizedWeight !== undefined && normalizedWeight !== null) {
      if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
        return res.status(400).json({ success: false, message: 'Le poids par unité doit être supérieur à zéro.' });
      }
      try {
        convertWeightToKg(normalizedWeight, unitePoids || existingProduit[0].unitePoids || 'kg');
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    } else if (unitePoids !== undefined) {
      try {
        convertWeightToKg(1, unitePoids);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }

    // Construire l'objet de mise à jour
    const updateData = {
      updatedAt: new Date(),
    };

    if (reference !== undefined) updateData.reference = reference;
    if (nom !== undefined) updateData.nom = nom.trim();
    if (description !== undefined) updateData.description = description;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (uniteMesure !== undefined) updateData.uniteMesure = uniteMesure;
    if (normalizedWeight !== undefined) updateData.poidsParUnite = normalizedWeight === null ? null : normalizedWeight.toFixed(6);
    if (unitePoids !== undefined) updateData.unitePoids = unitePoids;
    if (quantite !== undefined) updateData.quantite = quantite;
    if (stockMinimum !== undefined) updateData.stockMinimum = stockMinimum;
    if (prixAchat !== undefined) updateData.prixAchat = prixAchat;
    if (prixVente !== undefined) updateData.prixVente = prixVente;
    if (fournisseurId !== undefined) updateData.fournisseurId = fournisseurId;
    if (emplacement !== undefined) updateData.emplacement = emplacement;
    if (actif !== undefined) updateData.actif = actif;

    // Mettre à jour le produit
    const updatedProduit = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(produits).where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!previous) return null;
      const [updated] = await tx.update(produits).set(updateData).where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'produits',
        recordId: updated.id,
        ancienneValeur: previous,
        nouvelleValeur: updated,
        description: `Produit modifié: ${updated.nom}`,
        executor: tx,
        required: true
      });
      return updated;
    });
    if (!updatedProduit) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé ou accès non autorisé' });
    }

    res.json({
      success: true,
      message: 'Produit mis à jour avec succès',
      data: updatedProduit[0],
    });
  } catch (error) {
    console.error('Erreur PUT /api/produits/:id:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Cette référence produit existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du produit',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/produits/:id
 * Supprime un produit
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le produit existe et appartient à l'entreprise
    const existingProduit = await db
      .select()
      .from(produits)
      .where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingProduit || existingProduit.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé ou accès non autorisé',
      });
    }

    await db.transaction(async (tx) => {
      const [product] = await tx.select().from(produits).where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!product) throw Object.assign(new Error('Produit non trouvé ou accès non autorisé'), { status: 404 });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'produits',
        recordId: product.id,
        ancienneValeur: product,
        description: `Produit supprimé: ${product.nom}`,
        executor: tx,
        required: true
      });
      await tx.delete(produits).where(and(
        eq(produits.id, product.id),
        eq(produits.entrepriseId, req.entrepriseId)
      ));
    });

    res.json({
      success: true,
      message: 'Produit supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/produits/:id:', error);

    // Gestion des erreurs de contraintes (ex: produit utilisé dans commandes/factures)
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce produit car il est utilisé dans d\'autres enregistrements',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du produit',
      error: error.message,
    });
  }
});

/**
 * POST /api/produits/:id/ajuster-stock
 * Ajuste le stock d'un produit et enregistre un mouvement
 */
router.post('/:id/ajuster-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantite, type, motif } = req.body;

    // Validation
    if (!quantite || isNaN(quantite) || quantite === 0) {
      return res.status(400).json({
        success: false,
        message: 'La quantité doit être un nombre non nul',
      });
    }

    if (!type || !['entree', 'sortie', 'ajustement'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Le type doit être "entree", "sortie" ou "ajustement"',
      });
    }

    const updatedProduit = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(produits).where(and(
        eq(produits.id, parseInt(id)),
        eq(produits.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!product) return null;

      let nouvelleQuantite = parseFloat(product.quantite);
      if (type === 'entree' || (type === 'ajustement' && Number(quantite) > 0)) {
        nouvelleQuantite += Number(quantite);
      } else {
        nouvelleQuantite -= Math.abs(Number(quantite));
      }
      if (nouvelleQuantite < 0) {
        throw Object.assign(new Error('Le stock ne peut pas être négatif'), { status: 400 });
      }
      const stockDelta = nouvelleQuantite - parseFloat(product.quantite || 0);
      if (stockDelta > 0) {
        await ensureOpeningValuationLayer(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          productSnapshot: product,
        });
      }

      const [updated] = await tx.update(produits).set({
        quantite: nouvelleQuantite.toString(),
        updatedAt: new Date(),
      }).where(and(
        eq(produits.id, product.id),
        eq(produits.entrepriseId, req.entrepriseId)
      )).returning();
      const [movement] = await tx.insert(mouvementsStock).values({
        entrepriseId: req.entrepriseId,
        produitId: product.id,
        type,
        quantite: Math.abs(Number(quantite)).toString(),
        dateMouvement: new Date().toISOString().split('T')[0],
        motif: motif || null,
        userId: req.user.id,
      }).returning();

      if (stockDelta > 0) {
        const unitCost = Number(product.coutMoyen || product.prixAchat || 0);
        await createStockValuationLayer(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          mouvementId: movement.id,
          quantity: stockDelta,
          unitCost,
          productSnapshot: product,
          ensureOpening: false,
        });
      } else if (stockDelta < 0) {
        await consumeStockValuation(tx, {
          entrepriseId: req.entrepriseId,
          produitId: product.id,
          quantity: Math.abs(stockDelta),
        });
      }

      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'produits',
        recordId: updated.id,
        ancienneValeur: product,
        nouvelleValeur: updated,
        description: `Stock ajusté pour ${updated.nom}: ${product.quantite} → ${updated.quantite}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'mouvements_stock',
        recordId: movement.id,
        nouvelleValeur: movement,
        description: `Mouvement de stock ${type} enregistré pour ${updated.nom}`,
        executor: tx,
        required: true
      });
      return updated;
    });
    if (!updatedProduit) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }

    res.json({
      success: true,
      message: 'Stock ajusté avec succès',
      data: updatedProduit,
    });
  } catch (error) {
    console.error('Erreur POST /api/produits/:id/ajuster-stock:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de l\'ajustement du stock',
      error: error.message,
    });
  }
});

export default router;
