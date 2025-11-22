import express from 'express';
import { db } from '../db.js';
import { entreprises, users, plansAbonnement, abonnements, saasClients, saasVentes } from '../schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import FedaPay from 'fedapay';

const router = express.Router();

// Configuration FedaPay
const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY;
const FEDAPAY_PUBLIC_KEY = process.env.FEDAPAY_PUBLIC_KEY;
const FEDAPAY_ENVIRONMENT = process.env.FEDAPAY_ENVIRONMENT || 'sandbox'; // sandbox ou live

if (FEDAPAY_SECRET_KEY) {
  FedaPay.setApiKey(FEDAPAY_SECRET_KEY);
  FedaPay.setEnvironment(FEDAPAY_ENVIRONMENT);
  console.log(`✅ FedaPay configuré en mode ${FEDAPAY_ENVIRONMENT}`);
}

// ===========================================
// ROUTES PUBLIQUES (sans authentification)
// ===========================================

// GET /api/public/plans - Récupérer les plans tarifaires publics
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.select({
      id: plansAbonnement.id,
      nom: plansAbonnement.nom,
      prix: plansAbonnement.prix,
      devise: plansAbonnement.devise,
      periode: plansAbonnement.periode,
      limiteUtilisateurs: plansAbonnement.limiteUtilisateurs,
      limiteEntreprises: plansAbonnement.limiteEntreprises,
      stockageGb: plansAbonnement.stockageGb,
      descriptionFeatures: plansAbonnement.descriptionFeatures
    })
    .from(plansAbonnement)
    .where(eq(plansAbonnement.actif, true))
    .orderBy(plansAbonnement.prix);

    res.json(plans);
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/public/inscription - Inscription publique
router.post('/inscription', async (req, res) => {
  try {
    const { 
      nomEntreprise, 
      email, 
      telephone, 
      pays,
      planId,
      dureeEnMois,
      methodePaiement // fedapay, stripe, paypal
    } = req.body;

    // Validation
    if (!nomEntreprise || !email || !planId || !dureeEnMois) {
      return res.status(400).json({ 
        error: 'Informations manquantes. Veuillez remplir tous les champs requis.' 
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        error: 'Cet email est déjà utilisé. Veuillez utiliser un autre email.' 
      });
    }

    // Récupérer le plan
    const [plan] = await db.select()
      .from(plansAbonnement)
      .where(eq(plansAbonnement.id, parseInt(planId)))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: 'Plan non trouvé' });
    }

    // Calculer le montant total
    const montantTotal = parseFloat(plan.prix) * parseInt(dureeEnMois);

    // Créer une transaction en attente
    const inscriptionData = {
      nomEntreprise,
      email: email.toLowerCase(),
      telephone,
      pays,
      planId: parseInt(planId),
      dureeEnMois: parseInt(dureeEnMois),
      montantTotal,
      methodePaiement,
      statut: 'en_attente_paiement'
    };

    // Créer la transaction de paiement selon la méthode choisie
    let paymentUrl = null;
    let transactionId = null;

    if (methodePaiement === 'fedapay') {
      // Créer transaction FedaPay
      if (!FEDAPAY_SECRET_KEY) {
        return res.status(500).json({ 
          error: 'FedaPay n\'est pas configuré. Veuillez contacter l\'administrateur.' 
        });
      }

      try {
        const transaction = await FedaPay.Transaction.create({
          description: `ComptaOrion - ${plan.nom} (${dureeEnMois} mois)`,
          amount: montantTotal,
          currency: { iso: plan.devise || 'XOF' },
          callback_url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/public/webhook/fedapay`,
          customer: {
            firstname: nomEntreprise.split(' ')[0] || 'Client',
            lastname: nomEntreprise.split(' ').slice(1).join(' ') || 'ComptaOrion',
            email: email,
            phone_number: telephone ? {
              number: telephone,
              country: (pays || 'bj').toLowerCase().substring(0, 2)
            } : undefined
          },
          custom_metadata: inscriptionData
        });

        const token = await transaction.generateToken();
        paymentUrl = token.url;
        transactionId = transaction.id;

      } catch (fedapayError) {
        console.error('Erreur FedaPay:', fedapayError);
        return res.status(500).json({ 
          error: 'Erreur lors de la création de la transaction FedaPay: ' + fedapayError.message 
        });
      }
    } else if (methodePaiement === 'stripe') {
      // TODO: Implémenter Stripe
      return res.status(501).json({ error: 'Stripe sera bientôt disponible' });
    } else if (methodePaiement === 'paypal') {
      // TODO: Implémenter PayPal
      return res.status(501).json({ error: 'PayPal sera bientôt disponible' });
    } else {
      return res.status(400).json({ error: 'Méthode de paiement non supportée' });
    }

    res.json({
      success: true,
      message: 'Inscription initiée. Veuillez procéder au paiement.',
      paymentUrl,
      transactionId,
      montantTotal,
      devise: plan.devise || 'XOF'
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/public/webhook/fedapay - Webhook FedaPay
router.post('/webhook/fedapay', async (req, res) => {
  try {
    const { transaction_id, status } = req.body;

    console.log('Webhook FedaPay reçu:', { transaction_id, status });

    if (status === 'approved') {
      // Récupérer les détails de la transaction
      const transaction = await FedaPay.Transaction.retrieve(transaction_id);
      const metadata = transaction.custom_metadata;

      if (!metadata || !metadata.email) {
        console.error('Métadonnées manquantes dans la transaction');
        return res.status(400).json({ error: 'Métadonnées manquantes' });
      }

      // Créer l'entreprise
      const [newEntreprise] = await db.insert(entreprises).values({
        nom: metadata.nomEntreprise,
        email: metadata.email,
        telephone: metadata.telephone,
        pays: metadata.pays || 'Bénin',
        devise: 'XOF',
        systemeComptable: 'SYSCOHADA'
      }).returning();

      // Générer un mot de passe temporaire
      const motDePasseTemporaire = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(motDePasseTemporaire, 10);

      // Créer l'utilisateur admin
      const [newUser] = await db.insert(users).values({
        nom: metadata.nomEntreprise,
        email: metadata.email,
        password: hashedPassword,
        entrepriseId: newEntreprise.id,
        role: 'admin',
        actif: true
      }).returning();

      // Créer le client SaaS (source: web, pas de commercial)
      const [clientSaas] = await db.insert(saasClients).values({
        entrepriseId: newEntreprise.id,
        commercialId: null, // Pas de commercial pour inscription web
        statut: 'actif', // Directement actif après paiement
        source: 'web',
        notes: `Inscription web - Paiement FedaPay ${transaction_id}`
      }).returning();

      // Créer l'abonnement
      const dateDebut = new Date();
      const dateExpiration = new Date(dateDebut);
      dateExpiration.setMonth(dateExpiration.getMonth() + parseInt(metadata.dureeEnMois));

      const [abonnement] = await db.insert(abonnements).values({
        entrepriseId: newEntreprise.id,
        planId: parseInt(metadata.planId),
        statut: 'actif',
        dateDebut,
        dateExpiration,
        prochainRenouvellement: dateExpiration,
        montantMensuel: metadata.montantTotal / metadata.dureeEnMois
      }).returning();

      // Créer la vente (sans commercial, source: web)
      await db.insert(saasVentes).values({
        commercialId: null, // Pas de commercial
        clientId: clientSaas.id,
        abonnementId: abonnement.id,
        montantVente: metadata.montantTotal,
        commission: 0, // Pas de commission pour vente web
        statut: 'confirmée',
        source: 'web',
        notes: `Vente web automatique - FedaPay ${transaction_id}`
      });

      console.log(`✅ Inscription complétée pour ${metadata.email}`);

      // TODO: Envoyer email avec identifiants
      // sendWelcomeEmail(metadata.email, motDePasseTemporaire, newEntreprise.nom);

      res.json({ success: true, message: 'Inscription complétée avec succès' });
    } else {
      console.log(`⚠️ Paiement non approuvé: ${status}`);
      res.json({ success: false, message: 'Paiement non approuvé' });
    }

  } catch (error) {
    console.error('Erreur webhook FedaPay:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
