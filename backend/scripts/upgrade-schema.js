import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

// Additive upgrade only. Never use drizzle-kit push against an older ERP database.
const apply = process.argv.includes('--apply');
const scopeArg = process.argv.find(arg => arg.startsWith('--scope='));
const scope = scopeArg?.slice('--scope='.length);
const migrationScopes = new Map([
  ['stock-units', new Set(['produits', 'lignes_reception', 'facture_achat_items'])],
  ['expense-tracking', new Set(['projets_associatifs', 'categories_depenses', 'depenses'])],
]);
const scopedTables = scope ? migrationScopes.get(scope) : null;
if (scope && !scopedTables) throw new Error(`Périmètre de migration inconnu: ${scope}`);
const source = execFileSync(process.execPath, [
  'node_modules/drizzle-kit/bin.cjs', 'export', '--dialect=postgresql', '--schema=./src/schema.js',
], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' });
const quote = name => `"${name.replaceAll('"', '""')}"`;
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout = '10s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('comptaorion-schema-upgrade'))");
  const { rows: columns } = await client.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
  );
  const present = new Map();
  for (const c of columns) {
    if (!present.has(c.table_name)) present.set(c.table_name, new Set());
    present.get(c.table_name).add(c.column_name);
  }
  const types = new Set((await client.query(
    "SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'",
  )).rows.map(t => t.typname));
  const actions = [];
  const added = new Set();
  for (const statement of source.split(/;\s*(?:--> statement-breakpoint)?\s*/)) {
    const type = statement.match(/^CREATE TYPE "public"\."([^"]+)"/);
    if (!scopedTables && type && !types.has(type[1])) actions.push(statement);
    const table = statement.match(/^CREATE TABLE "([^"]+)" \(\n([\s\S]*?)\n\)$/);
    if (!table) continue;
    const [, name, body] = table;
    if (scopedTables && !scopedTables.has(name)) continue;
    if (!present.has(name)) {
      if (scopedTables && scope !== 'expense-tracking') {
        throw new Error(`Migration ciblée annulée : la table ${name} est absente.`);
      }
      actions.push(statement);
      added.add(name);
    } else {
      for (const line of body.split('\n')) {
        const column = line.match(/^\s*"([^"]+)"\s+(.+?)(?:,)?$/);
        if (!column || present.get(name).has(column[1])) continue;
        let definition = line.trim().replace(/,$/, '');
        // Old fixed assets have real values: backfill explicitly below, never invent amounts.
        if (name === 'immobilisations' && ['categorie_id', 'valeur_nette_comptable'].includes(column[1])) {
          definition = definition.replace(' NOT NULL', '');
        } else if (definition.includes('NOT NULL') && !definition.includes('DEFAULT')) {
          const { rows: [{ exists }] } = await client.query(
            `SELECT EXISTS(SELECT 1 FROM ${quote(name)} LIMIT 1) AS exists`,
          );
          if (exists) throw new Error(`Migration manuelle requise pour ${name}.${column[1]} : données existantes, aucun défaut sûr.`);
        }
        actions.push(`ALTER TABLE ${quote(name)} ADD COLUMN ${definition}`);
        added.add(`${name}.${column[1]}`);
      }
    }
  }
  if (scope === 'expense-tracking') {
    const { rows: [statusColumn] } = await client.query(
      "SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='depenses' AND column_name='statut'",
    );
    if (statusColumn?.udt_name === 'expense_status') {
      actions.push(`
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
      `);
    }
  }
  console.log(`${actions.length} ajouts de tables, colonnes ou types (${apply ? 'application' : 'simulation'}).`);
  for (const sql of actions) {
    console.log(sql.split('\n')[0].slice(0, 150));
    if (apply) await client.query(sql);
  }
  const legacyAssets = present.get('immobilisations');
  if (!scopedTables && apply && legacyAssets?.has('categorie') &&
      (added.has('immobilisations.categorie_id') || added.has('immobilisations.valeur_nette_comptable'))) {
    // Keep each old category and its depreciation settings; no deletion of legacy data.
    await client.query(`
      INSERT INTO categories_immobilisations (entreprise_id, nom, duree_vie, methode_amortissement)
      SELECT DISTINCT i.entreprise_id, COALESCE(NULLIF(i.categorie,''),'Reprise historique'),
        COALESCE(i.duree_amortissement,5), COALESCE(i.methode_amortissement,'lineaire')
      FROM immobilisations i WHERE i.categorie_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM categories_immobilisations c
          WHERE c.entreprise_id=i.entreprise_id AND c.nom=COALESCE(NULLIF(i.categorie,''),'Reprise historique'))
    `);
    await client.query(`
      UPDATE immobilisations i SET categorie_id=(
        SELECT c.id FROM categories_immobilisations c WHERE c.entreprise_id=i.entreprise_id
          AND c.nom=COALESCE(NULLIF(i.categorie,''),'Reprise historique') ORDER BY c.id LIMIT 1)
      WHERE categorie_id IS NULL
    `);
    await client.query(`
      UPDATE immobilisations SET
        valeur_nette_comptable=COALESCE(valeur_nette_comptable,valeur_nette,valeur_acquisition-COALESCE(amortissement_cumule,0)),
        description=COALESCE(description,nom),
        statut=CASE WHEN actif=false THEN 'cede' ELSE COALESCE(statut,'actif') END
    `);
    await client.query('ALTER TABLE immobilisations ALTER COLUMN categorie_id SET NOT NULL, ALTER COLUMN valeur_nette_comptable SET NOT NULL');
  }
  const constraints = new Set((await client.query(
    "SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace",
  )).rows.map(c => c.conname));
  if (apply && legacyAssets?.has('nom') && legacyAssets?.has('duree_amortissement')) {
    // Old required fields remain populated when the new API creates an asset.
    // Legacy columns are retained for reversibility and historical reports.
    await client.query(`
      CREATE OR REPLACE FUNCTION orion_sync_legacy_asset() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW.nom := COALESCE(NEW.description,NEW.reference,NEW.nom,'Immobilisation');
        SELECT COALESCE(NEW.duree_amortissement,c.duree_vie),
          COALESCE(NEW.methode_amortissement,c.methode_amortissement), c.nom
          INTO NEW.duree_amortissement,NEW.methode_amortissement,NEW.categorie
          FROM categories_immobilisations c WHERE c.id=NEW.categorie_id AND c.entreprise_id=NEW.entreprise_id;
        NEW.valeur_nette := NEW.valeur_nette_comptable;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS orion_legacy_asset ON immobilisations;
      CREATE TRIGGER orion_legacy_asset BEFORE INSERT OR UPDATE ON immobilisations
        FOR EACH ROW EXECUTE FUNCTION orion_sync_legacy_asset();
    `);
  }
  for (const statement of source.split(/;\s*(?:--> statement-breakpoint)?\s*/)) {
    const fk = statement.match(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\)/);
    if (!fk || constraints.has(fk[2]) ||
        (!added.has(fk[1]) && !added.has(`${fk[1]}.${fk[3]}`))) continue;
    if (apply) await client.query(statement);
  }
  // Add only explicitly reviewed indexes. Historical data is preflighted
  // before unique accounting constraints are installed.
  const permittedIndexes = new Set([
    'projets_associatifs_entreprise_code_idx',
    'budgets_projets_associatifs_poste_idx',
    'paiements_depenses_projets_piece_unique',
    'paiements_depenses_projets_ecriture_unique',
    'ecritures_entreprise_numero_unique',
    'ecriture_sequences_scope_unique',
    'journaux_entreprise_code_unique',
  ]);
  const indexesForScope = scopedTables
    ? new Set(scope === 'expense-tracking' ? ['projets_associatifs_entreprise_code_idx'] : [])
    : permittedIndexes;
  const existingIndexes = new Set((await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public'",
  )).rows.map((row) => row.indexname));
  for (const statement of source.split(/;\s*(?:--> statement-breakpoint)?\s*/)) {
    const index = statement.match(/^CREATE UNIQUE INDEX "([^"]+)"/);
    if (!index || !indexesForScope.has(index[1]) || existingIndexes.has(index[1])) continue;
    if (index[1] === 'ecritures_entreprise_numero_unique') {
      if (present.has('ecritures')) {
        const { rows: [duplicates] } = await client.query(`
          SELECT COUNT(*)::int AS count FROM (
            SELECT entreprise_id, numero_ecriture
            FROM ecritures
            WHERE numero_ecriture IS NOT NULL
            GROUP BY entreprise_id, numero_ecriture
            HAVING COUNT(*) > 1
          ) duplicate_numbers
        `);
        if (duplicates.count > 0) {
          throw new Error(
            `Migration annulée : ${duplicates.count} numéro(s) d’écriture en doublon. ` +
            'Aucun numéro historique ne sera modifié; corrigez ces cas avant de créer l’index unique.'
          );
        }
      }
    }
    if (index[1] === 'journaux_entreprise_code_unique' && present.has('journaux')) {
      const { rows: [duplicates] } = await client.query(`
        SELECT COUNT(*)::int AS count FROM (
          SELECT entreprise_id, UPPER(code) AS normalized_code
          FROM journaux
          GROUP BY entreprise_id, UPPER(code)
          HAVING COUNT(*) > 1
        ) duplicate_codes
      `);
      if (duplicates.count > 0) {
        throw new Error(
          `Migration annulée : ${duplicates.count} code(s) de journal en doublon, sans distinction majuscule/minuscule. ` +
          'Aucun journal ne sera supprimé; corrigez ces codes avant la création de l’index.'
        );
      }
    }
    console.log(`INDEX ${index[1]} (${apply ? 'application' : 'simulation'})`);
    if (apply) await client.query(statement);
  }
  if (!scopedTables) {
    if (present.has('ecritures')) {
      const seedSequences = `
      INSERT INTO ecriture_sequences
        (entreprise_id, journal_id, exercice, derniere_sequence, updated_at)
      SELECT
        entreprise_id,
        journal_id,
        EXTRACT(YEAR FROM date_ecriture)::integer,
        COALESCE(MAX((regexp_match(numero_ecriture, '-([0-9]+)$'))[1]::integer), 0),
        NOW()
      FROM ecritures
      WHERE numero_ecriture ~ '-[0-9]+$'
      GROUP BY entreprise_id, journal_id, EXTRACT(YEAR FROM date_ecriture)
      ON CONFLICT (entreprise_id, journal_id, exercice)
      DO UPDATE SET
        derniere_sequence = GREATEST(ecriture_sequences.derniere_sequence, EXCLUDED.derniere_sequence),
        updated_at = NOW()
    `;
      console.log(`Initialisation des compteurs à partir des écritures existantes (${apply ? 'application' : 'simulation'})`);
      if (apply) await client.query(seedSequences);
    }

    const sequenceTrigger = `
      CREATE OR REPLACE FUNCTION orion_assign_journal_entry_number()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        journal_code text;
        journal_type text;
        exercise integer;
        next_sequence bigint;
        digit_width integer;
        explicit_sequence bigint;
      BEGIN
        SELECT UPPER(code), LOWER(COALESCE(type, ''))
          INTO journal_code, journal_type
          FROM journaux
          WHERE id = NEW.journal_id AND entreprise_id = NEW.entreprise_id;
        IF journal_code IS NULL THEN
          RAISE EXCEPTION 'Journal introuvable pour la numérotation de l’écriture';
        END IF;

        exercise := EXTRACT(YEAR FROM NEW.date_ecriture)::integer;
        digit_width := CASE WHEN journal_type = 'ventes' THEN 8 ELSE 6 END;
        PERFORM pg_advisory_xact_lock(hashtextextended(
          'comptaorion:ecritures:' || NEW.entreprise_id || ':' || NEW.journal_id || ':' || exercise,
          0
        ));

        IF NULLIF(BTRIM(NEW.numero_ecriture), '') IS NOT NULL THEN
          IF NEW.numero_ecriture ~ '-[0-9]+$' THEN
            explicit_sequence := (regexp_match(NEW.numero_ecriture, '-([0-9]+)$'))[1]::bigint;
            INSERT INTO ecriture_sequences
              (entreprise_id, journal_id, exercice, derniere_sequence, updated_at)
            VALUES (NEW.entreprise_id, NEW.journal_id, exercise, explicit_sequence, NOW())
            ON CONFLICT (entreprise_id, journal_id, exercice)
            DO UPDATE SET
              derniere_sequence = GREATEST(ecriture_sequences.derniere_sequence, EXCLUDED.derniere_sequence),
              updated_at = NOW();
          END IF;
          RETURN NEW;
        END IF;

        SELECT COALESCE(MAX((regexp_match(numero_ecriture, '-([0-9]+)$'))[1]::bigint), 0) + 1
          INTO next_sequence
          FROM ecritures
          WHERE entreprise_id = NEW.entreprise_id
            AND journal_id = NEW.journal_id
            AND date_ecriture >= make_date(exercise, 1, 1)
            AND date_ecriture < make_date(exercise + 1, 1, 1)
            AND numero_ecriture ~ '-[0-9]+$';

        INSERT INTO ecriture_sequences
          (entreprise_id, journal_id, exercice, derniere_sequence, updated_at)
        VALUES (NEW.entreprise_id, NEW.journal_id, exercise, next_sequence, NOW())
        ON CONFLICT (entreprise_id, journal_id, exercice)
        DO UPDATE SET
          derniere_sequence = GREATEST(ecriture_sequences.derniere_sequence, EXCLUDED.derniere_sequence - 1) + 1,
          updated_at = NOW()
        RETURNING derniere_sequence INTO next_sequence;

        IF (digit_width = 8 AND next_sequence > 99999999)
          OR (digit_width = 6 AND next_sequence > 999999) THEN
          RAISE EXCEPTION 'Capacité de numérotation atteinte pour le journal %', journal_code;
        END IF;

        NEW.numero_ecriture := UPPER(journal_code) || '-' || exercise::text || '-' ||
          lpad(next_sequence::text, digit_width, '0');
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS orion_assign_journal_entry_number_trigger ON ecritures;
      CREATE TRIGGER orion_assign_journal_entry_number_trigger
        BEFORE INSERT ON ecritures
        FOR EACH ROW
        EXECUTE FUNCTION orion_assign_journal_entry_number();
    `;
    console.log(`TRIGGER orion_assign_journal_entry_number_trigger (${apply ? 'application' : 'simulation'})`);
    if (apply) await client.query(sequenceTrigger);
  }
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(apply ? 'Mise à niveau additive terminée.' : 'Aucune modification. Utiliser --apply après sauvegarde pour appliquer.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Mise à niveau annulée :', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
