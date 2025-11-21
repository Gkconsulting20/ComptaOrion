# ComptaOrion - ERP Léger pour l'Afrique

## 🎯 Overview
ComptaOrion est une solution ERP (Enterprise Resource Planning) complète et légère spécifiquement optimisée pour le marché africain. Elle offre une plateforme moderne, réactive et intuitive pour gérer tous les aspects d'une entreprise : comptabilité, inventaire, relations clients/fournisseurs, ressources humaines, et plus. Inspirée de QuickBooks, elle combine un frontend React moderne avec un backend Express.js robuste, avec support multi-pays, multi-devise, et standards comptables africains (SYSCOHADA).

**Objectifs clés:**
- ✅ Support SYSCOHADA, IFRS, PCG
- ✅ Multi-devise (20+ currencies)
- ✅ Multi-tenant avec isolation par entrepriseId
- ✅ RBAC complet (Admin, Manager, Comptable, Employé, Viewer)
- ✅ Authentification JWT sécurisée
- ✅ Audit trail complète
- ✅ API REST complète (70+ endpoints)

---

## 👤 User Preferences
- Approche directe et pragmatique
- Itération rapide avec visibilité sur les progrès
- Code lisible, maintenable et production-ready
- Confirmation demandée avant refactorings majeurs

---

## 🏗️ System Architecture

### Tech Stack
- **Backend:** Express.js 4 + Node.js 20 (Port 3000)
- **Frontend:** React 18 + Vite 5 (Port 5000)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** JWT (24h) + Refresh Tokens (7d)
- **AI:** OpenAI Integration via Replit

### Design Principles
- **UI/UX:** Style QuickBooks - Sidebar/Topbar fixes, icônes, 100% français
- **Responsiveness:** Mobile-first, adaptive layouts
- **Sécurité:** RLS par entrepriseId, RBAC modulaire, Audit trail
- **Multi-tenancy:** Isolation complète par entrepriseId

---

## 📦 ARCHITECTURE MODULAIRE - 17 Modules

### 📊 MODULE 0: TABLEAU DE BORD GLOBAL

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **📊 Dashboard KPIs** | Métriques temps réel (Trésorerie, Revenus, Dépenses, Bénéfice), Graphiques interactifs (Recharts), Filtrage par période, Vue globale du système | GET /dashboard/kpis | ✅ |

**Agrégation:** Données provenant de tous les modules (Clients, Fournisseurs, Stock, Comptabilité, HR)

---

### 🎯 DOMAINE 1: GESTION CLIENTS & VENTES

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **👥 Clients** | CRUD, Contact, Info fiscale | POST/GET /clients | ✅ |
| **📄 Devis** | Création (DEV-YYYY-NNNN), Suivi, Conversion facture | POST/GET /devis | ✅ |
| **💵 Factures Ventes** | Facturation (FACT-YYYY-NNNN), Paiements, Suivi statut | POST/GET /factures | ✅ |

**Flux:** Client → Devis → Facture → Paiement → Comptabilité auto

---

### 🏢 DOMAINE 2: GESTION FOURNISSEURS & ACHATS

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **🏭 Fournisseurs** | CRUD, Conditions paiement, Évaluation | POST/GET /fournisseurs | ✅ |
| **📦 Commandes Achat** | Création (CMD-YYYY-NNNN), Suivi livraison | POST/GET /commandes-achat | ✅ |
| **📥 Réceptions** | Enregistrement réception, Contrôle qualité | POST/GET /receptions | ✅ |
| **🧾 Factures Fournisseurs** | Facturation (FACT-ACH-YYYY-NNNN), Rapprochement | POST/GET /achats | ✅ |

**Flux:** Commande → Réception → Facture Fournisseur → Comptabilité auto

---

### 💳 DOMAINE 3: TRÉSORERIE & FINANCE

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **💰 Trésorerie** | Soldes bancaires, Caisse, Rapprochement, Flux | GET/POST /tresorerie | ✅ |
| **📦 Stock & Inventaire** | Multi-entrepôts, FIFO/CMP, Alertes | GET/POST /produits, /stock | ✅ |
| **💸 Dépenses (ORION EXPENSE)** | Catégories, Workflow approbation (3 niveaux), Remboursement, Récurrentes | POST/GET /depenses | ✅ |

**Impacts automatiques:** Impact trésorerie, Comptabilité auto, Notifications

---

### 📚 DOMAINE 4: COMPTABILITÉ & CONFORMITÉ

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **📖 Comptabilité Générale** | Plans comptables (SYSCOHADA/IFRS/PCG), CRUD comptes, Journaux, Écritures validées, Grand livre, Balance | GET/POST /comptabilite/plans, /comptes, /journaux, /ecritures | ✅ |
| **🏗️ Immobilisations** | Catégories durée de vie, Amortissement linéaire/dégressif, Comptabilisation auto mensuelle, Cessions, Registre, Export CSV | POST/GET /immobilisations, /export-assets | ✅ |

**Validation:** Équilibre débit=crédit, Audit trail complet, Export Excel/CSV

---

