---
name: Affichage des devises
description: Règle d’affichage du franc CFA ouest-africain dans ComptaOrion.
---

Afficher le code monétaire ISO `XOF` dans les montants visibles du logiciel plutôt que le libellé `FCFA`. `XAF` reste distinct et doit toujours être présenté comme `XAF`. Les valeurs historiques ne doivent pas être converties ou modifiées pour ce changement d’affichage.

Pour les montants XOF, grouper les milliers avec des espaces selon le format français et afficher exactement deux décimales (exemple : `1 234 567,00 XOF`).

**Why:** l’utilisateur a choisi XOF avec deux décimales pour garder une précision suffisante dans les comptes, après avoir constaté que les rapports montraient « FCFA » alors que la devise de l’entreprise était XOF.

**How to apply:** normaliser uniquement les libellés et le format d’affichage, y compris pour les anciens enregistrements dont le symbole enregistré est `FCFA`; préserver les autres codes monétaires et les données stockées.
