import express from 'express';
import { db } from '../db.js';
import { devis, devisItems, factures, factureItems, clients } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

/**
 * Génère le prochain numéro de devis
 */
async function genererNumeroDevis(entrepriseId) {
  const annee = new Date().getFullYear();
  const [lastDevis] = await db
    .select({ numeroDevis: devis.numeroDevis })
    .from(devis)
    .where(and(
      eq(devis.entrepriseId, entrepriseId),
      sql`EXTRACT(YEAR FROM ${devis.dateDevis}::date) = ${annee}`
    ))
    .orderBy(desc(devis.createdAt))
    .limit(1);

  let numero = 1;
  if (lastDevis?.numeroDevis) {
    const match = lastDevis.numeroDevis.match(/DEV-(\d{4})-(\d+)/);
    if (match) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `DEV-${annee}-${numero.toString().padStart(4, '0')}`;
}

/**
 * GET /api/devis
 * Récupère la liste de tous les devis
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const devisList = await db
      .select({
        devis: devis,
        client: {
          id: clients.id,
          nom: clients.nom,
          email: clients.email,
        }
      })
      .from(devis)
      .leftJoin(clients, eq(devis.clientId, clients.id))
      .where(eq(devis.entrepriseId, req.entrepriseId))
      .orderBy(desc(devis.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(devis)
      .where(eq(devis.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: devisList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: devisList,
    });
  } catch (error) {
    console.error('Erreur GET /api/devis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des devis',
      error: error.message,
    });
  }
});

/**
 * GET /api/devis/:id
 * Récupère un devis spécifique avec ses lignes
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [devisData] = await db
      .select({
        devis: devis,
        client: clients,
      })
      .from(devis)
      .leftJoin(clients, eq(devis.clientId, clients.id))
      .where(and(
        eq(devis.id, parseInt(id)),
        eq(devis.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!devisData) {
      return res.status(404).json({
        success: false,
        message: 'Devis non trouvé',
      });
    }

    const items = await db
      .select()
      .from(devisItems)
      .where(eq(devisItems.devisId, parseInt(id)));

    res.json({
      success: true,
      data: {
        ...devisData.devis,
        client: devisData.client,
        items,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/devis/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du devis',
      error: error.message,
    });
  }
});

/**
 * POST /api/devis
 * Crée un nouveau devis avec ses lignes
 */
router.post('/', async (req, res) => {
  try {
    const {
      clientId,
      dateDevis,
      dateExpiration,
      notes,
      conditionsVente,
      items,
    } = req.body;

    // Validation
    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Client et au moins un article sont obligatoires',
      });
    }

    // Calculer les totaux
    let totalHT = 0;
    items.forEach(item => {
      const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalApresRemise = totalLigne * (1 - remise / 100);
      totalHT += totalApresRemise;
    });

    // Récupérer le taux TVA de l'entreprise
    const [entreprise] = await db
      .select({ tauxTva: sql`taux_tva` })
      .from(sql`entreprises`)
      .where(sql`id = ${req.entrepriseId}`);

    const tauxTva = parseFloat(entreprise?.tauxTva || 18);
    const totalTVA = totalHT * (tauxTva / 100);
    const totalTTC = totalHT + totalTVA;

    // Générer le numéro de devis
    const numeroDevis = await genererNumeroDevis(req.entrepriseId);

    const newDevis = await db.transaction(async (tx) => {
      const [created] = await tx.insert(devis).values({
        entrepriseId: req.entrepriseId,
        numeroDevis,
        clientId: parseInt(clientId),
        statut: 'brouillon',
        dateDevis: dateDevis || new Date().toISOString().split('T')[0],
        dateExpiration: dateExpiration || null,
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        notes: notes || null,
        conditionsVente: conditionsVente || null,
        userId: req.user.id,
      }).returning();

      const devisItemsData = items.map(item => {
        const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        return {
        entrepriseId: req.entrepriseId,
        devisId: created.id,
        produitId: item.produitId || null,
        description: item.description,
        quantite: item.quantite,
        prixUnitaire: item.prixUnitaire,
        remise: item.remise || '0',
        totalLigne: (totalLigne * (1 - remise / 100)).toFixed(2),
        };
      });
      const insertedItems = await tx.insert(devisItems).values(devisItemsData).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'devis',
        recordId: created.id,
        nouvelleValeur: { devis: created, items: insertedItems },
        description: `Devis créé: ${created.numeroDevis}`,
        executor: tx,
        required: true
      });
      return created;
    });

    res.status(201).json({
      success: true,
      message: 'Devis créé avec succès',
      data: newDevis,
    });
  } catch (error) {
    console.error('Erreur POST /api/devis:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du devis',
      error: error.message,
    });
  }
});

