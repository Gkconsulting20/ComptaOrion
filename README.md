# ComptaOrion ERP

Déploiement Cloudflare : [guide actuel](docs/DEPLOIEMENT_CLOUDFLARE.md).
Recette et limites : [résultats de vérification](docs/VERIFICATION_FONCTIONNELLE_LOCALE.md).
Environnement : Node.js 22.

> **Périmètre actuel : ERP uniquement.** ComptaOrion Lite fonctionne dans un
> projet indépendant et a été retiré de cette copie. L'IA reste désactivée par
> défaut. Les sections historiques ci-dessous ne constituent pas une certification
> de toutes les intégrations.
>
> - [État des fonctionnalités et parcours de test](docs/ETAT_ERP_ET_RECETTE.md)
> - [Préparation de l'hébergement Cloudflare](docs/HEBERGEMENT_CLOUDFLARE.md)
>
> Installation : `npm run install:all` ; tests : `npm test` ;
> compilation : `npm run build`. Configurer les secrets et PostgreSQL avant de
> lancer le backend. Ne jamais utiliser la base de production pour la recette.

![ComptaOrion](https://img.shields.io/badge/ERP-L%C3%A9ger-blue) ![Made for Africa](https://img.shields.io/badge/Made%20for-Africa-green) ![Mobile First](https://img.shields.io/badge/Mobile-First-orange)

## 🌍 À propos

ComptaOrion est un ERP complet et léger, spécialement conçu pour le marché africain. Il combine puissance et simplicité pour répondre aux besoins des entreprises africaines.

## ✨ Fonctionnalités principales

- 📱 **Mobile-first** - Interface optimisée pour smartphones
- 🇫🇷 **100% Français** - Interface entièrement en français
- 🤖 **IA Intégrée** - Assistant intelligent pour automatisation
- ⚡ **Ultra-léger** - Optimisé pour connexions limitées
- 💼 **ERP Complet** - Tous les modules essentiels

## 📦 Modules

| Module | Description | Icône |
|--------|-------------|-------|
| **Tableau de bord** | Vue d'ensemble de l'activité | 📊 |
| **Clients** | Gestion complète des clients | 👥 |
| **Factures** | Facturation et devis | 📄 |
| **Stock** | Gestion d'inventaire | 📦 |
| **Comptabilité** | Écritures et bilans | 💰 |
| **Assistant IA** | Automatisation intelligente | 🤖 |

## 🚀 Démarrage rapide

```bash
# L'application démarre automatiquement sur Replit
# ou exécutez manuellement :
bash start.sh
```

L'application sera accessible sur :
- Frontend : `https://[votre-repl].replit.dev`
- Backend API : Port 3000 (interne)

## 🛠️ Technologies

- **Frontend** : React 18 + Vite 5
- **Backend** : Express.js + Node.js 20
- **IA** : OpenAI (via Replit AI Integrations)
- **Design** : CSS responsive mobile-first

## 🌟 Optimisations pour l'Afrique

### 📱 Interface Mobile
- Navigation tactile optimisée
- Boutons larges et accessibles
- Scroll horizontal fluide
- Compatible tous smartphones

### ⚡ Performance
- Chargement rapide
- Optimisé bande passante limitée
- Architecture légère
- Prêt pour mode offline (à venir)

### 🌐 Adapté au contexte
- Interface 100% français
- Icônes visuelles claires
- Workflow simplifié
- Pensé pour l'Afrique

## 📋 API

Endpoints disponibles :
```
GET  /api/health           # État du système
GET  /api                  # Informations API
GET  /api/clients          # Module clients
GET  /api/factures         # Module facturation
GET  /api/stock            # Module stock
GET  /api/comptabilite     # Module comptabilité
```

## 🤖 Intelligence Artificielle

ComptaOrion utilise l'IA OpenAI via Replit AI Integrations :
- ✅ Pas besoin de clé API
- ✅ Configuration automatique
- ✅ Facturation via crédits Replit
- ✅ Modèles GPT-4, GPT-5 disponibles

## 📱 Responsive Design

| Taille écran | Optimisation |
|--------------|--------------|
| < 480px | Smartphone (prioritaire) |
| 768px - 1024px | Tablette |
| > 1024px | Desktop |

## 🔧 Développement

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run dev
```

## 📄 Licence

Ce projet est un squelette d'application ERP pour le marché africain.

## 🙏 Contributeurs

Optimisé pour l'Afrique, par des développeurs qui comprennent les défis du continent.

---

**ComptaOrion** - L'ERP qui comprend l'Afrique 🌍
