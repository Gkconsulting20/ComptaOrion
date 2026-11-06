---
name: Compte collectif clients
description: Règle d’identification auxiliaire et de comptabilisation des clients.
---

Chaque client reçoit un numéro auxiliaire unique. Toutes les factures, notes de débit, avoirs et règlements clients sont comptabilisés au compte collectif 4111; aucune fiche client ne choisit son propre compte général.

**Why:** l’utilisateur veut éviter la multiplication des comptes clients au grand livre tout en conservant un suivi individuel de chaque tiers.

**How to apply:** garder les identifiants auxiliaires uniques et faire pointer toutes les écritures client vers 4111, même si une fiche historique contient encore un ancien compte individuel.
