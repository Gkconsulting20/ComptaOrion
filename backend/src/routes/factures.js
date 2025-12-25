import express from 'express';
import { db } from '../db.js';
import { factures, factureItems, paiements, clients, produits, transactionsTresorerie, comptesBancaires, ecritures, lignesEcritures, journaux, comptesComptables, mouvementsStock, entreprises } from '../schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import emailService from '../services/emailService.js';
import { createEcritureFactureVente, createEcriturePaiementClient } from '../services/comptabiliteService.js';

const router = express.Router();

/**
 * Génère le prochain numéro de facture
 */
async function genererNumeroFacture(entrepriseId) {
  const annee = new Date().getFullYear();
  const [lastFacture] = await db
    .select({ numeroFacture: factures.numeroFacture })
    .from(factures)
    .where(and(
      eq(factures.entrepriseId, entrepriseId),
      sql`EXTRACT(YEAR FROM ${factures.dateFacture}::date) = ${annee}`
    ))
    .orderBy(desc(factures.createdAt))
    .limit(1);

  let numero = 1;
  if (lastFacture?.numeroFacture) {
    const match = lastFacture.numeroFacture.match(/FACT-(\d{4})-(\d+)/);
    if (match) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `FACT-${annee}-${numero.toString().padStart(4, '0')}`;
}

/**
 * GET /api/factures
 * Récupère la liste de toutes les factures
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const facturesList = await db
      .select({
        facture: factures,
        client: {
          id: clients.id,
          nom: clients.nom,
          email: clients.email,
        }
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(eq(factures.entrepriseId, req.entrepriseId))
      .orderBy(desc(factures.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)::int` })
      .from(factures)
      .where(eq(factures.entrepriseId, req.entrepriseId));

    res.json({
      success: true,
      count: facturesList.length,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      data: facturesList,
    });
  } catch (error) {
    console.error('Erreur GET /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures',
      error: error.message,
    });
  }
});

/**
 * GET /api/factures/:id
 * Récupère une facture spécifique avec ses lignes et paiements
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [factureData] = await db
      .select({
        facture: factures,
        client: clients,
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    const items = await db
      .select()
      .from(factureItems)
      .where(eq(factureItems.factureId, parseInt(id)));

    const paiementsList = await db
      .select()
      .from(paiements)
      .where(eq(paiements.factureId, parseInt(id)))
      .orderBy(desc(paiements.datePaiement));

    res.json({
      success: true,
      data: {
        ...factureData.facture,
        client: factureData.client,
        items,
        paiements: paiementsList,
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures
 * Crée une nouvelle facture
 */
router.post('/', async (req, res) => {
  try {
    const {
      clientId,
      dateFacture,
      dateEcheance,
      notes,
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

    // Récupérer le taux TVA
    const [entreprise] = await db
      .select({ tauxTva: sql`taux_tva` })
      .from(sql`entreprises`)
      .where(sql`id = ${req.entrepriseId}`);

    const tauxTva = parseFloat(entreprise?.tauxTva || 18);
    const totalTVA = totalHT * (tauxTva / 100);
    const totalTTC = totalHT + totalTVA;

    // Générer le numéro de facture
    const numeroFacture = await genererNumeroFacture(req.entrepriseId);

    // Créer la facture
    const [newFacture] = await db
      .insert(factures)
      .values({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        clientId: parseInt(clientId),
        statut: 'brouillon',
        dateFacture: dateFacture || new Date().toISOString().split('T')[0],
        dateEcheance: dateEcheance || null,
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        montantPaye: '0',
        soldeRestant: totalTTC.toFixed(2),
        notes: notes || null,
        userId: req.user.id,
      })
      .returning();

    // Créer les lignes de facture
    const factureItemsData = items.map(item => {
      const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalApresRemise = totalLigne * (1 - remise / 100);

      return {
        entrepriseId: req.entrepriseId,
        factureId: newFacture.id,
        produitId: item.produitId || null,
        description: item.description,
        quantite: item.quantite,
        prixUnitaire: item.prixUnitaire,
        remise: item.remise || '0',
        totalLigne: totalApresRemise.toFixed(2),
      };
    });

    await db.insert(factureItems).values(factureItemsData);

    // Impact automatique sur COMPTABILITÉ - Journal des Ventes
    // Débit: Client (411) - Crédit: Ventes (701) + TVA (443)
    try {
      const clientData = await db.select().from(clients).where(eq(clients.id, parseInt(clientId))).limit(1);
      const clientInfo = clientData[0] || {};
      
      await createEcritureFactureVente({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        dateFacture: dateFacture || new Date().toISOString().split('T')[0],
        clientNom: clientInfo.nom || 'Client',
        clientCompteId: clientInfo.compteComptableId,
        totalHT,
        totalTVA,
        totalTTC
      });
    } catch (comptaError) {
      console.warn('Avertissement: Écriture comptable facture vente non générée:', comptaError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: newFacture,
    });
  } catch (error) {
    console.error('Erreur POST /api/factures:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures/:id/paiement
 * Enregistre un paiement pour une facture
 * Impact automatique sur comptabilité et trésorerie
 */
router.post('/:id/paiement', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      montant,
      modePaiement, // mobile_money, carte_bancaire, virement, especes
      reference,
      datePaiement,
      compteBancaireId,
      notes,
    } = req.body;

    // Validation
    if (!montant || montant <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant du paiement doit être positif',
      });
    }

    if (!modePaiement) {
      return res.status(400).json({
        success: false,
        message: 'Le mode de paiement est obligatoire',
      });
    }

    // Récupérer la facture
    const [factureData] = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    const montantPaiement = parseFloat(montant);
    const soldeRestant = parseFloat(factureData.soldeRestant);

    if (montantPaiement > soldeRestant) {
      return res.status(400).json({
        success: false,
        message: `Le montant du paiement ne peut pas dépasser le solde restant (${soldeRestant} FCFA)`,
      });
    }

    // Enregistrer le paiement
    const [newPaiement] = await db
      .insert(paiements)
      .values({
        entrepriseId: req.entrepriseId,
        factureId: parseInt(id),
        clientId: factureData.clientId,
        montant: montantPaiement.toFixed(2),
        modePaiement,
        reference: reference || null,
        datePaiement: datePaiement || new Date().toISOString().split('T')[0],
        notes: notes || null,
        userId: req.user.id,
      })
      .returning();

    // Mettre à jour la facture
    const nouveauMontantPaye = parseFloat(factureData.montantPaye) + montantPaiement;
    const nouveauSoldeRestant = parseFloat(factureData.totalTTC) - nouveauMontantPaye;
    const nouveauStatut = nouveauSoldeRestant <= 0.01 ? 'payee' : 'envoyee';

    await db
      .update(factures)
      .set({
        montantPaye: nouveauMontantPaye.toFixed(2),
        soldeRestant: Math.max(0, nouveauSoldeRestant).toFixed(2),
        statut: nouveauStatut,
        updatedAt: new Date(),
      })
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ));

    // Impact automatique sur TRÉSORERIE
    if (compteBancaireId) {
      // Enregistrer la transaction de trésorerie
      await db.insert(transactionsTresorerie).values({
        entrepriseId: req.entrepriseId,
        compteBancaireId: parseInt(compteBancaireId),
        type: 'encaissement',
        montant: montantPaiement.toFixed(2),
        dateTransaction: datePaiement || new Date().toISOString().split('T')[0],
        categorie: 'Vente',
        description: `Paiement facture ${factureData.numeroFacture}`,
        tiersNom: null,
        numeroPiece: factureData.numeroFacture,
        userId: req.user.id,
      });

      // Mettre à jour le solde du compte bancaire
      const [compte] = await db
        .select()
        .from(comptesBancaires)
        .where(eq(comptesBancaires.id, parseInt(compteBancaireId)))
        .limit(1);

      if (compte) {
        const nouveauSolde = parseFloat(compte.soldeActuel) + montantPaiement;
        await db
          .update(comptesBancaires)
          .set({
            soldeActuel: nouveauSolde.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(comptesBancaires.id, parseInt(compteBancaireId)));
      }
    }

    // Impact automatique sur COMPTABILITÉ
    // Débit: Banque/Caisse - Crédit: Client (411)
    try {
      const clientData = await db.select().from(clients).where(eq(clients.id, factureData.clientId)).limit(1);
      const clientInfo = clientData[0] || {};
      
      await createEcriturePaiementClient({
        entrepriseId: req.entrepriseId,
        reference: reference || `PAI-${newPaiement.id}`,
        datePaiement: datePaiement || new Date().toISOString().split('T')[0],
        clientNom: clientInfo.nom || 'Client',
        clientCompteId: clientInfo.compteComptableId,
        montant: montantPaiement,
        modePaiement: modePaiement === 'especes' ? 'especes' : 'banque',
        compteBancaireId: compteBancaireId ? parseInt(compteBancaireId) : null
      });
    } catch (comptaError) {
      console.warn('Avertissement: Écriture comptable paiement client non générée:', comptaError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: {
        paiement: newPaiement,
        facture: {
          montantPaye: nouveauMontantPaye.toFixed(2),
          soldeRestant: Math.max(0, nouveauSoldeRestant).toFixed(2),
          statut: nouveauStatut,
        },
      },
    });
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du paiement',
      error: error.message,
    });
  }
});

