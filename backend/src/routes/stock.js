import express from 'express';
import db from '../db.js';
import { produits, categoriesStock, entrepots, stockParEntrepot, mouvementsStock, alertesStock, inventairesTournants } from '../schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// CRUD Catégories
router.get('/categories', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const categories = await db.query.categoriesStock.findMany({
      where: eq(categoriesStock.entrepriseId, parseInt(entrepriseId))
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { entrepriseId, nom, description } = req.body;
    const result = await db.insert(categoriesStock).values({
      entrepriseId: parseInt(entrepriseId),
      nom,
      description
    }).returning();
    res.json(result[0]);
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
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Entrepôts
router.get('/entrepots', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const entrepotsList = await db.query.entrepots.findMany({
      where: eq(entrepots.entrepriseId, parseInt(entrepriseId))
    });
    res.json(entrepotsList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/entrepots', async (req, res) => {
  try {
    const { entrepriseId, nom, adresse, responsable } = req.body;
    const result = await db.insert(entrepots).values({
      entrepriseId: parseInt(entrepriseId),
      nom,
      adresse,
      responsable
    }).returning();
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mouvements de stock
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
