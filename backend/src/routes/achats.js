import express from 'express';
import { db } from '../db.js';
import { 
  facturesAchat, 
  factureAchatItems,
  paiementsFournisseurs,
  fournisseurs,
  commandesAchat,
  commandesAchatItems,
  transactionsTresorerie,
  comptesBancaires
} from '../schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';

const router = express.Router();

// Génération automatique du numéro de facture achat
async function genererNumeroFactureAchat(entrepriseId) {
  const annee = new Date().getFullYear();
  const [lastFacture] = await db
    .select()
    .from(facturesAchat)
    .where(eq(facturesAchat.entrepriseId, entrepriseId))
    .orderBy(desc(facturesAchat.id))
    .limit(1);

  let numero = 1;
  if (lastFacture && lastFacture.numeroFacture) {
    const match = lastFacture.numeroFacture.match(/FACT-ACH-(\d{4})-(\d+)/);
    if (match && parseInt(match[1]) === annee) {
      numero = parseInt(match[2]) + 1;
    }
  }

  return `FACT-ACH-${annee}-${numero.toString().padStart(4, '0')}`;
}

// =========================================
// FACTURES FOURNISSEURS
// =========================================

// GET /api/achats/factures - Liste des factures fournisseurs
router.get('/factures', async (req, res) => {
  try {
    const { page = 1, limit = 50, statut, fournisseurId } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [eq(facturesAchat.entrepriseId, req.entrepriseId)];

    if (statut) {
      whereConditions.push(eq(facturesAchat.statut, statut));
    }

    if (fournisseurId) {
      whereConditions.push(eq(facturesAchat.fournisseurId, parseInt(fournisseurId)));
    }

    const results = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(and(...whereConditions))
      .orderBy(desc(facturesAchat.createdAt))
      .limit(parseInt(limit))
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(facturesAchat)
      .where(and(...whereConditions));

    const formattedResults = results.map(r => ({
      ...r.facture,
      fournisseur: r.fournisseur
    }));

    return res.json({
      success: true,
      data: formattedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des factures',
      error: error.message
    });
  }
});

