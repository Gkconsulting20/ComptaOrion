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
3.  **Supplier & Purchase Management:** CRUD for suppliers, purchase orders, goods receipts, and supplier invoices.
4.  **Treasury & Finance:** Bank balances, cash management, reconciliation, and expense management with approval workflows. Integrates with inventory for automatic stock updates.
5.  **Accounting & Compliance:** General ledger, chart of accounts (SYSCOHADA/IFRS/PCG), journals, entries, trial balance, and fixed asset management with automated depreciation.
6.  **Human Resources (HR Lite):** Employee management, salary advances, absence tracking, and HR notifications.
7.  **Configuration & Security:** Currency management, accounting system settings, country-specific parameters, authentication (JWT, RBAC), Row-Level Security (RLS), and a comprehensive audit log.
8.  **Intelligence & Assistance:** AI Assistant for intelligent Q&A and suggestions via OpenAI integration.

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