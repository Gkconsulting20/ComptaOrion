---
name: Coût de revient fournisseurs
description: Règle choisie pour intégrer les frais logistiques aux achats de stock.
---

Pour les achats de stock, répartir les frais logistiques au prorata du poids total des lignes d’articles. Conserver l’unité de stock du produit et convertir le poids unitaire saisi vers le kilogramme.

**Why:** L’utilisateur a demandé explicitement une répartition par poids plutôt que par valeur et a confirmé que les produits vendus à la pièce doivent avoir un poids par unité.

**How to apply:** Calculer le poids d’une ligne depuis sa quantité et le poids par unité de stock. Si le poids manque ou ne peut pas être converti, ne pas répartir ce coût par valeur en silence; signaler l’article à compléter.

Pour les achats, convertir l’unité saisie (par exemple tonne ou gramme) vers l’unité principale de stock du produit, en conservant aussi les valeurs d’origine de la facture. La quantité en stock et le coût unitaire doivent être normalisés dans la même unité avant le calcul du coût moyen et la répartition logistique.

**Why:** L’utilisateur a précisé qu’un produit suivi en kg peut être acheté en tonnes et que les frais doivent ensuite être répartis selon le poids converti.

**How to apply:** Pour les unités de masse, utiliser les conversions métriques vers l’unité principale; pour une unité non convertible, rejeter la ligne avec un message clair plutôt que de stocker une quantité incorrecte.

Ne pas réévaluer les ventes passées lors de la réception ultérieure de la facture; corriger seulement le stock encore disponible.

**Why:** L’utilisateur a choisi explicitement de ne pas ajuster le coût des articles déjà consommés.

**How to apply:** Calculer l’allocation à partir des lignes d’articles du même rapprochement fournisseur. N’ajuster la valeur du stock restant que si la quantité restante peut être établie de façon fiable; sinon conserver l’écart distinct et signaler la limite plutôt que d’estimer silencieusement.

Pour la bibliothèque de prix client, calculer le prix de vente par `PV = CMV × (1 + majoration/100)`. La majoration porte sur le CMV, pas sur le prix de vente.

**Why:** L’utilisateur a explicitement choisi une majoration exprimée en pourcentage du CMV.

**How to apply:** Utiliser le CMV courant révisé par les achats pour calculer les prix; une vente consomme ce coût sans recalculer le CMV unitaire.

Pour les factures fournisseurs, débiter le compte de charge correspondant à la nature de la ligne (notamment transport au compte 61) et créditer le compte collectif fournisseur 401. Garder un identifiant auxiliaire unique par fournisseur pour le suivi détaillé, sans créer un compte général distinct pour chaque fournisseur.

**Why:** L’utilisateur a demandé un seul compte fournisseur au passif, tout en conservant l’imputation par nature et l’identification individuelle des fournisseurs.

**How to apply:** Les factures et paiements fournisseurs utilisent le compte 401 commun; relier les lignes opérationnelles au fournisseur par son identifiant auxiliaire. Ne pas supprimer les anciens comptes personnalisés sans audit des soldes.
