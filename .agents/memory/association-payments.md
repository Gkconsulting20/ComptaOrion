---
name: Paiements associatifs
description: Règles comptables durables pour le paiement des dépenses d’un projet associatif.
---

Les dépenses enregistrées et leur approbation ne prouvent pas qu’un décaissement a eu lieu. Calculer les dépenses réellement payées à partir des paiements datés, afficher séparément le montant engagé et le solde à payer, et conserver un statut d’approbation distinct du statut de paiement.

Chaque paiement réel doit créer, dans la même transaction, un enregistrement de paiement et une écriture comptable équilibrée : débit du compte de charge ou d’immobilisation choisi, crédit du compte de banque ou de caisse choisi. Refuser les paiements qui dépassent le solde restant et conserver l’historique des paiements partiels.

**Why:** les rapports associatifs doivent distinguer un dossier soumis à validation d’un décaissement réellement effectué, sans gonfler les dépenses payées.

**How to apply:** appliquer ces règles aux rapports de projet et aux parcours d’enregistrement des paiements, en conservant l’isolation par entreprise et l’écriture comptable dans une transaction atomique.
