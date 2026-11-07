---
name: Validation réelle des actions UI
description: Règles de vérification des boutons et formulaires de ComptaOrion avant de déclarer une fonction opérationnelle.
---

Pour ComptaOrion, un build réussi, un test unitaire ou une réponse API 2xx ne suffisent pas à prouver qu’un bouton fonctionne. Vérifier l’action avec une session authentifiée et un vrai clic, puis confirmer le résultat visible et l’état enregistré. Employer des enregistrements explicitement marqués comme tests et les nettoyer après vérification. Ne pas publier les changements sur Cloudflare sans demande explicite.

**Why:** l’utilisateur a signalé à plusieurs reprises que des fonctions annoncées comme testées restaient inutilisables dans l’interface.

**How to apply:** pour chaque action contrôlée, distinguer « réussie », « échouée » et « bloquée par les données ou l’accès »; ne jamais présenter un contrôle partiel comme une validation exhaustive.
