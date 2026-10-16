# Préparation et déploiement Cloudflare de l’ERP

## Architecture préparée

- **Un Worker** : `comptaorion-erp-staging`, avec compatibilité Node.js.
- **Interface React** : assets statiques du même Worker, sans serveur Replit.
- **API Express** : exécutée dans le Worker via `httpServerHandler`.
- **PostgreSQL conservé** : Neon par WebSocket, ou PostgreSQL via Hyperdrive.
- **Fichiers** : binding R2 `UPLOADS`, bucket `comptaorion-uploads-staging`.
- **IA désactivée**, FedaPay en sandbox.

`wrangler.jsonc` contient la configuration de préproduction. Le compte connecté
possède déjà ce bucket R2. Les Workers existants, notamment `comptaorion`,
ne sont ni modifiés ni remplacés par cette préparation.

Les connexions SQL sont créées par requête puis fermées avec `waitUntil`.
Les transactions utilisent une même connexion ; les fichiers ne sont jamais
enregistrés sur le disque éphémère du Worker.

## Ce qu’il faut créer ou configurer

### 1. Worker de préproduction

Dans Cloudflare, créer/connecter un Worker nommé **`comptaorion-erp-staging`**.
Le déploiement CLI peut aussi le créer. Ne pas réutiliser un Worker existant
sans avoir confirmé son rôle et sauvegardé sa configuration.

Configurer les secrets AVANT la première exécution de l’ERP :

| Secret Cloudflare | Usage |
|---|---|
| `DATABASE_URL` | URL de la base PostgreSQL externe destinée à cet ERP |
| `JWT_SECRET` | Secret aléatoire fort de signature des sessions |
| `JWT_REFRESH_SECRET` | Autre secret aléatoire fort pour le renouvellement |
| `WEBHOOK_ENCRYPTION_KEY` | Clé stable de chiffrement des intégrations |
| `FISCAL_ENCRYPTION_KEY` | Clé stable si des identifiants fiscaux sont enregistrés |

Ne pas recopier les valeurs d’exemple de `.replit`. Ne pas mettre de secret dans
GitHub, le frontend ou `wrangler.jsonc`. Les secrets Replit ne sont pas
automatiquement transmis à Cloudflare. Utiliser le formulaire de secrets du
Worker ou `npx wrangler secret put NOM_DU_SECRET` sur un poste autorisé.

Les clés de chiffrement doivent être conservées : les changer sans migration
peut rendre les paramètres chiffrés illisibles.

### 2. Base PostgreSQL externe

Une connexion Neon existe déjà dans les secrets du projet. Il faut confirmer
quelle base externe contient les données de l’ERP, y sauvegarder les données
et y appliquer les mises à niveau nécessaires. La correction effectuée dans
l’environnement local n’est **pas** une migration automatique de Neon.

Ne pas utiliser l’adresse PostgreSQL interne de développement Replit dans
Cloudflare. Ne pas créer de base D1 et ne pas remplacer PostgreSQL.

Pour Neon : enregistrer sa connexion comme `DATABASE_URL` du Worker.
Pour une autre base PostgreSQL : privilégier une configuration Hyperdrive,
ajouter son binding `HYPERDRIVE` dans Wrangler et tester la connexion.

### 3. Fichiers R2

Le bucket **`comptaorion-uploads-staging` existe déjà**. Aucun nouveau bucket
n’est requis pour cette préproduction ; Wrangler déclare son binding.

Les fichiers présents dans `backend/uploads/` ne sont pas automatiquement
copiés dans R2. Avant la bascule, les importer en préservant les clés relatives :
un logo accessible à `/uploads/logos/fichier.png` doit avoir pour clé R2
`logos/fichier.png`. Les sauvegardes ne doivent pas être exposées comme logos.

Exemple depuis un poste autorisé :

```sh
npx wrangler r2 object put comptaorion-uploads-staging/logos/fichier.png \
  --file backend/uploads/logos/fichier.png --content-type image/png --remote
```

Pour la production, utiliser un bucket et une configuration distincts après
validation de la préproduction. Un domaine personnalisé n’est pas obligatoire
pour les premiers essais : l’adresse `workers.dev` suffit.

### 4. Services facultatifs

- Emails réels : `SENDGRID_API_KEY` et un expéditeur autorisé, selon le service email.
- FedaPay : ses clés de **sandbox** pour la recette, puis clés live et webhook
  correctement configuré uniquement après validation commerciale.
- Aucune clé OpenAI n’est nécessaire pour cette version.

Les envois fiscaux externes simulés, les connecteurs non terminés et les
restaurations de sauvegarde ne sont pas certifiés par cette préparation.

## Installation et commandes

Node.js 22, compatible avec la version de Wrangler verrouillée dans ce projet.
Les fichiers de verrouillage et `.npmrc` utilisent le registre public npm.

```sh
npm ci
npm test
npm run test:functional
npm run cloudflare:check
npm run test:cloudflare
npm run test:worker
```

Les deux recettes fonctionnelles créent puis suppriment un schéma PostgreSQL
jetable. Elles nécessitent une base de **développement**, avec le droit de créer
un schéma ; ne pas les lancer sur la production. Aucun email ni paiement externe
n’est envoyé. `test:worker` utilise le bundle produit par `cloudflare:check`.

Après autorisation et configuration des ressources :

```sh
npm run cloudflare:deploy
```

Cette dernière commande publie réellement. Elle n’a pas été exécutée pendant
la préparation.

### Cloudflare Workers Builds depuis GitHub

- Dépôt : `Gkconsulting20/ComptaOrion`, branche `main`.
- Répertoire racine : racine du dépôt.
- Build : `npm run build`.
- Déploiement : `npx wrangler deploy`.
- Version Node.js : 22, déclarée dans `.nvmrc`.
- Secrets : dans le Worker, pas dans les assets React.

L’installation automatique `npm ci` à la racine lance maintenant le
`postinstall`, qui installe aussi les dépendances frontend et backend. Cela
évite `vite: not found` sur un environnement vierge. Ne pas activer
`--ignore-scripts` pour cette installation Cloudflare ; si les scripts
d’installation sont désactivés, utiliser explicitement
`npm run install:all && npm run build` comme commande de build.

La configuration Wrangler fait autorité pour le nom et les bindings. Vérifier
que le premier projet connecté correspond au Worker de préproduction, pas à
l’un des Workers déjà en service.

## Mise à niveau de la base

```sh
# Après configuration sécurisée de DATABASE_URL sur un poste de maintenance :
npm run db:check --prefix backend
# Sauvegarder la base cible avant de poursuivre.
npm run db:upgrade --prefix backend
```

L’outil ajoute les tables/colonnes absentes dans une transaction, conserve
les anciennes colonnes et reprend les catégories/valeurs des immobilisations
historiques. Il refuse une colonne obligatoire sans valeur de reprise sûre.
Il ne supprime pas les données et ne modifie pas automatiquement les types
ou les valeurs d’enums existants. Ne pas substituer `drizzle-kit push --force`.

## Validation avant ouverture

1. Confirmer la base cible et sa sauvegarde.
2. Configurer les secrets et importer les fichiers existants.
3. Déployer en préproduction.
4. Contrôler connexion, lecture des données existantes, facturation, paiements,
   écritures, uploads et séparation des entreprises sur la vraie cible.
5. Vérifier les écrans authentifiés dans un navigateur, les emails et webhooks.
6. Valider fiscalité, droits par rôle, clôtures et restaurations avant ouverture.

Une recette automatisée réussie ne certifie pas tous les modules ni toutes
les exigences légales/comptables.
