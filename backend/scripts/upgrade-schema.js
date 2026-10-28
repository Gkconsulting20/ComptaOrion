import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

// Additive upgrade only. Never use drizzle-kit push against an older ERP database.
const apply = process.argv.includes('--apply');
const scopeArg = process.argv.find(arg => arg.startsWith('--scope='));
const scope = scopeArg?.slice('--scope='.length);
const scopedTables = scope === 'stock-units'
  ? new Set(['produits', 'lignes_reception', 'facture_achat_items'])
  : null;
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
      if (scopedTables) throw new Error(`Migration ciblée annulée : la table ${name} est absente.`);
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
  // Only add indexes introduced by the association module. Rebuilding every
  // historical ERP index could fail on old duplicate data and is not required
  // to install this additive feature.
  const associationIndexes = new Set([
    'projets_associatifs_entreprise_code_idx',
    'budgets_projets_associatifs_poste_idx',
    'paiements_depenses_projets_piece_unique',
    'paiements_depenses_projets_ecriture_unique',
  ]);
  const existingIndexes = new Set((await client.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public'",
  )).rows.map((row) => row.indexname));
  for (const statement of source.split(/;\s*(?:--> statement-breakpoint)?\s*/)) {
    const index = statement.match(/^CREATE UNIQUE INDEX "([^"]+)"/);
    if (scopedTables || !index || !associationIndexes.has(index[1]) || existingIndexes.has(index[1])) continue;
    console.log(`INDEX ${index[1]} (${apply ? 'application' : 'simulation'})`);
    if (apply) await client.query(statement);
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
