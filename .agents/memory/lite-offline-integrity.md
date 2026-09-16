---
name: Intégrité hors ligne de Lite
description: Règle de cohérence pour étendre les opérations hors ligne de ComptaOrion Lite.
---

Une écriture ne doit être ajoutée à la file hors ligne Lite que si le serveur garantit l’idempotence et regroupe l’opération métier avec la validation de la clé dans une même transaction.

**Why:** Une simple relance HTTP après une réponse perdue peut dupliquer une vente, un paiement ou un mouvement de stock. Une clé enregistrée séparément de l’opération peut aussi rester bloquée ou devenir incohérente après une panne.

Lorsqu’une vente verrouille plusieurs produits, elle doit toujours les verrouiller dans un ordre déterministe.

**Why:** Deux ventes concurrentes qui verrouillent les mêmes produits dans des ordres opposés peuvent provoquer un interblocage même si chaque mise à jour est transactionnelle.

**How to apply:** Pour toute nouvelle écriture hors ligne, créer d’abord un endpoint atomique et une gestion transactionnelle de la clé d’idempotence. Pour les lots de ressources verrouillées, dédupliquer et trier les identifiants avant les verrous.