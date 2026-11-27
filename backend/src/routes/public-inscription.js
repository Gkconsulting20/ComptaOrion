import express from 'express';
import { db } from '../db.js';
import { withTenantTransaction } from '../utils/rlsPolicies.js';
import { entreprises, users, plansAbonnement, abonnements, saasClients, saasVentes, saasCommerciaux, inscriptionsEnAttente } from '../schema.js';
import { and, eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import fedapayModule from 'fedapay';
import crypto from 'crypto';
import emailService from '../services/emailService.js';
import { initializeSyscohadaForEnterprise } from '../services/syscohadaService.js';
import { getTrialExpirationDate, TRIAL_SUBSCRIPTION_NOTE } from '../services/trialSubscription.js';
import { parseTauxTva } from '../utils/tauxTva.js';

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
// FONCTION UTILITAIRE - EMAIL DE BIENVENUE
// ===========================================

/**
 * Envoie un email de bienvenue avec les identifiants de connexion
 */
async function envoyerEmailBienvenue(email, nomEntreprise, motDePasse, planId, entrepriseId) {
  // Récupérer les infos du plan
  const [plan] = await db.select()
    .from(plansAbonnement)
    .where(eq(plansAbonnement.id, planId))
    .limit(1);

  const nomPlan = plan ? plan.nom : 'Votre plan';

  // URL de l'application (à adapter selon votre domaine)
  const appUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL?.replace(':3000', ':5000') || 'https://votre-app.com';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">💼 Bienvenue sur ComptaOrion !</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Votre compte a été créé avec succès</p>
        </div>
        
        <div class="content">
          <h2 style="color: #667eea;">Bonjour ${nomEntreprise} ! 🎉</h2>
          
          <p>Félicitations ! Votre inscription à <strong>ComptaOrion</strong> est confirmée.</p>
          
          <p>Vous avez souscrit au plan <strong>${nomPlan}</strong> et pouvez dès maintenant accéder à votre espace de gestion.</p>
          
          <div class="credentials">
            <h3 style="margin-top: 0; color: #667eea;">🔐 Vos Identifiants de Connexion</h3>
            <p><strong>ID Entreprise :</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${entrepriseId}</code></p>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Mot de passe temporaire :</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 16px;">${motDePasse}</code></p>
          </div>
          
          <div class="warning">
            <p style="margin: 0;"><strong>⚠️ Important :</strong> Pour votre sécurité, veuillez changer ce mot de passe temporaire dès votre première connexion.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${appUrl}" class="button">🚀 Accéder à mon compte</a>
          </div>
          
          <h3 style="color: #667eea;">📚 Pour bien démarrer :</h3>
          <ul>
            <li>✅ Complétez les paramètres de votre entreprise</li>
            <li>✅ Configurez votre plan comptable (SYSCOHADA, IFRS, PCG)</li>
            <li>✅ Ajoutez vos premiers clients et fournisseurs</li>
            <li>✅ Créez votre première facture</li>
          </ul>
          
          <h3 style="color: #667eea;">💡 Besoin d'aide ?</h3>
          <p>Notre équipe support est là pour vous accompagner :</p>
          <ul>
            <li>📧 Email : admin@orionexa.com</li>
            <li>📞 Téléphone : 90 54 15 15</li>
            <li>📍 ORIONEXA — Agbodrafo, Togo</li>
            <li>💬 Chat en direct sur l'application</li>
          </ul>
          
          <div class="footer">
            <p><strong>ComptaOrion</strong> - L'ERP professionnel pour l'Afrique</p>
            <p>Cet email a été envoyé automatiquement suite à votre inscription.<br>
            Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce message.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Envoyer via SendGrid (sans historique car pas de entrepriseId/factureId disponibles ici)
  const sgMail = (await import('@sendgrid/mail')).default;
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ SendGrid non configuré - Email de bienvenue NON ENVOYÉ');
    console.warn(`🏢 Entreprise ID: ${entrepriseId}`);
    console.warn(`⚠️ IMPORTANT: Le client ne recevra PAS ses identifiants par email !`);
    // SÉCURITÉ: Ne jamais logger le mot de passe en clair
    // En production, SendGrid DOIT être configuré
    throw new Error('SENDGRID_API_KEY non configuré - impossible d\'envoyer l\'email de bienvenue');
  }

  sgMail.setApiKey(apiKey);
  
  const msg = {
    to: email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@comptaorion.com',
      name: process.env.SENDGRID_FROM_NAME || 'ComptaOrion',
    },
    subject: `🎉 Bienvenue sur ComptaOrion - Vos identifiants de connexion`,
    html,
  };

  await sgMail.send(msg);
  console.log('✅ Email de bienvenue envoyé');
}

