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

Chaque entreprise cliente peut inviter gratuitement un compte nominatif de cabinet comptable, sans consommer l’un des trois utilisateurs inclus. Pour le MVP choisi, le compte est distinct et lié à une seule entreprise.

**Why:** l’utilisateur a précisé que le cabinet invité ne consomme pas l’un des trois comptes inclus, puis a choisi un premier MVP séparé par entreprise.

**How to apply:** traiter le compte comptable séparément du quota ordinaire; l’accès est limité à l’entreprise qui a envoyé l’invitation. Dans ce MVP, la même adresse ne peut pas encore utiliser un compte unique pour plusieurs entreprises. Ne pas présenter l’avantage comme opérationnel avant la mise à niveau et le déploiement du parcours sécurisé et révocable.

La démo destinée aux prospects doit montrer les modules métiers importants de ComptaOrion, dont la comptabilité générale, la trésorerie et la comptabilité des associations. Paie & RH et l’Assistant IA restent masqués et exclus de l’offre commercialisée.

**Why:** l’utilisateur a précisé que tous les modules métiers sont importants pour la démo et l’offre, à l’exception de la paie et de l’IA.

**How to apply:** présenter les fonctionnalités métiers avec des données fictives; ne pas ajouter Paie & RH ni Assistant IA au menu public de démonstration ou à la liste des fonctionnalités vendues.

La répartition commerciale approuvée est : Base pour le socle ERP et les droits par module; Standard ajoute l’OCR fournisseur, le coût moyen pondéré avec frais répartis au poids et la bibliothèque de prix; Premium ajoute la comptabilité associative par projet, les paiements partiels et le détail des états financiers.

**Why:** l’utilisateur a autorisé la publication Cloudflare après avoir vu et reçu le résumé de cette répartition.

**How to apply:** conserver cette répartition dans l’offre; exclure Paie & RH, Assistant IA et Immobilisations. Ne pas inventer de tarifs ni prétendre que les limites par forfait sont appliquées avant configuration et validation.

La version à jour du guide de mise en route doit rester accessible à l’administrateur de la plateforme dans l’espace Admin SaaS et être actualisée au fil des changements de ComptaOrion.

**Why:** l’utilisateur a demandé que le document soit disponible dans l’administration SaaS et maintenu à mesure que le logiciel évolue.

**How to apply:** garder une source unique du guide et faire pointer l’onglet Admin SaaS vers le document courant; éviter les copies publiées qui pourraient devenir obsolètes.
