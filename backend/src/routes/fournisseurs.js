import express from 'express';
import { db } from '../db.js';
import { fournisseurs, facturesAchat, paiementsFournisseurs } from '../schema.js';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import emailService from '../services/emailService.js';

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

    // Générer et assigner le code auxiliaire automatiquement
    const codeAuxiliaire = 'FOU' + String(newFournisseur.id).padStart(5, '0');
    await db.update(fournisseurs)
      .set({ codeAuxiliaire })
      .where(eq(fournisseurs.id, newFournisseur.id));
    newFournisseur.codeAuxiliaire = codeAuxiliaire;

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

/**
 * POST /api/fournisseurs/etat-compte
 * Génère un état de compte fournisseur sur une période donnée
 */
router.post('/etat-compte', async (req, res) => {
  try {
    const { fournisseurId, dateDebut, dateFin } = req.body;

    if (!fournisseurId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'fournisseurId, dateDebut et dateFin sont requis'
      });
    }

    const fournisseur = await db
      .select()
      .from(fournisseurs)
      .where(and(
        eq(fournisseurs.id, parseInt(fournisseurId)),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!fournisseur || fournisseur.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    const facturesList = await db
      .select()
      .from(facturesAchat)
      .where(and(
        eq(facturesAchat.fournisseurId, parseInt(fournisseurId)),
        eq(facturesAchat.entrepriseId, req.entrepriseId),
        gte(facturesAchat.dateFacture, dateDebut),
        lte(facturesAchat.dateFacture, dateFin)
      ))
      .orderBy(facturesAchat.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiementsFournisseurs)
      .where(and(
        eq(paiementsFournisseurs.entrepriseId, req.entrepriseId),
        gte(paiementsFournisseurs.datePaiement, dateDebut),
        lte(paiementsFournisseurs.datePaiement, dateFin)
      ))
      .orderBy(paiementsFournisseurs.datePaiement);

    const paiementsFournisseur = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + (f.montantTotal || f.montantHT || 0), 0);
    const totalPaye = paiementsFournisseur.reduce((sum, p) => sum + (p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    res.json({
      success: true,
      data: {
        fournisseur: fournisseur[0],
        factures: facturesList,
        paiements: paiementsFournisseur,
        totalFacture,
        totalPaye,
        solde,
        periode: { dateDebut, dateFin }
      }
    });

  } catch (error) {
    console.error('Erreur POST /api/fournisseurs/etat-compte:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de l\'état de compte',
      error: error.message
    });
  }
});

/**
 * POST /api/fournisseurs/etat-compte/email
 * Envoie un état de compte fournisseur par email
 */
