---
name: Recettes multi-tenant
description: Conventions de tests PostgreSQL isolés couvrant plusieurs utilisateurs et entreprises.
---

Dans une recette qui change d’identité, conserver un état de session distinct par acteur et ouvrir une session dédiée avant de valider sa déconnexion. Ne pas supposer le statut d’une route sans tenir compte de l’ordre des contrôles d’accès et de disponibilité du module.

**Why:** les tests complets peuvent réussir toutes les opérations métier puis échouer sur une attente de statut ou un cookie périmé, donnant un faux diagnostic de régression.

**How to apply:** lors d’une recette réunissant administrateur, comptable externe et second tenant, vérifier séparément l’identité active et la session utilisée pour chaque opération.

Tester aussi la mise à niveau d’une base existante, pas seulement une base neuve produite depuis le schéma courant. Vérifier les contraintes historiques et les tables manquantes.

**Why:** la recette isolée réussissait alors que de nouvelles entreprises restaient bloquées dans l’application : d’anciennes contraintes imposaient des numéros uniques entre toutes les entreprises et des tables de rapports associatifs manquaient. Le schéma neuf ne reproduisait pas ces défauts.

**How to apply:** préparer un état ancien représentatif, appliquer la migration ciblée, puis tester deux entreprises utilisant les mêmes premiers numéros. Conserver l’interdiction des doublons dans une même entreprise et les protections d’isolation des tables ajoutées.
