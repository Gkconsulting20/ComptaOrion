# ComptaOrion - ERP Léger pour l'Afrique

## Vue d'ensemble
ComptaOrion est un ERP (Enterprise Resource Planning) complet et léger, spécialement optimisé pour le marché africain. L'application combine une interface React moderne et responsive avec un backend Express.js robuste.

## Caractéristiques principales
- 💼 **Interface professionnelle** - Design moderne inspiré de QuickBooks
- 📱 **Responsive** - Sidebar adaptatif, optimisé desktop et mobile
- 🤖 **IA intégrée** - Assistant intelligent utilisant OpenAI (via Replit AI Integrations)
- 📊 **Tableaux de données** - Tables professionnelles pour tous les modules
- 💰 **Comptabilité complète** - États financiers, grand livre, réconciliation
- 🌍 **Multi-pays** - 20+ devises, SYSCOHADA/IFRS/PCG, support mondial
- 🇨🇮 **Optimisé Afrique** - FCFA, français, connexions limitées, SYSCOHADA

## Modules ERP
1. **Tableau de bord** 📊 - Vue d'ensemble avec métriques clés
2. **Gestion clients** 👥 - Fichier clients complet
3. **Gestion fournisseurs** 🏭 - Suivi des fournisseurs et dettes
4. **Gestion de trésorerie** 💳 - Encaissements, décaissements, solde
5. **Stock & Inventaire** 📦 - Gestion complète des stocks
6. **Comptabilité** 📚 - Module complet avec :
   - États financiers (Bilan, Compte de résultat, Flux de trésorerie)
   - Grand livre
   - Écriture de journal
   - Réconciliation bancaire
   - Charte de comptes
7. **Assistant IA** 🤖 - Aide intelligente et automatisation

## Structure du projet
```
├── backend/              # API Express.js
│   ├── src/
│   │   ├── app.js       # Configuration Express
│   │   └── main.js      # Point d'entrée serveur
│   └── package.json     # Dépendances backend
│
├── frontend/             # Interface React + Vite
│   ├── src/
│   │   ├── App.jsx      # Composant principal
│   │   ├── main.jsx     # Point d'entrée React
│   │   └── app.css      # Styles responsive
│   ├── index.html       # Page HTML
│   ├── vite.config.js   # Configuration Vite
│   └── package.json     # Dépendances frontend
│
└── start.sh             # Script de démarrage
```

## Stack technologique
- **Frontend**: React 18, Vite 5
- **Backend**: Express.js 4, Node.js 20
- **IA**: OpenAI via Replit AI Integrations
- **Styling**: CSS moderne avec design responsive
- **Langue**: Interface 100% français

## Architecture
- **Port Backend**: 3000 (127.0.0.1)
- **Port Frontend**: 5000 (0.0.0.0)
- **Proxy**: Vite redirige `/api/*` vers le backend
- **IA**: Variables d'environnement automatiques (AI_INTEGRATIONS_OPENAI_*)

## Optimisations pour l'Afrique
1. **Mobile-first** - Interface conçue d'abord pour mobile
2. **Responsive** - S'adapte à tous les écrans (smartphone → desktop)
3. **Navigation tactile** - Boutons larges, scroll horizontal optimisé
4. **Icônes visuelles** - Communication visuelle claire
5. **Prêt pour offline** - Architecture préparée pour mode hors ligne futur

## API Endpoints

### Général
- `GET /api/health` - Vérification système
- `GET /api` - Informations API

### Clients
- `GET /api/clients` - Liste des clients
- `POST /api/clients` - Créer un client

### Fournisseurs
- `GET /api/fournisseurs` - Liste des fournisseurs
- `POST /api/fournisseurs` - Créer un fournisseur

### Trésorerie
- `GET /api/tresorerie` - État de trésorerie
- `POST /api/tresorerie/transaction` - Nouvelle transaction

### Stock
- `GET /api/stock` - Inventaire
- `POST /api/stock` - Nouvel article

### Comptabilité
- `GET /api/comptabilite/etats-financiers` - États financiers
- `GET /api/comptabilite/grand-livre` - Grand livre
- `GET /api/comptabilite/journal` - Journal
- `POST /api/comptabilite/journal` - Nouvelle écriture
- `GET /api/comptabilite/reconciliation` - Réconciliation
- `GET /api/comptabilite/charte-comptes` - Charte de comptes
- `POST /api/comptabilite/charte-comptes` - Nouveau compte

### Assistant IA
- `GET /api/ia/chat` - État de l'assistant
- `POST /api/ia/chat` - Envoyer un message

### Paramètres & Configuration
- `GET /api/parametres/entreprise` - Paramètres de l'entreprise
- `PUT /api/parametres/entreprise` - Mise à jour paramètres entreprise
- `GET /api/parametres/devises` - Liste des devises supportées (20+)
- `GET /api/parametres/systemes-comptables` - Systèmes (SYSCOHADA, IFRS, PCG)
- `GET /api/parametres/taux-tva` - Taux TVA par pays
- `GET /api/parametres/pays` - Pays supportés avec configs