/**
 * PUT /api/factures/:id
 * Met à jour une facture
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      statut,
      dateFacture,
      dateEcheance,
      notes,
      items,
    } = req.body;

    // Vérifier que la facture existe
    const [existingFacture] = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingFacture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    let updateData = {
      updatedAt: new Date(),
    };

    if (statut !== undefined) updateData.statut = statut;
    if (dateFacture !== undefined) updateData.dateFacture = dateFacture;
    if (dateEcheance !== undefined) updateData.dateEcheance = dateEcheance;
    if (notes !== undefined) updateData.notes = notes;

    // Si les items sont fournis, recalculer les totaux
    if (items && items.length > 0) {
      // Supprimer les anciennes lignes
      await db
        .delete(factureItems)
        .where(eq(factureItems.factureId, parseInt(id)));

      // Calculer les nouveaux totaux
      let totalHT = 0;
      items.forEach(item => {
        const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        const totalApresRemise = totalLigne * (1 - remise / 100);
        totalHT += totalApresRemise;
      });

      const [entreprise] = await db
        .select({ tauxTva: sql`taux_tva` })
        .from(sql`entreprises`)
        .where(sql`id = ${req.entrepriseId}`);

      const tauxTva = parseFloat(entreprise?.tauxTva || 18);
      const totalTVA = totalHT * (tauxTva / 100);
      const totalTTC = totalHT + totalTVA;

      updateData.totalHT = totalHT.toFixed(2);
      updateData.totalTVA = totalTVA.toFixed(2);
      updateData.totalTTC = totalTTC.toFixed(2);
      updateData.soldeRestant = (totalTTC - parseFloat(existingFacture.montantPaye)).toFixed(2);

      // Créer les nouvelles lignes
      const newItemsData = items.map(item => {
        const totalLigne = parseFloat(item.quantite) * parseFloat(item.prixUnitaire);
        const remise = parseFloat(item.remise || 0);
        const totalApresRemise = totalLigne * (1 - remise / 100);

        return {
          entrepriseId: req.entrepriseId,
          factureId: parseInt(id),
          produitId: item.produitId || null,
          description: item.description,
          quantite: item.quantite,
          prixUnitaire: item.prixUnitaire,
          remise: item.remise || '0',
          totalLigne: totalApresRemise.toFixed(2),
        };
      });

      await db.insert(factureItems).values(newItemsData);
    }

    // Mettre à jour la facture
    const [updatedFacture] = await db
      .update(factures)
      .set(updateData)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .returning();

    // *** INTÉGRATION STOCK AUTOMATIQUE ***
    // Si le statut change vers 'envoyee' ou 'payee', générer mouvements SORTIE
    if (statut && (statut === 'envoyee' || statut === 'payee') && existingFacture.statut === 'brouillon') {
      // Récupérer les items de la facture
      const factureItemsList = await db
        .select()
        .from(factureItems)
        .where(eq(factureItems.factureId, parseInt(id)));

      // Créer un mouvement SORTIE pour chaque produit
      for (const item of factureItemsList) {
        if (item.produitId) {
          try {
            // Créer mouvement de stock SORTIE
            await db.insert(mouvementsStock).values({
              entrepriseId: req.entrepriseId,
              produitId: item.produitId,
              type: 'sortie',
              quantite: parseFloat(item.quantite),
              prixUnitaire: parseFloat(item.prixUnitaire),
              reference: `Facture ${updatedFacture.numeroFacture}`,
              notes: `Vente client - Facture ${updatedFacture.numeroFacture}`,
              userId: req.user?.id || null
            });

            // Mettre à jour le stock du produit (décrémenter)
            const [produit] = await db
              .select()
              .from(produits)
              .where(eq(produits.id, item.produitId))
              .limit(1);

            if (produit) {
              const nouvelleQuantite = Math.max(0, parseFloat(produit.quantite || 0) - parseFloat(item.quantite));
              await db
                .update(produits)
                .set({ 
                  quantite: nouvelleQuantite,
                  updatedAt: new Date()
                })
                .where(eq(produits.id, item.produitId));
            }
          } catch (error) {
            console.error(`Erreur création mouvement SORTIE pour produit ${item.produitId}:`, error);
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Facture mise à jour avec succès',
      data: updatedFacture,
    });
  } catch (error) {
    console.error('Erreur PUT /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la facture',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/factures/:id
 * Supprime une facture
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la facture existe
    const [existingFacture] = await db
      .select()
      .from(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!existingFacture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée',
      });
    }

    // Vérifier qu'il n'y a pas de paiements
    const [paiement] = await db
      .select()
      .from(paiements)
      .where(eq(paiements.factureId, parseInt(id)))
      .limit(1);

    if (paiement) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une facture qui a des paiements enregistrés',
      });
    }

    // Supprimer les lignes de facture
    await db
      .delete(factureItems)
      .where(eq(factureItems.factureId, parseInt(id)));

    // Supprimer la facture
    await db
      .delete(factures)
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ));

    res.json({
      success: true,
      message: 'Facture supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE /api/factures/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la facture',
      error: error.message,
    });
  }
});

/**
 * POST /api/factures/:id/send-email
 * Envoie une facture par email au client
 */