// ===========================================
// ROUTES PUBLIQUES (sans authentification)
// ===========================================

// GET /api/public/commercial/:id - Récupérer les infos d'un commercial (pour lien parrainage)
router.get('/commercial/:id', async (req, res) => {
  try {
    const commercialId = parseInt(req.params.id);
    if (!commercialId || isNaN(commercialId)) {
      return res.status(400).json({ error: 'ID commercial invalide' });
    }

    const [commercial] = await db.select({
      id: saasCommerciaux.id,
      nom: saasCommerciaux.nom,
      prenom: saasCommerciaux.prenom,
      region: saasCommerciaux.region
    })
    .from(saasCommerciaux)
    .where(eq(saasCommerciaux.id, commercialId))
    .limit(1);

    if (!commercial || !commercial.id) {
      return res.status(404).json({ error: 'Commercial non trouvé' });
    }

    res.json(commercial);
  } catch (error) {
    console.error('Erreur récupération commercial:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/public/plans - Récupérer les plans tarifaires publics
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.select({
      id: plansAbonnement.id,
      nom: plansAbonnement.nom,
      prix: plansAbonnement.prix,
      devise: plansAbonnement.devise,
    })
    .from(plansAbonnement)
    .where(and(
      eq(plansAbonnement.actif, true),
      sql`${plansAbonnement.prix} = 0`,
    ))
    .orderBy(plansAbonnement.prix);

    res.json(plans.map(plan => ({
      ...plan,
      periode: '30 jours',
      descriptionFeatures: 'Essai de 30 jours dès la création de votre organisation, sans paiement.',
    })));
  } catch (error) {
    console.error('Erreur récupération plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/public/inscription - Inscription publique
router.post('/inscription', async (req, res) => {
  let entrepriseIdCreated = null;
  try {
    const {
      nomEntreprise,
      nomAdministrateur,
      email,
      telephone,
      pays,
      planId,
      motDePasse,
      confirmationMotDePasse,
      commercialId,
      tauxTva,
    } = req.body;

    // Taux de TVA choisi à l'inscription (18 % par défaut, 0 % exonéré,
    // ou taux personnalisé 0–100) : validé avant stockage, jamais inventé.
    let tauxTvaEntreprise;
    try {
      tauxTvaEntreprise = parseTauxTva(tauxTva);
    } catch (tauxError) {
      return res.status(400).json({ error: tauxError.message });
    }

    const normalizedName = typeof nomEntreprise === 'string' ? nomEntreprise.trim() : '';
    const normalizedAdminName = typeof nomAdministrateur === 'string' ? nomAdministrateur.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const parsedPlanId = Number(planId);
    if (
      normalizedName.length < 2 ||
      normalizedName.length > 255 ||
      normalizedAdminName.length < 2 ||
      normalizedAdminName.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      !Number.isSafeInteger(parsedPlanId) ||
      typeof motDePasse !== 'string' ||
      motDePasse.length < 8 ||
      Buffer.byteLength(motDePasse, 'utf8') > 72
    ) {
      return res.status(400).json({
        error: 'Vérifiez le nom de l’entreprise, le courriel et un mot de passe de 8 à 72 octets.',
      });
    }
    if (confirmationMotDePasse !== motDePasse) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' });
    }

    const [plan] = await db.select()
      .from(plansAbonnement)
      .where(and(
        eq(plansAbonnement.id, parsedPlanId),
        eq(plansAbonnement.actif, true),
        sql`${plansAbonnement.prix} = 0`,
      ))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: 'Le forfait gratuit de test est indisponible.' });
    }

    const [existingUser] = await db.select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    if (existingUser) {
      return res.status(409).json({
        error: 'Cette adresse courriel possède déjà un compte. Connectez-vous plutôt.',
      });
    }

    const referralId = Number(commercialId);
    const [commercial] = Number.isSafeInteger(referralId) && referralId > 0
      ? await db.select({ id: saasCommerciaux.id, nom: saasCommerciaux.nom, prenom: saasCommerciaux.prenom })
        .from(saasCommerciaux)
        .where(eq(saasCommerciaux.id, referralId))
        .limit(1)
      : [];

    const now = new Date();
    const trialExpiration = getTrialExpirationDate(now);
    // Année fiscale = année civile en cours (avant : défaut base 2025 → dashboard à 0)
    const fiscalYear = now.getFullYear();
    const debutAnneeFiscale = `${fiscalYear}-01-01`;
    const finAnneeFiscale = `${fiscalYear}-12-31`;
    const usernameStem = normalizedEmail.split('@')[0].replace(/[^a-z0-9]/g, '').slice(0, 24) || 'client';
    const username = `${usernameStem}_${crypto.randomBytes(5).toString('hex')}`;
    const passwordHash = await bcrypt.hash(motDePasse, 10);

    const [newEntreprise] = await db.insert(entreprises).values({
      nom: normalizedName,
      email: normalizedEmail,
      telephone: typeof telephone === 'string' ? telephone.trim() : null,
      pays: typeof pays === 'string' && pays.trim() ? pays.trim() : 'Togo',
      devise: 'XOF',
      tauxTva: tauxTvaEntreprise.toString(),
      systemeComptable: 'SYSCOHADA',
      debutAnneeFiscale,
      finAnneeFiscale,
      actif: true,
    }).returning();
    entrepriseIdCreated = newEntreprise.id;

    let newUser;
    let clientSaas;
    let abonnement;
    try {
      [newUser, clientSaas, abonnement] = await withTenantTransaction(newEntreprise.id, async () => {
        const [createdUser] = await db.insert(users).values({
          nom: normalizedAdminName,
          email: normalizedEmail,
          username,
          passwordHash,
          entrepriseId: newEntreprise.id,
          role: 'admin',
          actif: true,
        }).returning();

        const [createdClient] = await db.insert(saasClients).values({
          entrepriseId: newEntreprise.id,
          commercialId: commercial?.id || null,
          statut: 'actif',
          source: commercial ? 'commercial' : 'web',
          notes: `Essai gratuit de 30 jours${commercial ? ` - parrainage ${commercial.nom} ${commercial.prenom}` : ''}`,
        }).returning();

        const [createdSubscription] = await db.insert(abonnements).values({
          entrepriseId: newEntreprise.id,
          planId: plan.id,
          statut: 'actif',
          dateDebut: now,
          dateExpiration: trialExpiration,
          prochainRenouvellement: trialExpiration,
          montantMensuel: '0.00',
          modeRenouvellement: 'manuel',
          remarques: TRIAL_SUBSCRIPTION_NOTE,
          createdAt: now,
        }).returning();

        return [createdUser, createdClient, createdSubscription];
      });

      await withTenantTransaction(newEntreprise.id, () =>
        initializeSyscohadaForEnterprise(newEntreprise.id),
      );
    } catch (creationError) {
      try {
        await withTenantTransaction(newEntreprise.id, async () => {
          await db.delete(saasClients).where(eq(saasClients.entrepriseId, newEntreprise.id));
          await db.delete(abonnements).where(eq(abonnements.entrepriseId, newEntreprise.id));
          await db.delete(users).where(eq(users.entrepriseId, newEntreprise.id));
        });
        await db.delete(entreprises).where(eq(entreprises.id, newEntreprise.id));
      } catch (cleanupError) {
        console.error('Nettoyage incomplet après échec d’inscription:', cleanupError);
      }
      throw creationError;
    }

    res.status(201).json({
      success: true,
      message: 'Votre espace est créé. Connectez-vous avec votre courriel et le mot de passe choisi. Votre essai se termine le ' +
        trialExpiration.toISOString().slice(0, 10) + '.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        nom: newUser.nom,
        role: newUser.role,
        entrepriseId: newUser.entrepriseId,
      },
      entreprise: newEntreprise,
      clientSaas,
      abonnement,
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'Cette adresse courriel possède déjà un compte. Connectez-vous plutôt.',
      });
    }
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
        console.log('Traitement renouvellement en cours');
        
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

        console.log('✅ Renouvellement complété');
        return res.json({ success: true, message: 'Renouvellement complété avec succès' });
      }

      // Nouveau client - Créer l'entreprise
      console.log('Traitement nouveau client en cours');

      // Taux de TVA choisi à l'inscription payante (stocké dans
      // inscriptions_en_attente) ; absent ou invalide → 18 % par défaut.
      // Un taux invalide ne doit jamais faire échouer le webhook.
      let tauxTvaFedaPay = 18;
      try {
        tauxTvaFedaPay = parseTauxTva(inscriptionEnAttente.tauxTva);
      } catch (tauxError) {
        console.warn('Taux de TVA FedaPay invalide, 18 % appliqué:', tauxError.message);
      }

      // Année fiscale = année civile en cours (avant : défaut base 2025)
      const fiscalYearFedaPay = new Date().getFullYear();
      const [newEntreprise] = await db.insert(entreprises).values({
        nom: inscriptionEnAttente.nomEntreprise,
        email: inscriptionEnAttente.email,
        telephone: inscriptionEnAttente.telephone,
        pays: inscriptionEnAttente.pays || 'Togo',
        devise: 'XOF',
        tauxTva: tauxTvaFedaPay.toString(),
        systemeComptable: 'SYSCOHADA',
        debutAnneeFiscale: `${fiscalYearFedaPay}-01-01`,
        finAnneeFiscale: `${fiscalYearFedaPay}-12-31`
      }).returning();

      // Générer un mot de passe temporaire
      const motDePasseTemporaire = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(motDePasseTemporaire, 10);

      // Générer un username unique à partir de l'email
      const username = inscriptionEnAttente.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString(36);

      // Créer l'utilisateur admin
      const [newUser] = await db.insert(users).values({
        nom: inscriptionEnAttente.nomEntreprise,
        email: inscriptionEnAttente.email,
        username: username,
        passwordHash: hashedPassword,
        entrepriseId: newEntreprise.id,
        role: 'admin',
        actif: true
      }).returning();

      // Récupérer le commercial si un lien parrainage a été utilisé
      let commercialData = null;
      if (inscriptionEnAttente.commercialId) {
        const [commercial] = await db.select()
          .from(saasCommerciaux)
          .where(eq(saasCommerciaux.id, inscriptionEnAttente.commercialId))
          .limit(1);
        if (commercial) {
          commercialData = commercial;
          console.log(`📣 Inscription via parrainage commercial: ${commercial.nom} ${commercial.prenom}`);
        }
      }

      // Créer le client SaaS
      const [clientSaas] = await db.insert(saasClients).values({
        entrepriseId: newEntreprise.id,
        commercialId: commercialData ? commercialData.id : null,
        statut: 'actif',
        source: commercialData ? 'commercial' : 'web',
        notes: commercialData 
          ? `Inscription via lien parrainage ${commercialData.nom} ${commercialData.prenom} - FedaPay ${transaction_id}`
          : `Inscription web - Paiement FedaPay ${transaction_id}`
      }).returning();

      // Créer l'abonnement
      const dateDebut = new Date();
      const dateExpiration = new Date(dateDebut);
      dateExpiration.setMonth(dateExpiration.getMonth() + inscriptionEnAttente.dureeEnMois);

      const [abonnement] = await withTenantTransaction(newEntreprise.id, () =>
        db.insert(abonnements).values({
          entrepriseId: newEntreprise.id,
          planId: inscriptionEnAttente.planId,
          statut: 'actif',
          dateDebut,
          dateExpiration,
          prochainRenouvellement: dateExpiration,
          montantMensuel: inscriptionEnAttente.montantTotal / inscriptionEnAttente.dureeEnMois
        }).returning(),
      );

      // Calculer la commission si parrainage
      const commissionAmount = commercialData 
        ? parseFloat(inscriptionEnAttente.montantTotal) * parseFloat(commercialData.commission || 10) / 100
        : 0;

      // Créer la vente
      await db.insert(saasVentes).values({
        commercialId: commercialData ? commercialData.id : null,
        clientId: clientSaas.id,
        abonnementId: abonnement.id,
        montantVente: inscriptionEnAttente.montantTotal.toString(),
        commission: commissionAmount,
        statut: 'confirmée',
        source: commercialData ? 'commercial' : 'web',
        notes: commercialData 
          ? `Vente via lien parrainage ${commercialData.nom} ${commercialData.prenom} - FedaPay ${transaction_id}`
          : `Inscription web - FedaPay ${transaction_id}`
      });
      
      // Marquer comme traitée
      await db.update(inscriptionsEnAttente)
        .set({ traitee: true })
        .where(eq(inscriptionsEnAttente.id, inscriptionEnAttente.id));

      console.log('✅ Inscription complétée');

      // Envoyer email de bienvenue avec identifiants
      try {
        await envoyerEmailBienvenue(
          inscriptionEnAttente.email,
          inscriptionEnAttente.nomEntreprise,
          motDePasseTemporaire,
          inscriptionEnAttente.planId,
          newEntreprise.id // Ajouter l'ID de l'entreprise créée
        );
        console.log('✅ Email de bienvenue envoyé avec succès');
      } catch (emailError) {
        console.error('❌ ERREUR CRITIQUE: Impossible d\'envoyer l\'email de bienvenue:', emailError.message);
        console.error(`⚠️ Le client (ID ${newEntreprise.id}) n'a PAS reçu ses identifiants !`);
        // IMPORTANT: En production, ceci est un échec critique
        // L'inscription est créée mais le client ne peut pas se connecter
        // Action requise: Contactez manuellement le client ou réinitialisez son mot de passe
      }

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
