import express from 'express';
import { db } from '../db.js';
import { produits, categoriesStock, entrepots, stockParEntrepot, mouvementsStock, alertesStock, inventairesTournants } from '../schema.js';
import { eq, and } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

// CRUD Catégories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.query.categoriesStock.findMany({
      where: eq(categoriesStock.entrepriseId, req.entrepriseId)
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { nom, description } = req.body;
    const result = await db.insert(categoriesStock).values({
      entrepriseId: req.entrepriseId,
      nom,
      description
    }).returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'categories_stock',
      recordId: result[0].id,
      nouvelleValeur: result[0],
      description: `Catégorie stock créée: ${nom}`
    });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { nom, description } = req.body;
    const result = await db.update(categoriesStock)
      .set({ nom, description, updatedAt: new Date() })
      .where(and(
        eq(categoriesStock.id, parseInt(req.params.id)),
        eq(categoriesStock.entrepriseId, req.entrepriseId)
      ))
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'UPDATE',
      table: 'categories_stock',
      recordId: parseInt(req.params.id),
      nouvelleValeur: result[0],
      description: `Catégorie stock modifiée: ${nom}`
    });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    // Audit log avant suppression
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'DELETE',
      table: 'categories_stock',
      recordId: parseInt(req.params.id),
      description: `Catégorie stock supprimée ID: ${req.params.id}`
    });

    await db.delete(categoriesStock)
      .where(and(
        eq(categoriesStock.id, parseInt(req.params.id)),
        eq(categoriesStock.entrepriseId, req.entrepriseId)
      ));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Produits