## Intégration IA
L'application utilise **Replit AI Integrations** pour l'accès à OpenAI :
- ✅ Pas besoin de clé API personnelle
- ✅ Configuration automatique
- ✅ Facturation via crédits Replit
- ✅ Modèles disponibles : GPT-4, GPT-4o, GPT-5, etc.

Variables d'environnement automatiques :
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`

## Développement
L'application démarre automatiquement via le workflow configuré :
```bash
bash start.sh
```

Cela lance :
1. Backend sur port 3000 (après 3 secondes d'attente)
2. Frontend sur port 5000 avec hot reload

## Déploiement
Configuré pour déploiement **autoscale** sur Replit :
- Démarre automatiquement avec `bash start.sh`
- S'adapte à la charge
- Prêt pour production

## Changements récents
- **2025-11-20** : Configuration initiale
  - Application full-stack Node.js avec React + Express
  - Configuration Vite avec proxy
  - Backend sur 127.0.0.1:3000 (compatibilité IPv4)
  - Workflow de démarrage automatique
  
- **2025-11-20** : Interface professionnelle QuickBooks-style
  - Refonte complète avec sidebar fixe + top bar
  - Design moderne avec couleurs professionnelles (gris foncé, bleu)
  - Navigation avec sous-menus pour Comptabilité
  - Nouveau slogan : "Gestion d'entreprise professionnelle"
  - Suppression module Factures
  - Ajout modules : Fournisseurs, Trésorerie
  - Module Comptabilité complet : États financiers, Grand livre, Journal, Réconciliation, Charte de comptes
  - Tables de données professionnelles
  - Métriques et KPI sur tableau de bord
  - Backend avec tous les endpoints nécessaires
  - Intégration OpenAI via Replit AI Integrations

## ✅ État actuel : Phase 2 EN COURS - Modules CRUD fonctionnels

### **Infrastructure complète** 
✅ Base de données PostgreSQL avec Drizzle ORM
✅ 40+ tables pour les 12 modules avec relations
✅ Authentification JWT sécurisée (register, login, refresh)
✅ Multi-entreprise avec isolation automatique (RLS)
✅ Middlewares de sécurité et d'isolation configurés
✅ Secrets JWT obligatoires (pas de fallback)

### **Interface professionnelle**
✅ Tous les modules ont des onglets (Liste + Paramètres)
✅ Formulaires CRUD professionnels complets
✅ Paramètres de configuration pour chaque module
✅ Design QuickBooks moderne et responsive

### **Modules CRUD fonctionnels**
✅ **Module Clients** - CRUD complet avec pagination et validation
✅ **Module Produits/Stock** - CRUD avec ajustements stock et alertes
✅ **Module Devis** - Création, numérotation auto (DEV-2025-0001), transformation en facture
✅ **Module Factures** - CRUD complet avec :
  - Transformation devis → facture
  - Numérotation automatique (FACT-2025-0001)
  - Calculs automatiques HT/TVA/TTC
  - Enregistrement paiements (mobile money, carte, virement, espèces)
  - Impact automatique sur trésorerie
✅ **Module Paramètres** - Configuration entreprise :
  - Gestion année fiscale
  - Choix système comptable (SYSCOHADA, IFRS, PCG)
  - Support multi-devises (20+ devises mondiales)
  - Support multi-pays (Afrique, Europe, Amérique, Asie)
  - Paramètres fiscaux (TVA par pays)

### 🌍 **Support International**
✅ **Multi-devises** : XOF, XAF, EUR, USD, GBP, MAD, TND, DZD, NGN, etc.
✅ **Systèmes comptables** : SYSCOHADA (Afrique OHADA), IFRS (International), PCG (France)
✅ **Multi-pays** : Configuration adaptée à chaque pays avec TVA et devises par défaut
✅ **Année fiscale flexible** : Configurable selon les normes locales

### ⚠️ **Prochaine étape : Phase 2 - Compléter modules restants**
**À implémenter** :
- Routes CRUD pour Fournisseurs, Employés, Trésorerie, Immobilisations
- Impact stock lors des ventes (déduction automatique)
- Impact comptable lors des transactions (écritures automatiques)
- Dashboard avec métriques calculées
- Factures récurrentes, PDF, envoi email

## Prochaines étapes prioritaires
1. **Connecter formulaires au backend** - Implémenter la logique CRUD pour sauvegarder/charger les données
2. **Ajouter base de données PostgreSQL** - Persistance des données (clients, fournisseurs, transactions, etc.)
3. **Gestion d'état** - Implémenter React state management pour les données
4. **Validation des formulaires** - Vérification des champs obligatoires et formats
5. **Implémenter l'assistant IA** - Connexion à OpenAI pour l'assistant intelligent
6. **Données de démonstration** - Seed data pour tester les fonctionnalités
7. **Filtres et recherche** - Ajouter recherche et tri dans les tableaux
8. **États financiers réels** - Calculs automatiques à partir des écritures
9. **Export PDF/Excel** - Génération de rapports exportables
10. **Support offline/PWA** - Mode hors ligne pour zones à faible connectivité
