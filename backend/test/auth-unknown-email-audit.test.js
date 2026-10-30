import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { auditConnexions } from '../src/schema.js';
import { buildAuthAuditNullabilityStatements } from '../scripts/auth-audit-migration.js';

test('les tentatives sans utilisateur ne sont attribuées à aucun tenant', () => {
  const columns = getTableConfig(auditConnexions).columns;
  const userId = columns.find((column) => column.name === 'user_id');
  const enterpriseId = columns.find((column) => column.name === 'enterprise_id');

  assert.ok(userId);
  assert.ok(enterpriseId);
  assert.equal(userId.notNull, false);
  assert.equal(enterpriseId.notNull, false);
});

test('la migration auth-audit rend idempotemment les références facultatives', () => {
  const existingColumns = [
    { table_name: 'audit_connexions', column_name: 'user_id', is_nullable: 'NO' },
    { table_name: 'audit_connexions', column_name: 'enterprise_id', is_nullable: 'NO' },
  ];

  assert.deepEqual(buildAuthAuditNullabilityStatements(existingColumns), [
    'ALTER TABLE "audit_connexions" ALTER COLUMN "user_id" DROP NOT NULL',
    'ALTER TABLE "audit_connexions" ALTER COLUMN "enterprise_id" DROP NOT NULL',
  ]);
  assert.deepEqual(
    buildAuthAuditNullabilityStatements(
      existingColumns.map((column) => ({ ...column, is_nullable: 'YES' })),
    ),
    [],
  );
});

test('la migration auth-audit échoue explicitement si une colonne manque', () => {
  assert.throws(
    () =>
      buildAuthAuditNullabilityStatements([
        { table_name: 'audit_connexions', column_name: 'user_id', is_nullable: 'NO' },
      ]),
    /audit_connexions\.enterprise_id est introuvable/,
  );
});

test('le script de mise à niveau branche le scope auth-audit sur la migration dédiée', async () => {
  const upgradeScript = await readFile(
    new URL('../scripts/upgrade-schema.js', import.meta.url),
    'utf8',
  );

  assert.match(upgradeScript, /'auth-audit', new Set\(\['audit_connexions'\]\)/);
  assert.match(
    upgradeScript,
    /actions\.push\(\.\.\.buildAuthAuditNullabilityStatements\(columns\)\)/,
  );
});

test('une adresse inconnue est journalisée sans identifiant puis reçoit une réponse 401', async () => {
  const route = await readFile(
    new URL('../src/routes/auth-security.js', import.meta.url),
    'utf8',
  );
  const unknownUserBranch = route.match(/if \(!user\) \{([\s\S]*?)\n    \}/)?.[1];

  assert.ok(unknownUserBranch, 'branche utilisateur inconnu présente');
  assert.match(unknownUserBranch, /userId:\s*null/);
  assert.match(unknownUserBranch, /enterpriseId:\s*null/);
  assert.match(unknownUserBranch, /type:\s*'failed_login'/);
  assert.match(unknownUserBranch, /return res\.status\(401\)/);
});
