---
name: Hébergement ERP
description: Destination d'hébergement souhaitée par l'utilisateur pour l'ancien projet ERP.
---

L’utilisateur souhaite pousser l’ERP vers GitHub et utiliser Cloudflare pour l’interface, pas Replit.

**Why:** Il distingue désormais le logiciel Lite indépendant de l’ancien ERP et a explicitement choisi Cloudflare comme destination pour l’ERP.

**How to apply:** Ne pas proposer une publication Replit comme résultat de cette migration. Distinguer interface statique et serveur métier lors de la préparation Cloudflare.

L’utilisateur précise qu’il dispose déjà d’un backend fonctionnel sur Render.

**Why:** Il a refusé la proposition de migration D1 en indiquant que le backend Render est déjà fonctionnel. Le nom donné précédemment comme « base Cloudflare » désignait le stockage de fichiers R2.

**How to apply:** Réutiliser le backend Render et vérifier son raccordement à l’interface Cloudflare avant de créer le compte de test. Ne pas créer de base D1 ni supposer le moteur ou le contenu de la base existante. Ne pas supprimer les données existantes.
