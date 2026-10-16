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
