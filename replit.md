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
- **UI/UX:** QuickBooks-inspired style (fixed Sidebar/Topbar, icons, 100% French localization), mobile-first, adaptive layouts. Interactive tables with click-to-view details for factures and écritures comptables.
- **Security:** Row-Level Security (RLS) by `entrepriseId`, modular RBAC, and a complete audit trail.
- **Multi-tenancy:** Complete isolation per `entrepriseId`.

### Core Features
ComptaOrion is built with a modular architecture comprising 18 modules organized into 8 domains:

1.  **Dashboard Global:** Real-time KPIs and system overview.
2.  **Customer & Sales Management:** CRUD for clients, quotes, sales invoices, and payments, with automatic accounting integration. Includes delivery note generation from invoices and **Aging Report** showing receivables categorized by maturity (Overdue, 0-30 days, 31-60 days, 61-90 days, 90+ days).
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices.
4.  **Stock & Inventory:** Multi-warehouse stock management with movement tracking and FIFO/CMP valorization.
5.  **Accounting & Compliance:** Complete accounting system including Chart of Accounts (SYSCOHADA/IFRS/PCG), Journals, Accounting Entries, General Ledger, Trial Balance, Fixed Assets management with automatic amortization, Financial Reports, and recurrent entries management.
6.  **Treasury & Finance:** Bank balances, cash management, **automated bank reconciliation**, expense management, and **cash flow forecasting with automated predictions**. Includes bank account management with accounting linkage, advanced treasury forecasts based on outstanding invoices (both receivables and payables), and complete bank reconciliation workflow with transaction matching.
7.  **Configuration & Security:** Currency management, accounting system settings, country-specific parameters, authentication (JWT, RBAC), Row-Level Security (RLS), a comprehensive audit log, and customizable invoice branding (logo, colors, footer).
8.  **Intelligence & Assistance:** AI Assistant for intelligent Q&A and suggestions via OpenAI.
9.  **SaaS Administration:** Complete commercialization platform with sales team management, client tracking, subscription plans, subscription management with **automated sales tracking**, invoicing, and revenue analytics (MRR tracking).

### Cross-Modular Functionalities
-   **Automated Accounting:** Transactions automatically generate accounting entries.
-   **Treasury Impact:** Payments and expenses update cash balances.
-   **Monthly Amortization:** Automated calculation and posting of fixed asset depreciation.
-   **Notifications:** Alerts for absences, birthdays, and contract expirations.
-   **Multi-Currency & Internationalization:** Supports over 20 currencies, 3 accounting systems (SYSCOHADA, IFRS, PCG), and custom country settings.
-   **Compliance & Audit:** Complete audit trail for all operations, SYSCOHADA compliance, and CSV/Excel export.
-   **Email Automation (NEW - Nov 2025):** SendGrid integration for automated invoice sending with professional HTML templates, email tracking, and delivery history. Requires SENDGRID_API_KEY secret configuration.
-   **Interactive Details View (NEW - Nov 2025):** Click on any facture or écriture comptable row to view complete details in a modal with all associated information (client data, line items, totals, accounting lines, etc.).
-   **Treasury Forecasting (Nov 2025):** Automated cash flow predictions considering:
    - Current bank balances across all active accounts
    - Outstanding client invoices (receivables) with due dates
    - Outstanding supplier invoices (payables) with due dates
    - Week-by-week projection for 7, 30, or 90 days
    - Automatic calculation of projected balance = current balance + receivables - payables
-   **Account Statements (Nov 2025):** Complete account statement generation for both clients and suppliers with period filtering, automatic balance calculation, and professional email delivery via SendGrid.
-   **Client Period Reports (Nov 2025):** Custom client reports for any time period in the Clients module Rapports tab:
    - Date range selection (start date / end date) with default to last month
    - 4 KPIs: Revenue (CA), Invoices Issued, Payments Received, Outstanding Balances
    - Top 10 clients ranking for the selected period
    - Inline error handling and loading states
    - Uses canonical schema columns (dateFacture, soldeRestant) for accuracy
-   **Aging Report for Receivables (Nov 2025):** Professional receivables aging report in the Clients module showing outstanding invoices categorized by maturity:
    - Overdue (past due date)
    - 0-30 days (due within next 30 days)
    - 31-60 days (due between 31-60 days)
    - 61-90 days (due between 61-90 days)
    - 90+ days (due in more than 90 days)
    - Each category displays total amount, invoice count, and detailed invoice list
    - Mutually exclusive categories with accurate totals for financial tracking
-   **Bank Reconciliation (Nov 2025):** Complete automated bank reconciliation system in the Treasury module:
    - Create reconciliation by selecting bank account, period, and entering bank statement balance
    - Automatic calculation of accounting balance from transactions within the period
    - Real-time gap calculation between bank statement and accounting balance
    - Interactive transaction matching interface with two sections: transactions to reconcile and reconciled transactions
    - Mark/unmark transactions as reconciled with one click
    - Validation workflow to lock completed reconciliations
    - Full audit trail with reconciliation history, dates, statuses, and notes
    - Visual indicators for reconciliation status (validated, in progress)
-   **Hybrid Sales System (Nov 2025):** ComptaOrion supports **two sales channels**:
    - **Commercial Sales (B2B):** Sales reps prospect and create subscriptions with automatic commission calculation
    - **Web Sales (Self-Service):** Clients register and pay online via FedaPay (mobile money, cards) with automatic provisioning
    
    When a subscription is created (via commercial or web), a sale is automatically recorded with:
    - Commercial commission (if B2B sale) or zero commission (if web sale)
    - Total amount = plan price × subscription duration  
    - Source tracking (commercial/web) for analytics
    - Complete audit trail with notes

