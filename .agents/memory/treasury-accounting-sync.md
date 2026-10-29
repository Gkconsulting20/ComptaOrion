---
name: Synchronisation comptabilité-trésorerie
description: Règles durables pour garder les mouvements bancaires et les journaux comptables cohérents.
---

Une écriture validée au journal de banque doit être rapprochée du compte comptable lié au compte bancaire réel. Une synchronisation doit être idempotente et ne jamais recréer un mouvement déjà enregistré par le parcours de paiement. Toute création manuelle de mouvement doit garder sa trace d’audit dans la même transaction.

**Why:** L’exercice KOMLANVI a révélé que les règlements étaient enregistrés dans la trésorerie sur le compte bancaire 5121, mais dans le grand livre sur un compte 52 générique; les salaires comptabilisés ne figuraient pas dans les mouvements de trésorerie.

**How to apply:** Pour les changements de paiement, de validation d’écriture ou de tableau de bord, utiliser le compte comptable associé au compte bancaire de l’entreprise et vérifier l’absence de doublon entre les routes de paiement et la synchronisation des journaux.
