---
name: Hébergement ERP
description: Destination d'hébergement souhaitée par l'utilisateur pour l'ancien projet ERP.
---

L’utilisateur souhaite pousser l’ERP vers GitHub et l’héberger sur Cloudflare, pas sur Replit.

**Why:** Il distingue désormais le logiciel Lite indépendant de l’ancien ERP et a explicitement choisi Cloudflare comme destination pour l’ERP.

**How to apply:** Ne pas proposer une publication Replit comme résultat de cette migration. Distinguer interface statique et serveur métier lors de la préparation Cloudflare.

L’utilisateur veut utiliser la base créée sur Cloudflare pour l’ERP et ne veut plus conserver PostgreSQL comme cible par défaut.

**Why:** Il a explicitement corrigé le choix de PostgreSQL et demande un compte administrateur pour tester sur Cloudflare.

**How to apply:** Identifier la base Cloudflare exacte avant d’y écrire et vérifier la compatibilité du serveur avec son moteur. Ne pas choisir une base d’un autre projet et ne pas supprimer l’ancienne base.