-   **FedaPay Integration (Nov 2025):** Full payment gateway integration for African markets:
    - Mobile Money (MTN, Moov, Orange Money) support
    - HMAC signature verification for webhook security
    - Automatic account creation after payment confirmation
    - **Automated welcome email with login credentials** sent immediately upon account creation
    - Idempotent webhook handling (duplicate protection via transaction_id)
    - Renewal support for existing customers
    - Covers 8+ West African countries (Benin, Senegal, Côte d'Ivoire, Togo, Mali, etc.)
    - Public registration page at `/inscription` with plan selection
    - See `GUIDE_CONFIGURATION_FEDAPAY.md` and `GUIDE_EMAILS_INSCRIPTION.md` for setup instructions

-   **Commercial Referral Links (Dec 2025):** Sales representatives can now generate personalized referral links:
    - Link format: `/inscription?ref=COMMERCIAL_ID`
    - Admin SaaS > Commerciaux: "Copier le lien" button for each commercial
    - When a client uses a referral link:
      - The commercial is automatically associated with the new client
      - Commission is calculated based on the commercial's rate
      - Source is tracked as "commercial" for analytics
      - Full audit trail with commercial attribution in notes
    - Supports both new subscriptions and renewals

-   **Commercial Portal (Dec 2025):** Dedicated self-service portal for sales representatives at `/commercial`:
    - Separate JWT authentication system (independent from main app)
    - Password set by admin in Admin SaaS > Commerciaux form
    - Emails normalized to lowercase for consistent login
    - Dashboard features:
      - Personal referral link with one-click copy
      - Real-time statistics (total clients, active clients, monthly/total revenue and commissions)
      - Complete client list with subscription status and dates
      - Complete sales history with amounts and commissions
    - Commission rate displayed (modifiable only by admin in Admin SaaS)
    - No access to main ERP system - commercials only see their own data

-   **Integrations Module (Dec 2025):** Complete external connectivity and data security system:
    - **Data Import (NEW):** Import data from external accounting software (QuickBooks, Sage 100, Excel/CSV):
      - Multi-step wizard: Source selection → File upload → Column mapping → Validation → Commit
      - Supported formats: CSV, Excel (.xlsx), QuickBooks IIF files
      - Importable entities: Clients, Fournisseurs, Plan Comptable, Produits/Services
      - Auto-detection of column mappings based on header names
      - Validation with detailed error reporting per line
      - Transactional commits with rollback on failure
      - Import history tracking with batch status
      - Database tables: import_batches, import_records, import_mapping_templates
    - **Data Export:** Manual exports by domain (12 domains: clients, fournisseurs, factures, paiements, écritures, comptes, produits, mouvements_stock, comptes_bancaires, transactions, employes, depenses) in JSON/CSV formats, plus full backup export
    - **API Keys:** Secure key generation with SHA-256 hashing, permissions management (read/write), IP allowlisting, and activation toggle. Key format: `co_{prefix}_{key}`
    - **Webhooks:** Subscription management with HMAC-SHA256 signature signing, 14 available events (facture.created/paid/sent, paiement.received/created, client/fournisseur created/updated, ecriture.posted/validated, stock.alert/movement, backup.completed/failed), test functionality, and delivery tracking. Secrets encrypted at rest with AES-256-CBC.
    - **Scheduled Backups:** Configuration for automated backups (daily/weekly/monthly) with multiple destinations (URL/SFTP/S3), format selection (JSON/CSV), and optional encryption
    - **Security:** Multi-tenant isolation via entrepriseId, encrypted webhook secrets (requires WEBHOOK_ENCRYPTION_KEY in production), complete audit logging for all export/API operations
    - **Database Tables:** api_keys, webhook_subscriptions, webhook_deliveries, backup_configs, backup_jobs, export_history, import_batches, import_records, import_mapping_templates

-   **Two-Stage Purchase Costing (Dec 2025):** Sophisticated purchase-to-invoice workflow for import operations following SYSCOHADA standards:
    - **Purchase Orders with Logistics Costs:** Orders include estimated costs for transport, customs (douane), handling (manutention), insurance, and other charges
    - **Reception Validation (Quantity Only):** Validates quantities received without final costing, creates stock movements with bridge account 408 (Fournisseurs - Factures non parvenues)
    - **Pending Ledgers:** Automatic creation of `stock_pending` and `logistique_pending` records for tracking uninvoiced goods and logistics costs
    - **Invoice Reconciliation (Final Costing):** New endpoint `/api/achats/factures-avec-rapprochement` matches invoices to receptions, captures actual costs, and calculates price variances
    - **Reports:**
      - "Non Facturé" tab in Stock module showing pending stock and logistics costs by supplier
      - Costing variance reports comparing estimated vs actual prices
    - **Accounting Flow:**
      - At reception: Debit 31x (Stock) / Credit 408 (Bridge account)
      - At invoice: Debit 408 / Credit 401 (Fournisseurs) + adjust for price variances
    - **Database Tables:** stock_pending, logistique_pending, couts_logistiques_commande

## External Dependencies

### Backend
-   Express.js 4
-   Drizzle ORM
-   bcrypt (password hashing)
-   jsonwebtoken (JWT)
-   @sendgrid/mail (email sending)

### Frontend
-   React 18
-   Vite 5
-   Recharts (for KPI graphs)

### Database
-   PostgreSQL

### AI
-   OpenAI API