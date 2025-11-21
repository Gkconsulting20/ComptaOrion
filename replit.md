# ComptaOrion - ERP Léger pour l'Afrique

## Overview
ComptaOrion is a comprehensive and lightweight ERP solution specifically optimized for the African market. It provides a modern, responsive, and intuitive platform to manage all aspects of a business, including accounting, inventory, customer/supplier relations, human resources, and more. Inspired by QuickBooks, it combines a modern React frontend with a robust Express.js backend, featuring multi-country, multi-currency support, and adherence to African accounting standards (SYSCOHADA).

Key capabilities include support for SYSCOHADA, IFRS, and PCG, multi-currency functionality (20+ currencies), multi-tenancy with isolation per `entrepriseId`, and a comprehensive Role-Based Access Control (RBAC) system. The project aims to be a production-ready solution with a complete audit trail and a robust REST API.

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
- **UI/UX:** QuickBooks-inspired style (Sidebar/Topbar fixes, icons, 100% French localization).
- **Responsiveness:** Mobile-first, adaptive layouts.
- **Security:** Row-Level Security (RLS) by `entrepriseId`, modular RBAC, and a complete audit trail.
- **Multi-tenancy:** Complete isolation per `entrepriseId`.

### Core Features
ComptaOrion is built with a modular architecture comprising 17 modules organized into 7 domains:

1.  **Dashboard Global:** Real-time KPIs, interactive charts, and system overview.
2.  **Customer & Sales Management:** CRUD for clients, quotes, sales invoices, and payments. Includes automatic accounting integration.
    - **Parameters:** 3 sous-onglets (Clients, Taxes, Codes Comptables)
    - **Devis, Factures, Paiements, Relances, Rapports**
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices.
    - **Parameters:** 3 sous-onglets (Fournisseurs, Taxes, Codes Comptables)
    - **Commandes Achat** avec conversion automatique en facture
    - **Réceptions, Factures Fournisseurs, Paiements, Rapports**
4.  **Stock & Inventory:** Multi-warehouse stock management with movement tracking.
    - **Stock Management:** Multi-warehouse, FIFO/CMP valorization
    - **Movement Tracking:** Entries, exits, transfers, adjustments
    - **Reports:** Period-based valorization reports
5.  **Accounting & Compliance (Module Comptabilité):** Complete accounting system with 7 tabs:
    - **📋 Plan Comptable:** CRUD des comptes (SYSCOHADA/IFRS/PCG classes 1-8)
    - **📚 Journaux:** Gestion des journaux (Ventes, Achats, Banque, Caisse, OD)
    - **✍️ Écritures Comptables:** Saisie débit/crédit avec validation d'équilibre automatique
    - **📖 Grand Livre:** Mouvements par compte avec filtrage par période
    - **⚖️ Balance Générale:** Balance des comptes avec soldes initiaux/finaux
    - **🏢 Immobilisations:** Gestion des actifs avec calcul automatique amortissement
    - **📊 Rapports Financiers:** Bilan, Compte de Résultat, Flux de Trésorerie
6.  **Treasury & Finance:** Bank balances, cash management, reconciliation, and expense management with approval workflows.
7.  **Human Resources (HR Lite):** Employee management, salary advances, absence tracking, and HR notifications.
8.  **Configuration & Security:** Currency management, accounting system settings, country-specific parameters, authentication (JWT, RBAC), Row-Level Security (RLS), and a comprehensive audit log.
9.  **Intelligence & Assistance:** AI Assistant for intelligent Q&A and suggestions via OpenAI integration.

### Cross-Modular Functionalities
-   **Automated Accounting:** Every client/supplier transaction automatically generates accounting entries.
-   **Treasury Impact:** Payments and expenses automatically update cash balances.
-   **Monthly Amortization:** Automated calculation and posting of fixed asset depreciation.
-   **Notifications:** Alerts for absences, birthdays, and contract expirations.
-   **Multi-Currency & Internationalization:** Supports over 20 currencies, 3 accounting systems (SYSCOHADA, IFRS, PCG), and custom country settings.
-   **Compliance & Audit:** Complete audit trail for all operations, SYSCOHADA compliance, and CSV/Excel export for all modules.

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
-   Drizzle migrations

### AI
-   OpenAI API (via Replit integration)

## Recent Changes (November 21, 2025)

### Module Comptabilité - Complete Implementation ✅
Created comprehensive accounting module (ModuleComptabilite.jsx) with 7 fully functional tabs:

**Frontend:**
- Plan Comptable: CRUD comptes comptables with categories
- Journaux: Management of accounting journals (VE, AC, BQ, CA, OD)
- Écritures: Complete entry workflow with ligne creation, debit/credit validation, and real-time balance check
- Grand Livre: Account ledger with period filtering and API integration
- Balance Générale: Trial balance generation with API integration
- Immobilisations: Fixed assets management with depreciation tracking
- Rapports: Financial reports (Bilan, Compte de Résultat) with period-based filtering

**Backend Routes (all functional with proper SQL JOINs):**
- `/comptabilite/comptes` - CRUD chart of accounts
- `/comptabilite/journaux` - CRUD journals
- `/comptabilite/ecritures` - CRUD entries with debit/credit validation
- `/comptabilite/lignes` - CRUD entry lines
- `/comptabilite/grand-livre` - Ledger with JOIN on ecritures (fixes PostgreSQL error)
- `/comptabilite/balance` - Trial balance with JOIN on ecritures (fixes PostgreSQL error)
- `/comptabilite/bilan` - Balance sheet report with JOIN on ecritures
- `/comptabilite/compte-resultat` - Income statement with JOIN on ecritures
- `/immobilisations/*` - Fixed assets management with automatic depreciation calculation

**Key Features:**
- ✅ Automatic debit/credit balance validation before entry approval
- ✅ Multi-journal support (Sales, Purchases, Bank, Cash, OD)
- ✅ Period-based filtering for all reports
- ✅ Complete entry workflow: create header → add lignes → validate balance → approve
- ✅ All frontend tabs connected to backend APIs
- ✅ SYSCOHADA/IFRS/PCG compliance
- ✅ Complete audit trail for all operations

**Known Issues:**
- ⚠️ **CRITICAL SECURITY ISSUE:** Authentication middleware disabled in `backend/src/app.js` line 49. All API routes are publicly accessible without authentication. Must be addressed before production deployment.

### Module Client - Standardized Parameters
Updated ClientsModule.jsx with 3 sub-tabs in Parameters:
- Clients: CRUD with accounting codes, payment terms
- Taxes: VAT configuration (18%, 9%, 0%)
- Codes Comptables: Account codes (411, 4111, 4112, 4431)

### Module Fournisseur - Complete Structure
GestionFournisseurs.jsx with 6 tabs:
- Parameters (3 sub-tabs: Suppliers, Taxes, Accounting Codes)
- Purchase Orders with automatic invoice conversion
- Receptions, Supplier Invoices, Payments, Reports