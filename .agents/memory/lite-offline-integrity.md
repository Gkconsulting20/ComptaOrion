---
name: Intégrité hors ligne de Lite
description: Règle de cohérence pour étendre les opérations hors ligne de ComptaOrion Lite.
---

Une écriture ne doit être ajoutée à la file hors ligne Lite que si le serveur garantit l’idempotence et regroupe l’opération métier avec la validation de la clé dans une même transaction.

**Why:** Une simple relance HTTP après une réponse perdue peut dupliquer une vente, un paiement ou un mouvement de stock. Une clé enregistrée séparément de l’opération peut aussi rester bloquée ou devenir incohérente après une panne.

**How to apply:** Pour toute nouvelle écriture hors ligne, créer d’abord un endpoint atomique et une gestion transactionnelle de la clé d’idempotence, puis seulement ajouter cet endpoint à la liste des opérations que le client peut mettre en attente.