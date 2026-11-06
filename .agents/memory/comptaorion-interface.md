---
name: Interface ComptaOrion
description: Direction choisie pour la navigation et la marque de l’ERP.
---

Garder une barre latérale sombre avec les modules regroupés par rubrique. Conserver exactement le logo ComptaOrion existant; ne pas le redessiner ni le remplacer. Seuls sa taille, son cadrage et son contraste d’affichage peuvent être ajustés. Afficher séparément le nom de l’entreprise active, par exemple NERU.

**Why:** l’utilisateur a choisi la navigation regroupée, demandé de conserver la bande sombre et précisé que le logo original doit rester inchangé tout en étant plus visible. Les clients potentiels ont aussi besoin du guide de prise en main pour réaliser leur essai.

**How to apply:** conserver cette distinction produit/entreprise et la barre latérale sombre lors des prochaines évolutions visuelles; garder le même logo, ne pas ajouter de modules à la navigation sans demande, et rendre le guide accessible à l’inscription, après création du compte et depuis l’application.

Présenter les rapports avec le même en-tête compact que le tableau de bord : titre et courte description à gauche, période sélectionnable à droite, avec les dates personnalisées affichées seulement au besoin.

**Why:** l’utilisateur veut alléger l’interface et harmoniser les rapports, notamment la balance, selon le tableau de bord.

**How to apply:** réutiliser `ReportPageHeader` et le sélecteur compact `PeriodFilter` pour les nouveaux écrans de rapport, en conservant leurs actions et filtres métier spécifiques.
