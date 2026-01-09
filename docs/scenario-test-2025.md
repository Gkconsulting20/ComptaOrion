# Scénario de Test Complet - Exercice 2025

## Entreprise : Orion Logistics & Solutions SARL

| Caractéristique | Valeur |
|-----------------|--------|
| **Activité** | Import-export équipements numériques |
| **Siège** | Lomé, Togo |
| **Effectif** | 25 employés |
| **CA cible** | 650 000 000 FCFA |
| **Norme comptable** | SYSCOHADA |
| **TVA** | 18% |
| **Devise** | FCFA (XOF) |

---

## BILAN D'OUVERTURE AU 1er JANVIER 2025

### ACTIF (230 500 000 FCFA)

| Compte | Libellé | Montant (FCFA) |
|--------|---------|----------------|
| **IMMOBILISATIONS** | | **124 000 000** |
| 213 | Constructions (local commercial) | 80 000 000 |
| 215 | Installations techniques | 10 000 000 |
| 241 | Matériel de transport (2 camionnettes) | 18 000 000 |
| 244 | Mobilier | 6 500 000 |
| 245 | Matériel informatique | 9 500 000 |
| **ACTIF CIRCULANT** | | **80 000 000** |
| 310 | Stock marchandises | 48 000 000 |
| 411 | Créances clients (N-1) | 32 000 000 |
| **TRÉSORERIE** | | **26 500 000** |
| 512 | Banque (Ecobank Togo) | 24 000 000 |
| 571 | Caisse | 2 500 000 |
| | **TOTAL ACTIF** | **230 500 000** |

### PASSIF (230 500 000 FCFA)

| Compte | Libellé | Montant (FCFA) |
|--------|---------|----------------|
| **CAPITAUX PROPRES** | | **170 500 000** |
| 101 | Capital social | 120 000 000 |
| 106 | Réserves légales | 30 000 000 |
| 110 | Report à nouveau | 20 500 000 |
| **DETTES FINANCIÈRES** | | **40 000 000** |
| 162 | Emprunt bancaire (5 ans) | 40 000 000 |
| **DETTES D'EXPLOITATION** | | **20 000 000** |
| 401 | Fournisseurs (N-1) | 20 000 000 |
| | **TOTAL PASSIF** | **230 500 000** |

---

## DONNÉES DE BASE À CRÉER

### Entrepôt

| Nom | Adresse | Capacité |
|-----|---------|----------|
| Entrepôt Principal Lomé | Zone Portuaire, Boulevard du Mono | 500 m² |

### Fournisseurs (6)

| # | Fournisseur | Pays | Activité | Délai paiement |
|---|-------------|------|----------|----------------|
| 1 | Dubai Tech Electronics | Émirats Arabes Unis | Smartphones, laptops | 45 jours |
| 2 | Guangzhou Digital Co. | Chine | Accessoires | 60 jours |
| 3 | Samsung West Africa | Ghana | Smartphones Samsung | 30 jours |
| 4 | Trans-Sahel Logistics | Togo | Transport/logistique | 15 jours |
| 5 | Espace Immobilier SARL | Togo | Location bureau | 5 jours |
| 6 | CEET (Électricité) | Togo | Électricité | 10 jours |

### Clients (8)

| # | Client | Type | Ville | Délai paiement |
|---|--------|------|-------|----------------|
| 1 | Revendeur Soleil | Revendeur | Lomé | 30 jours |
| 2 | Techno Distribution | Revendeur | Cotonou, Bénin | 45 jours |
| 3 | Groupe Hôtelier Atlantique | Entreprise | Lomé | 30 jours |
| 4 | Ministère de l'Éducation | Administration | Lomé | 60 jours |
| 5 | Mobile Plus | Revendeur | Kara | 30 jours |
| 6 | Entreprise BTP Sahel | Entreprise | Lomé | 45 jours |
| 7 | Cyber Solutions | Revendeur | Lomé | 30 jours |
| 8 | Université de Lomé | Administration | Lomé | 60 jours |

