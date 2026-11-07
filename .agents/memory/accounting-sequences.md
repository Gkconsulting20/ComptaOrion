---
name: Séquences comptables
description: Règles de numérotation séquentielle propres à chaque journal dans ComptaOrion
---

Chaque journal doit conserver son propre compteur annuel : achats/fournisseurs sur 6 chiffres, ventes/clients sur 8 chiffres. Un numéro émis ne doit jamais être réutilisé, même après la suppression de l’écriture; garder un compteur persistant et un historique des suppressions.

**Why:** l’utilisateur exige des numéros uniques et séquentiels pour les contrôles d’audit, avec une longueur distincte pour les opérations fournisseurs et clients.

**How to apply:** vérifier les chemins d’écriture directs et les suppressions; le compteur doit être transactionnel, isolé par entreprise, journal et exercice, et ne doit pas renuméroter les pièces historiques.

Certaines bases existantes ont `journaux.type` en enum, même si le schéma applicatif le déclare comme texte. Dans les déclencheurs PostgreSQL, convertir ce champ en texte avant `COALESCE`; `COALESCE(type, '')` peut faire caster la chaîne vide en enum et bloquer chaque écriture, même avec un type valide. Garder aussi la réparation applicative des types vides ou invalides pour les bases où le champ est textuel.

**Why:** une réception de stock a échoué au moment de l’écriture comptable car la base de test avait un type enum; PostgreSQL rejetait la chaîne vide de `COALESCE` avant la création de l’écriture.

**How to apply:** employer `COALESCE(type::text, '')` dans les fonctions SQL de numérotation, appliquer la mise à niveau comptable ciblée aux bases concernées et vérifier l’insertion d’une écriture dans une transaction annulée avant de retester la réception complète.