/**
 * PUT /api/devis/:id
 * Met à jour un devis
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, dateDevis, dateExpiration, notes, conditionsVente, items } = req.body;
    const updatedDevis = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(devis).where(and(
        eq(devis.id, parseInt(id)),
        eq(devis.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!previous) throw Object.assign(new Error('Devis non trouvé'), { status: 404 });
      const previousItems = await tx.select().from(devisItems).where(and(
        eq(devisItems.devisId, previous.id),
        eq(devisItems.entrepriseId, req.entrepriseId)
      ));
      const updateData = { updatedAt: new Date() };
      if (statut !== undefined) updateData.statut = statut;
      if (dateDevis !== undefined) updateData.dateDevis = dateDevis;
      if (dateExpiration !== undefined) updateData.dateExpiration = dateExpiration;
      if (notes !== undefined) updateData.notes = notes;
      if (conditionsVente !== undefined) updateData.conditionsVente = conditionsVente;

      if (Array.isArray(items) && items.length > 0) {
        let totalHT = 0;
        for (const item of items) {
          const totalLigne = Number(item.quantite) * Number(item.prixUnitaire);
          const remise = Number(item.remise || 0);
          totalHT += totalLigne * (1 - remise / 100);
        }
        const [company] = await tx.select({ tauxTva: sql`taux_tva` })
          .from(sql`entreprises`).where(sql`id = ${req.entrepriseId}`);
        const tauxTva = Number(company?.tauxTva || 18);
        const totalTVA = totalHT * (tauxTva / 100);
        updateData.totalHT = totalHT.toFixed(2);
        updateData.totalTVA = totalTVA.toFixed(2);
        updateData.totalTTC = (totalHT + totalTVA).toFixed(2);
        await tx.delete(devisItems).where(and(
          eq(devisItems.devisId, previous.id),
          eq(devisItems.entrepriseId, req.entrepriseId)
        ));
        await tx.insert(devisItems).values(items.map((item) => {
          const totalLigne = Number(item.quantite) * Number(item.prixUnitaire);
          const remise = Number(item.remise || 0);
          return {
            entrepriseId: req.entrepriseId,
            devisId: previous.id,
            produitId: item.produitId || null,
            description: item.description,
            quantite: item.quantite,
            prixUnitaire: item.prixUnitaire,
            remise: item.remise || '0',
            totalLigne: (totalLigne * (1 - remise / 100)).toFixed(2)
          };
        }));
      }

      const [updated] = await tx.update(devis).set(updateData).where(and(
        eq(devis.id, previous.id),
        eq(devis.entrepriseId, req.entrepriseId)
      )).returning();
      const updatedItems = await tx.select().from(devisItems).where(and(
        eq(devisItems.devisId, previous.id),
        eq(devisItems.entrepriseId, req.entrepriseId)
      ));
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'devis',
        recordId: updated.id,
        ancienneValeur: { devis: previous, items: previousItems },
        nouvelleValeur: { devis: updated, items: updatedItems },
        description: `Devis modifié: ${updated.numeroDevis}`,
        executor: tx,
        required: true
      });
      return updated;
    });

    res.json({
      success: true,
      message: 'Devis mis à jour avec succès',
      data: updatedDevis,
    });
  } catch (error) {
    console.error('Erreur PUT /api/devis/:id:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du devis',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/devis/:id
 * Supprime un devis
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.transaction(async (tx) => {
      const [existingDevis] = await tx.select().from(devis).where(and(
        eq(devis.id, parseInt(id)),
        eq(devis.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!existingDevis) return { status: 404 };
      const items = await tx.select().from(devisItems).where(and(
        eq(devisItems.devisId, existingDevis.id),
        eq(devisItems.entrepriseId, req.entrepriseId)
      ));
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'devis',
        recordId: existingDevis.id,
        ancienneValeur: { devis: existingDevis, items },
        description: `Devis supprimé: ${existingDevis.numeroDevis}`,
        executor: tx,
        required: true
      });
      await tx.delete(devisItems).where(and(
        eq(devisItems.devisId, existingDevis.id),
        eq(devisItems.entrepriseId, req.entrepriseId)
      ));
      await tx.delete(devis).where(and(
        eq(devis.id, existingDevis.id),
        eq(devis.entrepriseId, req.entrepriseId)
      ));
      return { status: 200 };
    });
    if (result.status === 404) {
      return res.status(404).json({ success: false, message: 'Devis non trouvé' });
    }

    res.json({
      success: true,
      message: 'Devis supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/devis/:id:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de la suppression du devis',
      error: error.message,
    });
  }
});

/**
 * POST /api/devis/:id/transformer-facture
 * Transforme un devis en facture
 */