// GET /api/achats/factures/:id - Détails d'une facture fournisseur
router.get('/factures/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [facture] = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(
        and(
          eq(facturesAchat.id, parseInt(id)),
          eq(facturesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    // Récupérer les lignes de facture
    const items = await db
      .select()
      .from(factureAchatItems)
      .where(eq(factureAchatItems.factureId, parseInt(id)));

    // Récupérer les paiements
    const paiements = await db
      .select()
      .from(paiementsFournisseurs)
      .where(eq(paiementsFournisseurs.factureId, parseInt(id)));

    return res.json({
      success: true,
      data: {
        ...facture.facture,
        fournisseur: facture.fournisseur,
        items,
        paiements
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la facture',
      error: error.message
    });
  }
});

// POST /api/achats/factures - Créer une facture fournisseur
router.post('/factures', async (req, res) => {
  try {
    const {
      fournisseurId,
      commandeId, // Optionnel - si depuis une commande
      numeroFactureFournisseur, // Numéro de facture du fournisseur
      dateFacture,
      dateEcheance,
      items,
      notes
    } = req.body;

    // Validation
    if (!fournisseurId) {
      return res.status(400).json({
        success: false,
        message: 'Le fournisseur est obligatoire'
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un article est obligatoire'
      });
    }

    // Vérifier que le fournisseur existe
    const [fournisseur] = await db
      .select()
      .from(fournisseurs)
      .where(
        and(
          eq(fournisseurs.id, parseInt(fournisseurId)),
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

    // Générer numéro de facture
    const numeroFacture = await genererNumeroFactureAchat(req.entrepriseId);

    // Calculer les totaux
    let totalHT = 0;
    for (const item of items) {
      const quantite = parseFloat(item.quantite);
      const prixUnitaire = parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalLigne = quantite * prixUnitaire * (1 - remise / 100);
      totalHT += totalLigne;
    }

    const totalTVA = totalHT * 0.18;
    const totalTTC = totalHT + totalTVA;

    // Créer la facture
    const [newFacture] = await db
      .insert(facturesAchat)
      .values({
        entrepriseId: req.entrepriseId,
        numeroFacture,
        numeroFactureFournisseur: numeroFactureFournisseur || null,
        fournisseurId: parseInt(fournisseurId),
        commandeId: commandeId ? parseInt(commandeId) : null,
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
    const itemsToInsert = items.map(item => {
      const quantite = parseFloat(item.quantite);
      const prixUnitaire = parseFloat(item.prixUnitaire);
      const remise = parseFloat(item.remise || 0);
      const totalLigne = quantite * prixUnitaire * (1 - remise / 100);

      return {
        entrepriseId: req.entrepriseId,
        factureId: newFacture.id,
        produitId: item.produitId ? parseInt(item.produitId) : null,
        description: item.description,
        quantite: quantite.toString(),
        prixUnitaire: prixUnitaire.toFixed(2),
        remise: remise.toFixed(2),
        totalLigne: totalLigne.toFixed(2),
      };
    });

    const insertedItems = await db
      .insert(factureAchatItems)
      .values(itemsToInsert)
      .returning();

    return res.status(201).json({
      success: true,
      message: 'Facture créée avec succès',
      data: {
        ...newFacture,
        items: insertedItems
      }
    });
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la facture',
      error: error.message
    });
  }
});

// PUT /api/achats/factures/:id/valider - Valider une facture fournisseur
router.put('/factures/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;

    const [facture] = await db
      .select()
      .from(facturesAchat)
      .where(
        and(
          eq(facturesAchat.id, parseInt(id)),
          eq(facturesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!facture) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    if (facture.statut !== 'brouillon') {
      return res.status(400).json({
        success: false,
        message: 'Seules les factures en brouillon peuvent être validées'
      });
    }

    const [updated] = await db
      .update(facturesAchat)
      .set({
        statut: 'validee',
        updatedAt: new Date()
      })
      .where(eq(facturesAchat.id, parseInt(id)))
      .returning();

    // Mettre à jour le solde dû du fournisseur
    await db
      .update(fournisseurs)
      .set({
        soldeDu: sql`${fournisseurs.soldeDu} + ${updated.totalTTC}`,
        updatedAt: new Date()
      })
      .where(eq(fournisseurs.id, facture.fournisseurId));

    return res.json({
      success: true,
      message: 'Facture validée avec succès',
      data: updated
    });
  } catch (error) {
    console.error('Erreur lors de la validation de la facture:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation de la facture',
      error: error.message
    });
  }
});

// =========================================
// PAIEMENTS FOURNISSEURS
// =========================================

// POST /api/achats/factures/:id/paiement - Enregistrer un paiement fournisseur
router.post('/factures/:id/paiement', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      montant,
      modePaiement,
      reference,
      datePaiement,
      compteBancaireId,
      notes
    } = req.body;

    // Validation
    if (!montant || parseFloat(montant) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant est obligatoire et doit être supérieur à 0'
      });
    }

    const montantPaiement = parseFloat(montant);

    // Récupérer la facture
    const [factureData] = await db
      .select()
      .from(facturesAchat)
      .where(
        and(
          eq(facturesAchat.id, parseInt(id)),
          eq(facturesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .limit(1);

    if (!factureData) {
      return res.status(404).json({
        success: false,
        message: 'Facture non trouvée'
      });
    }

    const soldeRestant = parseFloat(factureData.soldeRestant);

    if (montantPaiement > soldeRestant) {
      return res.status(400).json({
        success: false,
        message: `Le montant du paiement (${montantPaiement}) dépasse le solde restant (${soldeRestant})`
      });
    }

    // Enregistrer le paiement
    const [paiement] = await db
      .insert(paiementsFournisseurs)
      .values({
        entrepriseId: req.entrepriseId,
        factureId: parseInt(id),
        fournisseurId: factureData.fournisseurId,
        montant: montantPaiement.toFixed(2),
        modePaiement: modePaiement || null,
        reference: reference || null,
        datePaiement: datePaiement || new Date().toISOString().split('T')[0],
        notes: notes || null,
        userId: req.user.id,
      })
      .returning();

    // Mettre à jour la facture
    const nouveauMontantPaye = parseFloat(factureData.montantPaye) + montantPaiement;
    const nouveauSolde = parseFloat(factureData.totalTTC) - nouveauMontantPaye;
    const nouveauStatut = nouveauSolde <= 0.01 ? 'payee' : 'partiellement_payee';

    const [factureUpdated] = await db
      .update(facturesAchat)
      .set({
        montantPaye: nouveauMontantPaye.toFixed(2),
        soldeRestant: nouveauSolde.toFixed(2),
        statut: nouveauStatut,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(facturesAchat.id, parseInt(id)),
          eq(facturesAchat.entrepriseId, req.entrepriseId)
        )
      )
      .returning();

    // Impact sur le solde dû du fournisseur
    await db
      .update(fournisseurs)
      .set({
        soldeDu: sql`${fournisseurs.soldeDu} - ${montantPaiement}`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(fournisseurs.id, factureData.fournisseurId),
          eq(fournisseurs.entrepriseId, req.entrepriseId)
        )
      );

    // Impact sur la trésorerie si un compte bancaire est spécifié
    if (compteBancaireId) {
      // Créer la transaction de trésorerie (décaissement)
      await db.insert(transactionsTresorerie).values({
        entrepriseId: req.entrepriseId,
        compteBancaireId: parseInt(compteBancaireId),
        type: 'decaissement',
        montant: montantPaiement.toFixed(2),
        dateTransaction: datePaiement || new Date().toISOString().split('T')[0],
        categorie: 'Achat',
        description: `Paiement facture ${factureData.numeroFacture}`,
        tiersNom: null,
        numeroPiece: factureData.numeroFacture,
        modePaiement: modePaiement || null,
        userId: req.user.id,
      });

      // Mettre à jour le solde du compte bancaire
      await db
        .update(comptesBancaires)
        .set({
          soldeActuel: sql`${comptesBancaires.soldeActuel} - ${montantPaiement}`,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(comptesBancaires.id, parseInt(compteBancaireId)),
            eq(comptesBancaires.entrepriseId, req.entrepriseId)
          )
        );
    }

    return res.json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: {
        paiement,
        facture: {
          montantPaye: factureUpdated.montantPaye,
          soldeRestant: factureUpdated.soldeRestant,
          statut: factureUpdated.statut
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du paiement:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du paiement',
      error: error.message
    });
  }
});

