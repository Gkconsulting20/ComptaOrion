---
name: Coût de revient fournisseurs
description: Règle choisie pour intégrer les frais logistiques aux achats de stock.
---

Pour les achats de stock, répartir les frais logistiques au prorata de la valeur des lignes d’articles.

**Why:** L’utilisateur a choisi explicitement cette règle pour que les articles plus chers reçoivent une part proportionnelle des frais.

Ne pas réévaluer les ventes passées lors de la réception ultérieure de la facture; corriger seulement le stock encore disponible.

**Why:** L’utilisateur a choisi explicitement de ne pas ajuster le coût des articles déjà consommés.

**How to apply:** Calculer l’allocation à partir des lignes d’articles du même rapprochement fournisseur. N’ajuster la valeur du stock restant que si la quantité restante peut être établie de façon fiable; sinon conserver l’écart distinct et signaler la limite plutôt que d’estimer silencieusement.
