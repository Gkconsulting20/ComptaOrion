# Checklist avant la vente des abonnements

> Document interne de développement conservé dans le projet Replit. Il n’est pas destiné à l’interface publique et cette mise à jour ne publie rien sur Cloudflare. Une case non cochée signifie que le point reste à vérifier; cela ne prouve pas à elle seule que la fonction est absente du code.

## Règle de lancement

ComptaOrion reste en phase de test client. Attendre les retours de plusieurs entreprises, ajouter leurs problèmes à cette liste, puis fermer les blocages de sécurité et de fonctionnement avant de commencer à vendre des abonnements payants.

Cette liste distingue les fonctions non terminées des fonctions présentes qui doivent encore être validées avec des données et des parcours réels. Elle doit être révisée après chaque retour client.

## Priorité 1 — Sécurité et protection des données

- [ ] Vérifier l’isolation entre entreprises sur toutes les routes et tous les objets : un utilisateur ne doit jamais lire ou modifier les données d’un autre client, même en changeant un identifiant envoyé par le navigateur.
- [ ] Tester les permissions par module et par action avec plusieurs rôles et deux entreprises de test.
- [ ] Finaliser la connexion renforcée : double vérification pour les comptes sensibles, limitation des tentatives répétées, expiration et révocation des sessions.
- [ ] Vérifier et finaliser la récupération de mot de passe : lien unique, expiration, réponse neutre et journalisation adaptée.
- [ ] Couvrir chaque création, modification et suppression par une piste d’audit complète, attribuée au bon utilisateur et à la bonne entreprise; empêcher sa modification par un utilisateur normal.
- [ ] Refaire l’audit des dépendances et corriger les vulnérabilités élevées ou critiques avant la commercialisation.
- [ ] Vérifier les droits minimaux d’accès à la base et aux fichiers; ne jamais exposer les secrets dans le navigateur, les journaux ou Git.
- [ ] Tester une restauration réelle depuis une sauvegarde chiffrée.
- [ ] Contrôler la validation et la taille des fichiers importés, notamment les factures envoyées pour OCR.
- [ ] Si ComptaOrion migre un jour vers Supabase, mettre en place des règles RLS et les tester avec un rôle non privilégié. Le passage à Supabase, à lui seul, ne garantit pas l’isolation.

## Priorité 2 — Abonnements et paiements

- [ ] Choisir les moyens de paiement à offrir pour les abonnements.
- [ ] Après les tests clients, décider et intégrer les paiements d’abonnement par FedaPay et Stripe; ils ne bloquent pas la phase de test gratuite actuelle.
- [ ] Tester chaque étape nécessaire du paiement retenu : paiement accepté ou refusé, notification signée, notification répétée, renouvellement, expiration et résiliation; vérifier que l’accès et le statut d’abonnement restent cohérents.
- [ ] Faire respecter côté serveur les limites de chaque forfait : modules prévus, trois utilisateurs inclus, utilisateurs supplémentaires et accès gratuit séparé du comptable invité.
- [ ] Vérifier de bout en bout l’essai de 30 jours : le délai commence à la création de l’organisation et l’accès est bloqué à son expiration.
- [ ] Définir et tester le traitement des données de l’entreprise après l’expiration de l’essai.
- [ ] Confirmer que les prix, la périodicité, les taxes éventuelles et les fonctionnalités affichées sont cohérents entre l’offre commerciale, l’inscription, les factures et l’accès réel.
- [ ] Confirmer l’accès au calcul automatique du coût de revient pendant l’essai et dans le forfait Premium; les forfaits Base et Standard gardent la saisie manuelle des coûts et prix.

## Priorité 3 — Parcours clients et fonctions métier

