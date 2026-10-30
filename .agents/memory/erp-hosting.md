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

Pour les opérations de base de données et de Cloudflare, l’utilisateur préfère que l’agent réalise les étapes possibles et lui donne des instructions simples uniquement pour les actions qui exigent son intervention.

**Why:** L’utilisateur a indiqué ne pas pouvoir créer lui-même les bases de données et a demandé de l’aide pour ces opérations.

**How to apply:** Privilégier les procédures que l’agent peut effectuer avec les outils connectés; demander uniquement les validations ou actions qui ne sont pas accessibles à l’agent.

Les sauvegardes Render doivent utiliser un client `pg_dump` de la même version majeure que la base PostgreSQL 18; le canal Nix épinglé du projet ne fournit pas cette version.

**Why:** Un client PostgreSQL plus ancien ne prend pas en charge correctement un serveur plus récent, et le canal de paquets du projet était en retard sur la version du serveur.

**How to apply:** Pour une sauvegarde de production, utiliser un client PostgreSQL 18 temporaire, chiffrer l’archive et vérifier son intégrité avant toute migration; ne pas ajouter cet outil de sauvegarde aux dépendances d’exécution de l’application.
