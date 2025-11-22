# Guide de Configuration FedaPay pour ComptaOrion

## 📋 Présentation

ComptaOrion supporte maintenant un **système hybride de ventes** :
- **Ventes Commerciaux** : Les commerciaux prospectent et créent des abonnements clients
- **Ventes Web** : Les clients s'inscrivent et paient directement en ligne via **FedaPay**

FedaPay permet aux clients africains de payer avec :
- 📱 Mobile Money (MTN, Moov, Orange Money)
- 💳 Cartes bancaires locales et internationales
- 🌍 Couvre 8+ pays d'Afrique de l'Ouest

---

## 🚀 Configuration Étape par Étape

### 1. Créer un Compte FedaPay

1. Allez sur **https://dashboard.fedapay.com**
2. Cliquez sur "S'inscrire" et créez votre compte
3. Remplissez les informations de votre entreprise
4. Vérifiez votre email

### 2. Obtenir les Clés API

1. Connectez-vous à votre tableau de bord FedaPay
2. Allez dans **Paramètres** → **API Keys**
3. Vous verrez deux types de clés :
   - **Clés Sandbox** (pour les tests) :
     - `FEDAPAY_SECRET_KEY_SANDBOX`
     - `FEDAPAY_PUBLIC_KEY_SANDBOX`
   - **Clés Live** (pour la production) :
     - `FEDAPAY_SECRET_KEY_LIVE`
     - `FEDAPAY_PUBLIC_KEY_LIVE`

### 3. Configurer ComptaOrion

#### Option A : Via l'interface Replit (Recommandé)

1. Dans votre projet Replit, cliquez sur **Secrets** (icône 🔒)
2. Ajoutez les variables d'environnement suivantes :

```
FEDAPAY_SECRET_KEY=votre_cle_secrete_sandbox_ou_live
FEDAPAY_PUBLIC_KEY=votre_cle_publique_sandbox_ou_live
FEDAPAY_ENVIRONMENT=sandbox
```

3. Pour passer en production, changez :
```
FEDAPAY_ENVIRONMENT=live
```

#### Option B : Via fichier .env (Développement local)

Créez un fichier `.env` dans le dossier `backend/` :

```bash
# FedaPay Configuration
FEDAPAY_SECRET_KEY=votre_cle_secrete
FEDAPAY_PUBLIC_KEY=votre_cle_publique
FEDAPAY_ENVIRONMENT=sandbox  # ou 'live' pour la production

# Backend URL (pour les callbacks)
BACKEND_URL=https://votre-domaine-replit.com
```

### 4. Tester l'Inscription

#### Mode Sandbox (Tests)

1. Accédez à `https://votre-app.com/inscription`
2. Remplissez le formulaire d'inscription
3. Choisissez un plan
4. Cliquez sur "Procéder au Paiement"
5. Vous serez redirigé vers FedaPay
6. Utilisez les **numéros de test** fournis par FedaPay pour simuler un paiement :
   - Mobile Money : `+22997000001`
   - Carte : `4242 4242 4242 4242`

#### Mode Live (Production)

1. Changez `FEDAPAY_ENVIRONMENT=live`
2. Redémarrez votre application
3. Les vrais paiements seront traités

---

## 🔄 Flux d'Inscription Automatique

Voici ce qui se passe lorsqu'un client s'inscrit en ligne :

```
1. Client remplit le formulaire → /inscription
2. Client choisit son plan et paie via FedaPay
3. ✅ Paiement confirmé → Webhook activé
4. Système crée automatiquement :
   ├─ Entreprise (organisation du client)
   ├─ Utilisateur admin (avec mot de passe temporaire)
   ├─ Client SaaS (statut: actif, source: web)
   ├─ Abonnement (actif pour la durée choisie)
   └─ Vente (commission: 0, source: web)
5. 📧 Email envoyé avec identifiants (TODO: À activer avec SendGrid)
```

---

## 📊 Suivi des Ventes dans Admin SaaS

Dans le module **Admin SaaS** → **Ventes**, vous verrez :

- **Ventes Commerciaux** : Ventes réalisées par vos commerciaux (avec commission)
- **Ventes Web** : Inscriptions directes en ligne (sans commission)

Vous pouvez filtrer par type pour voir :
- Le nombre de ventes par canal
- Le montant total par canal
- Les commissions à payer aux commerciaux

---

## 🔍 Vérification et Dépannage

### Vérifier que FedaPay est bien configuré

Exécutez cette commande dans le backend :

```bash
node -e "console.log(process.env.FEDAPAY_SECRET_KEY ? '✅ Configuré' : '❌ Non configuré')"
```

### Tester l'endpoint d'inscription

```bash
curl -X POST https://votre-app.com/api/public/inscription \
  -H "Content-Type: application/json" \
  -d '{
    "nomEntreprise": "Test Entreprise",
    "email": "test@test.com",
    "telephone": "+22997000000",
    "pays": "Bénin",
    "planId": "2",
    "dureeEnMois": "12",
    "methodePaiement": "fedapay"
  }'
```

Réponse attendue :
```json
{
  "success": true,
  "paymentUrl": "https://checkout.fedapay.com/...",
  "montantTotal": 358800,
  "devise": "XOF"
}
```

### Problèmes courants

**❌ "FedaPay n'est pas configuré"**
- Vérifiez que `FEDAPAY_SECRET_KEY` est bien défini dans les secrets
- Redémarrez l'application après avoir ajouté les clés

**❌ "Transaction failed"**
- Vérifiez que vous êtes en mode `sandbox` pour les tests
- Utilisez les numéros de test fournis par FedaPay
- Vérifiez les logs FedaPay : https://dashboard.fedapay.com/transactions

**❌ Le webhook ne fonctionne pas**
- Vérifiez que `BACKEND_URL` pointe vers votre domaine public
- Sur Replit, utilisez : `https://votre-projet.replit.app`
- Vérifiez dans FedaPay Dashboard que le webhook est bien appelé

---

## 💡 Conseils de Production

### Sécurité

1. **Ne jamais exposer** les clés secrètes dans le code
2. Utilisez toujours les **Secrets** de Replit pour stocker les clés
3. Activez la **validation de signature** dans FedaPay pour sécuriser les webhooks

### Performance

1. Activez les **emails automatiques** via SendGrid pour envoyer les identifiants
2. Configurez des **alertes** pour surveiller les paiements échoués
3. Testez régulièrement le processus en mode sandbox

### Support Client

1. Préparez un email de bienvenue avec :
   - Lien de connexion
   - Identifiants temporaires
   - Guide de démarrage rapide
2. Configurez SendGrid pour l'envoi automatique (voir `GUIDE_EMAILS.md`)

---

## 📞 Support

- **Documentation FedaPay** : https://docs.fedapay.com
- **Dashboard FedaPay** : https://dashboard.fedapay.com
- **Support FedaPay** : support@fedapay.com

---

## ✅ Checklist de Mise en Production

- [ ] Compte FedaPay créé et vérifié
- [ ] Entreprise vérifiée sur FedaPay
- [ ] Clés API Live obtenues
- [ ] Variables d'environnement configurées en mode `live`
- [ ] Tests effectués en mode sandbox
- [ ] URL de callback correctement configurée
- [ ] Emails de bienvenue configurés (SendGrid)
- [ ] Page d'inscription testée de bout en bout
- [ ] Monitoring des transactions activé

---

🎉 **Votre système d'inscription en ligne est prêt !**

Les clients peuvent désormais s'abonner et payer directement via la page `/inscription`, tandis que vos commerciaux continuent de gérer les clients B2B avec leurs commissions.