### Produits (8 stockés + 2 services)

| Référence | Produit | Prix Achat | Prix Vente | Marge | Stock min |
|-----------|---------|------------|------------|-------|-----------|
| PHONE-001 | iPhone 14 | 450 000 | 580 000 | 29% | 10 |
| PHONE-002 | Samsung Galaxy S23 | 380 000 | 490 000 | 29% | 15 |
| PHONE-003 | Xiaomi Redmi Note 12 | 120 000 | 165 000 | 38% | 20 |
| LAPTOP-001 | Laptop HP ProBook | 420 000 | 550 000 | 31% | 5 |
| TAB-001 | Tablette iPad | 350 000 | 450 000 | 29% | 8 |
| PRINT-001 | Imprimante Canon | 95 000 | 135 000 | 42% | 10 |
| ACC-001 | Chargeur USB-C (lot 10) | 15 000 | 25 000 | 67% | 50 |
| ACC-002 | Écouteurs Bluetooth | 8 000 | 15 000 | 88% | 100 |
| SVC-001 | Service Installation | - | 50 000 | - | - |
| SVC-002 | Service Maintenance | - | 35 000/h | - | - |

---

## CALENDRIER DES TRANSACTIONS 2025

### JANVIER

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 02/01 | OUVERTURE | AN-2025-001 | Écriture bilan d'ouverture | - |
| 05/01 | ACHAT | CMD-2025-001 | Commande Dubai Tech (iPhone, Samsung) | 45 000 000 |
| 08/01 | RÉCEPTION | BR-2025-001 | Réception conteneur Dubai | - |
| 10/01 | FACTURE ACH | FA-2025-001 | Facture Dubai Tech Electronics | 45 000 000 |
| 12/01 | VENTE | FV-2025-001 | Revendeur Soleil - 30 smartphones | 14 700 000 |
| 15/01 | PAIEMENT | PAY-2025-001 | Règlement Revendeur Soleil | 14 700 000 |
| 18/01 | VENTE | FV-2025-002 | Techno Distribution - 25 smartphones | 12 250 000 |
| 25/01 | VENTE | FV-2025-003 | Mobile Plus - 50 Xiaomi | 8 250 000 |
| 31/01 | CHARGE | CH-2025-001 | Loyer janvier - Espace Immobilier | 2 000 000 |
| 31/01 | CHARGE | CH-2025-002 | Électricité janvier - CEET | 800 000 |

### FÉVRIER

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/02 | ACHAT | CMD-2025-002 | Accessoires Guangzhou Digital | 12 000 000 |
| 08/02 | RÉCEPTION | BR-2025-002 | Réception accessoires Chine | - |
| 10/02 | FACTURE ACH | FA-2025-002 | Facture Guangzhou Digital Co. | 12 000 000 |
| 10/02 | VENTE | FV-2025-004 | Cyber Solutions - 20 Laptops | 11 000 000 |
| 15/02 | VENTE | FV-2025-005 | Groupe Hôtelier - 20 Tablettes | 9 000 000 |
| 18/02 | PAIEMENT | PAY-2025-002 | Règlement Techno Distribution (janv) | 12 250 000 |
| 20/02 | VENTE | FV-2025-006 | Revendeur Soleil - Accessoires | 5 000 000 |
| 25/02 | VENTE | FV-2025-007 | Ministère Éducation - 100 Imprimantes | 13 500 000 |
| 28/02 | CHARGE | CH-2025-003 | Loyer février | 2 000 000 |
| 28/02 | CHARGE | CH-2025-004 | Salaires février | 8 000 000 |

