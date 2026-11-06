---
name: Rapprochement des factures fournisseur
description: Règles de cohérence entre réceptions, frais non facturés, factures fournisseur et comptabilité.
---

Le rapprochement fournisseur doit être vérifié de bout en bout depuis la réception liée au bon de commande. Les colonnes utilisées par les requêtes SQL de facturation doivent exister aussi dans le schéma Drizzle et être incluses dans une migration additive dédiée. Le test doit confirmer que les réceptions apparaissent, que la facture les lie, que les lignes en attente sont soldées et que l’écriture comptable est référencée.

**Why:** Le flux peut sembler raccordé côté interface alors que des colonnes absentes du schéma font échouer l’enregistrement au milieu du rapprochement.

**How to apply:** Lors de toute évolution de ce parcours, exécuter un test fonctionnel isolé « commande → réception → facture rapprochée », puis contrôler les montants pending et le lien vers l’écriture comptable.