// GET /api/achats/echeances - Échéancier des factures fournisseurs
router.get('/echeances', async (req, res) => {
  try {
    const { debutPeriode, finPeriode } = req.query;

    let whereConditions = [
      eq(facturesAchat.entrepriseId, req.entrepriseId),
      sql`${facturesAchat.statut} != 'payee'`,
      sql`${facturesAchat.dateEcheance} IS NOT NULL`
    ];

    if (debutPeriode) {
      whereConditions.push(sql`${facturesAchat.dateEcheance} >= ${debutPeriode}`);
    }

    if (finPeriode) {
      whereConditions.push(sql`${facturesAchat.dateEcheance} <= ${finPeriode}`);
    }

    const results = await db
      .select({
        facture: facturesAchat,
        fournisseur: fournisseurs,
      })
      .from(facturesAchat)
      .leftJoin(fournisseurs, eq(facturesAchat.fournisseurId, fournisseurs.id))
      .where(and(...whereConditions))
      .orderBy(facturesAchat.dateEcheance);

    const formattedResults = results.map(r => ({
      ...r.facture,
      fournisseur: r.fournisseur,
      retard: new Date(r.facture.dateEcheance) < new Date() ? true : false
    }));

    return res.json({
      success: true,
      data: formattedResults
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des échéances:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des échéances',
      error: error.message
    });
  }
});

export default router;
