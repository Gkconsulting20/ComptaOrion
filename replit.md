# ComptaOrion - ERP Léger pour l'Afrique

## Overview
ComptaOrion is a comprehensive yet lightweight ERP (Enterprise Resource Planning) system specifically optimized for the African market. It aims to provide businesses with a modern, responsive, and intuitive platform for managing various operations, from accounting and inventory to customer and supplier relations. The project combines a modern React frontend with a robust Express.js backend, featuring integrated AI assistance and a design inspired by leading professional tools like QuickBooks. Its core ambition is to support multi-country operations, including specific African accounting standards (SYSCOHADA), multiple currencies, and adaptable fiscal year configurations, all while being optimized for limited internet connectivity environments.

## User Preferences
I prefer clear, concise explanations and a direct approach to problem-solving. I appreciate iterative development where I can see progress regularly. When making changes, please ask for confirmation before implementing major architectural shifts or deleting significant portions of code. I prefer a coding style that is readable, maintainable, and follows modern best practices. Focus on delivering functional modules that are production-ready.

## System Architecture
ComptaOrion is built as a full-stack application with a clear separation of frontend and backend concerns.

**UI/UX Decisions:**
- **Design Inspiration:** QuickBooks, ensuring a professional and intuitive user experience.
- **Responsiveness:** Mobile-first approach with adaptive sidebar and layouts optimized for all screen sizes (smartphone to desktop).
- **Navigation:** Fixed sidebar and top bar, with sub-menus for complex modules like Accounting.
- **Visual Cues:** Extensive use of icons for clear visual communication.
- **Styling:** Modern CSS with professional color schemes (dark grey, blue).
- **Language:** Interface is 100% in French.

**Technical Implementations & Feature Specifications:**
- **Core Modules:** Dashboard, Customer Management, Supplier Management, Purchasing (Purchase Orders, Goods Receipts, Supplier Invoices, Payments, Due Dates), Treasury Management, Stock & Inventory, Comprehensive Accounting (Financial Statements, General Ledger, Journal Entries, Bank Reconciliation, Chart of Accounts), and an integrated AI Assistant.
- **Internationalization:**
    - **Multi-currency:** Supports over 20 global currencies (XOF, XAF, EUR, USD, etc.).
    - **Accounting Systems:** Configurable for SYSCOHADA (OHADA Africa), IFRS (International), and PCG (France).
    - **Multi-country Support:** Customizable tax rates (e.g., VAT) and default currencies per country.
    - **Flexible Fiscal Year:** Configurable to local standards.
- **Data Tables:** Professional-grade data tables with pagination, filtering, and sorting capabilities.
- **Transactional Logic:** Automatic impacts on stock and treasury for purchases and sales. Automated accounting entries for transactions.
- **Document Generation:** Automated numbering for Purchase Orders (CMD-YYYY-NNNN), Sales Invoices (FACT-YYYY-NNNN), and Supplier Invoices (FACT-ACH-YYYY-NNNN). PDF generation for invoices/orders is a planned feature.
- **Security & Authentication (Orion Secure Module):**
    - **Login:** Email/password authentication with bcrypt hashing.
    - **JWT:** Secure JWT (24h) and Refresh Token (7d) system with mandatory secrets.
    - **Session Management:** Tracking IP/UserAgent, listing active sessions, and logout functionality.
    - **Password Recovery:** Forgot password functionality with time-limited reset tokens.
    - **RLS (Row-Level Security):** Data isolation per `entrepriseId` across all endpoints, ensuring multi-tenant data integrity.
    - **RBAC (Role-Based Access Control):** Modular permissions (admin, manager, accountant, employee, viewer) with `requireRole()` middleware.
    - **Audit Trails:** Comprehensive logging of login/logout/failed login/token refresh events with IP/User Agent.

**System Design Choices:**
- **Backend:** Express.js 4 on Node.js 20, running on port 3000 (127.0.0.1).
- **Frontend:** React 18 with Vite 5, running on port 5000 (0.0.0.0).
- **Proxy:** Vite is configured to proxy `/api/*` requests to the backend.
- **Database:** PostgreSQL with Drizzle ORM.
- **Scalability:** Designed for autoscale deployment on Replit, adapting to load.
- **Offline Readiness:** Architecture includes considerations for future offline mode/PWA capabilities to support low-connectivity environments.

## External Dependencies
- **Frontend:** React 18, Vite 5
- **Backend:** Express.js 4, Node.js 20
- **Database:** PostgreSQL (with Drizzle ORM)
- **AI Integration:** OpenAI (via Replit AI Integrations, utilizing `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` environment variables).
- **Authentication Hashing:** bcrypt (for password hashing)