### 👨‍💼 DOMAINE 5: RESSOURCES HUMAINES (ORION HR LITE)

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **👤 Employés** | CRUD, Documents (contrat, diplômes, bulletins), Rôles/permissions, Paie intégrée | POST/GET/PUT /employes | ✅ |
| **💼 Avances Salaire** | Demandes, Workflow approbation, Remboursement, Audit | POST/GET /employes/avances | ✅ |
| **🗓️ Absences** | Types (congé, maladie, etc), Approvals, Suivi, Notifications | POST/GET /employes/absences | ✅ |
| **🔔 Notifications RH** | Alertes absences, Anniversaires, Expiration contrats | POST/GET /employes/notifications | ✅ |

**Intégration:** Auto-liaison avec module Dépenses pour paie

---

### ⚙️ DOMAINE 6: CONFIGURATION & SÉCURITÉ

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **⚙️ Paramètres** | Devises (20+), Systèmes comptables, Pays, TVA, Numérotation auto, Exercice | GET /parametres/devises, /systemes, /pays | ✅ |
| **🔐 Authentification** | Email/Password, JWT (24h), Refresh Tokens (7d), Password Recovery, Sessions tracking | POST /auth/login, /refresh, /forgot-password | ✅ |
| **👑 RBAC & Permissions** | 5 Rôles (Admin/Manager/Comptable/Employé/Viewer), Contrôle modulaire | Middleware /auth/requireRole | ✅ |
| **🔒 RLS (Row-Level Security)** | Isolation multi-tenant par entrepriseId sur TOUS les endpoints | Middleware /auth/entrepriseIsolation | ✅ |
| **📋 Audit Log** | Historique opérations (CREATE/UPDATE/DELETE), Date/User/Action/Table/IP, Filtrage | GET /parametres/audit-logs | ✅ |

**Sécurité:** Hachage bcrypt, JWT signing, Sessions IP/UserAgent, Audit trail

---

### 🤖 DOMAINE 7: INTELLIGENCE & ASSISTANCE

| Module | Fonctionnalités | API Endpoints | État |
|--------|-----------------|----------------|------|
| **🤖 Assistant IA** | Questions/réponses intelligentes, Suggestions, Intégration OpenAI | POST /ia/chat | ✅ |

---

## 📊 RÉCAPITULATIF COMPLET

### Infrastructure de Données
- **Tables PostgreSQL:** 30+ tables
- **Colonnes auditées:** Toutes les operations loggées
- **Foreign Keys:** RLS multi-tenant par entrepriseId

### API Backend
- **Endpoints Totaux:** 70+
- **Pattern:** `/api/{module}/{action}`
- **Authentification:** JWT + RBAC sur TOUS les endpoints
- **Sécurité:** RLS par entrepriseId

### Frontend React
- **Components:** 17 Views (Dashboard Global + 16 modules métier)
- **Layout:** Sidebar + Topbar + Content Area
- **Responsive:** Mobile-first design
- **Langue:** 100% Français

### Déploiement
- **Plateforme:** Replit (autoscale ready)
- **Frontend:** Vite proxy vers backend
- **Cache:** No-cache directives pour dev
- **Base de données:** PostgreSQL Neon-backed

---

## 🚀 FONCTIONNALITÉS CROSS-MODULAIRES

### Automatisations Intégrées
- **Comptabilisation Auto:** Chaque transaction client/fournisseur → écriture comptable auto
- **Impact Trésorerie:** Paiements/Dépenses → mise à jour soldes cash
- **Amortissement Mensuel:** Endpoint `/immobilisations/calculer-amortissements`
- **Notifications:** Absences, anniversaires, expiration contrats

### Multi-Devise & Internationalisation
- **20+ Devises:** XOF, XAF, EUR, USD, etc.
- **3 Systèmes Comptables:** SYSCOHADA (Afrique), IFRS (International), PCG (France)
- **Pays Customisés:** Taux TVA, devise défaut, standards locaux

### Conformité & Audit
- **Audit Trail Complet:** Chaque CREATE/UPDATE/DELETE loggée
- **Conformité SYSCOHADA:** Numérotation, plans comptables standards
- **Export Compliance:** CSV/Excel pour tous les modules

---

## 📦 DÉPENDANCES EXTERNES

### Backend
- Express.js 4
- Drizzle ORM
- bcrypt (password hashing)
- jsonwebtoken (JWT)

### Frontend
- React 18
- Vite 5
- Recharts (graphiques KPI)

### Database
- PostgreSQL
- Drizzle migrations

### AI
- OpenAI API (via Replit integration)

---

## 🎯 STATUS FINAL: 🚀 PRODUCTION-READY

✅ **17 Modules complètement implémentés** (incluant Dashboard Global)
✅ **70+ Endpoints API fonctionnels**
✅ **Multi-tenant sécurisé (RLS + RBAC)**
✅ **Audit trail complète**
✅ **Multi-devise & multi-pays**
✅ **Prêt pour déploiement (Publishing)**

**Architecture optimisée: Dashboard module central + 6 domaines métier sans code dupliqué**
