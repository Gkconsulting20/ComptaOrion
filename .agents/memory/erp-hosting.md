---
name: Hébergement ERP
description: Destination d'hébergement souhaitée par l'utilisateur pour l'ancien projet ERP.
---

L’utilisateur souhaite pousser l’ERP vers GitHub et utiliser Cloudflare pour l’interface, pas Replit.

**Why:** Il distingue désormais le logiciel Lite indépendant de l’ancien ERP et a explicitement choisi Cloudflare comme destination pour l’ERP.

**How to apply:** Ne pas proposer une publication Replit comme résultat de cette migration. Distinguer interface statique et serveur métier lors de la préparation Cloudflare.

L’utilisateur confirme qu’il dispose uniquement d’une base PostgreSQL sur Render, sans service Web Render.

**Why:** Il a clarifié explicitement cette distinction après avoir employé le mot « backend » pour désigner sa base. Le nom donné précédemment comme « base Cloudflare » désignait le stockage de fichiers R2.

**How to apply:** Garder le frontend et le backend dans le Worker Cloudflare et raccorder celui-ci à la base PostgreSQL Render existante. Vérifier la base cible et les comptes existants avant de créer un administrateur de test. Ne pas créer de base D1 ni de service Web Render. Ne pas supprimer les données existantes.
