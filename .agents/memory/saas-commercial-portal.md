---
name: Espace commercial ComptaOrion
description: Rôle du portail commercial SaaS et séparation avec les comptes ERP.
---

L’Espace commercial sert à gérer la commercialisation du logiciel ComptaOrion. Il est distinct des comptes des entreprises clientes dans l’ERP.

**Why:** l’utilisateur a précisé que le portail sert à commercialiser le logiciel lui-même.

**How to apply:** traiter le portail commercial comme un espace de gestion des ventes de ComptaOrion et conserver son authentification séparée de celle de l’ERP.

Chaque entreprise cliente doit gérer ses propres utilisateurs et leurs niveaux d’accès dans l’ERP. Le propriétaire de ComptaOrion conserve séparément l’espace commercial pour gérer les commerciaux du logiciel.

**Why:** l’utilisateur a distingué les administrateurs des entreprises clientes du propriétaire de la plateforme et de ses commerciaux.

**How to apply:** cloisonner la gestion des membres par entreprise; ne jamais donner aux administrateurs clients l’accès aux fonctions SaaS globales ni aux commerciaux ComptaOrion.

Les administrateurs clients doivent pouvoir régler séparément, pour chaque utilisateur et chaque module ERP, la consultation, la modification et la gestion incluant la suppression. Le middleware de tenant injecte l’identifiant d’entreprise dans les objets JSON imbriqués : le vérifier puis l’exclure des droits persistés.

**Why:** l’utilisateur a précisé que les niveaux d’accès par module sont essentiels pour limiter les accès de son équipe; un test API a révélé que les métadonnées de tenant sont ajoutées aux objets JSON imbriqués.

**How to apply:** les profils servent de valeurs de départ; les droits effectifs restent configurables par utilisateur et vérifiés côté serveur dans le tenant de son entreprise. Pour les objets de droits imbriqués, valider l’identifiant ajouté par le middleware avant de le retirer du contenu métier.

Les prix de lancement acceptés pour l’offre sont par entreprise : Base 9 900 XOF/mois ou 99 000 XOF/an; Standard 17 900 XOF/mois ou 179 000 XOF/an; Premium 29 900 XOF/mois ou 299 000 XOF/an. Chaque forfait inclut trois utilisateurs; un utilisateur supplémentaire est proposé à 2 500 XOF/mois. L’annuel donne 12 mois d’accès pour 10 mois payés.

**Why:** l’utilisateur a accepté d’ajouter à l’offre commerciale la grille tarifaire proposée après comparaison de tarifs publics locaux et régionaux.

**How to apply:** conserver ces tarifs et trois utilisateurs inclus dans l’offre affichée. Le traitement HT/TTC et le raccordement aux forfaits actifs, aux limites d’accès et à la facturation doivent être confirmés avant de les appliquer à l’inscription ou aux factures.

Les nouveaux clients peuvent créer leur espace avec un essai gratuit de 30 jours, sans paiement. Chaque période commence à la création de l’organisation; le lien public reste réutilisable pour d’autres prospects.

**Why:** l’utilisateur a choisi l’essai gratuit sans paiement et a fixé sa durée à 30 jours.

**How to apply:** le formulaire public demande un mot de passe choisi par le client, active le compte et son abonnement de test, puis propose la connexion. Calculer les 30 jours par organisation, pas depuis la création ou le partage du lien; ne pas afficher les anciens forfaits payants tant qu’ils ne correspondent pas à l’offre approuvée.

L’accès à l’essai doit être automatiquement bloqué à l’échéance des 30 jours.

**Why:** l’utilisateur a confirmé que le blocage automatique est nécessaire.

**How to apply:** refuser l’authentification et l’accès aux API après l’expiration de l’essai.

Avant la vente des abonnements payants, attendre les retours de plusieurs clients testeurs, compléter la checklist `docs/Checklist-avant-commercialisation.md` et fermer les blocages de sécurité et de fonctionnement. Les offres de paiement FedaPay/Stripe et les autres fonctions incomplètes doivent être vérifiées avant de commencer la commercialisation.

Les comptes clients/fournisseurs en débit-crédit, les retours avec avoirs comptables et l’encaissement des chèques clients sont des fonctions essentielles à inclure dans cette revue précommerciale.

**Why:** l’utilisateur veut corriger les problèmes détectés pendant les essais et les fonctions incomplètes avant de vendre les abonnements, et demande qu’on lui rappelle cette vérification avant le lancement réel.

**How to apply:** garder l’application en phase de test jusqu’aux retours clients; réviser la checklist avec chaque retour; vérifier les flux débit/crédit et leur écriture équilibrée pour les factures, paiements, retours et chèques; dès que l’utilisateur évoque la vente ou l’activation des abonnements réels, lui rappeler de vérifier cette checklist et de fermer les points critiques avant le lancement payant.

Chaque entreprise cliente peut inviter gratuitement un compte nominatif de cabinet comptable, sans consommer l’un des trois utilisateurs inclus. Pour le MVP choisi, le compte est distinct et lié à une seule entreprise.

**Why:** l’utilisateur a précisé que le cabinet invité ne consomme pas l’un des trois comptes inclus, puis a choisi un premier MVP séparé par entreprise.

**How to apply:** traiter le compte comptable séparément du quota ordinaire; l’accès est limité à l’entreprise qui a envoyé l’invitation. Dans ce MVP, la même adresse ne peut pas encore utiliser un compte unique pour plusieurs entreprises. Ne pas présenter l’avantage comme opérationnel avant la mise à niveau et le déploiement du parcours sécurisé et révocable.

La démo destinée aux prospects doit montrer les modules métiers importants de ComptaOrion, dont la comptabilité générale, la trésorerie et la comptabilité des associations. Paie & RH et l’Assistant IA restent masqués et exclus de l’offre commercialisée.

**Why:** l’utilisateur a précisé que tous les modules métiers sont importants pour la démo et l’offre, à l’exception de la paie et de l’IA.

**How to apply:** présenter les fonctionnalités métiers avec des données fictives; ne pas ajouter Paie & RH ni Assistant IA au menu public de démonstration ou à la liste des fonctionnalités vendues.

La répartition commerciale approuvée est : Base pour le socle ERP et les droits par module avec coût et prix saisis manuellement; Standard ajoute l’OCR fournisseur en conservant la saisie manuelle des coûts; Premium ajoute le coût moyen pondéré avec frais répartis au poids, les prix calculés, la comptabilité associative et les rapports détaillables. L’essai de 30 jours inclut aussi le calcul automatique.

**Why:** l’utilisateur a précisé que le calcul automatique de coût est réservé à Premium, mais doit aussi être inclus dans l’essai, et que les autres forfaits saisissent leurs coûts et prix manuellement.

**How to apply:** conserver cette répartition dans l’offre; exclure Paie & RH, Assistant IA et Immobilisations. Les prix restent ceux acceptés dans l’offre. Ne pas prétendre que les différences autres que le calcul automatique sont verrouillées côté serveur avant vérification.

La version à jour du guide de mise en route doit rester accessible à l’administrateur de la plateforme dans l’espace Admin SaaS et être actualisée au fil des changements de ComptaOrion.

**Why:** l’utilisateur a demandé que le document soit disponible dans l’administration SaaS et maintenu à mesure que le logiciel évolue.

**How to apply:** garder une source unique du guide et faire pointer l’onglet Admin SaaS vers le document courant; éviter les copies publiées qui pourraient devenir obsolètes.
