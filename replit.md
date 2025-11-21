# ComptaOrion - ERP Léger pour l'Afrique

## Overview
ComptaOrion is a comprehensive and lightweight ERP solution optimized for the African market. It provides a modern, responsive, and intuitive platform for managing accounting, inventory, customer/supplier relations, human resources, and more. Inspired by QuickBooks, it features a React frontend with an Express.js backend, supporting multi-country, multi-currency operations, and adhering to African accounting standards (SYSCOHADA).

Key capabilities include support for SYSCOHADA, IFRS, and PCG, multi-currency functionality (20+ currencies), multi-tenancy with isolation per `entrepriseId`, and a comprehensive Role-Based Access Control (RBAC) system. The project aims to be a production-ready solution with a complete audit trail and a robust REST API, addressing the market potential for tailored ERP solutions in Africa.

## User Preferences
- Approche directe et pragmatique
- Itération rapide avec visibilité sur les progrès
- Code lisible, maintenable et production-ready
- Confirmation demandée avant refactorings majeurs

## System Architecture

### Tech Stack
- **Backend:** Express.js 4 + Node.js 20
- **Frontend:** React 18 + Vite 5
- **Database:** PostgreSQL + Drizzle ORM
- **Authentication:** JWT + Refresh Tokens
- **AI:** OpenAI Integration

### Design Principles
- **UI/UX:** QuickBooks-inspired style (fixed Sidebar/Topbar, icons, 100% French localization).
- **Responsiveness:** Mobile-first, adaptive layouts.
- **Security:** Row-Level Security (RLS) by `entrepriseId`, modular RBAC, and a complete audit trail.
- **Multi-tenancy:** Complete isolation per `entrepriseId`.

### Core Features
ComptaOrion is built with a modular architecture comprising 18 modules organized into 8 domains:

1.  **Dashboard Global:** Real-time KPIs and system overview.
2.  **Customer & Sales Management:** CRUD for clients, quotes, sales invoices, and payments, with automatic accounting integration.
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices.
4.  **Stock & Inventory:** Multi-warehouse stock management with movement tracking and FIFO/CMP valorization.
5.  **Accounting & Compliance:** Complete accounting system including Chart of Accounts (SYSCOHADA/IFRS/PCG), Journals, Accounting Entries (debit/credit validation), General Ledger, Trial Balance, Fixed Assets management with automatic amortization, and Financial Reports (Balance Sheet, Income Statement, Cash Flow).
6.  **Treasury & Finance:** Bank balances, cash management, reconciliation, and expense management.
7.  **Configuration & Security:** Currency management, accounting system settings, country-specific parameters, authentication (JWT, RBAC), Row-Level Security (RLS), and a comprehensive audit log.
8.  **Intelligence & Assistance:** AI Assistant for intelligent Q&A and suggestions via OpenAI.
9.  **SaaS Administration:** Complete commercialization platform with sales team management, client tracking, subscription plans, invoicing, and revenue analytics (MRR tracking).

### Cross-Modular Functionalities
-   **Automated Accounting:** Transactions automatically generate accounting entries.
-   **Treasury Impact:** Payments and expenses update cash balances.
-   **Monthly Amortization:** Automated calculation and posting of fixed asset depreciation.
-   **Notifications:** Alerts for absences, birthdays, and contract expirations.
-   **Multi-Currency & Internationalization:** Supports over 20 currencies, 3 accounting systems (SYSCOHADA, IFRS, PCG), and custom country settings.
-   **Compliance & Audit:** Complete audit trail for all operations, SYSCOHADA compliance, and CSV/Excel export.

## External Dependencies

### Backend
-   Express.js 4
-   Drizzle ORM
-   bcrypt (password hashing)
-   jsonwebtoken (JWT)

### Frontend
-   React 18
-   Vite 5
-   Recharts (for KPI graphs)

### Database
-   PostgreSQL

### AI
-   OpenAI API

## Recent Changes (November 21, 2025)

### Logo d'Entreprise & Personnalisation des Factures (21 Nov 2025)
Ajout d'un système complet de gestion du logo et de personnalisation des factures:

**Fonctionnalités:**
- Upload de logo d'entreprise (JPEG, PNG, GIF, SVG, max 5MB)
- Prévisualisation et suppression du logo
- Personnalisation complète des factures:
  - Couleur principale (color picker)
  - Texte de pied de page personnalisé
  - Mentions légales
  - Toggle pour afficher/masquer le logo sur les factures

