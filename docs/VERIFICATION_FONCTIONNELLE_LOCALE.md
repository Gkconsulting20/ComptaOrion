# Vérification fonctionnelle de l’ERP dans l’environnement de développement

Date : 16 octobre 2026.

## Conclusion

L’ERP démarre et ses principaux services répondent, mais il ne peut pas encore
être déclaré entièrement fonctionnel. Des consultations échouent sur la base
actuelle, notamment pour les stocks, les dépenses et les immobilisations.

Cette vérification ne constitue ni une certification comptable ni une validation
des opérations de création, modification, paiement et suppression.

## Méthode

- Exécution de `npm test` et `npm run build`.
- Vérification des journaux du serveur en cours d’exécution.
- Vérification HTTP de l’interface et de `/api/health` via le domaine de prévisualisation.
- Capture de la page publique de connexion.
- Contrôle des API métier sur une instance locale du même serveur, reliée à la
  base de développement avec `default_transaction_read_only=on`, confirmé par SQL.
- Utilisation en mémoire d’un jeton signé pour un utilisateur actif existant,
  sans afficher ni conserver le jeton. Ce contrôle ne teste pas la saisie du
  mot de passe ni une connexion réussie depuis le navigateur.
- Aucun enregistrement métier créé, modifié ou supprimé ; aucune migration.

## Contrôles réussis

- 9 tests automatisés réussis : 3 frontend et 6 backend.
- Compilation de production réussie.
- Frontend et API accessibles via la prévisualisation : HTTP 200.
- Page de connexion visible.
- Requêtes privées sans session ou avec jeton invalide : HTTP 401.
- Connexion sans les champs requis : HTTP 400.
- IA désactivée dans les journaux ; route IA indisponible avec un jeton valide :
  HTTP 404, comportement attendu.

### Consultations authentifiées avec réponse HTTP 200

Les résultats ci-dessous confirment la disponibilité des consultations, pas
l’exactitude de tous les montants ou la totalité des comportements des écrans.

| Domaine | Consultations contrôlées |
|---|---|
| Session | Profil `/api/auth/me` |
| Tableau de bord | Indicateurs globaux |
| Ventes | Clients, produits, stock faible, devis, factures, bons de livraison |
| Achats | Fournisseurs, commandes d’achat, factures d’achat, échéances, réceptions en attente de facturation |
| Stock | Catégories, produits avec paramètre entreprise, entrepôts, mouvements, état des stocks |
| Trésorerie | Comptes, mouvements, encaissements, décaissements, catégories, prévisions, rapprochements |
| Comptabilité | Plans avec paramètre entreprise, comptes, journaux, écritures, grand-livre, balance, bilan, résultat, flux de trésorerie |
| Récurrence | Liste des écritures récurrentes |
| Paramètres | Entreprise, devises de référence, taux de TVA |
| Fiscalité | Résumé TVA, paramètres, déclarations |
| Intégrations | Domaines exportables, configurations et tâches de sauvegarde |
| Multidevise | Devises, devise principale, taux |

Les endpoints `/api/stock/produits` et `/api/comptabilite/plans` renvoient
une erreur 500 sans `entrepriseId` dans la requête, mais répondent avec ce
paramètre. Leur dépendance à une entreprise fournie par le client mérite une
revue d’isolation : ce contrôle n’a pas testé l’accès entre entreprises.

## Échecs confirmés

Ces huit consultations renvoient HTTP 500, y compris avec le paramètre entreprise :

| Endpoint | Fonction concernée |
|---|---|
| `/api/stock/receptions` | Liste des réceptions |
| `/api/stock/alertes` | Alertes de stock |
| `/api/stock/rapports/valorisation` | Valorisation de stock |
| `/api/depenses/list` | Liste des dépenses |
| `/api/depenses/categories` | Catégories de dépenses |
| `/api/immobilisations/list` | Liste des immobilisations |
| `/api/immobilisations/categories` | Catégories d’immobilisations |
| `/api/immobilisations/registre` | Registre des immobilisations |

L’inspection des métadonnées confirme l’absence des tables publiques suivantes :

- `valorisations_stock`
- `alertes_stock`
- `categories_depenses`
- `categories_immobilisations`
- `amortissements`

Les tables `depenses`, `immobilisations` et `bons_reception` existent. Il faut
donc comparer également leurs colonnes aux requêtes et aux migrations :
la présence d’une table ne suffit pas à garantir sa compatibilité.
Les causes précises de chaque échec n’ont pas toutes été établies.

Des chemins racines essayés lors du repérage renvoyaient 404 parce que les routes
réelles utilisent des sous-chemins : par exemple `/api/achats/factures`,
`/api/depenses/list` et `/api/immobilisations/list`. Ces 404 de repérage
ne sont pas comptés comme des fonctionnalités défectueuses.

## Autres observations

- La compilation signale un fichier JavaScript principal d’environ 925 ko :
  avertissement de performance, sans blocage de compilation.
- Le navigateur signale une ressource 404 non identifiée et l’absence
  d’attribut d’autocomplétion sur le champ mot de passe.
- FedaPay démarre en mode sandbox : aucun paiement réel vérifié.

## Non vérifié

- Connexion réussie avec mot de passe, renouvellement et déconnexion réels.
- Navigation des écrans après connexion dans le navigateur.
- Création, modification, annulation et suppression de documents.
- Chaîne devis → facture → paiement → écritures et concordance des rapports.
- Mise à jour des stocks, clôture, amortissements et rapprochement réel.
- Cloisonnement entre entreprises et droits de chaque rôle.
- Imports, restauration de sauvegarde, envoi d’emails et stockage durable des fichiers.
- Déploiement et fonctionnement sur Cloudflare.

## Suite recommandée

1. Comparer le schéma de développement aux migrations prévues, sans suppression
   ni remplacement de la base.
2. Préparer les mises à niveau manquantes et corriger les consultations en erreur.
3. Vérifier les droits et l’isolation des routes qui acceptent un identifiant entreprise.
4. Tester un cycle métier complet sur des données de test isolées, puis les
   écrans authentifiés, avant toute ouverture commerciale.
