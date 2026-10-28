import { Router } from 'express';
import { db } from '../db.js';
import { bonsLivraison, bonLivraisonItems, factures, factureItems, clients } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const bonsList = await db.select().from(bonsLivraison)
      .where(eq(bonsLivraison.entrepriseId, req.entrepriseId))
      .orderBy(desc(bonsLivraison.createdAt));

    const bonsAvecDetails = await Promise.all(bonsList.map(async (bon) => {
      const client = await db.select().from(clients)
        .where(eq(clients.id, bon.clientId))
        .limit(1);
      
      const items = await db.select().from(bonLivraisonItems)
        .where(eq(bonLivraisonItems.bonLivraisonId, bon.id));

      return {
        ...bon,
        client: client[0] || null,
        items: items
      };
    }));

    res.json(bonsAvecDetails);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const bon = await db.select().from(bonsLivraison)
      .where(and(
        eq(bonsLivraison.id, parseInt(id)),
        eq(bonsLivraison.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (bon.length === 0) {
      return res.status(404).json({ error: 'Bon de livraison introuvable' });
    }

    const items = await db.select().from(bonLivraisonItems)
      .where(eq(bonLivraisonItems.bonLivraisonId, parseInt(id)));

    const client = await db.select().from(clients)
      .where(eq(clients.id, bon[0].clientId))
      .limit(1);

    res.json({
      ...bon[0],
      items,
      client: client[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generer-depuis-facture/:factureId', async (req, res) => {
  try {
    const { factureId } = req.params;
    const result = await db.transaction(async (tx) => {
      const [factureData] = await tx.select().from(factures).where(and(
        eq(factures.id, parseInt(factureId)),
        eq(factures.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!factureData) return { status: 404 };

      const [lastBon] = await tx.select().from(bonsLivraison)
        .where(eq(bonsLivraison.entrepriseId, req.entrepriseId))
        .orderBy(desc(bonsLivraison.id)).limit(1);
      const lastNumber = lastBon?.numeroBL ? parseInt(lastBon.numeroBL.replace(/\D/g, '')) || 0 : 0;
      const numeroBL = `BL-${String(lastNumber + 1).padStart(6, '0')}`;
      const [created] = await tx.insert(bonsLivraison).values({
        entrepriseId: req.entrepriseId,
        numeroBL,
        commandeId: factureData.commandeId,
        clientId: factureData.clientId,
        dateLivraison: new Date().toISOString().split('T')[0],
        notes: `Bon de livraison généré automatiquement pour la facture ${factureData.numeroFacture}`,
        userId: req.user?.id
      }).returning();

      const items = await tx.select().from(factureItems).where(and(
        eq(factureItems.factureId, parseInt(factureId)),
        eq(factureItems.entrepriseId, req.entrepriseId)
      ));
      const bonItems = items.filter(item => item.produitId).map(item => ({
        entrepriseId: req.entrepriseId,
        bonLivraisonId: created.id,
        produitId: item.produitId,
        quantite: item.quantite
      }));
      const insertedItems = bonItems.length ? await tx.insert(bonLivraisonItems).values(bonItems).returning() : [];
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'bons_livraison',
        recordId: created.id,
        nouvelleValeur: { bon: created, items: insertedItems, factureId: factureData.id },
        description: `Bon de livraison généré depuis ${factureData.numeroFacture}`,
        executor: tx,
        required: true
      });
      return { status: 201, bonLivraison: created };
    });
    if (result.status === 404) return res.status(404).json({ error: 'Facture introuvable' });

    res.json({
      message: 'Bon de livraison généré avec succès',
      bonLivraison: result.bonLivraison
    });
  } catch (err) {
    console.error('Erreur génération BL:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { clientId, commandeId, dateLivraison, notes, items } = req.body;

    const nouveauBon = await db.transaction(async (tx) => {
      const [lastBon] = await tx.select().from(bonsLivraison)
        .where(eq(bonsLivraison.entrepriseId, req.entrepriseId))
        .orderBy(desc(bonsLivraison.id)).limit(1);
      const lastNumber = lastBon?.numeroBL ? parseInt(lastBon.numeroBL.replace(/\D/g, '')) || 0 : 0;
      const numeroBL = `BL-${String(lastNumber + 1).padStart(6, '0')}`;
      const [created] = await tx.insert(bonsLivraison).values({
        entrepriseId: req.entrepriseId,
        numeroBL,
        commandeId: commandeId || null,
        clientId: parseInt(clientId),
        dateLivraison: dateLivraison || new Date().toISOString().split('T')[0],
        notes,
        userId: req.user?.id
      }).returning();
      const insertedItems = items?.length
        ? await tx.insert(bonLivraisonItems).values(items.map(item => ({
            entrepriseId: req.entrepriseId,
            bonLivraisonId: created.id,
            produitId: parseInt(item.produitId),
            quantite: item.quantite
          }))).returning()
        : [];
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'bons_livraison',
        recordId: created.id,
        nouvelleValeur: { bon: created, items: insertedItems },
        description: `Bon de livraison créé: ${created.numeroBL}`,
        executor: tx,
        required: true
      });
      return created;
    });
    res.status(201).json(nouveauBon);
  } catch (err) {
    console.error('Erreur création BL:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateLivraison, notes, signatureClient } = req.body;

    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(bonsLivraison).where(and(
        eq(bonsLivraison.id, parseInt(id)),
        eq(bonsLivraison.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!previous) return null;
      const [current] = await tx.update(bonsLivraison).set({
        dateLivraison,
        notes,
        signatureClient
      }).where(and(
        eq(bonsLivraison.id, previous.id),
        eq(bonsLivraison.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'bons_livraison',
        recordId: current.id,
        ancienneValeur: previous,
        nouvelleValeur: current,
        description: `Bon de livraison modifié: ${current.numeroBL}`,
        executor: tx,
        required: true
      });
      return current;
    });
    if (!updated) return res.status(404).json({ error: 'Bon de livraison introuvable' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await db.transaction(async (tx) => {
      const [bon] = await tx.select().from(bonsLivraison).where(and(
        eq(bonsLivraison.id, parseInt(id)),
        eq(bonsLivraison.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!bon) return false;
      const items = await tx.select().from(bonLivraisonItems).where(and(
        eq(bonLivraisonItems.bonLivraisonId, bon.id),
        eq(bonLivraisonItems.entrepriseId, req.entrepriseId)
      ));
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'bons_livraison',
        recordId: bon.id,
        ancienneValeur: { bon, items },
        description: `Bon de livraison supprimé: ${bon.numeroBL}`,
        executor: tx,
        required: true
      });
      await tx.delete(bonLivraisonItems).where(and(
        eq(bonLivraisonItems.bonLivraisonId, bon.id),
        eq(bonLivraisonItems.entrepriseId, req.entrepriseId)
      ));
      await tx.delete(bonsLivraison).where(and(
        eq(bonsLivraison.id, bon.id),
        eq(bonsLivraison.entrepriseId, req.entrepriseId)
      ));
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'Bon de livraison introuvable' });

    res.json({ message: 'Bon de livraison supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
