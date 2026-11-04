import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToIsoDate,
  isValidPaymentDelay,
  isValidPreferredPaymentMethods,
  preferredPaymentMethod,
} from '../src/services/paymentTerms.js';

test('accepte le paiement à réception et les délais de paiement non négatifs', () => {
  for (const days of [0, 15, 30, 60]) {
    assert.equal(isValidPaymentDelay(days), true);
  }
  assert.equal(isValidPaymentDelay(-1), false);
  assert.equal(isValidPaymentDelay(1.5), false);
});

test('calcule une échéance calendaire sans décalage de fuseau horaire', () => {
  assert.equal(addDaysToIsoDate('2026-01-31', 0), '2026-01-31');
  assert.equal(addDaysToIsoDate('2026-01-31', 15), '2026-02-15');
  assert.equal(addDaysToIsoDate('2026-12-15', 30), '2027-01-14');
});

test('valide les modes préférés et ne transforme pas le crédit en mode d’encaissement', () => {
  assert.equal(isValidPreferredPaymentMethods(['virement', 'cheque']), true);
  assert.equal(isValidPreferredPaymentMethods(['virement', 'virement']), false);
  assert.equal(isValidPreferredPaymentMethods(['inconnu']), false);
  assert.equal(preferredPaymentMethod(['credit', 'virement'], 'especes'), 'virement');
  assert.equal(preferredPaymentMethod(['credit'], 'especes'), 'especes');
});