router.get('/produits', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const produitsList = await db.query.produits.findMany({
      where: eq(produits.entrepriseId, parseInt(entrepriseId))
    });
    res.json(produitsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/produits', async (req, res) => {
  try {
    const { entrepriseId, reference, nom, categoriId, prixAchat, prixVente, valorisationMethod } = req.body;
    const result = await db.insert(produits).values({
      entrepriseId: parseInt(entrepriseId),
      reference,
      nom,
      categoriId: categoriId ? parseInt(categoriId) : null,
      prixAchat: parseFloat(prixAchat) || 0,
      prixVente: parseFloat(prixVente) || 0,
      valorisationMethod: valorisationMethod || 'FIFO'
    }).returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'produits',
      recordId: result[0].id,
      nouvelleValeur: result[0],
      description: `Produit créé: ${nom} (${reference})`
    });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Entrepôts
router.get('/entrepots', async (req, res) => {
  try {
    const entrepotsList = await db.query.entrepots.findMany({
      where: eq(entrepots.entrepriseId, req.entrepriseId)
    });
    res.json(entrepotsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/entrepots', async (req, res) => {
  try {
    const { nom, adresse, responsable } = req.body;
    const result = await db.insert(entrepots).values({
      entrepriseId: req.entrepriseId,
      nom,
      adresse,
      responsable
    }).returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'entrepots',
      recordId: result[0].id,
      nouvelleValeur: result[0],
      description: `Entrepôt créé: ${nom}`
    });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/entrepots/:id', async (req, res) => {
  try {
    const { nom, adresse, responsable } = req.body;
    const result = await db.update(entrepots)
      .set({ nom, adresse, responsable, updatedAt: new Date() })
      .where(and(
        eq(entrepots.id, parseInt(req.params.id)),
        eq(entrepots.entrepriseId, req.entrepriseId)
      ))
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'UPDATE',
      table: 'entrepots',
      recordId: parseInt(req.params.id),
      nouvelleValeur: result[0],
      description: `Entrepôt modifié: ${nom}`
    });

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/entrepots/:id', async (req, res) => {
  try {
    // Audit log avant suppression
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'DELETE',
      table: 'entrepots',
      recordId: parseInt(req.params.id),
      description: `Entrepôt supprimé ID: ${req.params.id}`
    });

    await db.delete(entrepots)
      .where(and(
        eq(entrepots.id, parseInt(req.params.id)),
        eq(entrepots.entrepriseId, req.entrepriseId)
      ));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mouvements de stock
router.get('/mouvements', async (req, res) => {
  try {
    const mouvementsList = await db.select().from(mouvementsStock)
      .where(eq(mouvementsStock.entrepriseId, req.entrepriseId))
      .orderBy(mouvementsStock.createdAt);
    res.json(mouvementsList);
  } catch (error) {
    // Table mouvements_stock pas encore créée - retourner vide temporairement
    console.log('Erreur mouvements_stock:', error.message);
    res.json([]);
  }
});

router.post('/mouvements', async (req, res) => {
  try {
    const { entrepriseId, produitId, entrepotId, type, quantite, prixUnitaire, reference } = req.body;
    
    // Insérer le mouvement
    const movement = await db.insert(mouvementsStock).values({
      entrepriseId: parseInt(entrepriseId),
      produitId: parseInt(produitId),
      entrepotId: entrepotId ? parseInt(entrepotId) : null,
      type,
      quantite: parseFloat(quantite),
      prixUnitaire: prixUnitaire ? parseFloat(prixUnitaire) : null,
      reference
    }).returning();

    // Mettre à jour le stock par entrepôt
    if (entrepotId && type !== 'transfert') {
      const currentStock = await db.query.stockParEntrepot.findFirst({
        where: and(
          eq(stockParEntrepot.produitId, parseInt(produitId)),
          eq(stockParEntrepot.entrepotId, parseInt(entrepotId))
        )
      });

      const quantityChange = type === 'entree' ? parseFloat(quantite) : -parseFloat(quantite);
      
      if (currentStock) {
        await db.update(stockParEntrepot).set({
          quantitePresente: currentStock.quantitePresente + quantityChange,
          quantiteDisponible: currentStock.quantiteDisponible + quantityChange,
          updatedAt: new Date()
        }).where(eq(stockParEntrepot.id, currentStock.id));
      } else {
        await db.insert(stockParEntrepot).values({
          entrepriseId: parseInt(entrepriseId),
          produitId: parseInt(produitId),
          entrepotId: parseInt(entrepotId),
          quantitePresente: type === 'entree' ? parseFloat(quantite) : 0,
          quantiteDisponible: type === 'entree' ? parseFloat(quantite) : 0
        });
      }

      // Vérifier alertes
      await checkStockAlerts(parseInt(entrepriseId), parseInt(produitId), parseInt(entrepotId));
    }

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'mouvements_stock',
      recordId: movement[0].id,
      nouvelleValeur: movement[0],
      description: `Mouvement stock ${type}: ${quantite} unités (ref: ${reference || 'N/A'})`
    });

    res.json(movement[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suivi temps réel
router.get('/suivi/:produitId', async (req, res) => {
  try {
    const { produitId } = req.params;
    const { entrepriseId } = req.query;
    
    const stock = await db.query.stockParEntrepot.findMany({
      where: and(
        eq(stockParEntrepot.produitId, parseInt(produitId)),
        eq(stockParEntrepot.entrepriseId, parseInt(entrepriseId))
      )
    });
    
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alertes
router.get('/alertes', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const alerts = await db.query.alertesStock.findMany({
      where: and(
        eq(alertesStock.entrepriseId, parseInt(entrepriseId)),
        eq(alertesStock.statut, 'active')
      )
    });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fonction pour vérifier les alertes
async function checkStockAlerts(entrepriseId, produitId, entrepotId) {
  try {
    const stock = await db.query.stockParEntrepot.findFirst({
      where: and(
        eq(stockParEntrepot.produitId, produitId),
        eq(stockParEntrepot.entrepotId, entrepotId)
      )
    });

    const produit = await db.query.produits.findFirst({
      where: eq(produits.id, produitId)
    });

    if (stock && produit && stock.quantiteDisponible < produit.stockMinimum) {
      await db.insert(alertesStock).values({
        entrepriseId,
        produitId,
        entrepotId,
        type: 'seuil_min',
        quantiteActuelle: stock.quantiteDisponible,
        seuil: produit.stockMinimum,
        statut: 'active'
      });
    }
  } catch (error) {
    console.error('Erreur vérification alertes:', error);
  }
}

export default router;
