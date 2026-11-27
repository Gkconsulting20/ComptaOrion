-- 20261127_fusion_plans_base_premium.sql
-- Fusion des plans validée par Cap le 27 nov. 2026 : 2 plans payants
-- seulement — Base 9 900 et Premium 29 900 XOF/mois (annuels 99 000 /
-- 299 000, soit 10 mois payés pour 12). Le plan Standard (17 900)
-- disparaît ; la lecture OCR des factures fournisseurs passe dans le
-- Premium. Ceci règle l'alignement base / noms commerciaux en attente
-- depuis le 20 nov. 2026.
-- Les lignes sont mises à jour PAR ID pour préserver les références
-- existantes (abonnements.plan_id) : aucun abonnement n'est supprimé
-- ni réassigné, seuls nom / prix / période / description changent.
-- La ligne « Entreprise Annuel » (id 6) est supprimée : elle n'a aucun
-- abonnement rattaché (vérifié en base live le 27 nov. 2026 : 0 ligne
-- dans abonnements) et son contenu est couvert par « Premium Annuel ».
-- Les descriptions ne promettent plus la Paie & RH ni les
-- Immobilisations (modules supprimés le 22 nov. 2026, hors offre).
-- L'essai gratuit (id 1) garde son nom et son prix 0 ; seule sa limite
-- d'utilisateurs passe de 1 à 3, comme l'offre commerciale (3 inclus).
-- Idempotent : chaque UPDATE est gardé par l'ancien nom, le DELETE par
-- l'ancien nom ; une 2e exécution ne change rien.
BEGIN;

UPDATE plans_abonnement
SET limite_utilisateurs = 3,
    stockage_gb = 10,
    description_features = 'Essai gratuit 30 jours • Socle ERP complet • Calcul automatique des coûts inclus • 3 utilisateurs • Sans paiement'
WHERE id = 1 AND nom = 'Essai Gratuit';

UPDATE plans_abonnement
SET nom = 'Base',
    prix = 9900.00,
    devise = 'XOF',
    periode = 'mensuel',
    limite_utilisateurs = 3,
    limite_entreprises = 1,
    stockage_gb = 20,
    support_email = true,
    support_prioritaire = false,
    features_crm = true,
    features_rh = false,
    features_comptabilite = true,
    description_features = 'Socle ERP complet SYSCOHADA • Ventes, achats, trésorerie, stock, comptabilité • Module Dépenses • TVA • Clôture d’exercice • 3 utilisateurs • Support email',
    actif = true
WHERE id = 2 AND nom = 'Starter';

UPDATE plans_abonnement
SET nom = 'Premium',
    prix = 29900.00,
    devise = 'XOF',
    periode = 'mensuel',
    limite_utilisateurs = 10,
    limite_entreprises = 3,
    stockage_gb = 100,
    support_email = true,
    support_prioritaire = true,
    features_crm = true,
    features_rh = false,
    features_comptabilite = true,
    description_features = 'Tout Base + Lecture OCR des factures fournisseurs • Calcul automatique du coût réel et du prix de vente • Comptabilité associative • Détail des états financiers • 10 utilisateurs • Support prioritaire',
    actif = true
WHERE id = 3 AND nom = 'Professional';

UPDATE plans_abonnement
SET nom = 'Base Annuel',
    prix = 99000.00,
    devise = 'XOF',
    periode = 'annuel',
    limite_utilisateurs = 3,
    limite_entreprises = 1,
    stockage_gb = 20,
    support_email = true,
    support_prioritaire = false,
    features_crm = true,
    features_rh = false,
    features_comptabilite = true,
    description_features = 'Tout Base • Paiement annuel : 99 000 XOF/an (12 mois dont 2 offerts) • 3 utilisateurs • Support email',
    actif = true
WHERE id = 4 AND nom = 'Entreprise';

UPDATE plans_abonnement
SET nom = 'Premium Annuel',
    prix = 299000.00,
    devise = 'XOF',
    periode = 'annuel',
    limite_utilisateurs = 10,
    limite_entreprises = 3,
    stockage_gb = 100,
    support_email = true,
    support_prioritaire = true,
    features_crm = true,
    features_rh = false,
    features_comptabilite = true,
    description_features = 'Tout Premium • Paiement annuel : 299 000 XOF/an (12 mois dont 2 offerts) • 10 utilisateurs • Support prioritaire',
    actif = true
WHERE id = 5 AND nom = 'Professional Annuel';

DELETE FROM plans_abonnement WHERE id = 6 AND nom = 'Entreprise Annuel';

COMMIT;
