---
name: Séparation de Lite
description: Intention produit concernant l’indépendance de Lite et la réutilisation du code existant.
---

Lite doit être un nouveau projet distinct de l’ERP, en partant de l’ancien projet et non en reconstruisant à zéro.

**Why:** L’utilisateur souhaite distinguer le nouveau logiciel léger de l’ancien ERP et a précisé « en partant de l’ancien ».

**How to apply:** Réutiliser les fonctionnalités et services existants dans une copie indépendante. Ne pas considérer une simple route `/lite` dans l’ERP comme la séparation demandée. L’utilisateur a confirmé que la version Lite indépendante fonctionne et a demandé son retrait de ce projet : ne pas la réintégrer ici. Conserver les données et services métier partagés nécessaires à l’ERP.
