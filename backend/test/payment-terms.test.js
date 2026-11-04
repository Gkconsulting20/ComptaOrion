import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToIsoDate,
  calculateCashDiscount,
  isValidCashDiscountTerms,
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

test('valide un escompte avant l’échéance nette', () => {
  assert.equal(isValidCashDiscountTerms(1, 15, 30), true);
  assert.equal(isValidCashDiscountTerms(2, 15, 30), true);
  assert.equal(isValidCashDiscountTerms(1, 15, 15), false);
  assert.equal(isValidCashDiscountTerms(0, 0, 30), true);
  assert.equal(isValidCashDiscountTerms(101, 15, 30), false);
});

test('calcule l’escompte de règlement sur le HT sans modifier la TVA', () => {
  assert.deepEqual(calculateCashDiscount({
    totalHT: 10000,
    totalTVA: 1800,
    totalTTC: 11800,
    rate: 1,
    discountDeadline: '2026-01-15',
    paymentDate: '2026-01-15',
  }), {
    montantHT: 100,
    montantTVA: 0,
    montantTTC: 100,
    montantNetHT: 10000,
    montantNetTVA: 1800,
    montantNetTTC: 11700,
  });
  assert.equal(calculateCashDiscount({
    totalHT: 10000,
    totalTVA: 1800,
    rate: 1,
    discountDeadline: '2026-01-15',
    paymentDate: '2026-01-16',
  }), null);
  assert.equal(calculateCashDiscount({
    totalHT: 10000,
    totalTVA: 1800,
    rate: 1,
    discountDeadline: '2026-01-15',
    paymentDate: '2026-01-10',
    hasPriorPayments: true,
  }), null);
});

test('valide les modes préférés et ne transforme pas le crédit en mode d’encaissement', () => {
  assert.equal(isValidPreferredPaymentMethods(['virement', 'cheque']), true);
  assert.equal(isValidPreferredPaymentMethods(['virement', 'virement']), false);
  assert.equal(isValidPreferredPaymentMethods(['inconnu']), false);
  assert.equal(preferredPaymentMethod(['credit', 'virement'], 'especes'), 'virement');
  assert.equal(preferredPaymentMethod(['credit'], 'especes'), 'especes');
});
