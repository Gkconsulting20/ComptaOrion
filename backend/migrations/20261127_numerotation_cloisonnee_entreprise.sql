-- 20261127_numerotation_cloisonnee_entreprise.sql
-- Cloisonner les numéros de documents à l'entreprise (ordre de Cap, 27 nov. 2026) :
-- devis, factures, bons de livraison : l'ancienne contrainte globale UNIQUE(numero)
-- empêchait la 2e entreprise de créer son premier document (INSERT -> 500), car
-- la séquence est comptée par entreprise (DEV-AAAA-0001, FACT-AAAA-0001, BL-000001).
-- Le format généré porte désormais l'id entreprise (DEV/FACT/CMD/BL-AAAA-{eid}-NNNN),
-- et l'unicité devient composite (entreprise_id, numero) — un même numéro est
-- toléré pour 2 entreprises différentes. Aucun document existant n'est renuméroté
-- (base live au 27 nov. 2026 : 0 devis, 0 facture, 0 bon de livraison — seule
-- l'entreprise ORIONEXA existe).
-- notes_credit : les 2 index composites déclarés dans schema.js manquaient en base live.
-- commandes_achat et factures_achat ont déjà leur index composite : rien à faire.
-- Idempotent.
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_numero_devis_unique;
CREATE UNIQUE INDEX IF NOT EXISTS devis_entreprise_numero_unique ON devis (entreprise_id, numero_devis);
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_numero_facture_unique;
CREATE UNIQUE INDEX IF NOT EXISTS factures_entreprise_numero_unique ON factures (entreprise_id, numero_facture);
ALTER TABLE bons_livraison DROP CONSTRAINT IF EXISTS bons_livraison_numero_bl_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bons_livraison_entreprise_numero_unique ON bons_livraison (entreprise_id, numero_bl);
CREATE UNIQUE INDEX IF NOT EXISTS notes_credit_sequence_unique ON notes_credit (entreprise_id, type, annee, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS notes_credit_number_unique ON notes_credit (entreprise_id, numero);
