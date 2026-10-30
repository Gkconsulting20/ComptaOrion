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

Trois utilisateurs est une capacité fréquente à considérer pour un forfait, mais l’offre commerciale complète reste à revoir.

**Why:** l’utilisateur a indiqué que le nombre d’utilisateurs est souvent de trois et qu’il souhaite revenir sur l’offre commerciale plus tard.

**How to apply:** considérer trois utilisateurs comme une référence provisoire pour les nouveaux forfaits, sans modifier les offres existantes ni figer la tarification avant la revue commerciale.

La démo destinée aux prospects doit montrer les modules métiers importants de ComptaOrion, dont la comptabilité générale, la trésorerie et la comptabilité des associations. Paie & RH et l’Assistant IA restent masqués et exclus de l’offre commercialisée.

**Why:** l’utilisateur a précisé que tous les modules métiers sont importants pour la démo et l’offre, à l’exception de la paie et de l’IA.

**How to apply:** présenter les fonctionnalités métiers avec des données fictives; ne pas ajouter Paie & RH ni Assistant IA au menu public de démonstration ou à la liste des fonctionnalités vendues.

La répartition commerciale approuvée est : Base pour le socle ERP et les droits par module; Standard ajoute l’OCR fournisseur, le coût moyen pondéré avec frais répartis au poids et la bibliothèque de prix; Premium ajoute la comptabilité associative par projet, les paiements partiels et le détail des états financiers.

**Why:** l’utilisateur a autorisé la publication Cloudflare après avoir vu et reçu le résumé de cette répartition.

**How to apply:** conserver cette répartition dans l’offre; exclure Paie & RH, Assistant IA et Immobilisations. Ne pas inventer de tarifs ni prétendre que les limites par forfait sont appliquées avant configuration et validation.
