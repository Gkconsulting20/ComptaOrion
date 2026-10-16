# ComptaOrion ERP — état des lieux et recette

## Périmètre et niveau de preuve

Lite a été transféré dans un projet distinct. Cette copie conserve l'ERP seul.
Les tables et services partagés n'ont pas été supprimés et aucune donnée n'a été effacée.
L'IA reste désactivée par défaut.

« Présent, à tester » signifie que l'interface et les routes correspondantes existent :
cela ne signifie pas qu'une opération réelle a été vérifiée de bout en bout.
Les tests automatisés de ce chantier portent sur le retrait Lite, le contrat HTTP
sans connexion, la désactivation IA par défaut et les tests d'idempotence existants.
Ils ne certifient pas la justesse des états comptables.

## Fonctions présentes et parcours à tester

Effectuer ces essais dans une entreprise de test, pas dans les données réelles.
Utiliser une seule chaîne achat → stock → vente → paiement pour contrôler les
effets dans plusieurs modules.

| Module | Fonctions présentes | Essai recommandé / résultat attendu |
|---|---|---|
| Connexion | inscription, connexion, renouvellement JWT, déconnexion | Créer un compte test, se reconnecter, vérifier que les pages privées sont interdites après déconnexion |
| Tableau de bord | indicateurs, ventes/dépenses, graphiques, détail des indicateurs | Comparer les montants aux opérations test et changer les bornes de période |
| Clients | fiches clients, devis, factures, bons de livraison, paiements, créances, états de compte, rapports | Créer/modifier un client, établir une facture, payer partiellement puis totalement, comparer l'état de compte |
| Fournisseurs | fiches, commandes d'achat, réceptions, achats, paiements, états de compte, rapports | Créer un fournisseur et une commande, réceptionner, facturer et régler ; vérifier stock et dette |
| Stock | produits, inventaires, mouvements, entrepôts et rapports | Réceptionner 10 unités, en vendre 2, comparer stock et mouvements ; contrôler un ajustement d'inventaire |
| Trésorerie | comptes, mouvements, transferts, rapprochement et rapports | Encaisser une facture test, comparer le solde, tester un transfert entre deux comptes test |
| Dépenses | saisie, catégories, approbations et rapprochement comptable selon parcours | Tester la dépense depuis les écrans de trésorerie et vérifier le mouvement et l'écriture associés |
| Comptabilité | plan de comptes SYSCOHADA, journaux, écritures et validation | Initialiser le plan dans une entreprise vide, créer une écriture équilibrée, refuser une écriture déséquilibrée |
| Rapports comptables | grand livre, balance, bilan, résultat, journaux, flux de trésorerie, exports | Vérifier débit = crédit, concordance du résultat et des soldes, filtrage par dates et export |
| Immobilisations | fiches, amortissements, écritures et sorties selon parcours | Créer une immobilisation test et comparer un amortissement à un calcul manuel |
| Écritures récurrentes | modèles, paramètres et exécution selon parcours | Créer un modèle test, exécuter et vérifier l'absence d'écriture imprévue ou doublonnée |
| Clôture | aperçu et clôture d'exercice | Aperçu uniquement d'abord ; tester l'exécution seulement dans une entreprise jetable après contrôle comptable |
| Fiscalité | paramètres, calcul TVA/IS, déclarations enregistrées | Comparer TVA/IS aux écritures test ; l'envoi à une administration est simulé, pas un dépôt légal |
| Import/export | assistant CSV/XLSX/IIF, sources QuickBooks/Sage, mapping, exports | Importer un petit fichier non sensible, vérifier lignes rejetées/acceptées et sauvegarder un export |
| Intégrations/sauvegardes | écrans et routes de configuration, exports et sauvegardes selon connecteur | Tester chaque connecteur avec un compte dédié ; la présence d'un écran ne prouve pas une sauvegarde externe restaurable |
| Paramètres | entreprise/logo, exercice, système comptable, devises, change, pays, taxes, audit | Modifier un paramètre test, recharger et contrôler sa prise en compte dans les documents |
| Sécurité | sessions, permissions et audit de connexion | Tester deux utilisateurs de rôles différents et deux entreprises ; vérifier l'absence d'accès croisé |
| Admin SaaS | clients SaaS, commerciaux, plans, abonnements et ventes | Utiliser un administrateur autorisé ; vérifier qu'un compte client n'accède pas aux opérations globales |
| Inscription commerciale | inscription publique, parrainage et FedaPay | Parcours sandbox uniquement avant validation du compte marchand et des webhooks de production |

Pour chaque fonction CRUD, contrôler création, modification et suppression/annulation
lorsqu'elle est proposée, y compris le refus d'une suppression incompatible avec
des factures ou mouvements existants. Vérifier les documents imprimés et exports.

## Limites connues — pas de promesse de finalisation

- La récupération de mot de passe prépare un jeton mais n'envoie pas encore le courriel.
- Les connexions et soumissions aux administrations fiscales sont simulées.
- Stripe et PayPal ne sont pas implémentés ; FedaPay est à valider hors sandbox.
- Un taux de recouvrement client est encore fixé à zéro.
- Certaines éditions de comptes/journaux et routes comptables sont à vérifier :
  des écrans demandent des routes qui n'existent pas ou des routes sont déclarées
  plusieurs fois. Ne pas les certifier sans recette dédiée.
- Paie/RH existe côté serveur mais n'est pas proposé comme module finalisé.
- L'IA est conservée pour plus tard, pas activée ni facturable par défaut.
- Les anciens comptes créés avec le mot de passe de démonstration doivent être
  sécurisés. Le démarrage ne crée plus ce compte ; aucun compte existant n'est modifié.
- Les fichiers téléversés restent sur disque ; prévoir stockage persistant et sauvegarde.
- La couverture des tests métier est insuffisante pour qualifier l'ERP de production
  sans contrôle comptable et tests d'isolation des entreprises.

## Nettoyage réalisé

- Retrait interface, CSS, IndexedDB, manifeste et générateur d'export Lite.
- Retrait des archives Lite de cette copie ; conservation dans le projet autonome.
- Retrait de l'enregistrement du service worker Lite ; script de retraite ciblé pour
  les navigateurs ayant l'ancien cache. Pas d'effacement des données IndexedDB.
- Route `/lite` retirée du serveur ERP avec statut HTTP 410.
- Retrait des anciennes routes de démonstration qui renvoyaient un faux succès.
  Les vraies routes métier montées dans leurs modules sont conservées.
- Retrait de la création automatique du compte administrateur à mot de passe connu.
- Compilation séparée de l'installation : `npm run install:all`, `npm run build`,
  `npm test`. Les fichiers lock existants pilotent les installations.

## Avant publication commerciale

Faire la recette ci-dessus, traiter les limites bloquantes selon le périmètre
commercial retenu, contrôler les dépendances, vérifier les sauvegardes/restaurations,
configurer les secrets et le stockage du nouvel hébergeur, puis tester une préproduction.
