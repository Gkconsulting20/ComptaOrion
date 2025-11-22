# ComptaOrion - Comptes de Test

## 🔐 Accès au Système

### Compte Administrateur Principal
- **Email:** `admin@comptaorion.com`
- **Mot de passe:** `Test123!`
- **ID Entreprise:** `1`
- **Rôle:** `admin`
- **Permissions:** Accès complet à tous les modules, y compris le module SaaS Admin
- **Utilisation:** Pour gérer le système, accéder aux rapports SaaS, gérer les clients commerciaux

---

### Comptes Utilisateurs de Test

#### 1. Comptable Principal
- **Email:** `comptable@test.com`
- **Mot de passe:** `Test123!`
- **ID Entreprise:** `1`
- **Rôle:** `comptable`
- **Permissions:** Accès complet aux modules comptabilité, trésorerie, clients, fournisseurs
- **Utilisation:** Pour tester les fonctionnalités comptables, saisie d'écritures, génération de rapports

#### 2. Commercial / Vendeur
- **Email:** `commercial@test.com`
- **Mot de passe:** `Test123!`
- **ID Entreprise:** `1`
- **Rôle:** `commercial`
- **Permissions:** Accès aux modules clients, factures, devis, bons de livraison
- **Utilisation:** Pour tester la création de devis, factures, suivi des clients

#### 3. Gestionnaire de Stock
- **Email:** `stock@test.com`
- **Mot de passe:** `Test123!`
- **ID Entreprise:** `1`
- **Rôle:** `gestionnaire_stock`
- **Permissions:** Accès aux modules stock, produits, mouvements de stock, inventaires
- **Utilisation:** Pour tester la gestion des produits, mouvements de stock, alertes de stock faible

#### 4. Trésorier
- **Email:** `tresorier@test.com`
- **Mot de passe:** `Test123!`
- **ID Entreprise:** `1`
- **Rôle:** `tresorier`
- **Permissions:** Accès aux modules trésorerie, banque, paiements, prévisions
- **Utilisation:** Pour tester les encaissements, décaissements, prévisions de trésorerie

---

## 🏢 Entreprises de Test

