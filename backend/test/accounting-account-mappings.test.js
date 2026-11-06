import test from 'node:test';
import assert from 'node:assert/strict';
import { isPriceVarianceAccount } from '../src/services/accountingAccountMappings.js';

test('recognizes expense and income accounts across SYSCOHADA naming variants', () => {
  assert.equal(isPriceVarianceAccount({ numero: '603', type: 'charges' }), true);
  assert.equal(isPriceVarianceAccount({ numero: '701', type: 'produits' }), true);
  assert.equal(isPriceVarianceAccount({ numero: '600', type: 'expense' }), true);
  assert.equal(isPriceVarianceAccount({ numero: '700', type: 'income' }), true);
  assert.equal(isPriceVarianceAccount({ numero: '640', type: 'other' }), true);
  assert.equal(isPriceVarianceAccount({ numero: '401', type: 'passif' }), false);
});
