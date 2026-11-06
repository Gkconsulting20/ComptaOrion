import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClientNumberFromId } from '../src/services/clientIdentity.js';

test('génère un identifiant client lisible à partir de son identifiant interne', () => {
  assert.equal(formatClientNumberFromId(1), 'CLI00001');
  assert.equal(formatClientNumberFromId(12345), 'CLI12345');
  assert.equal(formatClientNumberFromId(123456), 'CLI123456');
});

test('refuse les identifiants internes invalides', () => {
  for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatClientNumberFromId(id), /Identifiant client invalide/);
  }
});
