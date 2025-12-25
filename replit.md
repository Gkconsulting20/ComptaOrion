# ComptaOrion - ERP Léger pour l'Afrique

## Overview
ComptaOrion is a lightweight ERP solution designed for the African market, inspired by QuickBooks. It offers a modern, responsive platform for managing accounting, inventory, customer/supplier relations, and human resources. Key features include multi-country, multi-currency support, compliance with African accounting standards (SYSCOHADA), IFRS, and PCG. The project aims to be a production-ready solution with multi-tenancy, Role-Based Access Control (RBAC), a complete audit trail, and a robust REST API, addressing the demand for tailored ERP solutions in Africa.

## User Preferences
- Approche directe et pragmatique
- Itération rapide avec visibilité sur les progrès
- Code lisible, maintenable et production-ready
- Confirmation demandée avant refactorings majeurs

## System Architecture

### Tech Stack
-   **Backend:** Express.js 4 + Node.js 20
-   **Frontend:** React 18 + Vite 5
-   **Database:** PostgreSQL + Drizzle ORM
-   **Authentication:** JWT + Refresh Tokens
-   **AI:** OpenAI Integration

### Design Principles
-   **UI/UX:** QuickBooks-inspired design (fixed Sidebar/Topbar, icons, 100% French localization), mobile-first, adaptive layouts. Interactive tables for detailed views.
-   **Security:** Row-Level Security (RLS) per `entrepriseId`, modular RBAC, and a complete audit trail.
-   **Multi-tenancy:** Complete isolation per `entrepriseId`.

### Core Features
ComptaOrion features a modular architecture covering 8 domains:

1.  **Dashboard Global:** Real-time KPIs.
2.  **Customer & Sales Management:** CRUD for clients, quotes, sales invoices, payments, delivery notes, and an Aging Report for receivables.
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices. Includes a two-stage costing workflow for import operations with logistics costs.
4.  **Stock & Inventory:** Multi-warehouse management, movement tracking, and FIFO/CMP valorization.
5.  **Accounting & Compliance:** Chart of Accounts (SYSCOHADA/IFRS/PCG), Journals, Accounting Entries, General Ledger, Trial Balance, Fixed Assets management with amortization, Financial Reports, and recurrent entries. Includes a Chart of Accounts Report with SYSCOHADA class grouping.
6.  **Treasury & Finance:** Bank balances, cash management, automated bank reconciliation, expense management, and cash flow forecasting with automated predictions.
7.  **Configuration & Security:** Currency management, accounting settings, country-specific parameters, authentication, RLS, audit log, and customizable invoice branding.
8.  **Intelligence & Assistance:** AI Assistant via OpenAI for Q&A and suggestions.
9.  **SaaS Administration:** Commercialization platform with sales team management, client tracking, subscription plans, automated sales tracking, invoicing, and MRR analytics.
    -   **Hybrid Sales System:** Supports commercial (B2B) sales with referral links and web (self-service) sales via FedaPay.
    -   **Commercial Portal:** Dedicated self-service portal for sales representatives with personal referral links, real-time statistics, client lists, and sales history.
10. **Integrations Module:**
    -   **Data Import:** From external accounting software (QuickBooks, Sage 100, Excel/CSV) for Clients, Fournisseurs, Plan Comptable, Produits/Services.
    -   **Data Export:** By domain in JSON/CSV formats, plus full backup export.
    -   **API Keys:** Secure generation with permissions, IP allowlisting.
    -   **Webhooks:** Subscription management for 14 events with HMAC-SHA256 signature, delivery tracking.
    -   **Scheduled Backups:** Automated backups with multiple destinations and optional encryption.

### Cross-Modular Functionalities
-   **Automated Accounting:** Transactions automatically generate accounting entries.
-   **Treasury Impact:** Payments and expenses update cash balances.
-   **Multi-Currency & Internationalization:** Supports over 20 currencies and 3 accounting systems.
-   **Compliance & Audit:** Complete audit trail, SYSCOHADA compliance, CSV/Excel export.
-   **Email Automation:** SendGrid integration for automated invoice sending and account statements.
-   **Account Statements:** Generation for clients and suppliers.
-   **Client Period Reports:** Custom reports with KPIs for any time period.

## External Dependencies

### Backend
-   Express.js
-   Drizzle ORM
-   bcrypt
-   jsonwebtoken
-   @sendgrid/mail

### Frontend
-   React
-   Vite
-   Recharts

### Database
-   PostgreSQL

### AI
-   OpenAI API