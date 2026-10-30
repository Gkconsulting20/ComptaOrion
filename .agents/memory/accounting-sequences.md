---
name: Séquences comptables
description: Règles de numérotation séquentielle propres à chaque journal dans ComptaOrion
---

Chaque journal doit conserver son propre compteur annuel : achats/fournisseurs sur 6 chiffres, ventes/clients sur 8 chiffres. Un numéro émis ne doit jamais être réutilisé, même après la suppression de l’écriture; garder un compteur persistant et un historique des suppressions.

**Why:** l’utilisateur exige des numéros uniques et séquentiels pour les contrôles d’audit, avec une longueur distincte pour les opérations fournisseurs et clients.

**How to apply:** vérifier les chemins d’écriture directs et les suppressions; le compteur doit être transactionnel, isolé par entreprise, journal et exercice, et ne doit pas renuméroter les pièces historiques.
