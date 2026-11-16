---
name: Tests PostgreSQL RLS
description: Vérification des politiques RLS avec un rôle réellement soumis aux politiques.
---

Les tests de Row Level Security doivent se connecter avec un rôle qui n’est ni superutilisateur ni `BYPASSRLS`, même lorsque le schéma de test est créé par un administrateur.

**Why:** Le rôle PostgreSQL du bac à sable de développement est superutilisateur et contourne RLS; des tests exécutés avec ce rôle peuvent réussir tout en laissant les données entièrement visibles.

**How to apply:** Créer un rôle restreint temporaire pour le schéma isolé, vérifier ses attributs, exécuter les requêtes d’application avec ce rôle, puis supprimer le schéma et le rôle. Ne jamais activer la RLS sur Render ou Cloudflare pendant ces tests.

Une reprise de données multi-entreprises doit définir explicitement son contexte de maintenance autorisé dans la transaction, puis le laisser expirer à la fin de celle-ci.

**Why:** Avec FORCE RLS, une migration sans contexte d’entreprise peut lire zéro ligne sans échouer. Le superutilisateur de développement masque ce défaut : une reprise peut sembler réussie mais omettre silencieusement les données historiques.

**How to apply:** Tester également les reprises de données avec un rôle sans privilège de contournement, à partir de données historiques existantes. Vérifier leur effet métier après migration et la disparition de l’accès global au commit ou rollback.
