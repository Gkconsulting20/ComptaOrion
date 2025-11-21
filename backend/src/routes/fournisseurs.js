import express from 'express';
import { db } from '../db.js';
import { fournisseurs } from '../schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

// GET /api/fournisseurs - Liste des fournisseurs avec pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, actif } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construction de la requête avec filtres
    let query = db
      .select()
      .from(fournisseurs)
      .where(eq(fournisseurs.entrepriseId, req.entrepriseId))
      .orderBy(desc(fournisseurs.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    // Filtre par statut actif
    if (actif !== undefined) {
      query = query.where(
        and(
          eq(fournisseurs.entrepriseId, req.entrepriseId),
          eq(fournisseurs.actif, actif === 'true')
        )
      );
    }

    const results = await query;

    // Compter le total
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(fournisseurs)
      .where(eq(fournisseurs.entrepriseId, req.entrepriseId));

    return res.json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fournisseurs',
      error: error.message
    });
  }
});

// GET /api/fournisseurs/:id - Récupérer un fournisseur
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [fournisseur] = await db
      .select()
      .from(fournisseurs)
      .where(
        and(
          eq(fournisseurs.id, parseInt(id)),
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

    return res.json({
      success: true,
      data: fournisseur
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du fournisseur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du fournisseur',
      error: error.message
    });
  }
});

// POST /api/fournisseurs - Créer un fournisseur
router.post('/', async (req, res) => {
  try {
    const {
      numeroFournisseur,
      raisonSociale,
      contactPrincipal,
      fonction,
      email,
      telephone,
      adresse,
      categorie,
      delaiPaiement,
      compteBancaire,
      banque,
      actif
    } = req.body;

    // Validation des champs obligatoires
    if (!raisonSociale) {
      return res.status(400).json({
        success: false,
        message: 'La raison sociale est obligatoire'
      });
    }

    // Validation email si fourni
    if (email && !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email invalide'
      });
    }

    // Validation délai de paiement
    if (delaiPaiement !== undefined && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif'
      });
    }

    // Vérifier unicité du numéro fournisseur si fourni
    if (numeroFournisseur) {
      const [existing] = await db
        .select()
        .from(fournisseurs)
        .where(
          and(
            eq(fournisseurs.numeroFournisseur, numeroFournisseur),
            eq(fournisseurs.entrepriseId, req.entrepriseId)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de fournisseur existe déjà'
        });
      }
    }

    // Créer le fournisseur
    const [newFournisseur] = await db
      .insert(fournisseurs)
      .values({
        entrepriseId: req.entrepriseId,
        numeroFournisseur: numeroFournisseur || null,
        raisonSociale,
        contactPrincipal: contactPrincipal || null,
        fonction: fonction || null,
        email: email || null,
        telephone: telephone || null,
        adresse: adresse || null,
        categorie: categorie || null,
        delaiPaiement: delaiPaiement || 30,
        compteBancaire: compteBancaire || null,
        banque: banque || null,
        soldeDu: '0',
        actif: actif !== undefined ? actif : true,
      })
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'fournisseurs',
      recordId: newFournisseur.id,
      nouvelleValeur: newFournisseur,
      description: `Fournisseur créé: ${raisonSociale}`
    });

    return res.status(201).json({
      success: true,
      message: 'Fournisseur créé avec succès',
      data: newFournisseur
    });
  } catch (error) {
    console.error('Erreur lors de la création du fournisseur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du fournisseur',
      error: error.message
    });
  }
});

// PUT /api/fournisseurs/:id - Mettre à jour un fournisseur
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numeroFournisseur,
      raisonSociale,
      contactPrincipal,
      fonction,
      email,
      telephone,
      adresse,
      categorie,
      delaiPaiement,
      compteBancaire,
      banque,
      soldeDu,
      actif
    } = req.body;

    // Vérifier que le fournisseur existe et appartient à l'entreprise
    const [existingFournisseur] = await db
      .select()
      .from(fournisseurs)
      .where(
        and(
          eq(fournisseurs.id, parseInt(id)),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!existingFournisseur) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    // Validation email si fourni
    if (email && !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email invalide'
      });
    }

    // Validation délai de paiement
    if (delaiPaiement !== undefined && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif'
      });
    }

    // Vérifier unicité du numéro fournisseur si modifié
    if (numeroFournisseur && numeroFournisseur !== existingFournisseur.numeroFournisseur) {
      const [existing] = await db
        .select()
        .from(fournisseurs)
        .where(
          and(
            eq(fournisseurs.numeroFournisseur, numeroFournisseur),
            eq(fournisseurs.entrepriseId, req.entrepriseId)
          )
        )
        .limit(1);

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de fournisseur existe déjà'
        });
      }
    }

    // Préparer les données à mettre à jour
    const updateData = {};
    if (numeroFournisseur !== undefined) updateData.numeroFournisseur = numeroFournisseur;
    if (raisonSociale !== undefined) updateData.raisonSociale = raisonSociale;
    if (contactPrincipal !== undefined) updateData.contactPrincipal = contactPrincipal;
    if (fonction !== undefined) updateData.fonction = fonction;
    if (email !== undefined) updateData.email = email;
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresse !== undefined) updateData.adresse = adresse;
    if (categorie !== undefined) updateData.categorie = categorie;
    if (delaiPaiement !== undefined) updateData.delaiPaiement = delaiPaiement;
    if (compteBancaire !== undefined) updateData.compteBancaire = compteBancaire;
    if (banque !== undefined) updateData.banque = banque;
    if (soldeDu !== undefined) updateData.soldeDu = soldeDu.toString();
    if (actif !== undefined) updateData.actif = actif;

    updateData.updatedAt = new Date();

    // Mettre à jour
    const [updated] = await db
      .update(fournisseurs)
      .set(updateData)
      .where(
        and(
          eq(fournisseurs.id, parseInt(id)),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      )
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'UPDATE',
      table: 'fournisseurs',
      recordId: parseInt(id),
      ancienneValeur: existingFournisseur,
      nouvelleValeur: updated,
      description: `Fournisseur modifié: ${updated.raisonSociale}`
    });

    return res.json({
      success: true,
      message: 'Fournisseur mis à jour avec succès',
      data: updated
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fournisseur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du fournisseur',
      error: error.message
    });
  }
});

// DELETE /api/fournisseurs/:id - Supprimer (désactiver) un fournisseur
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le fournisseur existe
    const [existingFournisseur] = await db
      .select()
      .from(fournisseurs)
      .where(
        and(
          eq(fournisseurs.id, parseInt(id)),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!existingFournisseur) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    // Audit log avant désactivation
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'DELETE',
      table: 'fournisseurs',
      recordId: parseInt(id),
      ancienneValeur: existingFournisseur,
      description: `Fournisseur désactivé: ${existingFournisseur.raisonSociale}`
    });

    // Désactiver au lieu de supprimer (soft delete)
    const [updated] = await db
      .update(fournisseurs)
      .set({ actif: false, updatedAt: new Date() })
      .where(
        and(
          eq(fournisseurs.id, parseInt(id)),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      )
      .returning();

    return res.json({
      success: true,
      message: 'Fournisseur désactivé avec succès',
      data: updated
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du fournisseur:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fournisseur',
      error: error.message
    });
  }
});

export default router;
