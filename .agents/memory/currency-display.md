---
name: Affichage des devises
description: Règle d’affichage du franc CFA ouest-africain dans ComptaOrion.
---

Afficher le code monétaire ISO `XOF` dans les montants visibles du logiciel plutôt que le libellé `FCFA`. `XAF` reste distinct et doit toujours être présenté comme `XAF`. Les valeurs historiques ne doivent pas être converties ou modifiées pour ce changement d’affichage.

**Why:** l’utilisateur a choisi d’afficher seulement XOF après avoir constaté que les rapports montraient « FCFA » alors que la devise de l’entreprise était XOF.

**How to apply:** normaliser uniquement les libellés d’affichage, y compris pour les anciens enregistrements dont le symbole enregistré est `FCFA`; préserver les autres codes monétaires et les données stockées.
