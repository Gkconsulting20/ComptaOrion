# ComptaOrion - ERP Léger pour l'Afrique

## Vue d'ensemble
ComptaOrion est un ERP (Enterprise Resource Planning) complet et léger, spécialement optimisé pour le marché africain. L'application combine une interface React moderne et responsive avec un backend Express.js robuste.

## Caractéristiques principales
- ✅ **Interface en français** - Entièrement traduit pour les utilisateurs francophones
- 📱 **Mobile-first** - Optimisé pour smartphones avec navigation tactile
- 🤖 **IA intégrée** - Assistant intelligent utilisant OpenAI (via Replit AI Integrations)
- ⚡ **Léger et rapide** - Optimisé pour connexions limitées
- 🌍 **Adapté à l'Afrique** - Conçu pour les réalités du marché africain

## Modules ERP
1. **Tableau de bord** 📊 - Vue d'ensemble de l'activité
2. **Gestion clients** 👥 - Fichier clients complet
3. **Facturation** 📄 - Création et suivi des factures
4. **Gestion de stock** 📦 - Inventaire et mouvements
5. **Comptabilité** 💰 - Écritures et états financiers
6. **Assistant IA** 🤖 - Aide intelligente et automatisation

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
- `GET /api/health` - Vérification système
- `GET /api` - Informations API
- `GET /api/clients` - Module clients
- `GET /api/factures` - Module facturation
- `GET /api/stock` - Module stock
- `GET /api/comptabilite` - Module comptabilité

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
  
- **2025-11-20** : Optimisation pour l'Afrique
  - Interface traduite en français
  - Design mobile-first responsive
  - Navigation tactile optimisée
  - Intégration OpenAI via Replit AI Integrations
  - Modules ERP de base configurés

## Prochaines étapes
- [ ] Développer les modules clients, factures, stock
- [ ] Implémenter l'assistant IA
- [ ] Ajouter support offline/PWA
- [ ] Optimiser pour bande passante limitée
- [ ] Ajouter thèmes de couleur personnalisables