### MARS

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/03 | ACHAT | CMD-2025-003 | Samsung West Africa | 28 000 000 |
| 08/03 | RÉCEPTION | BR-2025-003 | Réception Samsung Ghana | - |
| 10/03 | FACTURE ACH | FA-2025-003 | Facture Samsung West Africa | 28 000 000 |
| 08/03 | VENTE | FV-2025-008 | Université Lomé - 30 Laptops + installation | 16 500 000 |
| 12/03 | VENTE | FV-2025-009 | Techno Distribution - 40 Samsung | 19 600 000 |
| 15/03 | PAIEMENT | PAY-2025-003 | Règlement Mobile Plus (janv) | 8 250 000 |
| 18/03 | VENTE | FV-2025-010 | BTP Sahel - 20 Tablettes | 9 000 000 |
| 22/03 | VENTE | FV-2025-011 | Revendeur Soleil - Mix produits | 12 000 000 |
| 28/03 | VENTE | FV-2025-012 | Mobile Plus - Accessoires | 7 500 000 |
| 31/03 | CHARGE | CH-2025-005 | Loyer mars | 2 000 000 |
| 31/03 | CHARGE | CH-2025-006 | Électricité T1 | 900 000 |

### AVRIL

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/04 | ACHAT | CMD-2025-004 | Dubai Tech - Laptops | 35 000 000 |
| 08/04 | RÉCEPTION | BR-2025-004 | Réception laptops Dubai | - |
| 10/04 | FACTURE ACH | FA-2025-004 | Facture Dubai Tech | 35 000 000 |
| 10/04 | VENTE | FV-2025-013 | Ministère Éducation - Laptops | 22 000 000 |
| 12/04 | VENTE | FV-2025-014 | Cyber Solutions - Smartphones | 15 000 000 |
| 15/04 | VENTE | FV-2025-015 | Revendeur Soleil - Mix | 10 000 000 |
| 18/04 | VENTE | FV-2025-016 | Techno Distribution - Tablettes | 13 500 000 |
| 22/04 | VENTE | FV-2025-017 | BTP Sahel - Laptops | 8 250 000 |
| 28/04 | VENTE | FV-2025-018 | Université Lomé - Accessoires | 3 000 000 |
| 30/04 | CHARGE | CH-2025-007 | Loyer avril | 2 000 000 |

### MAI

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/05 | ACHAT | CMD-2025-005 | Guangzhou - Accessoires | 18 000 000 |
| 08/05 | RÉCEPTION | BR-2025-005 | Réception accessoires | - |
| 12/05 | FACTURE ACH | FA-2025-005 | Facture Guangzhou Digital | 18 000 000 |
| 10/05 | VENTE | FV-2025-019 | Groupe Hôtelier - Équipement complet | 18 000 000 |
| 15/05 | VENTE | FV-2025-020 | Revendeur Soleil - Smartphones | 14 000 000 |
| 18/05 | VENTE | FV-2025-021 | Mobile Plus - Mix | 9 000 000 |
| 22/05 | VENTE | FV-2025-022 | Cyber Solutions - Accessoires | 8 500 000 |
| 28/05 | VENTE | FV-2025-023 | Techno Distribution - Smartphones | 8 500 000 |
| 31/05 | CHARGE | CH-2025-008 | Loyer mai | 2 000 000 |
| 31/05 | CHARGE | CH-2025-009 | Salaires mai | 8 000 000 |

### JUIN

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/06 | ACHAT | CMD-2025-006 | Dubai Tech - Smartphones premium | 52 000 000 |
| 08/06 | RÉCEPTION | BR-2025-006 | Réception smartphones Dubai | - |
| 10/06 | FACTURE ACH | FA-2025-006 | Facture Dubai Tech | 52 000 000 |
| 08/06 | VENTE | FV-2025-024 | Ministère Éducation - Tablettes | 18 000 000 |
| 12/06 | VENTE | FV-2025-025 | Revendeur Soleil - iPhone 14 | 17 400 000 |
| 15/06 | VENTE | FV-2025-026 | Cyber Solutions - Samsung | 14 700 000 |
| 18/06 | VENTE | FV-2025-027 | Techno Distribution - Mix | 12 000 000 |
| 22/06 | VENTE | FV-2025-028 | Université Lomé - Laptops | 11 000 000 |
| 25/06 | VENTE | FV-2025-029 | Mobile Plus - Smartphones | 7 000 000 |
| 28/06 | VENTE | FV-2025-030 | BTP Sahel - Équipement bureau | 4 900 000 |
| 30/06 | CHARGE | CH-2025-010 | Loyer juin | 2 000 000 |
| 30/06 | CHARGE | CH-2025-011 | Électricité T2 | 1 100 000 |

