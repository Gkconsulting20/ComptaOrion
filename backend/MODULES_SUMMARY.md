# ComptaOrion - Modules Summary

## Quick Reference (17 Modules)

### 0️⃣ MODULE CENTRAL
**📊 Dashboard Global**
- GET /dashboard/kpis (Trésorerie, Revenus, Dépenses, Bénéfice)
- Graphiques interactifs (Recharts)
- Agrégation données temps réel
- Filtrage par période

### 1️⃣ CLIENTS & VENTES
- **Clients:** POST/GET /clients
- **Devis:** POST/GET /devis → numérotation DEV-YYYY-NNNN
- **Factures:** POST/GET /factures → numérotation FACT-YYYY-NNNN

### 2️⃣ FOURNISSEURS & ACHATS
- **Fournisseurs:** POST/GET /fournisseurs
- **Commandes:** POST/GET /commandes-achat → numérotation CMD-YYYY-NNNN
- **Réceptions:** POST/GET /receptions
- **Factures Fournisseurs:** POST/GET /achats → numérotation FACT-ACH-YYYY-NNNN

### 3️⃣ TRÉSORERIE & FINANCE
- **Trésorerie:** GET/POST /tresorerie (soldes, caisse, rapprochement)
- **Stock (Multi-entrepôts):** GET/POST /produits, /stock (FIFO/CMP, alertes)
- **Dépenses:** POST/GET /depenses (catégories, workflow 3 niveaux, remboursement)

### 4️⃣ COMPTABILITÉ
- **Comptabilité Générale:** GET/POST /comptabilite (plans, comptes, journaux, écritures)
- **Immobilisations:** POST/GET /immobilisations (amortissement auto, cessions, registre)

### 5️⃣ RESSOURCES HUMAINES
- **Employés:** POST/GET /employes (CRUD, documents, rôles)
- **Avances Salaire:** POST/GET /employes/avances (workflow, audit)
- **Absences:** POST/GET /employes/absences (types, approvals)
- **Notifications:** POST/GET /employes/notifications (alertes RH)

### 6️⃣ CONFIGURATION & SÉCURITÉ
- **Paramètres:** GET /parametres (devises, systèmes, pays, TVA)
- **Auth:** POST /auth/login, /refresh, /forgot-password
- **RBAC:** Middleware requireRole (5 rôles)
- **RLS:** Middleware entrepriseIsolation (multi-tenant)
- **Audit Log:** GET /parametres/audit-logs

### 7️⃣ IA
- **Assistant:** POST /ia/chat (OpenAI integration)

---

## Architecture Globale

```
📊 DASHBOARD (Module Central)
        ↓
    ┌───┴───┬───────┬───────┬──────────┬──────────┐
    ↓       ↓       ↓       ↓          ↓          ↓
CLIENTS  FOURNI.  TRÉS.  COMPTA      RH      CONFIG
(3 mod)  (4 mod)  (3 mod) (2 mod)   (4 mod)  (6 mod)
```

---
## API Status: ✅ All 70+ endpoints functional
## Security: ✅ JWT + RBAC + RLS + Audit Trail
## Database: ✅ 30+ PostgreSQL tables
## UI: ✅ 17 React components
