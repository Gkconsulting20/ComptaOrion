---
name: Saisie numérique localisée
description: Règle d’édition des montants, quantités et taux dans l’interface ComptaOrion.
---

Les champs numériques de l’ERP doivent accepter la virgule ou le point décimal et les espaces de milliers. La saisie doit conserver son brouillon et sa position de curseur pendant que l’utilisateur tape, puis afficher le nombre groupé après la saisie.

**Why:** l’utilisateur a signalé à plusieurs reprises que les champs de montants étaient difficiles à remplir et a demandé une simplification dans tout le logiciel.

**How to apply:** utiliser le composant numérique partagé dans les nouveaux champs; éviter les champs numériques natifs contrôlés par un état qui reconvertit la valeur à chaque frappe et déplace le curseur.
