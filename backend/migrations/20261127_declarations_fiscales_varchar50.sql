-- Migration d'alignement declarations_fiscales (live <-> schema.js)
-- Contexte : déclaration TVA ComptaOrion en HTTP 500, diagnostic du 27 nov. 2026
-- (phase 3, Worker v52) — champ `detail` : "value too long for type character varying(20)".
-- Cause prouvée par lecture de information_schema le 27 nov. 2026 :
--   - periode : varchar(20) en base live, varchar(50) dans schema.js (ligne 971).
--     L'insert de déclaration TVA porte periode '2026-10-01..2026-12-31' (22 caractères)
--     -> rejet Postgres. C'est LA colonne fautive.
--   - statut : varchar(20) en base live, varchar(50) dans schema.js (ligne 973).
--     Les valeurs actuelles (brouillon, soumise, acceptee, rejetee, payée) tiennent dans
--     20 caractères, mais on aligne sur le schéma pour éviter la même panne.
--   - notes : text en base live ET dans schema.js — déjà aligné, rien à faire.
--   - erreurs : jsonb en base live, text dans schema.js — NON touché ici (l'insert TVA
--     ne renseigne pas cette colonne ; passer de jsonb à text serait une régression).
-- Idempotent : ré-appliquer ces ALTER sur des colonnes déjà en varchar(50) est sans effet.
-- À appliquer sur la base Neon live de ComptaOrion, sur feu vert de Cap, puis retester
-- la déclaration TVA T4 2026 (POST /impots/declarations/tva).

ALTER TABLE declarations_fiscales ALTER COLUMN periode TYPE varchar(50);
ALTER TABLE declarations_fiscales ALTER COLUMN statut TYPE varchar(50);
