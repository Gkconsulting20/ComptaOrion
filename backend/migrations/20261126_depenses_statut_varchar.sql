-- Conversion de depenses.statut : enum expense_status -> varchar(50).
-- Exercice comptable complet 2026 (26 nov. 2026), erreur 2 :
-- POST /api/depenses/create insère statut = 'en_attente', valeur absente
-- de l'enum expense_status ('brouillon', 'soumise', 'approuvee',
-- 'rejetee', 'remboursee') -> HTTP 500 systématique, aucune dépense
-- ne peut être créée, donc ni approbation ni remboursement ne sont
-- testables.
--
-- Le code (schema Drizzle) déclare déjà la colonne en varchar(50) et
-- les routes + le frontend utilisent les valeurs 'en_attente',
-- 'approuvée', 'rejetée', 'remboursée', 'partiellement_remboursée'.
-- Seule la base live est restée sur l'enum : la même conversion existe
-- déjà dans scripts/upgrade-schema.js (périmètre 'expense-tracking'),
-- ce fichier en est la version autonome, à appliquer sur la base live
-- au déploiement, sur feu vert de Cap. NE PAS appliquer avant.
--
-- La conversion mappe chaque ancienne valeur vers la nouvelle sans
-- perte ('brouillon'/'soumise' -> 'en_attente', 'approuvee' ->
-- 'approuvée', 'rejetee' -> 'rejetée', 'remboursee' -> 'remboursée').
-- Idempotent : ne fait rien si la colonne est déjà en varchar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'depenses'
      AND column_name = 'statut'
      AND udt_name = 'expense_status'
  ) THEN
    ALTER TABLE "depenses" ALTER COLUMN "statut" DROP DEFAULT;
    ALTER TABLE "depenses" ALTER COLUMN "statut" TYPE varchar(50)
      USING CASE statut::text
        WHEN 'brouillon' THEN 'en_attente'
        WHEN 'soumise' THEN 'en_attente'
        WHEN 'approuvee' THEN 'approuvée'
        WHEN 'rejetee' THEN 'rejetée'
        WHEN 'remboursee' THEN 'remboursée'
        ELSE statut::text
      END;
    ALTER TABLE "depenses" ALTER COLUMN "statut" SET DEFAULT 'en_attente';
  END IF;
END $$;