- [ ] Refaire le parcours public depuis `comptaorion.com` : création d’organisation, premier administrateur, connexion et accès aux modules.
- [ ] Invitation gratuite du cabinet comptable : fiabiliser le lien partagé par courriel ou WhatsApp, l’acceptation, la création du compte, la connexion et les droits limités à l’entreprise invitante.
- [ ] Impôts : vérifier les règles fiscales togolaises et les calculs. Les déclarations doivent rester des brouillons tant qu’un dépôt officiel n’est pas réellement intégré.
- [ ] Dépenses : distinguer les montants engagés des paiements réellement effectués et permettre une dépense sans projet.
- [ ] Trésorerie : vérifier le cycle de conversion avec l’historique réel du stock et des paiements.
- [ ] Catalogue clients : vérifier que les tarifs propres à chaque client sont appliqués dans les devis et les factures.
- [ ] Comptes clients et fournisseurs : fournir un relevé auxiliaire débit/crédit complet, avec les soldes d’ouverture et de clôture, toutes les factures, notes de crédit et tous les règlements.
- [ ] Vérifier que chaque client et fournisseur possède un identifiant auxiliaire unique, tandis que les écritures utilisent les comptes collectifs prévus au grand livre.
- [ ] Relevés de comptes : inclure un paiement dans sa période de paiement même si la facture est d’une période antérieure; calculer les dettes fournisseurs sur le TTC, pas seulement le HT.
- [ ] Retours clients : permettre un retour total ou partiel lié à la facture d’origine, créer l’avoir, diminuer la créance et corriger ventes, TVA, stock et CMV de façon équilibrée.
- [ ] Retours fournisseurs : enregistrer l’avoir reçu du fournisseur, diminuer la dette et corriger achats/stock, TVA déductible et éventuel remboursement ou crédit fournisseur.
- [ ] Notes d’ajustement : vérifier la note de débit client et l’avoir fournisseur lié à la qualité, sans les confondre avec un retour physique.
- [ ] Conditions de règlement : tester les échéances disponibles côté client et fournisseur ainsi que les escomptes configurés sur leurs comptes.
- [ ] Escomptes : vérifier la distinction entre escompte de règlement et remise sur achat; l’escompte reçu d’un client ne modifie ni la facture d’origine ni sa taxe, tandis que l’escompte d’achat réduit le coût du bien et sa base taxable.
- [ ] Chèques reçus des clients : ajouter la saisie du chèque et son suivi jusqu’à l’encaissement bancaire, puis gérer les rejets sans laisser le compte client ni la trésorerie erronés. Confirmer le circuit comptable avant implémentation.
- [ ] Bons de commande fournisseurs : vérifier les coûts logistiques prévisionnels, la réception qui crée le stock et les coûts logistiques non facturés, le verrouillage des modifications après réception, et la saisie directe des factures sans stock.
- [ ] Garantir l’atomicité des paiements : si l’écriture comptable ne peut pas être créée, ne pas valider le paiement ni modifier le solde. Le contrôle du code a repéré un chemin de paiement fournisseur qui peut continuer après une erreur d’écriture.
- [ ] Confirmer le traitement des écritures automatiques : elles sont créées en brouillon; les états financiers ne retiennent que les écritures validées. Définir clairement quand et par qui elles sont validées.
- [ ] Vérifier l’unicité et l’ordre des numéros séquentiels par journal, y compris après suppression ou importation.
- [ ] SYSCOHADA : conserver le plan par défaut, tester la personnalisation facultative par entreprise et la correspondance des comptes collectifs.
- [ ] Import : tester l’import d’un plan comptable et des données provenant d’un logiciel existant, avec validation des erreurs avant enregistrement.
- [ ] Coût de revient : valider tout le parcours achat, poids et conversions d’unités, frais logistiques répartis au poids, coût moyen pondéré et CMV lors de la vente.
- [ ] OCR fournisseurs : faire tester des photos réelles de factures et contrôler les champs reconnus et leur correction avant validation comptable.
- [ ] Format des montants : vérifier partout le format XOF avec deux décimales, y compris les états et les écrans récemment ajoutés.
- [ ] Performance : mesurer les parcours les plus lents et améliorer l’ouverture et les opérations fréquentes sans retirer les modules essentiels.

## Priorité 4 — Production et fiabilité

- [ ] Vérifier sur Cloudflare les parcours réels avec plusieurs comptes de test, y compris les données et fichiers persistants.
- [ ] Confirmer que les changements validés sur Replit sont bien intégrés au processus de publication Cloudflare et que le build automatique fonctionne.
- [ ] Contrôler les alertes, les erreurs de production et la procédure de réponse à un incident.

## Fonctions volontairement hors périmètre de lancement

- Paie & RH reste en pause.
- L’assistant IA reste masqué et désactivé.
- Ne pas remettre les immobilisations dans les forfaits commerciaux tant que leur valeur complète n’est pas démontrée.

## Fonctions présentes à confirmer avec les testeurs

Les tests automatisés réussis sont un bon signal, mais ils ne remplacent pas les essais d’entreprises clientes. Demander notamment aux testeurs de valider l’OCR, le coût moyen pondéré, les états financiers, les séquences de journaux et les parcours de facturation et de trésorerie avec leurs propres cas d’usage.
