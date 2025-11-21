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
2.  **Customer & Sales Management:** CRUD for clients, quotes, sales invoices, and payments, with automatic accounting integration. Includes delivery note generation from invoices.
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices.
4.  **Stock & Inventory:** Multi-warehouse stock management with movement tracking and FIFO/CMP valorization.
5.  **Accounting & Compliance:** Complete accounting system including Chart of Accounts (SYSCOHADA/IFRS/PCG), Journals, Accounting Entries, General Ledger, Trial Balance, Fixed Assets management with automatic amortization, Financial Reports, and recurrent entries management.
6.  **Treasury & Finance:** Bank balances, cash management, reconciliation, expense management, and **cash flow forecasting with automated predictions**. Includes bank account management with accounting linkage, and advanced treasury forecasts based on outstanding invoices (both receivables and payables).
7.  **Configuration & Security:** Currency management, accounting system settings, country-specific parameters, authentication (JWT, RBAC), Row-Level Security (RLS), a comprehensive audit log, and customizable invoice branding (logo, colors, footer).
8.  **Intelligence & Assistance:** AI Assistant for intelligent Q&A and suggestions via OpenAI.
9.  **SaaS Administration:** Complete commercialization platform with sales team management, client tracking, subscription plans, invoicing, and revenue analytics (MRR tracking).

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