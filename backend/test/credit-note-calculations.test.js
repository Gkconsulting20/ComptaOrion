import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCreditNoteVat, calculateReturnedLine } from '../src/services/creditNoteCalculations.js';

test('retour client calculé au coût historique de la vente', () => {
  assert.deepEqual(calculateReturnedLine({
    quantityOriginal: 4,
    quantityAlreadyReturned: 1,
    quantityRequested: 2,
    totalOriginalHT: 120000,
    historicalUnitCost: 72500.125,
  }), {
    quantite: 2,
    totalHT: 60000,
    coutStock: 145000.25,
  });
});

test('refuse un retour supérieur à la quantité facturée', () => {
  assert.throws(() => calculateReturnedLine({
    quantityOriginal: 3,
    quantityAlreadyReturned: 2,
    quantityRequested: 1.001,
    totalOriginalHT: 1000,
  }), /dépasse la quantité/);
});

test('répartit la TVA du retour au prorata du HT original', () => {
  assert.equal(calculateCreditNoteVat(250, 1000, 180), 45);
});

test('refuse une ligne historique sans quantité ou montant valide', () => {
  assert.throws(() => calculateReturnedLine({
    quantityOriginal: 0,
    quantityRequested: 1,
    totalOriginalHT: 100,
  }), /positive/);
});
