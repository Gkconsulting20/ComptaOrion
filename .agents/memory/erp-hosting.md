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
