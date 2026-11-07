---
name: Séquences comptables
description: Règles de numérotation séquentielle propres à chaque journal dans ComptaOrion
---

Chaque journal doit conserver son propre compteur annuel : achats/fournisseurs sur 6 chiffres, ventes/clients sur 8 chiffres. Un numéro émis ne doit jamais être réutilisé, même après la suppression de l’écriture; garder un compteur persistant et un historique des suppressions.

**Why:** l’utilisateur exige des numéros uniques et séquentiels pour les contrôles d’audit, avec une longueur distincte pour les opérations fournisseurs et clients.

**How to apply:** vérifier les chemins d’écriture directs et les suppressions; le compteur doit être transactionnel, isolé par entreprise, journal et exercice, et ne doit pas renuméroter les pièces historiques.

Avant de créer une écriture, réparer un journal existant dont le type est vide ou invalide en utilisant le type métier attendu par l’opération. Des déclencheurs historiques peuvent convertir ce champ en enum et faire échouer l’écriture, ce qui annule aussi la réception ou la facture dans la même transaction.

**Why:** une réception de stock a échoué parce que le journal d’achats existant avait un type vide; le déclencheur PostgreSQL rejetait cette valeur avant la création de l’écriture.

**How to apply:** garder cette réparation dans la transaction qui crée l’écriture et couvrir le scénario avec un test fonctionnel utilisant un journal volontairement incomplet.
