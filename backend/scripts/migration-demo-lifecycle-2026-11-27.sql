-- Migration mode démo + cycle de vie essai → blocage → suppression
-- ComptaOrion, 27 novembre 2026. Idempotente (IF NOT EXISTS).
-- Appliquée en base live Neon via psql ; le schéma Drizzle
-- (backend/src/schema.js) est la référence pour les environnements futurs.

ALTER TABLE entreprises ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS entreprises_is_demo_created_idx ON entreprises (is_demo, created_at);

CREATE TABLE IF NOT EXISTS suppressions_entreprises (
  id serial PRIMARY KEY,
  application varchar(20) NOT NULL,
  entreprise_supprimee_id integer NOT NULL,
  entreprise_nom text NOT NULL,
  entreprise_email text,
  motif varchar(50) NOT NULL,
  date_inscription timestamptz,
  date_fin_essai timestamptz,
  date_blocage timestamptz,
  date_suppression_eligible timestamptz,
  date_suppression timestamptz NOT NULL DEFAULT now(),
  delai_jours_applique integer NOT NULL,
  supprime_par text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suppressions_entreprises_entreprise_idx
  ON suppressions_entreprises (entreprise_supprimee_id);

CREATE TABLE IF NOT EXISTS parametres_plateforme (
  cle varchar(100) PRIMARY KEY,
  valeur text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO parametres_plateforme (cle, valeur, description) VALUES
  ('trial_deletion_delay_days', '30', 'Jours de blocage avant suppression d''un essai expiré non converti (décision Cap 27 nov. 2026)'),
  ('demo_retention_days', '7', 'Jours de conservation d''une entreprise démo'),
  ('trial_purge_enabled', 'false', 'Bascule suppression réelle par la purge (false = dry-run seulement, journalisation sans suppression)')
ON CONFLICT (cle) DO NOTHING;