router.post('/:id/transformer-facture', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.transaction(async (tx) => {
      const [devisData] = await tx.select().from(devis).where(and(
        eq(devis.id, parseInt(id)),
        eq(devis.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!devisData) return { status: 404 };
      if (devisData.statut !== 'acceptee') return { status: 400 };

      const items = await tx.select().from(devisItems).where(and(
        eq(devisItems.devisId, devisData.id),
        eq(devisItems.entrepriseId, req.entrepriseId)
      ));
      const annee = new Date().getFullYear();
      const [lastFacture] = await tx.select({ numeroFacture: factures.numeroFacture })
        .from(factures).where(and(
          eq(factures.entrepriseId, req.entrepriseId),
          sql`EXTRACT(YEAR FROM ${factures.dateFacture}::date) = ${annee}`
        )).orderBy(desc(factures.createdAt)).limit(1);
      let numero = 1;
      const match = lastFacture?.numeroFacture?.match(/FACT-(\d{4})-(\d+)/);
      if (match) numero = parseInt(match[2]) + 1;
      const numeroFacture = `FACT-${annee}-${numero.toString().padStart(4, '0')}`;

      const [newFacture] = await tx.insert(factures).values({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        clientId: devisData.clientId,
        statut: 'brouillon',
        dateFacture: new Date().toISOString().split('T')[0],
        dateEcheance: null,
        totalHT: devisData.totalHT,
        totalTVA: devisData.totalTVA,
        totalTTC: devisData.totalTTC,
        montantPaye: '0',
        soldeRestant: devisData.totalTTC,
        notes: devisData.notes,
        userId: req.user.id,
      }).returning();
      const factureItemsData = items.map(item => ({
        entrepriseId: req.entrepriseId,
        factureId: newFacture.id,
        produitId: item.produitId,
        description: item.description,
        quantite: item.quantite,
        prixUnitaire: item.prixUnitaire,
        remise: item.remise,
        totalLigne: item.totalLigne,
      }));
      const insertedItems = factureItemsData.length
        ? await tx.insert(factureItems).values(factureItemsData).returning()
        : [];
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'factures',
        recordId: newFacture.id,
        nouvelleValeur: { facture: newFacture, items: insertedItems, devisSource: devisData.id },
        description: `Facture ${newFacture.numeroFacture} créée depuis le devis ${devisData.numeroDevis}`,
        executor: tx,
        required: true
      });
      return { status: 201, newFacture };
    });
    if (result.status !== 201) {
      return res.status(result.status).json({
        success: false,
        message: result.status === 404 ? 'Devis non trouvé' : 'Seuls les devis acceptés peuvent être transformés en facture'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès à partir du devis',
      data: result.newFacture,
    });
  } catch (error) {
    console.error('Erreur POST /api/devis/:id/transformer-facture:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Erreur lors de la transformation du devis en facture',
      error: error.message,
    });
  }
});

export default router;