### JUILLET

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/07 | ACHAT | CMD-2025-007 | Samsung - Tablettes | 25 000 000 |
| 08/07 | RÉCEPTION | BR-2025-007 | Réception tablettes Samsung | - |
| 10/07 | FACTURE ACH | FA-2025-007 | Facture Samsung West Africa | 25 000 000 |
| 10/07 | VENTE | FV-2025-031 | Groupe Hôtelier - Tablettes | 13 500 000 |
| 15/07 | VENTE | FV-2025-032 | Revendeur Soleil - Mix | 11 000 000 |
| 22/07 | VENTE | FV-2025-033 | Techno Distribution - Accessoires | 9 500 000 |
| 28/07 | VENTE | FV-2025-034 | Cyber Solutions - Imprimantes | 11 000 000 |
| 31/07 | CHARGE | CH-2025-012 | Loyer juillet | 2 000 000 |

### AOÛT

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/08 | ACHAT | CMD-2025-008 | Guangzhou - Imprimantes | 15 000 000 |
| 08/08 | RÉCEPTION | BR-2025-008 | Réception imprimantes | - |
| 12/08 | FACTURE ACH | FA-2025-008 | Facture Guangzhou Digital | 15 000 000 |
| 10/08 | VENTE | FV-2025-035 | Ministère Éducation - Imprimantes | 16 200 000 |
| 18/08 | VENTE | FV-2025-036 | Revendeur Soleil - Accessoires | 12 000 000 |
| 25/08 | VENTE | FV-2025-037 | Mobile Plus - Smartphones | 9 800 000 |
| 31/08 | CHARGE | CH-2025-013 | Loyer août | 2 000 000 |
| 31/08 | CHARGE | CH-2025-014 | Salaires août | 8 000 000 |

### SEPTEMBRE

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/09 | ACHAT | CMD-2025-009 | Dubai Tech - Smartphones rentrée | 48 000 000 |
| 08/09 | RÉCEPTION | BR-2025-009 | Réception smartphones Dubai | - |
| 10/09 | FACTURE ACH | FA-2025-009 | Facture Dubai Tech | 48 000 000 |
| 08/09 | VENTE | FV-2025-038 | Université Lomé - Équipement rentrée | 22 000 000 |
| 12/09 | VENTE | FV-2025-039 | Techno Distribution - Smartphones | 15 000 000 |
| 18/09 | VENTE | FV-2025-040 | Cyber Solutions - Laptops | 11 000 000 |
| 22/09 | VENTE | FV-2025-041 | Revendeur Soleil - Mix | 8 000 000 |
| 28/09 | VENTE | FV-2025-042 | BTP Sahel - Accessoires | 6 000 000 |
| 30/09 | CHARGE | CH-2025-015 | Loyer septembre | 2 000 000 |
| 30/09 | CHARGE | CH-2025-016 | Électricité T3 | 950 000 |

### OCTOBRE

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/10 | ACHAT | CMD-2025-010 | Dubai Tech - Stock fêtes | 55 000 000 |
| 08/10 | RÉCEPTION | BR-2025-010 | Réception stock fêtes | - |
| 10/10 | FACTURE ACH | FA-2025-010 | Facture Dubai Tech | 55 000 000 |
| 08/10 | VENTE | FV-2025-043 | Groupe Hôtelier - Équipement complet | 18 000 000 |
| 12/10 | VENTE | FV-2025-044 | Revendeur Soleil - Smartphones | 16 000 000 |
| 15/10 | VENTE | FV-2025-045 | Ministère Éducation - Tablettes | 14 000 000 |
| 18/10 | VENTE | FV-2025-046 | Techno Distribution - Mix | 12 000 000 |
| 22/10 | VENTE | FV-2025-047 | Mobile Plus - Accessoires | 10 000 000 |
| 28/10 | VENTE | FV-2025-048 | Cyber Solutions - Smartphones | 8 000 000 |
| 31/10 | CHARGE | CH-2025-017 | Loyer octobre | 2 000 000 |

