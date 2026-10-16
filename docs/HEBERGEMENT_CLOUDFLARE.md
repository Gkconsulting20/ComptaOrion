# Hébergement de l'ERP sur Cloudflare

## Situation actuelle

Frontend React/Vite (`frontend/`), serveur Express (`backend/`),
PostgreSQL existant via Drizzle, fichiers téléversés sur disque.
Le projet n'est pas encore adapté ni publié intégralement sur Cloudflare.
Ne pas configurer Pages comme si le frontend statique constituait tout l'ERP :
sans `/api` et `/uploads`, connexion, factures et logos ne fonctionnent pas.

## Deux architectures possibles, sans hébergement Replit

### A. Cloudflare pour l'interface, serveur Node chez un autre hébergeur

- Frontend sur Cloudflare Pages.
- API Express et fichiers persistants sur un service Node externe.
- PostgreSQL existant conservé.
- Proxy même origine `/api/*` et `/uploads/*` à configurer vers l'API.
- Solution la plus proche de l'existant, mais le backend n'est pas chez Cloudflare.
- Build frontend depuis la racine : `npm ci --prefix frontend && npm run build`.
- Sortie statique : `frontend/dist`. Cela ne suffit pas sans le proxy d'API.

### B. Application sur Cloudflare Workers + stockage R2

- Express est maintenant pris en charge via `cloudflare:node` et
  `httpServerHandler`, avec `nodejs_compat`.
- Adapter le point d'entrée du serveur, les assets statiques et les paramètres.
- Adapter la gestion des connexions PostgreSQL au cycle de vie Workers
  (Neon/Hyperdrive selon la base réellement utilisée), en conservant les
  transactions et l'isolation entreprise.
- Remplacer les fichiers téléversés persistants sur disque par R2. Le système
  de fichiers virtuel Workers ne constitue pas un stockage durable.
- Vérifier SendGrid, FedaPay, import Excel, chiffrement et authentification.
- Garder PostgreSQL : aucune conversion vers D1 n'est nécessaire ou autorisée
  par le simple choix de Cloudflare.
- Tester en préproduction toutes les opérations avant de déplacer le domaine.

## GitHub

Le dépôt distant configuré est `https://github.com/Gkconsulting20/ComptaOrion`.
La structure actuelle est un monorepo à la racine : `frontend/`, `backend/`,
`scripts/`, `docs/`. Ne pas créer un deuxième dossier ComptaOrion imbriqué.
La connexion GitHub doit être réparée avant envoi. Ne jamais forcer un push
ou supprimer l'historique. Les secrets doivent rester hors du dépôt.
Vérifier également que les URL de registry dans les lockfiles sont utilisables
par le runner Cloudflare ; certaines proviennent du proxy de paquets Replit.

## Documentation officielle consultée

- https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/

## Décisions nécessaires

Choisir A ou B avant adaptation du déploiement. Ne pas considérer les fichiers
de ce document comme une configuration Cloudflare opérationnelle.