router.post('/etat-compte/email', async (req, res) => {
  try {
    const { fournisseurId, dateDebut, dateFin } = req.body;

    if (!fournisseurId || !dateDebut || !dateFin) {
      return res.status(400).json({
        success: false,
        message: 'fournisseurId, dateDebut et dateFin sont requis'
      });
    }

    const fournisseur = await db
      .select()
      .from(fournisseurs)
      .where(and(
        eq(fournisseurs.id, parseInt(fournisseurId)),
        eq(fournisseurs.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!fournisseur || fournisseur.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    if (!fournisseur[0].email) {
      return res.status(400).json({
        success: false,
        message: 'Ce fournisseur n\'a pas d\'adresse email configurée'
      });
    }

    const facturesList = await db
      .select()
      .from(facturesAchat)
      .where(and(
        eq(facturesAchat.fournisseurId, parseInt(fournisseurId)),
        eq(facturesAchat.entrepriseId, req.entrepriseId),
        gte(facturesAchat.dateFacture, dateDebut),
        lte(facturesAchat.dateFacture, dateFin)
      ))
      .orderBy(facturesAchat.dateFacture);

    const paiementsList = await db
      .select()
      .from(paiementsFournisseurs)
      .where(and(
        eq(paiementsFournisseurs.entrepriseId, req.entrepriseId),
        gte(paiementsFournisseurs.datePaiement, dateDebut),
        lte(paiementsFournisseurs.datePaiement, dateFin)
      ))
      .orderBy(paiementsFournisseurs.datePaiement);

    const paiementsFournisseur = paiementsList.filter(p => {
      const facture = facturesList.find(f => f.id === p.factureId);
      return !!facture;
    });

    const totalFacture = facturesList.reduce((sum, f) => sum + (f.montantTotal || f.montantHT || 0), 0);
    const totalPaye = paiementsFournisseur.reduce((sum, p) => sum + (p.montant || 0), 0);
    const solde = totalFacture - totalPaye;

    const dateDebutFr = new Date(dateDebut).toLocaleDateString('fr-FR');
    const dateFinFr = new Date(dateFin).toLocaleDateString('fr-FR');

    let facturesHtml = '';
    if (facturesList.length > 0) {
      facturesHtml = `
        <h3>📋 Factures Fournisseur</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
              <th style="padding: 12px; text-align: left;">N° Facture</th>
              <th style="padding: 12px; text-align: left;">Date</th>
              <th style="padding: 12px; text-align: right;">Montant Total</th>
              <th style="padding: 12px; text-align: center;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${facturesList.map(f => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${f.numeroFacture || 'N/A'}</td>
                <td style="padding: 12px;">${new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold;">${(f.montantTotal || f.montantHT || 0).toLocaleString('fr-FR')} XOF</td>
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
    if (paiementsFournisseur.length > 0) {
      paiementsHtml = `
        <h3>💳 Paiements Effectués</h3>
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
            ${paiementsFournisseur.map(p => `
              <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px;">${new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                <td style="padding: 12px;">${p.reference || '-'}</td>
                <td style="padding: 12px;">${p.modePaiement || '-'}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #27ae60;">${(p.montant || 0).toLocaleString('fr-FR')} XOF</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1976d2; padding-bottom: 20px;">
          <h1 style="color: #1976d2; margin: 0 0 10px 0;">ÉTAT DE COMPTE FOURNISSEUR</h1>
          <p style="margin: 5px 0; font-size: 16px;"><strong>${fournisseur[0].nom}</strong></p>
          <p style="margin: 5px 0; color: #666;">Période: ${dateDebutFr} au ${dateFinFr}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div style="padding: 15px; background-color: #e8f4f8; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Facturé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1976d2;">${totalFacture.toLocaleString('fr-FR')} XOF</p>
          </div>
          <div style="padding: 15px; background-color: #e8f8f0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Total Payé</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #27ae60;">${totalPaye.toLocaleString('fr-FR')} XOF</p>
          </div>
          <div style="padding: 15px; background-color: #fff3e0; border-radius: 8px; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">Solde Dû</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${solde > 0 ? '#e74c3c' : '#27ae60'};">${solde.toLocaleString('fr-FR')} XOF</p>
          </div>
        </div>

        ${facturesHtml}
        ${paiementsHtml}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
          <p>Cet état de compte a été généré automatiquement par ComptaOrion</p>
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: fournisseur[0].email,
      subject: `État de Compte - ${fournisseur[0].nom} (${dateDebutFr} au ${dateFinFr})`,
      html: emailHtml,
      entrepriseId: req.entrepriseId,
      typeEmail: 'etat_compte'
    });

    res.json({
      success: true,
      message: `État de compte envoyé à ${fournisseur[0].email} avec succès`
    });

  } catch (error) {
    console.error('Erreur POST /api/fournisseurs/etat-compte/email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'état de compte',
      error: error.message
    });
  }
});

// ==========================================
// DRILL-DOWN ENDPOINTS
// ==========================================

/**
 * GET /api/fournisseurs/detail/fournisseurs
 * Liste détaillée des fournisseurs
 */
router.get('/detail/fournisseurs', async (req, res) => {
  try {
    const eId = req.entrepriseId;
    
    const fournisseursData = await db
      .select({
        id: fournisseurs.id,
        nom: fournisseurs.raisonSociale,
        email: fournisseurs.email,
        telephone: fournisseurs.telephone,
        ville: fournisseurs.adresse,
        categorie: fournisseurs.categorie,
        actif: fournisseurs.actif
      })
      .from(fournisseurs)
      .where(eq(fournisseurs.entrepriseId, eId))
      .orderBy(desc(fournisseurs.raisonSociale));
    
    res.json(fournisseursData);
  } catch (error) {
    console.error('Erreur drill-down fournisseurs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fournisseurs/detail/achats
 * Détail des commandes d'achat
 */
router.get('/detail/achats', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    let whereConditions = [eq(facturesAchat.entrepriseId, eId)];
    if (dateDebut) whereConditions.push(gte(facturesAchat.dateFacture, new Date(dateDebut)));
    if (dateFin) whereConditions.push(lte(facturesAchat.dateFacture, new Date(dateFin)));
    
    const achatsData = await db
      .select({
        id: facturesAchat.id,
        numero: facturesAchat.numero,
        date: facturesAchat.dateFacture,
        montant: facturesAchat.totalHT,
        statut: facturesAchat.statut,
        fournisseurId: facturesAchat.fournisseurId
      })
      .from(facturesAchat)
      .where(and(...whereConditions))
      .orderBy(desc(facturesAchat.dateFacture));
    
    // Récupérer les noms des fournisseurs
    const fournisseurIds = [...new Set(achatsData.map(a => a.fournisseurId))];
    const fournisseursData = fournisseurIds.length > 0 ? await db
      .select({ id: fournisseurs.id, nom: fournisseurs.nom })
      .from(fournisseurs)
      .where(eq(fournisseurs.entrepriseId, eId)) : [];
    
    const fournisseurMap = {};
    fournisseursData.forEach(f => fournisseurMap[f.id] = f.nom);
    
    res.json(achatsData.map(a => ({
      ...a,
      fournisseur: fournisseurMap[a.fournisseurId] || 'Fournisseur inconnu'
    })));
  } catch (error) {
    console.error('Erreur drill-down achats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fournisseurs/detail/paiements
 * Détail des paiements aux fournisseurs
 */
router.get('/detail/paiements', async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const eId = req.entrepriseId;
    
    let whereConditions = [eq(paiementsFournisseurs.entrepriseId, eId)];
    if (dateDebut) whereConditions.push(gte(paiementsFournisseurs.datePaiement, new Date(dateDebut)));
    if (dateFin) whereConditions.push(lte(paiementsFournisseurs.datePaiement, new Date(dateFin)));
    
    const paiementsData = await db
      .select({
        id: paiementsFournisseurs.id,
        date: paiementsFournisseurs.datePaiement,
        montant: paiementsFournisseurs.montant,
        modePaiement: paiementsFournisseurs.modePaiement,
        reference: paiementsFournisseurs.reference,
        fournisseurId: paiementsFournisseurs.fournisseurId
      })
      .from(paiementsFournisseurs)
      .where(and(...whereConditions))
      .orderBy(desc(paiementsFournisseurs.datePaiement));
    
    // Récupérer les noms des fournisseurs
    const fournisseurIds = [...new Set(paiementsData.map(p => p.fournisseurId))];
    const fournisseursData = fournisseurIds.length > 0 ? await db
      .select({ id: fournisseurs.id, nom: fournisseurs.nom })
      .from(fournisseurs)
      .where(eq(fournisseurs.entrepriseId, eId)) : [];
    
    const fournisseurMap = {};
    fournisseursData.forEach(f => fournisseurMap[f.id] = f.nom);
    
    res.json(paiementsData.map(p => ({
      ...p,
      fournisseur: fournisseurMap[p.fournisseurId] || 'Fournisseur inconnu'
    })));
  } catch (error) {
    console.error('Erreur drill-down paiements fournisseurs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
