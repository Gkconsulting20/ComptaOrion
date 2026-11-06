import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSupplierNumberFromId } from '../src/services/supplierIdentity.js';

test('génère un numéro fournisseur lisible à partir de son identifiant interne', () => {
  assert.equal(formatSupplierNumberFromId(1), 'FOU00001');
  assert.equal(formatSupplierNumberFromId(12345), 'FOU12345');
  assert.equal(formatSupplierNumberFromId(123456), 'FOU123456');
});

test('refuse les identifiants internes fournisseur invalides', () => {
  for (const id of [0, -1, NaN, Infinity, 'abc']) {
    assert.throws(() => formatSupplierNumberFromId(id));
  }
});
