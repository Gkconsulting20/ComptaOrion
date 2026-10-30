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

Le push de `main` sur GitHub déclenche automatiquement le déploiement de production Cloudflare.

**Why:** Le Worker de l’ERP est relié à Workers Builds; son déclencheur exécute `npm run build` puis `npx wrangler deploy`. Un push avant la mise à niveau du schéma Render peut donc publier du code qui attend des tables absentes.

**How to apply:** Simuler la migration avec l’URL Render, appliquer la migration additive sur la base confirmée, vérifier qu’une simulation suivante ne prévoit plus de changements, puis pousser `main` et contrôler le résultat du build correspondant au commit.

Les builds Cloudflare ne peuvent pas télécharger les paquets depuis les URLs internes du pare-feu npm de Replit inscrites dans le lockfile racine.

**Why:** `npm clean-install` peut échouer avec `ENOTFOUND package-firewall.replit.internal` alors que le build local réussit.

**How to apply:** Garder les URLs `resolved` du lockfile racine accessibles depuis Cloudflare, préserver versions et intégrités, puis vérifier `npm ci` et `npm run cloudflare:check` avant le push.

Un build Workers qui s’arrête avant l’installation avec le message de jeton supprimé/renouvelé doit être réparé dans la configuration Workers Builds, pas dans le code source.

**Why:** Cloudflare peut conserver un ancien jeton API sélectionné pour un Worker alors que l’ancienne version du Worker continue de fonctionner.

**How to apply:** Dans les paramètres Build du Worker, sélectionner ou créer un jeton API valide puis relancer le build; ne jamais copier sa valeur dans le dépôt ou le chat.
