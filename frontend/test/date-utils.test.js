import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysToIsoDate } from '../src/utils/dateUtils.js';

test('calcule les échéances client et fournisseur sans décalage de fuseau', () => {
  assert.equal(addDaysToIsoDate('2026-01-31', 0), '2026-01-31');
  assert.equal(addDaysToIsoDate('2026-01-31', 15), '2026-02-15');
  assert.equal(addDaysToIsoDate('2026-12-15', 30), '2027-01-14');
});

test('refuse une date ou un délai de paiement invalide', () => {
  assert.equal(addDaysToIsoDate('2026-02-30', 30), '');
  assert.equal(addDaysToIsoDate('2026-01-01', -1), '');
  assert.equal(addDaysToIsoDate('2026-01-01', 366), '');
});