router.post('/:id/send-email', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const [factureData] = await db
      .select({
        facture: factures,
        client: clients,
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(and(
        eq(factures.id, parseInt(id)),
        eq(factures.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée ou accès non autorisé',
      });
    }

    if (!factureData.client?.email) {
      return res.status(400).json({
        success: false,
        message: 'Le client n\'a pas d\'adresse email renseignée',
      });
    }

    const [entrepriseData] = await db
      .select()
      .from(entreprises)
      .where(eq(entreprises.id, req.entrepriseId))
      .limit(1);

    if (!entrepriseData) {
      return res.status(500).json({
        success: false,
        message: 'Données entreprise non disponibles',
      });
    }

    const result = await emailService.sendInvoiceEmail({
      facture: factureData.facture,
      client: factureData.client,
      entreprise: entrepriseData,
      pdfBase64: null,
      userId,
    });

    res.json(result);
  } catch (error) {
    console.error('Erreur POST /api/factures/:id/send-email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi de l\'email',
      error: error.message,
    });
  }
});

/**
 * GET /api/factures/export/csv
 * Export CSV de toutes les factures
 */
router.get('/export/csv', async (req, res) => {
  try {
    const facturesList = await db
      .select({
        facture: factures,
        client: { nom: clients.nom }
      })
      .from(factures)
      .leftJoin(clients, eq(factures.clientId, clients.id))
      .where(eq(factures.entrepriseId, req.entrepriseId))
      .orderBy(desc(factures.createdAt));

    const csv = [
      'Numero;Client;Date;Echeance;Total HT;Total TTC;Paye;Solde;Statut',
      ...facturesList.map(f => 
        `${f.facture.numeroFacture || ''};${f.client?.nom || ''};${f.facture.dateFacture ? new Date(f.facture.dateFacture).toLocaleDateString('fr-FR') : ''};${f.facture.dateEcheance ? new Date(f.facture.dateEcheance).toLocaleDateString('fr-FR') : ''};${f.facture.totalHT || 0};${f.facture.totalTTC || 0};${f.facture.montantPaye || 0};${f.facture.soldeRestant || 0};${f.facture.statut || ''}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=factures.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Erreur export factures:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