### NOVEMBRE

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/11 | ACHAT | CMD-2025-011 | Guangzhou - Accessoires fêtes | 18 000 000 |
| **15/11** | **RÉCEPTION** | **BR-2025-011** | **Réception accessoires SANS FACTURE** | **18 000 000** |
| 10/11 | VENTE | FV-2025-049 | Revendeur Soleil - Promo Black Friday | 18 000 000 |
| 15/11 | VENTE | FV-2025-050 | Techno Distribution - Smartphones | 15 000 000 |
| 20/11 | VENTE | FV-2025-051 | Cyber Solutions - Mix | 12 000 000 |
| 25/11 | VENTE | FV-2025-052 | Université Lomé - Accessoires | 13 000 000 |
| 28/11 | VENTE | FV-2025-053 | BTP Sahel - Laptops | 10 000 000 |
| 30/11 | CHARGE | CH-2025-018 | Loyer novembre | 2 000 000 |
| 30/11 | CHARGE | CH-2025-019 | Salaires novembre | 8 000 000 |

### DÉCEMBRE

| Date | Type | Référence | Description | Montant HT |
|------|------|-----------|-------------|------------|
| 05/12 | ACHAT | CMD-2025-012 | Samsung - Stock fin année | 22 000 000 |
| 08/12 | RÉCEPTION | BR-2025-012 | Réception Samsung | - |
| 10/12 | FACTURE ACH | FA-2025-011 | Facture Samsung West Africa | 22 000 000 |
| 05/12 | VENTE | FV-2025-054 | Ministère Éducation - Commande annuelle | 20 000 000 |
| 08/12 | VENTE | FV-2025-055 | Groupe Hôtelier - Équipement Noël | 15 000 000 |
| 10/12 | VENTE | FV-2025-056 | Revendeur Soleil - Stock fêtes | 14 000 000 |
| 12/12 | VENTE | FV-2025-057 | Techno Distribution - Smartphones | 12 000 000 |
| 15/12 | VENTE | FV-2025-058 | Mobile Plus - Mix | 10 000 000 |
| 18/12 | VENTE | FV-2025-059 | Cyber Solutions - Accessoires | 9 000 000 |
| 22/12 | VENTE | FV-2025-060 | Université Lomé - Fin exercice | 8 000 000 |
| 28/12 | VENTE | FV-2025-061 | BTP Sahel - Dernière commande | 7 000 000 |
| 31/12 | CHARGE | CH-2025-020 | Loyer décembre | 2 000 000 |
| 31/12 | CHARGE | CH-2025-021 | Électricité T4 | 1 050 000 |
| 31/12 | INVENTAIRE | INV-2025-001 | Inventaire physique fin exercice | - |

---

## CAS SPÉCIAL : RÉCEPTION NON FACTURÉE

### Contexte
Le 15 novembre 2025, un conteneur d'accessoires arrive de Guangzhou Digital Co. mais la facture fournisseur n'est pas encore disponible (retard administratif du fournisseur chinois).

### Détail de la réception

| Référence | BR-2025-011 |
|-----------|-------------|
| Date | 15/11/2025 |
| Fournisseur | Guangzhou Digital Co. |
| Contenu | 500 Chargeurs USB-C + 300 Écouteurs Bluetooth |
| Valeur estimée | 18 000 000 FCFA |

### Écriture comptable (Réception sans facture)

| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 310 | Stock marchandises | 18 000 000 | |
| 408 | Fournisseurs - Factures non parvenues | | 18 000 000 |

### Régularisation prévue (Janvier 2026)
Quand la facture arrivera :
| Compte | Libellé | Débit | Crédit |
|--------|---------|-------|--------|
| 408 | Fournisseurs - Factures non parvenues | 18 000 000 | |
| 401 | Fournisseurs | | 18 000 000 |

