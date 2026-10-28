---
name: Piste d’audit
description: Exigence de sécurité client pour l’historique des opérations ComptaOrion
---

Les clients auront besoin de la piste d’audit comme outil de sécurité. Les créations, modifications et suppressions de leurs opérations doivent laisser une trace consultable, attribuée au bon utilisateur et à la bonne entreprise. Les suppressions doivent être journalisées avant l’effacement de l’enregistrement; les secrets ne doivent jamais être copiés dans l’historique.

**Why:** l’utilisateur a précisé que les pistes d’audit sont des outils de sécurité nécessaires aux clients.

**How to apply:** pour les flux de gestion du tenant, écrire les événements d’audit dans la même transaction que la modification quand c’est possible, et toujours dériver l’auteur et l’entreprise de la session.
