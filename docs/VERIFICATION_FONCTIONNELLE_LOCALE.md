# Vérification fonctionnelle de l’ERP — local et Cloudflare

## Vérification Cloudflare et Render — 16 octobre 2026

- La nouvelle base PostgreSQL Render est initialisée : 84 tables.
- Un administrateur actif a été créé via le Worker Cloudflare dans l’entreprise
  de test « ComptaOrion — Tests ». Aucun identifiant de connexion n’est consigné
  dans ce document.
- La présence du compte et son mot de passe haché ont été vérifiés directement
  dans la base cible ; son rôle est `admin`.
- Le plan SYSCOHADA contient 263 comptes et 8 journaux pour cette entreprise.
- Connexion par `/api/auth-security/login` : HTTP 200, comme pour l’écran
  de connexion. Déconnexion avec l’identifiant de session : HTTP 200.
- Profil, tableau de bord global, indicateurs, clients, produits, factures,
  réceptions et alertes de stock, dépenses et catégories, immobilisations,
  catégories et registre : consultations authentifiées HTTP 200 sur le Worker.
- Les sessions utilisées par ces contrôles ont été fermées.
- L’API IA reste désactivée (HTTP 404).
- Aucun client, produit, facture, paiement ou dépense de démonstration n’a été
  créé dans cette base pendant ces contrôles.
- La connexion directe chiffrée Cloudflare–Render fonctionne après correction
  TLS et mise à jour du pilote. Hyperdrive n’a pas été créé et n’est pas requis
  pour les contrôles ci-dessus.

Ces contrôles sont des tests HTTP et SQL. Ils ne constituent pas une
vérification visuelle des écrans connectés ni une recette complète des
factures/paiements sur Render. Les résultats locaux historiques ci-dessous
ne remplacent pas ces validations avant ouverture commerciale.

## Historique des vérifications locales

> Mise à jour après corrections : une mise à niveau additive de la base et les
> corrections de routes ont été réalisées. Une recette isolée couvre désormais
> connexion, facture, paiement, comptabilité, dépenses et immobilisations.
> Le diagnostic ci-dessous est conservé comme état initial, pas comme liste
> des défauts actuels. Voir aussi `DEPLOIEMENT_CLOUDFLARE.md`.

## Résultat après corrections

- Les huit consultations en erreur dans le diagnostic initial répondent
  maintenant HTTP 200 sur le serveur local avec la base existante.
- Sauvegarde PostgreSQL effectuée avant la mise à niveau ; les anciennes
  immobilisations ont été conservées, avec reprise des catégories et valeurs.
- 12 tests unitaires/contrats réussis, plus une recette fonctionnelle séparée
  sur schéma jetable. La recette est aussi réussie dans le runtime Workers local.
- Parcours testé : inscription, connexion avec mot de passe, consultations,
  client, produit, facture, paiement, écritures équilibrées, immobilisation,
  dépense, upload/lecture/suppression de logo, déconnexion.
- Deux paiements concurrents pour le même solde : un paiement accepté,
  l’autre refusé ; factures numérotées sans collision entre deux entreprises.
- Contrôles ciblés de séparation : facture d’une autre entreprise inaccessible
  et paramètre entreprise falsifié ignoré. Ce n’est pas un audit exhaustif des droits.
- Compilation frontend, bundle Wrangler et tests R2/HTTP du Worker réussis.
- Audits npm : aucune vulnérabilité à la racine et dans le frontend ;
  quatre alertes modérées restent dans la chaîne d’outillage Drizzle/esbuild
  du backend. Aucune correction forcée avec rétrogradation de Drizzle appliquée.
- Page publique vérifiée visuellement ; écrans après connexion non vérifiés
  visuellement. Les tests de connexion et métier ci-dessus passent par HTTP.
- Pas de publication distante, de migration de Neon ni de modification
  d’un Worker Cloudflare existant.

Les limites restantes comprennent les services externes simulés, la fiscalité,
les autres rôles et parcours non couverts, les restaurations et la validation
visuelle des écrans connectés. La préproduction doit encore être configurée
et validée avant toute ouverture commerciale.

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
