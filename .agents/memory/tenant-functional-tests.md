---
name: Recettes multi-tenant
description: Conventions de tests PostgreSQL isolés couvrant plusieurs utilisateurs et entreprises.
---

Dans une recette qui change d’identité, conserver un état de session distinct par acteur et ouvrir une session dédiée avant de valider sa déconnexion. Ne pas supposer le statut d’une route sans tenir compte de l’ordre des contrôles d’accès et de disponibilité du module.

**Why:** les tests complets peuvent réussir toutes les opérations métier puis échouer sur une attente de statut ou un cookie périmé, donnant un faux diagnostic de régression.

**How to apply:** lors d’une recette réunissant administrateur, comptable externe et second tenant, vérifier séparément l’identité active et la session utilisée pour chaque opération.
