import express from 'express';
import { db } from '../db.js';
import { clients } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/clients
 * Récupère la liste de tous les clients de l'entreprise (avec pagination)
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const clientsList = await db
      .select()
      .from(clients)
      .where(eq(clients.entrepriseId, req.entrepriseId))
      .orderBy(desc(clients.createdAt))
      .limit(Math.min(limit, 100)) // Max absolu de 100
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(clients)
      .where(eq(clients.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: clientsList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: clientsList,
    });
  } catch (error) {
    console.error('Erreur GET /api/clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients',
      error: error.message,
    });
  }
});

/**
 * GET /api/clients/:id
 * Récupère un client spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé',
      });
    }

    res.json({
      success: true,
      data: client[0],
    });
  } catch (error) {
    console.error('Erreur GET /api/clients/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du client',
      error: error.message,
    });
  }
});

/**
 * POST /api/clients
 * Crée un nouveau client
 */
router.post('/', async (req, res) => {
  try {
    const {
      numeroClient,
      nom,
      type,
      email,
      telephone,
      adresse,
      ville,
      pays,
      categorieClient,
      limiteCredit,
      delaiPaiement,
      remise,
      soldeDu,
      actif,
    } = req.body;

    // Validation des champs obligatoires
    if (!nom || nom.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom du client est obligatoire',
      });
    }

    // Validation du type
    if (type && !['particulier', 'entreprise'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Le type doit être "particulier" ou "entreprise"',
      });
    }

    // Validation de l'email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide',
      });
    }

    // Validation des montants
    if (limiteCredit && (isNaN(limiteCredit) || limiteCredit < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La limite de crédit doit être un nombre positif',
      });
    }

    if (remise && (isNaN(remise) || remise < 0 || remise > 100)) {
      return res.status(400).json({
        success: false,
        message: 'La remise doit être un pourcentage entre 0 et 100',
      });
    }

    if (delaiPaiement && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif',
      });
    }

    // Créer le client avec l'entrepriseId automatique
    const newClient = await db
      .insert(clients)
      .values({
        entrepriseId: req.entrepriseId,
        numeroClient: numeroClient || null,
        nom: nom.trim(),
        type: type || 'particulier',
        email: email || null,
        telephone: telephone || null,
        adresse: adresse || null,
        ville: ville || null,
        pays: pays || null,
        categorieClient: categorieClient || 'standard',
        limiteCredit: limiteCredit || '0',
        delaiPaiement: delaiPaiement || 30,
        remise: remise || '0',
        soldeDu: soldeDu || '0',
        actif: actif !== undefined ? actif : true,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: newClient[0],
    });
  } catch (error) {
    console.error('Erreur POST /api/clients:', error);
    
    // Gestion des erreurs de contraintes
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: 'Ce numéro de client existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du client',
      error: error.message,
    });
  }
});

/**
 * PUT /api/clients/:id
 * Met à jour un client existant
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      numeroClient,
      nom,
      type,
      email,
      telephone,
      adresse,
      ville,
      pays,
      categorieClient,
      limiteCredit,
      delaiPaiement,
      remise,
      soldeDu,
      actif,
    } = req.body;

    // Vérifier que le client existe et appartient à l'entreprise
    const existingClient = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé ou accès non autorisé',
      });
    }

    // Validation du type
    if (type && !['particulier', 'entreprise'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Le type doit être "particulier" ou "entreprise"',
      });
    }

    // Validation de l'email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide',
      });
    }

    // Validation des montants
    if (limiteCredit !== undefined && (isNaN(limiteCredit) || limiteCredit < 0)) {
      return res.status(400).json({
        success: false,
        message: 'La limite de crédit doit être un nombre positif',
      });
    }

    if (remise !== undefined && (isNaN(remise) || remise < 0 || remise > 100)) {
      return res.status(400).json({
        success: false,
        message: 'La remise doit être un pourcentage entre 0 et 100',
      });
    }

    if (delaiPaiement !== undefined && (isNaN(delaiPaiement) || delaiPaiement < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Le délai de paiement doit être un nombre positif',
      });
    }

    if (soldeDu !== undefined && isNaN(soldeDu)) {
      return res.status(400).json({
        success: false,
        message: 'Le solde dû doit être un nombre valide',
      });
    }

    // Construire l'objet de mise à jour (seulement les champs fournis)
    const updateData = {
      updatedAt: new Date(),
    };

    if (numeroClient !== undefined) updateData.numeroClient = numeroClient;
    if (nom !== undefined) updateData.nom = nom.trim();
    if (type !== undefined) updateData.type = type;
    if (email !== undefined) updateData.email = email;
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresse !== undefined) updateData.adresse = adresse;
    if (ville !== undefined) updateData.ville = ville;
    if (pays !== undefined) updateData.pays = pays;
    if (categorieClient !== undefined) updateData.categorieClient = categorieClient;
    if (limiteCredit !== undefined) updateData.limiteCredit = limiteCredit;
    if (delaiPaiement !== undefined) updateData.delaiPaiement = delaiPaiement;
    if (remise !== undefined) updateData.remise = remise;
    if (soldeDu !== undefined) updateData.soldeDu = soldeDu;
    if (actif !== undefined) updateData.actif = actif;

    // Mettre à jour le client
    const updatedClient = await db
      .update(clients)
      .set(updateData)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .returning();

    res.json({
      success: true,
      message: 'Client mis à jour avec succès',
      data: updatedClient[0],
    });
  } catch (error) {
    console.error('Erreur PUT /api/clients/:id:', error);
    
    // Gestion des erreurs de contraintes
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Ce numéro de client existe déjà',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du client',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Supprime un client
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le client existe et appartient à l'entreprise
    const existingClient = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé ou accès non autorisé',
      });
    }

    // Supprimer le client
    await db
      .delete(clients)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ));

    res.json({
      success: true,
      message: 'Client supprimé avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/clients/:id:', error);
    
    // Gestion des erreurs de contraintes (ex: client utilisé dans factures)
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce client car il est utilisé dans d\'autres enregistrements (factures, commandes, etc.)',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du client',
      error: error.message,
    });
  }
});

export default router;
