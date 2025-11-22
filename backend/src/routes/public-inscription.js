import express from 'express';
import { db } from '../db.js';
import { entreprises, users, plansAbonnement, abonnements, saasClients, saasVentes, inscriptionsEnAttente } from '../schema.js';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const fedapayModule = require('fedapay');
const FedaPay = fedapayModule.FedaPay;
const Transaction = fedapayModule.Transaction;

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

    // Vérifier si l'utilisateur existe déjà pour déterminer le type d'inscription
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    const typeInscription = existingUser.length > 0 ? 'renouvellement' : 'nouveau';
    const entrepriseIdPourRenouvellement = existingUser.length > 0 ? existingUser[0].entrepriseId : null;

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
        const transaction = await Transaction.create({
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
        
        // Persister l'inscription en attente avec le transaction_id
        await db.insert(inscriptionsEnAttente).values({
          transactionId: transaction.id,
          email: email.toLowerCase(),
          nomEntreprise,
          telephone,
          pays,
          planId: parseInt(planId),
          dureeEnMois: parseInt(dureeEnMois),
          montantTotal,
          methodePaiement,
          typeInscription,
          entrepriseIdPourRenouvellement
        });

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

// Fonction de vérification de signature HMAC FedaPay
function verifyFedaPaySignature(signatureHeader, payload, secret) {
  if (!signatureHeader) {
    return false;
  }

  try {
    // Parse signature header: t=timestamp,v1=signature
    const sigParts = {};
    signatureHeader.split(',').forEach(item => {
      const [key, value] = item.split('=');
      sigParts[key] = value;
    });

    const timestamp = sigParts.t;
    const signature = sigParts.v1;

    if (!timestamp || !signature) {
      return false;
    }

    // Vérifier timestamp (prévenir les attaques par rejeu - tolérance 5 minutes)
    const TOLERANCE = 300; // 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > TOLERANCE) {
      console.log('⚠️ Timestamp trop ancien - possible attaque par rejeu');
      return false;
    }

    // Calculer la signature attendue
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    // Comparaison sécurisée contre les attaques temporelles
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Erreur vérification signature:', error);
    return false;
  }
}

// POST /api/public/webhook/fedapay - Webhook FedaPay
router.post('/webhook/fedapay', async (req, res) => {
  try {
    const { transaction_id, status } = req.body;

    console.log('Webhook FedaPay reçu:', { transaction_id, status });

    // SÉCURITÉ : Vérifier que la requête vient bien de FedaPay
    if (!FEDAPAY_SECRET_KEY) {
      console.error('FedaPay non configuré - webhook rejeté');
      return res.status(500).json({ error: 'FedaPay non configuré' });
    }

    // Vérifier la signature HMAC du webhook (protection contre falsification)
    const signatureHeader = req.headers['x-fedapay-signature'];
    
    // Vérification stricte : req.rawBody DOIT être défini
    if (!req.rawBody) {
      console.error('❌ rawBody manquant - webhook rejeté (middleware non configuré correctement)');
      return res.status(500).json({ error: 'Configuration serveur invalide' });
    }
    
    if (!verifyFedaPaySignature(signatureHeader, req.rawBody, FEDAPAY_SECRET_KEY)) {
      console.error('❌ Signature FedaPay invalide - webhook rejeté');
      return res.status(403).json({ error: 'Signature invalide' });
    }

    console.log('✅ Signature FedaPay vérifiée');

    // Récupérer la transaction depuis FedaPay pour double vérification
    let transaction;
    try {
      transaction = await FedaPay.Transaction.retrieve(transaction_id);
    } catch (fedapayError) {
      console.error('Transaction FedaPay invalide:', fedapayError);
      return res.status(400).json({ error: 'Transaction invalide' });
    }

    // Vérifier que le statut correspond bien
    if (transaction.status !== status) {
      console.error('Statut webhook ne correspond pas à FedaPay');
      return res.status(400).json({ error: 'Statut incohérent' });
    }

    if (status === 'approved') {
      // Récupérer l'inscription en attente depuis la table
      const [inscriptionEnAttente] = await db.select()
        .from(inscriptionsEnAttente)
        .where(eq(inscriptionsEnAttente.transactionId, transaction_id))
        .limit(1);

      if (!inscriptionEnAttente) {
        console.error('Inscription en attente non trouvée pour transaction:', transaction_id);
        return res.status(400).json({ error: 'Inscription non trouvée' });
      }

      // Vérifier si c'est un doublon (déjà traité)
      if (inscriptionEnAttente.traitee) {
        console.log(`Transaction ${transaction_id} déjà traitée - webhook ignoré (idempotence)`);
        return res.json({ success: true, message: 'Transaction déjà traitée' });
      }

      // Utiliser typeInscription de la table au lieu de deviner
      const typeInscription = inscriptionEnAttente.typeInscription;

      if (typeInscription === 'renouvellement') {
        // C'est un renouvellement
        console.log(`Traitement renouvellement pour ${inscriptionEnAttente.email}`);
        
        // Vérifier que l'entrepriseId est présent
        if (!inscriptionEnAttente.entrepriseIdPourRenouvellement) {
          console.error('Entreprise ID manquant pour renouvellement - webhook rejeté');
          return res.status(400).json({ error: 'Entreprise invalide' });
        }
        
        // Récupérer l'entreprise
        const entreprise = await db.select()
          .from(entreprises)
          .where(eq(entreprises.id, inscriptionEnAttente.entrepriseIdPourRenouvellement))
          .limit(1);
        
        if (entreprise.length === 0) {
          console.error('Entreprise non trouvée - webhook rejeté');
          return res.status(400).json({ error: 'Entreprise introuvable' });
        }

        const clientSaas = await db.select()
          .from(saasClients)
          .where(eq(saasClients.entrepriseId, entreprise[0].id))
          .limit(1);

        // Créer nouvel abonnement (renouvellement)
        const dateDebut = new Date();
        const dateExpiration = new Date(dateDebut);
        dateExpiration.setMonth(dateExpiration.getMonth() + inscriptionEnAttente.dureeEnMois);

        const [abonnement] = await db.insert(abonnements).values({
          entrepriseId: entreprise[0].id,
          planId: inscriptionEnAttente.planId,
          statut: 'actif',
          dateDebut,
          dateExpiration,
          prochainRenouvellement: dateExpiration,
          montantMensuel: inscriptionEnAttente.montantTotal / inscriptionEnAttente.dureeEnMois
        }).returning();

        // Créer la vente de renouvellement
        await db.insert(saasVentes).values({
          commercialId: null,
          clientId: clientSaas[0].id,
          abonnementId: abonnement.id,
          montantVente: inscriptionEnAttente.montantTotal.toString(),
          commission: 0,
          statut: 'confirmée',
          source: 'web',
          notes: `Renouvellement web - FedaPay ${transaction_id}`
        });
        
        // Marquer comme traitée
        await db.update(inscriptionsEnAttente)
          .set({ traitee: true })
          .where(eq(inscriptionsEnAttente.id, inscriptionEnAttente.id));

        console.log(`✅ Renouvellement complété pour ${inscriptionEnAttente.email}`);
        return res.json({ success: true, message: 'Renouvellement complété avec succès' });
      }

      // Nouveau client - Créer l'entreprise
      console.log(`Traitement nouveau client pour ${inscriptionEnAttente.email}`);
      
      const [newEntreprise] = await db.insert(entreprises).values({
        nom: inscriptionEnAttente.nomEntreprise,
        email: inscriptionEnAttente.email,
        telephone: inscriptionEnAttente.telephone,
        pays: inscriptionEnAttente.pays || 'Bénin',
        devise: 'XOF',
        systemeComptable: 'SYSCOHADA'
      }).returning();

      // Générer un mot de passe temporaire
      const motDePasseTemporaire = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(motDePasseTemporaire, 10);

      // Créer l'utilisateur admin
      const [newUser] = await db.insert(users).values({
        nom: inscriptionEnAttente.nomEntreprise,
        email: inscriptionEnAttente.email,
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
      dateExpiration.setMonth(dateExpiration.getMonth() + inscriptionEnAttente.dureeEnMois);

      const [abonnement] = await db.insert(abonnements).values({
        entrepriseId: newEntreprise.id,
        planId: inscriptionEnAttente.planId,
        statut: 'actif',
        dateDebut,
        dateExpiration,
        prochainRenouvellement: dateExpiration,
        montantMensuel: inscriptionEnAttente.montantTotal / inscriptionEnAttente.dureeEnMois
      }).returning();

      // Créer la vente (sans commercial, source: web)
      await db.insert(saasVentes).values({
        commercialId: null, // Pas de commercial
        clientId: clientSaas.id,
        abonnementId: abonnement.id,
        montantVente: inscriptionEnAttente.montantTotal.toString(),
        commission: 0, // Pas de commission pour vente web
        statut: 'confirmée',
        source: 'web',
        notes: `Inscription web - FedaPay ${transaction_id}`
      });
      
      // Marquer comme traitée
      await db.update(inscriptionsEnAttente)
        .set({ traitee: true })
        .where(eq(inscriptionsEnAttente.id, inscriptionEnAttente.id));

      console.log(`✅ Inscription complétée pour ${inscriptionEnAttente.email}`);

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
