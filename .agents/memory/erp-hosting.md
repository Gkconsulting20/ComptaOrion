---
name: Hébergement ERP
description: Destination d'hébergement souhaitée par l'utilisateur pour l'ancien projet ERP.
---

L’utilisateur souhaite pousser l’ERP vers GitHub et utiliser Cloudflare pour l’interface, pas Replit.

**Why:** Il distingue désormais le logiciel Lite indépendant de l’ancien ERP et a explicitement choisi Cloudflare comme destination pour l’ERP.

**How to apply:** Ne pas proposer une publication Replit comme résultat de cette migration. Distinguer interface statique et serveur métier lors de la préparation Cloudflare.

Render reste la base active pour le moment. L’utilisateur prévoit créer Supabase plus tard, sans basculer l’application maintenant.

**Why:** L’utilisateur a confirmé qu’il créera Supabase plus tard, mais qu’il souhaite rester sur Render pour le moment.

**How to apply:** Garder Render comme base active et ne pas modifier la connexion Cloudflare vers Supabase avant une décision explicite et une migration sauvegardée, testée et validée. Ne pas supprimer les données Render avant validation.

Le preview Replit et le Worker Cloudflare utilisent des bases distinctes : le preview suit sa propre configuration `DATABASE_URL`, tandis que le Worker de production utilise Render.

**Why:** Le même compte administrateur existait dans les deux environnements avec des mots de passe différents ; une connexion réussie dans l’un ne validait pas l’autre.

**How to apply:** Avant toute modification de compte ou de données, identifier la base réellement utilisée par l’environnement ciblé et vérifier ce dernier directement après l’opération.

La version d’essai client de 30 jours est servie par le Worker public ComptaOrion (`comptaorion.com`); `orion-test` concerne un autre produit et ne doit pas être utilisé pour l’ERP.

**Why:** L’utilisateur a précisé que la version à partager aux prospects est l’inscription gratuite de 30 jours sur ComptaOrion, et que le Worker `orion-test` n’est pas la comptabilité.

**How to apply:** Pour publier l’essai destiné aux clients, mettre à jour le Worker existant `comptaorion` et vérifier `/inscription`; ne pas créer ou déployer l’ERP sur `orion-test`.

L’essai gratuit client commence le jour où l’organisation est créée et expire 30 jours plus tard.

**Why:** L’utilisateur a précisé que le test commence au moment où le client crée son organisation.

**How to apply:** Calculer l’expiration depuis la création de l’organisation; une modification ultérieure du forfait ne doit pas redémarrer les 30 jours.

Pour les opérations de base de données et de Cloudflare, l’utilisateur préfère que l’agent réalise les étapes possibles et lui donne des instructions simples uniquement pour les actions qui exigent son intervention.

**Why:** L’utilisateur a indiqué ne pas pouvoir créer lui-même les bases de données et a demandé de l’aide pour ces opérations.

**How to apply:** Privilégier les procédures que l’agent peut effectuer avec les outils connectés; demander uniquement les validations ou actions qui ne sont pas accessibles à l’agent.

Les sauvegardes Render doivent utiliser un client `pg_dump` de la même version majeure que la base PostgreSQL 18; le canal Nix épinglé du projet ne fournit pas cette version.

**Why:** Un client PostgreSQL plus ancien ne prend pas en charge correctement un serveur plus récent, et le canal de paquets du projet était en retard sur la version du serveur.

**How to apply:** Pour une sauvegarde de production, utiliser un client PostgreSQL 18 temporaire, chiffrer l’archive et vérifier son intégrité avant toute migration; ne pas ajouter cet outil de sauvegarde aux dépendances d’exécution de l’application.
