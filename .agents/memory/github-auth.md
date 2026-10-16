---
name: Authentification GitHub
description: Distinguer le statut de l’intégration GitHub de l’authentification effective des opérations Git.
---

Ne pas interpréter un statut OAuth « healthy » ou une réponse d’ajout « déjà connecté » comme la preuve qu’un push Git fonctionnera.

**Why:** Dans cet environnement, Git a refusé l’authentification alors que les outils annonçaient une connexion saine. Les formulaires de reconnexion ont ensuite refusé cette même connexion ; répéter leur ouverture n’a pas réparé l’accès.

**How to apply:** Tester l’accès par une commande Git en lecture avant tout push. En cas de contradiction persistante entre intégration et Git, guider l’utilisateur vers les paramètres Replit → Git Providers pour reconnecter GitHub, selon la documentation officielle. Ne pas chercher de jeton dans les fichiers ni demander un secret dans le chat.
