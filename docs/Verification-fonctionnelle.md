# Vérification fonctionnelle de ComptaOrion

Dernière vérification : 16 novembre 2026.

## Périmètre

Cette vérification concerne le code de développement destiné à GitHub. Elle ne
certifie ni le déploiement Cloudflare en cours ni le schéma de sa base de
production. Aucune migration de production et aucun paiement réel n'ont été
effectués.

La recette fonctionnelle utilise un schéma PostgreSQL jetable et un rôle sans
privilège de contournement de l'isolation des entreprises. Elle s'exécute
séparément contre le serveur habituel et le Worker local Cloudflare.
Les services externes d'envoi d'e-mails et de paiement y sont désactivés.

## Résultats

| Contrôle | Résultat |
| --- | --- |
| Tests interface, documentation et utilitaires | 44 réussis |
| Tests serveur | 114 réussis |
| Recette fonctionnelle serveur | Réussie |
| Même recette dans le Worker Cloudflare local | Réussie |
| Compilation du site et assemblage du Worker à blanc | Réussis |
| Contrôles Worker : santé, refus d'accès anonyme et stockage R2 | Réussis |

Le test fonctionnel est volontairement ignoré pendant la commande unitaire
serveur, puis exécuté explicitement dans les deux modes. Le test ignoré dans
la première commande ne représente donc pas une recette manquante.

## Fonctions couvertes par les scénarios automatisés

- Inscription et essai, authentification, sessions et contrôles d'accès.
- Séparation des données et des droits de plusieurs entreprises.
- Clients, fournisseurs et comptes auxiliaires.
- Produits, commandes d'achat, réceptions et rapprochement de factures.
- Calcul des coûts, quantités, TVA, valorisation et comptes d'écart.
- Factures et règlements clients, ajustements et contrôles associés.
- Écritures, grand livre, balance, rapports et contrôles d'exercice.
- Budgets, financements et dépenses associatives.
- Parcours d'import couverts par les jeux de données de la recette.
- Numérotation multi-entreprise, y compris migration des anciennes contraintes.

Les assertions précises sont conservées dans `backend/test/functional.test.js`
et les tests unitaires de `backend/test/` et `frontend/test/`. Une catégorie
citée ci-dessus ne signifie pas que toutes ses combinaisons possibles ont été
testées.

## Guide actualisé

Le guide est accessible depuis l'application et l'espace d'administration SaaS :
ils utilisent le même document `docs/Guide-demarrage-ComptaOrion.html`, inclus
dans les fichiers du site à la compilation.

La mise à jour précise :

- les tarifs mensuels et annuels des trois forfaits, avec contrôle automatique
  de leur cohérence avec l'offre commerciale ;
- les trois utilisateurs inclus, l'accès cabinet supplémentaire et sa limite
  de disponibilité, ainsi que l'essai de 30 jours ;
- les comptes collectifs clients 4111 pour les biens et 4112 pour les services ;
- la préparation de l'entrepôt et des produits, les poids à la réception et
  la distinction entre coût standard et coût de revient ;
- les étapes du rapprochement, la TVA, l'échéance et le changement du compte
  d'écart avant création ;
- le passage réception → compte temporaire → facture fournisseur ;
- l'enregistrement immédiatement validé des écritures comptables ;
- la génération, le téléchargement et l'impression des rapports ;
- le caractère actuel, et non historique, de la valorisation de stock.

## Limites conservées explicitement

- Les tests API et de compilation ne prouvent pas, à eux seuls, le
  fonctionnement de chaque bouton dans un navigateur. Les parcours de
  réception, rapprochement et rapports ont fait l'objet d'une recette
  navigateur antérieure ; cette dernière passe n'est pas une nouvelle recette
  interactive de tous les écrans.
- La valorisation du stock à une date passée reste indisponible.
- Le parcours complet d'invitation et de connexion du cabinet comptable reste
  à valider avant de le présenter comme opérationnel.
- Les paiements d'abonnement Stripe/FedaPay restent à finaliser ; le Worker
  est configuré en mode FedaPay sandbox.
- Le suivi fiscal est indicatif, sans dépôt officiel ni paiement automatique.
- Les contrôles mensuels indépendants de la clôture annuelle restent à
  compléter. Paie, immobilisations et assistant IA restent hors offre active.
- Cette vérification n'est pas un audit de sécurité, un test de charge, une
  reprise exhaustive de données d'un logiciel tiers ou une validation de la
  base de production.

## Commandes de reproduction

Depuis la racine du projet, sur une base de développement :

```sh
npm test
npm run cloudflare:check
npm run test:functional
npm run test:worker
npm run test:cloudflare
```

Les recettes fonctionnelles créent puis nettoient leur propre schéma. Les
opérations `cloudflare:check` ne publient pas le Worker. Le passage GitHub vers
Cloudflare reste le circuit de publication demandé par le propriétaire.
