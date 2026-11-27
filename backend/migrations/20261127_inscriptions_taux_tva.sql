-- Migration TVA à l'inscription payante (27 nov. 2026)
-- Contexte : POST /api/public/inscription accepte désormais le taux de TVA
-- choisi (18 % / 0 % / personnalisé) et le stocke sur entreprises.taux_tva
-- (colonne déjà présente en base live, numeric, défaut 18.00 — vérifié le
-- 27 nov. 2026 via information_schema : aucune migration nécessaire là).
-- Le chemin webhook FedaPay lit le taux dans inscriptions_en_attente :
-- cette table n'avait pas de colonne taux_tva, on l'ajoute ici.
-- Idempotent : ADD COLUMN IF NOT EXISTS — ré-appliquer est sans effet.
-- À appliquer sur la base Neon live de ComptaOrion, puis vérifier la
-- colonne (information_schema) avant le déploiement du Worker.

ALTER TABLE inscriptions_en_attente ADD COLUMN IF NOT EXISTS taux_tva numeric(5,2);
