import express from 'express';
import { db } from '../db.js';
import { clients, factures, paiements } from '../schema.js';
import { eq, and, desc, sql, gte, lte, between } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { sendEmail } from '../services/emailService.js';

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
      compteComptableId,
      echeancesPersonnalisees,
      modesPaiementPreferes,
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

    // Validation des champs JSONB
    if (echeancesPersonnalisees && !Array.isArray(echeancesPersonnalisees)) {
      return res.status(400).json({
        success: false,
        message: 'Les échéances doivent être un tableau',
      });
    }

    if (echeancesPersonnalisees) {
      for (const ech of echeancesPersonnalisees) {
        if (!ech.jours || !ech.pourcentage || isNaN(ech.jours) || isNaN(ech.pourcentage)) {
          return res.status(400).json({
            success: false,
            message: 'Chaque échéance doit avoir jours et pourcentage valides',
          });
        }
        if (ech.pourcentage < 0 || ech.pourcentage > 100) {
          return res.status(400).json({
            success: false,
            message: 'Le pourcentage d\'échéance doit être entre 0 et 100',
          });
        }
      }
    }

    if (modesPaiementPreferes && !Array.isArray(modesPaiementPreferes)) {
      return res.status(400).json({
        success: false,
        message: 'Les modes de paiement doivent être un tableau',
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
        compteComptableId: compteComptableId || null,
        echeancesPersonnalisees: echeancesPersonnalisees || null,
        modesPaiementPreferes: modesPaiementPreferes || null,
      })
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'CREATE',
      table: 'clients',
      recordId: newClient[0].id,
      nouvelleValeur: newClient[0],
      description: `Client créé: ${nom}`
    });

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
      compteComptableId,
      echeancesPersonnalisees,
      modesPaiementPreferes,
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

    // Validation des champs JSONB
    if (echeancesPersonnalisees !== undefined) {
      if (!Array.isArray(echeancesPersonnalisees)) {
        return res.status(400).json({
          success: false,
          message: 'Les échéances doivent être un tableau',
        });
      }
      for (const ech of echeancesPersonnalisees) {
        if (!ech.jours || !ech.pourcentage || isNaN(ech.jours) || isNaN(ech.pourcentage)) {
          return res.status(400).json({
            success: false,
            message: 'Chaque échéance doit avoir jours et pourcentage valides',
          });
        }
        if (ech.pourcentage < 0 || ech.pourcentage > 100) {
          return res.status(400).json({
            success: false,
            message: 'Le pourcentage d\'échéance doit être entre 0 et 100',
          });
        }
      }
    }

    if (modesPaiementPreferes !== undefined && !Array.isArray(modesPaiementPreferes)) {
      return res.status(400).json({
        success: false,
        message: 'Les modes de paiement doivent être un tableau',
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
    if (compteComptableId !== undefined) updateData.compteComptableId = compteComptableId;
    if (echeancesPersonnalisees !== undefined) updateData.echeancesPersonnalisees = echeancesPersonnalisees;
    if (modesPaiementPreferes !== undefined) updateData.modesPaiementPreferes = modesPaiementPreferes;

    // Mettre à jour le client
    const updatedClient = await db
      .update(clients)
      .set(updateData)
      .where(and(
        eq(clients.id, parseInt(id)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .returning();

    // Audit log
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'UPDATE',
      table: 'clients',
      recordId: parseInt(id),
      ancienneValeur: existingClient[0],
      nouvelleValeur: updatedClient[0],
      description: `Client modifié: ${updatedClient[0].nom}`
    });

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

    // Audit log avant suppression
    const auditInfo = extractAuditInfo(req);
    await logAudit({
      ...auditInfo,
      action: 'DELETE',
      table: 'clients',
      recordId: parseInt(id),
      ancienneValeur: existingClient[0],
      description: `Client supprimé: ${existingClient[0].nom}`
    });

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

/**
 * POST /api/clients/etat-compte
 * Génère un état de compte client sur une période donnée
 */
router.post('/etat-compte', async (req, res) => {
  try {
    const { clientId, dateDebut, dateFin } = req.body;

    if (!clientId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'clientId, dateDebut et dateFin sont requis'
      });
    }

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(clientId)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const facturesList = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.clientId, parseInt(clientId)),
        eq(factures.entrepriseId, req.entrepriseId),
        gte(factures.dateFacture, dateDebut),
        lte(factures.dateFacture, dateFin)
      ))
      .orderBy(factures.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(and(
        eq(paiements.entrepriseId, req.entrepriseId),
        gte(paiements.datePaiement, dateDebut),
        lte(paiements.datePaiement, dateFin)
      ))
      .orderBy(paiements.datePaiement);

    const paiementsClient = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalPaye = paiementsClient.reduce((sum, p) => sum + (p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    res.json({
      success: true,
      data: {
        client: client[0],
        factures: facturesList,
        paiements: paiementsClient,
        totalFacture,
        totalPaye,
        solde,
        periode: { dateDebut, dateFin }
      }
    });

  } catch (error) {
    console.error('Erreur POST /api/clients/etat-compte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'état de compte',
      error: error.message
    });
  }
});

/**
 * POST /api/clients/etat-compte/email
 * Envoie un état de compte client par email
 */
router.post('/etat-compte/email', async (req, res) => {
  try {
    const { clientId, dateDebut, dateFin } = req.body;

    if (!clientId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'clientId, dateDebut et dateFin sont requis'
      });
    }

    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, parseInt(clientId)),
        eq(clients.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!client || client.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    if (!client[0].email) {
      return res.status(400).json({
        success: false,
        message: 'Ce client n\'a pas d\'adresse email configurée'
      });
    }

    const facturesList = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.clientId, parseInt(clientId)),
        eq(factures.entrepriseId, req.entrepriseId),
        gte(factures.dateFacture, dateDebut),
        lte(factures.dateFacture, dateFin)
      ))
      .orderBy(factures.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(and(
        eq(paiements.entrepriseId, req.entrepriseId),
        gte(paiements.datePaiement, dateDebut),
        lte(paiements.datePaiement, dateFin)
      ))
      .orderBy(paiements.datePaiement);

    const paiementsClient = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
    const totalPaye = paiementsClient.reduce((sum, p) => sum + (p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    const dateDebutFr = new Date(dateDebut).toLocaleDateString('fr-FR');
    const dateFinFr = new Date(dateFin).toLocaleDateString('fr-FR');

    let facturesHtml = '';
    if (facturesList.length > 0) {
      facturesHtml = `
        <h3>📋 Factures</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px; text-align: left;">N° Facture</th>
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: right;">Montant TTC</th>
              <th style="padding: 12px; text-align: center;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${facturesList.map(f => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${f.numeroFacture}</td>
                <td style="padding: 12px;">${new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold;">${(f.totalTTC || 0).toLocaleString('fr-FR')} FCFA</td>
                <td style="padding: 12px; text-align: center;">
                  <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; background-color: ${f.statut === 'payee' ? '#d4edda' : '#fff3cd'}; color: ${f.statut === 'payee' ? '#155724' : '#856404'};">
                    ${f.statut === 'payee' ? '✅ Payée' : '⏳ En attente'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let paiementsHtml = '';
    if (paiementsClient.length > 0) {
      paiementsHtml = `
        <h3>💳 Paiements</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: left;">Référence</th>
              <th style="padding: 12px; text-align: left;">Mode</th>
              <th style="padding: 12px; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${paiementsClient.map(p => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px;">${p.reference || '-'}</td>
                <td style="padding: 12px;">${p.modePaiement || '-'}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #27ae60;">${(p.montant || 0).toLocaleString('fr-FR')} FCFA</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3498db; padding-bottom: 20px;">
          <h1 style="color: #3498db; margin: 0 0 10px 0;">ÉTAT DE COMPTE CLIENT</h1>
          <p style="margin: 5px 0; font-size: 16px;"><strong>${client[0].nom}</strong></p>
          <p style="margin: 5px 0; color: #666;">Période: ${dateDebutFr} au ${dateFinFr}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="padding: 15px; background-color: #e8f4f8; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Facturé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3498db;">${totalFacture.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div style="padding: 15px; background-color: #e8f8f0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Payé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #27ae60;">${totalPaye.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div style="padding: 15px; background-color: #fff3e0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Solde Restant</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${solde > 0 ? '#e74c3c' : '#27ae60'};">${solde.toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>

        ${facturesHtml}
        ${paiementsHtml}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
          <p>Cet état de compte a été généré automatiquement par ComptaOrion</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: client[0].email,
      subject: `État de Compte - ${client[0].nom} (${dateDebutFr} au ${dateFinFr})`,
      html: emailHtml
    });

    res.json({
      success: true,
      message: `État de compte envoyé à ${client[0].email} avec succès`
    });

  } catch (error) {
    console.error('Erreur POST /api/clients/etat-compte/email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'état de compte',
      error: error.message
    });
  }
});

export default router;
