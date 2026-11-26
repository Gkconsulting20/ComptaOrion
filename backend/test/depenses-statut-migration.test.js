// Erreur 2 de l'exercice 2026 : POST /api/depenses/create insère
// statut = 'en_attente', absent de l'enum expense_status de la base live
// -> HTTP 500 systématique.
//
// Le schéma Drizzle déclare déjà depenses.statut en varchar(50) ; la
// correction est la migration backend/migrations/
// 20261126_depenses_statut_varchar.sql (conversion enum -> varchar avec
// mapping des anciennes valeurs, idempotente, à appliquer au
// déploiement). Ces tests vérifient, sans base de données, que la
// migration couvre toutes les anciennes valeurs de l'enum et que le
// schéma déclare bien la colonne en varchar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { depenses, expenseStatusEnum } from '../src/schema.js';

const MIGRATION_URL = new URL(
  '../migrations/20261126_depenses_statut_varchar.sql',
  import.meta.url,
);

test('le schéma déclare depenses.statut en varchar, pas en enum', () => {
  // PgVarchar : la colonne accepte 'en_attente' et les valeurs accentuées
  // utilisées par les routes et le frontend.
  assert.equal(depenses.statut.columnType, 'PgVarchar');
  assert.equal(depenses.statut.default, 'en_attente');
});

test('la migration convertit la colonne enum en varchar(50) avec défaut en_attente', async () => {
  const sql = await readFile(MIGRATION_URL, 'utf8');
  assert.match(sql, /ALTER TABLE "depenses" ALTER COLUMN "statut" TYPE varchar\(50\)/);
  assert.match(sql, /SET DEFAULT 'en_attente'/);
  assert.match(sql, /udt_name = 'expense_status'/);
});

test('la migration mappe chaque valeur de l’ancien enum sans perte', async () => {
  const sql = await readFile(MIGRATION_URL, 'utf8');
  const anciennesValeurs = expenseStatusEnum.enumValues;
  assert.deepEqual(
    [...anciennesValeurs].sort(),
    ['approuvee', 'brouillon', 'rejetee', 'remboursee', 'soumise'],
  );
  for (const valeur of anciennesValeurs) {
    assert.ok(
      sql.includes(`WHEN '${valeur}' THEN`),
      `la migration doit mapper l’ancienne valeur '${valeur}'`,
    );
  }
  // Les valeurs cibles sont celles qu'écrivent les routes et le frontend.
  for (const cible of ['en_attente', 'approuvée', 'rejetée', 'remboursée']) {
    assert.ok(sql.includes(`THEN '${cible}'`), `cible '${cible}' absente`);
  }
});
