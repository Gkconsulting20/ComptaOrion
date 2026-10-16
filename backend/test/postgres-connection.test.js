import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostgresConnectionString } from '../src/services/postgresConnection.js';

test('Render utilise TLS avec vérification du certificat même sans option SSL dans son URL', () => {
  const input = 'postgresql://test:example@dpg-example.frankfurt-postgres.render.com/erp';
  const result = new URL(normalizePostgresConnectionString(input));
  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  assert.equal(result.pathname, '/erp');
  assert.equal(result.hostname, new URL(input).hostname);
});

test('Render ne peut pas désactiver TLS via sslmode et conserve les autres options', () => {
  const input = 'postgresql://test:example@dpg-example.frankfurt-postgres.render.com/erp?sslmode=disable&application_name=erp';
  const result = new URL(normalizePostgresConnectionString(input));
  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  assert.equal(result.searchParams.get('application_name'), 'erp');
});

test('la normalisation ne modifie pas PostgreSQL local, Neon ou un hôte ressemblant à Render', () => {
  for (const input of [
    'postgresql://test:example@localhost/erp?options=-csearch_path%3Disolated',
    'postgresql://test:example@ep-example.neon.tech/erp?sslmode=require',
    'postgresql://test:example@render.com.example.org/erp',
  ]) {
    assert.equal(normalizePostgresConnectionString(input), input);
  }
});