**Schéma Base de Données:**
- Champs ajoutés à la table `entreprises`:
  - `logo_url`: URL du logo uploadé
  - `facture_footer_text`: Texte personnalisé de pied de page
  - `facture_mentions_legales`: Mentions légales
  - `facture_couleur_principale`: Couleur principale (#HEX)
  - `facture_afficher_logo`: Booléen pour afficher/masquer le logo

**API Backend:**
- `POST /api/upload/logo`: Upload de logo (multipart/form-data)
- `DELETE /api/upload/logo`: Suppression du logo
- `PUT /api/parametres/entreprise`: Mise à jour des paramètres enrichie
- Serveur de fichiers statiques: `/uploads/logos/`

**Sécurité Multi-Tenant:**
- Authentification requise (JWT) pour toutes les routes d'upload
- Validation req.entrepriseId sur upload/delete
- Nommage des fichiers par entreprise: `entreprise-{id}-logo-{timestamp}.ext`
- Suppression automatique de l'ancien logo lors d'un nouveau upload
- Validation des types de fichiers (images uniquement)
- Limite de taille: 5MB par fichier
- Création automatique du dossier uploads si inexistant

**Interface Frontend:**
- Section "🎨 Personnalisation des Factures" dans Paramètres > Entreprise
- Upload avec drag & drop
- Prévisualisation du logo en temps réel
- Color picker pour la couleur principale
- Champs de texte pour footer et mentions légales
- Toggle checkbox pour activer/désactiver le logo

**Workflow:**
1. Aller dans Paramètres > Entreprise
2. Cliquer sur "Modifier"
3. Scroller vers la section "🎨 Personnalisation des Factures"
4. Uploader un logo et personnaliser les paramètres
5. Enregistrer

### Module Bons de Livraison - Delivery Notes System (21 Nov 2025)
Ajout d'un système complet de gestion des bons de livraison avec génération à partir des factures:

**Fonctionnalités:**
- Génération de bons de livraison à partir des factures validées
- CRUD complet (Créer, Lire, Modifier, Supprimer)
- Numérotation automatique (BL-000001, BL-000002, etc.)
- Liaison automatique avec factures, clients et produits
- Interface dédiée dans le module Clients

**Schéma Base de Données:**
- Tables `bons_livraison` et `bon_livraison_items` (déjà existantes)
- Utilisation complète de la structure existante

**API Backend:**
- `GET /api/bons-livraison`: Liste des bons de livraison
- `GET /api/bons-livraison/:id`: Détails d'un bon spécifique
- `POST /api/bons-livraison/generer-depuis-facture/:factureId`: Génération automatique depuis facture
- `POST /api/bons-livraison`: Création manuelle
- `PUT /api/bons-livraison/:id`: Modification
- `DELETE /api/bons-livraison/:id`: Suppression sécurisée

**Sécurité Multi-Tenant:**
- Toutes les routes utilisent `req.entrepriseId` du JWT
- Validation de propriété lors de la suppression (bon + items)
- Protection cross-tenant complète

**Interface Frontend:**
- Onglet "📦 Bons de Livraison" dans le module Clients
- Liste des bons avec client, date, articles
- Modal de génération depuis facture avec sélection dropdown
- Affichage des factures validées/en attente uniquement

**Workflow:**
1. Créer une facture et la valider
2. Aller dans l'onglet "Bons de Livraison"
3. Cliquer sur "+ Générer depuis Facture"
4. Sélectionner la facture
5. Le bon de livraison est généré automatiquement avec les articles de la facture

## Recent Changes (November 21, 2025)

### Module Prévisions de Trésorerie - Cash Flow Forecasting (21 Nov 2025)
Ajout d'un système complet de prévision de trésorerie avec calcul automatique des flux futurs:

**Fonctionnalités:**
- Prévisions sur périodes configurables: 7 jours, 30 jours, 90 jours
- Calcul automatique basé sur les factures clients (créances à recevoir) et fournisseurs (dettes à payer)
- Filtrage intelligent par date d'échéance pour des projections réalistes
- Projection hebdomadaire détaillée avec soldes prévisionnels
- Recalcul du solde actuel basé sur les transactions réelles (pas les soldes stockés)
- Affichage des factures en attente par catégorie (clients/fournisseurs)

**Interface:**
- Onglet "📈 Prévisions" dans le module Trésorerie
- 4 KPI cards: Solde Actuel, Créances à Recevoir, Dettes à Payer, Solde Prévu
- Tableau de projection par semaine avec encaissements/décaissements prévus
- Listes des factures clients et fournisseurs en attente de paiement
- Sélection rapide de période (boutons 7/30/90 jours)

**API Backend:**
- Endpoint `GET /api/tresorerie/previsions/:entrepriseId?periode=X`
- Filtrage des factures par dateEcheance dans la période demandée
- Exclusion des factures sans date d'échéance pour des prévisions précises
- Agrégation hebdomadaire basée sur les échéances réelles
- Calcul des encaissements et décaissements cumulés par semaine

**Limitations Actuelles:**
- Factures sans date d'échéance exclues des prévisions (recommandation: créer un bucket "À planifier" séparé)

### Module Paramètres de Trésorerie - Bank Account Management (21 Nov 2025)
Ajout d'un onglet "Paramètres" dans le module Trésorerie pour gérer les comptes bancaires et leur liaison avec la comptabilité:

**Fonctionnalités:**
- CRUD complet pour les comptes bancaires (Créer, Modifier, Supprimer)
- Liaison avec les codes comptables de classe 5 (trésorerie)
- Support de 3 types de comptes: Banque, Caisse, Mobile Money
- Gestion du statut actif/inactif pour désactiver sans supprimer
- Protection contre la suppression de comptes avec transactions existantes
- Interface modale pour création et édition

**Schéma de Base de Données:**
- Ajout du champ `compte_comptable_id` dans la table `comptes_bancaires`
- Relation foreign key vers `comptes_comptables` (classe 5)

**API Backend:**
- `POST /api/tresorerie/comptes/create`: Création d'un compte bancaire avec validation de propriété du code comptable
- `PUT /api/tresorerie/comptes/:id`: Modification avec vérification multi-tenant (req.entrepriseId)
- `DELETE /api/tresorerie/comptes/:id`: Suppression avec protection contre comptes ayant des transactions
- `GET /api/tresorerie/comptes-comptables`: Liste des codes comptables classe 5 pour sélection

**Sécurité Multi-Tenant:**
- Toutes les routes utilisent `req.entrepriseId` extrait du JWT (pas d'entrepriseId dans l'URL)
- Validation de propriété du code comptable lors de la création et modification
- Filtre WHERE par entrepriseId sur toutes les opérations CRUD
- Protection contre l'accès/modification cross-tenant

**Interface Frontend:**
- Onglet "⚙️ Paramètres" avec tableau de gestion des comptes
- Formulaire modal avec sélection du compte comptable (dropdown classe 5)
- Champs: Nom, Numéro de compte, Banque, Type, Compte comptable, Solde initial
- Boutons Modifier/Supprimer par compte avec confirmations
- Affichage du statut (Actif/Inactif) et du type avec badges colorés

### SaaS Admin Module - Commercialization Platform
Created a complete SaaS administration module for managing ComptaOrion's commercialization:

**Database Schema:**
- `saas_commerciaux`: Sales team with commission tracking, regional assignment, and monthly targets
- `saas_clients`: Client organizations using ComptaOrion (extends entreprises table)
- `saas_ventes`: Sales tracking with automatic commission calculation
- `plans_abonnement`: Subscription plans with feature limits and pricing
- `abonnements`: Active subscriptions with renewal tracking
- `factures_abonnement`: Invoice history and payment tracking

**Backend API (`/api/saas-admin`):**
- Dashboard: Real-time KPIs (MRR, total clients, active/trial counts, commissions)
- Commerciaux: CRUD operations for sales team management
- Clients: Client tracking with commercial assignment and subscription status
- Plans: Subscription plan management with feature toggles
- Ventes: Sales history and commission tracking
- Reports: Commercial performance analytics

**Frontend Interface:**
- 5-tab interface: Dashboard, Clients SaaS, Commerciaux, Plans Tarifaires, Ventes
- Real-time KPI cards with color-coded metrics
- Complete CRUD forms with modal dialogs
- Professional table layouts with status badges
- Plan cards with pricing and feature display

**Features:**
- Multi-currency support (XOF, EUR, USD)
- Commission-based sales tracking (default 10%)
- MRR (Monthly Recurring Revenue) calculation
- Trial/Active/Suspended/Inactive status management
- Regional sales team assignment
- Complete sales funnel analytics

**Security & RBAC:**
- Routes protégées par JWT + vérification de rôle admin (`saasAdminOnly` middleware)
- Données globales (non isolées par entrepriseId) accessibles uniquement aux super-admins
- Middleware RBAC empêche l'accès aux utilisateurs standards
- Requêtes dashboard optimisées avec CTEs pour éviter la multiplication de lignes et garantir l'exactitude des KPIs