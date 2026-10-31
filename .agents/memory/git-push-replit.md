---
name: Push Git depuis Replit
description: Distinguer l’envoi distant réussi d’un échec local de mise à jour de la référence Git.
---

Un `git push origin main` peut envoyer les commits avec succès, puis retourner une erreur parce que Replit bloque la modification de `.git/refs/remotes/origin/main.lock`.

**Why:** l’erreur survient après la mise à jour distante, pendant l’actualisation de la référence locale de suivi ; répéter le push n’est généralement pas nécessaire.

**How to apply:** après une sortie indiquant `main -> main` puis une erreur de verrou local, confirmer le commit distant avec `git ls-remote origin refs/heads/main` avant toute nouvelle tentative. Ne pas contourner le verrou avec `DANGEROUSLY_ALLOW_GIT` sans raison.
