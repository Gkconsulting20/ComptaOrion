---
name: Rapprochement des factures fournisseur
description: Règles de cohérence entre réceptions, frais non facturés, factures fournisseur et comptabilité.
---

Le rapprochement fournisseur doit être vérifié de bout en bout depuis la réception liée au bon de commande. Les colonnes utilisées par les requêtes SQL de facturation doivent exister aussi dans le schéma Drizzle et être incluses dans une migration additive dédiée. Le test doit confirmer que les réceptions apparaissent, que la facture les lie, que les lignes en attente sont soldées et que l’écriture comptable est référencée.

**Why:** Le flux peut sembler raccordé côté interface alors que des colonnes absentes du schéma font échouer l’enregistrement au milieu du rapprochement.

**How to apply:** Lors de toute évolution de ce parcours, exécuter un test fonctionnel isolé « commande → réception → facture rapprochée », puis contrôler les montants pending et le lien vers l’écriture comptable.

Le numéro externe de facture fournisseur est saisi manuellement par l’utilisateur et reste distinct du numéro interne généré par ComptaOrion.

**Why:** L’utilisateur a signalé plusieurs fois que le champ du numéro externe ne permettait pas de garder le curseur ni de saisir le numéro.

**How to apply:** Garder ce champ directement éditable dans le formulaire de rapprochement, synchroniser la saisie avec l’état envoyé à l’API et vérifier qu’aucun pied fixe ou élément superposé ne bloque le clic.

Quand l’écart de prix est non nul, l’utilisateur choisit lui-même le compte actif de charge ou de produit adapté à la situation, parmi les comptes du plan de l’entreprise.

**Why:** L’utilisateur a précisé que le traitement comptable peut varier selon la situation et qu’il ne faut pas imposer un compte unique.

**How to apply:** Présenter une liste réellement sélectionnable et consultable des comptes admissibles du plan courant; conserver le compte choisi dans la facture et vérifier côté serveur qu’il appartient à l’entreprise.

Après rapprochement, la réception est liée à la facture et ne figure plus dans la liste des réceptions en attente, mais elle reste dans l’historique. Si l’écriture comptable échoue, la facture demeure visible en brouillon et peut être reprise; aucun des deux documents ne doit être supprimé.

**Why:** L’utilisateur a constaté que facture et réception semblaient disparaître après une erreur et souhaite refaire le test sans perdre les documents.

**How to apply:** Tester le cas d’échec comptable en vérifiant la facture dans la liste des brouillons et la réception dans l’historique, tout en confirmant qu’elle n’apparaît plus dans les réceptions en attente.

Toute écriture comptable complète et équilibrée est validée au moment de son enregistrement; il n’y a pas d’étape séparée de validation d’écriture. Le rapprochement publie l’écriture 408/TVA/401 et finalise la facture fournisseur dans la même transaction, puis met à jour le solde auxiliaire. En cas d’échec comptable, la facture reste brouillon sans écriture partielle; la reprise finalise la facture et son solde. Ne jamais recréer le stock déjà reçu.

**Why:** L’utilisateur demande que les écritures soient validées dès leur enregistrement et que le rapprochement fournisseur soit comptabilisé immédiatement.

**How to apply:** Vérifier par test de bout en bout que la réception apparaît au grand livre et à la balance, que le rapprochement publie 408/401/TVA et met à jour le solde fournisseur une seule fois, et qu’il ne duplique ni écriture ni mouvement de stock. Examiner séparément les anciens brouillons avant toute régularisation historique.