### Entreprise 1 - Société Demo
- **ID:** `1`
- **Nom:** Société Demo (à configurer lors de la première connexion)
- **Pays:** Configurable (Côte d'Ivoire, Sénégal, Mali, etc.)
- **Devise:** Configurable (XOF, XAF, MAD, etc.)
- **Système Comptable:** SYSCOHADA / IFRS / PCG

---

## 📊 Données de Test Recommandées

### Clients à Créer
1. **SARL TechAfrica**
   - Type: Entreprise
   - Email: contact@techafrica.com
   - Téléphone: +225 07 XX XX XX XX
   - Pays: Côte d'Ivoire
   - Délai de paiement: 30 jours

2. **M. Kouadio Jean**
   - Type: Particulier
   - Email: kouadio@email.com
   - Téléphone: +225 05 XX XX XX XX
   - Pays: Côte d'Ivoire
   - Délai de paiement: 15 jours

3. **SA Distribution Plus**
   - Type: Entreprise
   - Email: info@distplus.com
   - Téléphone: +221 77 XXX XX XX
   - Pays: Sénégal
   - Délai de paiement: 60 jours

### Fournisseurs à Créer
1. **Société Import Export**
   - Email: contact@importexport.com
   - Pays: France
   - Conditions de paiement: 30 jours fin de mois

2. **Fournisseur Local SARL**
   - Email: local@fournisseur.ci
   - Pays: Côte d'Ivoire
   - Conditions de paiement: 15 jours net

### Produits/Services à Créer
1. **Consultation IT** (Service)
   - Prix: 50,000 FCFA
   - TVA: 18%
   - Catégorie: Services

2. **Ordinateur Portable** (Produit)
   - Prix: 350,000 FCFA
   - Stock: 10 unités
   - Stock minimum: 2
   - TVA: 18%

3. **Formation Entreprise** (Service)
   - Prix: 200,000 FCFA
   - TVA: 18%
   - Catégorie: Formation

---

## 🧪 Scénarios de Test Recommandés

### Test 1: Cycle de Vente Complet
1. Connexion avec `commercial@test.com`
2. Créer un devis pour un client
3. Convertir le devis en facture
4. Générer un bon de livraison
5. Envoyer la facture par email
6. Enregistrer un paiement partiel
7. Enregistrer le solde restant

### Test 2: Gestion de Stock
1. Connexion avec `stock@test.com`
2. Créer des produits
3. Enregistrer un mouvement d'entrée de stock
4. Créer une sortie de stock
5. Vérifier les alertes de stock faible
6. Consulter l'historique des mouvements

### Test 3: Comptabilité et Rapports
1. Connexion avec `comptable@test.com`
2. Créer le plan comptable (SYSCOHADA)
3. Créer des comptes comptables
4. Saisir des écritures manuelles
5. Consulter le grand livre
6. Générer la balance générale
7. Consulter les rapports financiers

### Test 4: Trésorerie et Prévisions
1. Connexion avec `tresorier@test.com`
2. Créer des comptes bancaires
3. Enregistrer des encaissements
4. Enregistrer des décaissements
5. Consulter les prévisions de trésorerie (7/30/90 jours)
6. Analyser le cashflow

### Test 5: Module SaaS Admin (Admin uniquement)
1. Connexion avec `admin@comptaorion.com`
2. Créer des commerciaux
3. Ajouter des clients prospects
4. Gérer les abonnements
5. Consulter les statistiques MRR
6. Générer des factures d'abonnement

---

## 🔧 Configuration Initiale Recommandée

1. **Première connexion :**
   - Se connecter avec `admin@comptaorion.com`
   - Compléter les informations de l'entreprise
   - Configurer le logo et les couleurs de marque
   - Paramétrer le système comptable (SYSCOHADA recommandé)

2. **Configuration Comptable :**
   - Importer ou créer le plan comptable
   - Configurer les journaux (Ventes, Achats, Banque, OD)
   - Créer les comptes bancaires
   - Paramétrer les taux de TVA

3. **Configuration Email (si disponible) :**
   - Ajouter la clé API SendGrid dans les secrets
   - Tester l'envoi d'une facture par email
   - Configurer les templates d'email

---

## 📱 Test de Responsiveness Mobile

Pour tester sur mobile :
1. Ouvrir le navigateur en mode développeur (F12)
2. Activer le mode responsive (Ctrl+Shift+M)
3. Sélectionner un appareil mobile (iPhone, Samsung Galaxy, etc.)
4. Vérifier que :
   - Le menu sidebar se transforme en menu hamburger
   - Les tableaux sont scrollables horizontalement
   - Les formulaires sont utilisables
   - Les boutons sont accessibles
   - Le texte est lisible

---

## ⚠️ Notes Importantes

- **Tous les mots de passe de test sont:** `Test123!`
- **Ces comptes sont pour tests uniquement** - Ne pas utiliser en production
- **Les données peuvent être réinitialisées** lors des mises à jour du système
- **Pour production:** Créer de nouveaux comptes avec des mots de passe sécurisés
- **RBAC activé:** Chaque utilisateur a accès uniquement aux modules autorisés pour son rôle

---

## 🔐 Secrets Requis pour Fonctionnalités Avancées

### Email Automation (SendGrid)
- **Secret:** `SENDGRID_API_KEY`
- **Utilisation:** Envoi automatique de factures, devis, états de compte par email
- **Configuration:** Via l'interface Replit Secrets ou variables d'environnement

### OpenAI Assistant (Optionnel)
- **Secret:** Géré automatiquement par Replit Integration
- **Utilisation:** Assistant IA pour suggestions et analyses
- **Configuration:** Automatique via intégration Replit

---

**Dernière mise à jour:** Novembre 2025  
**Version:** 1.0  
**Support:** Pour toute question, consulter la documentation technique dans `replit.md`