---

## RÉCAPITULATIF ANNUEL

### Achats par fournisseur

| Fournisseur | Montant HT | % |
|-------------|------------|---|
| Dubai Tech Electronics | 235 000 000 | 61% |
| Guangzhou Digital Co. | 63 000 000 | 16% |
| Samsung West Africa | 75 000 000 | 19% |
| Trans-Sahel Logistics | 12 000 000 | 3% |
| **Total Achats** | **385 000 000** | **100%** |

### Ventes par client

| Client | Montant HT | % |
|--------|------------|---|
| Revendeur Soleil | 145 000 000 | 22% |
| Techno Distribution | 102 000 000 | 16% |
| Ministère de l'Éducation | 103 700 000 | 16% |
| Université de Lomé | 74 000 000 | 11% |
| Cyber Solutions | 78 200 000 | 12% |
| Groupe Hôtelier Atlantique | 64 500 000 | 10% |
| Mobile Plus | 54 550 000 | 8% |
| BTP Sahel | 35 150 000 | 5% |
| **Total Ventes** | **657 100 000** | **100%** |

### Charges d'exploitation

| Type | Montant annuel |
|------|----------------|
| Loyers (12 mois) | 24 000 000 |
| Salaires (4 trimestres) | 32 000 000 |
| Électricité (4 trimestres) | 3 800 000 |
| Autres charges | 30 200 000 |
| **Total Charges** | **90 000 000** |

---

## RÉSULTATS FINANCIERS ATTENDUS

| Indicateur | Montant (FCFA) |
|------------|----------------|
| **Chiffre d'affaires HT** | 657 100 000 |
| **Coût des marchandises vendues** | 507 000 000 |
| **Marge brute** | 150 100 000 |
| **Taux de marge brute** | 22.8% |
| **Charges d'exploitation** | 90 000 000 |
| **Résultat d'exploitation** | 60 100 000 |
| **Charges financières (intérêts)** | 4 000 000 |
| **Résultat net avant impôt** | 56 100 000 |

### Bilan de clôture attendu (31/12/2025)

| Poste | Montant |
|-------|---------|
| **ACTIF** | |
| Immobilisations nettes | 118 000 000 |
| Stock | 72 000 000 |
| Créances clients | 45 000 000 |
| Trésorerie | 48 000 000 |
| **Total Actif** | **283 000 000** |
| **PASSIF** | |
| Capital | 120 000 000 |
| Réserves | 30 000 000 |
| Report à nouveau | 20 500 000 |
| Résultat exercice | 56 100 000 |
| Emprunt | 32 000 000 |
| Fournisseurs | 6 400 000 |
| Factures non parvenues (408) | 18 000 000 |
| **Total Passif** | **283 000 000** |

---

## VÉRIFICATIONS À EFFECTUER

1. ✅ Bilan d'ouverture équilibré (230 500 000 = 230 500 000)
2. ✅ Balance de vérification équilibrée (Total Débit = Total Crédit)
3. ✅ Marge brute ≈ 22-23%
4. ✅ Compte 408 avec solde 18 000 000 (factures non parvenues)
5. ✅ Stock valorisé correctement (méthode CMP)
6. ✅ Écritures comptables automatiques générées
7. ✅ Journal des ventes (VT) cohérent
8. ✅ Journal des achats (ACH) cohérent
9. ✅ Journal de banque (BQ) traçable
10. ✅ DSO, DPO, CCC calculés
11. ✅ Entrepôt avec mouvements tracés

---

## COMPTEURS DE TRANSACTIONS

| Type | Nombre |
|------|--------|
| Factures de vente | 61 |
| Factures d'achat | 11 |
| Bons de réception | 12 |
| Écritures de charges | 21 |
| Paiements clients | ~50 |
| Paiements fournisseurs | ~15 |
| Mouvements de stock | ~150 |
| **Total transactions** | **~320** |

---

*Document généré pour le test complet de ComptaOrion ERP - Exercice 2025*
