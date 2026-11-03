---
name: Validation du runtime Cloudflare
description: Préparation Workers de l’ERP, migrations prudentes et vérification au-delà du bundle.
---

Ne pas considérer un bundle Wrangler réussi comme une preuve de fonctionnement :
tester le démarrage du runtime et un parcours SQL avec fichiers dans l’émulateur.

**Why:** La préparation a rencontré des incompatibilités invisibles au bundling :
exports navigateur de dépendances Node, génération aléatoire au chargement et
changements d’API de l’émulateur. Une recette HTTP a aussi révélé des erreurs
de requêtes absentes des tests sans session.

**How to apply:** Utiliser une version actuelle et auditée de Wrangler avec son
runtime Node compatible, puis vérifier les parcours avec un schéma SQL jetable.
Ne pas rétrograder l’outillage pour conserver un ancien Node au prix de
vulnérabilités connues.

Conserver la migration des données et la publication comme deux opérations distinctes.

**Why:** La base locale est ancienne ; corriger son schéma ne met pas à niveau
automatiquement la base PostgreSQL externe destinée à Cloudflare.

**How to apply:** Sauvegarder et contrôler explicitement la base cible avant la
bascule. Ajouter et reprendre les anciens champs sans effacer les données historiques.

Le plan Render gratuit observé pour l’ERP ne fournit pas le rétablissement PITR; une sauvegarde vérifiée doit précéder chaque migration.

**Why:** Le panneau Recovery de Render réservait le PITR aux plans payants; un dump logique complet a donc été vérifié avant la migration autorisée.

**How to apply:** Utiliser un client `pg_dump` compatible avec la version majeure du serveur, vérifier l’archive avant migration et garder la sauvegarde hors Git et des fichiers publiés.

Les tests d’une base locale sans TLS ne valident pas une connexion PostgreSQL
de production sur Render.

**Why:** Render impose TLS ; les mêmes requêtes fonctionnaient en connexion
sécurisée directe mais échouaient dans le Worker qui ne demandait pas TLS.

**How to apply:** Vérifier aussi une lecture SQL chiffrée contre la base cible
et ne pas conclure au bon fonctionnement PostgreSQL sur le seul endpoint de santé.

Un échec TLS Render dans Miniflare peut être un faux négatif pour le Worker réel.

**Why:** Après activation de TLS et mise à jour du pilote, Miniflare fermait
encore la connexion Render, tandis que le Worker déployé exécutait correctement
la connexion administrateur et les consultations métier. Hyperdrive n’était
donc pas indispensable.

**How to apply:** Confronter ce type d’échec à une requête SQL inoffensive sur
le Worker déployé avant d’imposer Hyperdrive ou un changement d’architecture.

Un push GitHub sur `main` déclenche normalement Workers Builds, mais ne garantit pas la publication : l’installation des outils peut échouer avant la compilation. Un déploiement Wrangler direct a servi de solution de repli.

**Why:** Le 3 novembre 2026, le push a bien atteint GitHub et déclenché un build Cloudflare, mais celui-ci s’est arrêté pendant l’installation de Node. `npm run cloudflare:deploy` a ensuite publié avec succès le même code après la mise à niveau du schéma Render.

**How to apply:** Avant un push, simuler puis appliquer toute migration Render autorisée. Après le push, vérifier le statut du build et la version réellement servie par le Worker; si Workers Builds échoue avant compilation, ne pas répéter le push et utiliser Wrangler après validation locale.

Les builds Cloudflare ne peuvent pas télécharger les paquets depuis les URLs internes du pare-feu npm de Replit inscrites dans le lockfile racine.

**Why:** `npm clean-install` peut échouer avec `ENOTFOUND package-firewall.replit.internal` alors que le build local réussit.

**How to apply:** Garder les URLs `resolved` du lockfile racine accessibles depuis Cloudflare, préserver versions et intégrités, puis vérifier `npm ci` et `npm run cloudflare:check` avant le push.

Un build Workers qui s’arrête avant l’installation avec le message de jeton supprimé/renouvelé doit être réparé dans la configuration Workers Builds, pas dans le code source.

**Why:** Cloudflare peut conserver un ancien jeton API sélectionné pour un Worker alors que l’ancienne version du Worker continue de fonctionner.

**How to apply:** Dans les paramètres Build du Worker, sélectionner ou créer un jeton API valide puis relancer le build; ne jamais copier sa valeur dans le dépôt ou le chat.

Le runtime Express sur Cloudflare Workers ne garantit pas `req.connection.remoteAddress`.

**Why:** Le test fonctionnel Worker a échoué lors de l’écriture de l’audit de session, car l’adresse IP était absente alors que la colonne PostgreSQL est obligatoire.

**How to apply:** Pour l’audit d’IP, lire les en-têtes Cloudflare et les propriétés Express/Node de manière optionnelle, puis fournir une valeur non nulle; valider connexion et renouvellement de session dans le Worker simulé.

Le Worker ComptaOrion de production utilise le bucket R2 `comptaorion-uploads`; le bucket historique `comptaorion-uploads-staging` est conservé vide.

**Why:** Le 3 novembre 2026, les deux buckets étaient vides au moment du basculement. L’utilisateur a choisi un bucket de production distinct, sans supprimer l’ancien.

**How to apply:** Garder `UPLOADS` lié au bucket de production. Ne pas supprimer le bucket staging ni y rediriger les fichiers clients sans accord explicite.
