export const BACKFILL_FISCAL_PERIOD_CLOSURES_SQL = `
  INSERT INTO clotures_exercices (
    entreprise_id,
    exercice,
    revision,
    date_debut,
    date_fin,
    date_ouverture_suivante,
    statut,
    ecriture_cloture_id,
    ecriture_ouverture_id,
    ferme_par,
    ferme_le,
    created_at,
    updated_at
  )
  SELECT
    closing.entreprise_id,
    (regexp_match(closing.numero_piece, '^CLOTURE-([0-9]{4})'))[1]::integer,
    COALESCE((regexp_match(closing.numero_piece, '-R([0-9]+)$'))[1]::integer, 1),
    (
      company.debut_annee_fiscale
      + make_interval(years =>
        (regexp_match(closing.numero_piece, '^CLOTURE-([0-9]{4})'))[1]::integer
        - EXTRACT(YEAR FROM company.debut_annee_fiscale)::integer
      )
    )::date,
    closing.date_ecriture,
    COALESCE(opening.date_ecriture, closing.date_ecriture + 1),
    'ferme',
    closing.id,
    opening.id,
    closing.user_id,
    COALESCE(closing.created_at, NOW()),
    COALESCE(closing.created_at, NOW()),
    NOW()
  FROM ecritures closing
  JOIN journaux closing_journal
    ON closing_journal.id = closing.journal_id
   AND closing_journal.entreprise_id = closing.entreprise_id
   AND UPPER(closing_journal.code) = 'OD'
  JOIN entreprises company ON company.id = closing.entreprise_id
  LEFT JOIN LATERAL (
    SELECT candidate.id, candidate.date_ecriture
    FROM ecritures candidate
    JOIN journaux opening_journal
      ON opening_journal.id = candidate.journal_id
     AND opening_journal.entreprise_id = candidate.entreprise_id
     AND UPPER(opening_journal.code) = 'AN'
    WHERE candidate.entreprise_id = closing.entreprise_id
      AND candidate.numero_piece =
        'OUVERTURE-' ||
        ((regexp_match(closing.numero_piece, '^CLOTURE-([0-9]{4})'))[1]::integer + 1)::text ||
        COALESCE((regexp_match(closing.numero_piece, '(-R[0-9]+)$'))[1], '')
    ORDER BY candidate.id DESC
    LIMIT 1
  ) opening ON TRUE
  WHERE closing.numero_piece ~ '^CLOTURE-[0-9]{4}(-R[0-9]+)?$'
  ON CONFLICT (entreprise_id, exercice, revision) DO NOTHING
`;

// Migration-only operation: the caller must already hold a transaction.
// FORCE RLS applies even to a table owner, so the backfill must explicitly use
// the same platform-wide context as the project's authorized maintenance code.
// LOCAL scope ensures this access ends when the migration commits or rolls back.
export async function backfillFiscalPeriodClosures(client) {
  await client.query("SELECT set_config('app.current_tenant', '*', true)");
  return client.query(BACKFILL_FISCAL_PERIOD_CLOSURES_SQL);
}

export const FISCAL_PERIOD_LOCK_GUARD_SQL = `
  CREATE OR REPLACE FUNCTION orion_assert_fiscal_period_open(
    p_entreprise_id integer,
    p_date date
  )
  RETURNS void
  LANGUAGE plpgsql
  AS $$
  DECLARE
    closed_exercise integer;
    closed_start date;
    closed_end date;
  BEGIN
    IF p_entreprise_id IS NULL OR p_date IS NULL THEN
      RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
      'comptaorion:fiscal-write:' || p_entreprise_id::text || ':' ||
      EXTRACT(YEAR FROM p_date)::integer::text,
      0
    ));

    SELECT exercice, date_debut, date_fin
      INTO closed_exercise, closed_start, closed_end
      FROM clotures_exercices
      WHERE entreprise_id = p_entreprise_id
        AND statut = 'ferme'
        AND p_date BETWEEN date_debut AND date_fin
      ORDER BY revision DESC
      LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION
        'Écriture refusée : exercice comptable % fermé du % au %. Demandez à un administrateur de réouvrir cet exercice.',
        closed_exercise,
        TO_CHAR(closed_start, 'DD/MM/YYYY'),
        TO_CHAR(closed_end, 'DD/MM/YYYY')
        USING ERRCODE = 'P0001',
              CONSTRAINT = 'comptaorion_closed_fiscal_period';
    END IF;
  END;
  $$;

  CREATE OR REPLACE FUNCTION orion_guard_fiscal_period_entry()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      PERFORM orion_assert_fiscal_period_open(OLD.entreprise_id, OLD.date_ecriture);
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      PERFORM orion_assert_fiscal_period_open(OLD.entreprise_id, OLD.date_ecriture);
    END IF;

    PERFORM orion_assert_fiscal_period_open(NEW.entreprise_id, NEW.date_ecriture);
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS orion_guard_fiscal_period_entry_trigger ON ecritures;
  DROP TRIGGER IF EXISTS orion_00_guard_fiscal_period_entry_trigger ON ecritures;
  CREATE TRIGGER orion_00_guard_fiscal_period_entry_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON ecritures
    FOR EACH ROW
    EXECUTE FUNCTION orion_guard_fiscal_period_entry();

  CREATE OR REPLACE FUNCTION orion_guard_fiscal_period_line()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    parent_company integer;
    parent_date date;
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      SELECT entreprise_id, date_ecriture
        INTO parent_company, parent_date
        FROM ecritures
        WHERE id = OLD.ecriture_id;
      PERFORM orion_assert_fiscal_period_open(parent_company, parent_date);
      IF NEW.ecriture_id IS DISTINCT FROM OLD.ecriture_id THEN
        SELECT entreprise_id, date_ecriture
          INTO parent_company, parent_date
          FROM ecritures
          WHERE id = NEW.ecriture_id;
        PERFORM orion_assert_fiscal_period_open(parent_company, parent_date);
      END IF;
      RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
      SELECT entreprise_id, date_ecriture
        INTO parent_company, parent_date
        FROM ecritures
        WHERE id = NEW.ecriture_id;
      PERFORM orion_assert_fiscal_period_open(parent_company, parent_date);
      RETURN NEW;
    ELSE
      SELECT entreprise_id, date_ecriture
        INTO parent_company, parent_date
        FROM ecritures
        WHERE id = OLD.ecriture_id;
      PERFORM orion_assert_fiscal_period_open(parent_company, parent_date);
      RETURN OLD;
    END IF;
  END;
  $$;

  DROP TRIGGER IF EXISTS orion_guard_fiscal_period_line_trigger ON lignes_ecriture;
  CREATE TRIGGER orion_guard_fiscal_period_line_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON lignes_ecriture
    FOR EACH ROW
    EXECUTE FUNCTION orion_guard_fiscal_period_line();
`;
