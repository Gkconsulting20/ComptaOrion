---
name: Hébergement ERP
description: Destination d'hébergement souhaitée par l'utilisateur pour l'ancien projet ERP.
---

L’utilisateur souhaite pousser l’ERP vers GitHub et utiliser Cloudflare pour l’interface, pas Replit.

**Why:** Il distingue désormais le logiciel Lite indépendant de l’ancien ERP et a explicitement choisi Cloudflare comme destination pour l’ERP.

**How to apply:** Ne pas proposer une publication Replit comme résultat de cette migration. Distinguer interface statique et serveur métier lors de la préparation Cloudflare.

L’utilisateur demande maintenant une base PostgreSQL Supabase pour remplacer Render.

**Why:** Il a explicitement changé la cible de base de données après avoir demandé de remplacer Render par Supabase.

**How to apply:** Garder le frontend et le backend sur Cloudflare. Traiter Supabase PostgreSQL comme cible, mais conserver Render jusqu’à la migration du schéma et des données, aux contrôles de cohérence et aux tests de l’application. Ne pas créer de D1 ou de service Web Render et ne pas supprimer les données Render avant validation.

Le preview Replit et le Worker Cloudflare utilisent des bases distinctes : le preview suit sa propre configuration `DATABASE_URL`, tandis que le Worker de production utilise Render.

**Why:** Le même compte administrateur existait dans les deux environnements avec des mots de passe différents ; une connexion réussie dans l’un ne validait pas l’autre.

**How to apply:** Avant toute modification de compte ou de données, identifier la base réellement utilisée par l’environnement ciblé et vérifier ce dernier directement après l’opération.
