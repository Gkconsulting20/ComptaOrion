---
name: Tests PostgreSQL RLS
description: Vérification des politiques RLS avec un rôle réellement soumis aux politiques.
---

Les tests de Row Level Security doivent se connecter avec un rôle qui n’est ni superutilisateur ni `BYPASSRLS`, même lorsque le schéma de test est créé par un administrateur.

**Why:** Le rôle PostgreSQL du bac à sable de développement est superutilisateur et contourne RLS; des tests exécutés avec ce rôle peuvent réussir tout en laissant les données entièrement visibles.

**How to apply:** Créer un rôle restreint temporaire pour le schéma isolé, vérifier ses attributs, exécuter les requêtes d’application avec ce rôle, puis supprimer le schéma et le rôle. Ne jamais activer la RLS sur Render ou Cloudflare pendant ces tests.
