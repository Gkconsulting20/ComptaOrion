import test from 'node:test';
import assert from 'node:assert/strict';
import { getCashDiscountPreview } from '../src/utils/cashDiscount.js';

test('prévisualise un escompte de règlement sans toucher au TTC ni à la TVA de la facture', () => {
  assert.deepEqual(getCashDiscountPreview({
    totalHT: '10000.00',
    totalTVA: '1800.00',
    totalTTC: '11800.00',
    escomptePourcentage: '1.00',
    dateLimiteEscompte: '2026-01-15',
    montantPaye: '0.00',
    montantEscompte: '0.00',
  }, '2026-01-15'), {
    discountHT: 100,
    invoiceTVA: 1800,
    netTTC: 11700,
  });
});

test('calcule correctement les taux décimaux et masque un escompte non applicable', () => {
  const invoice = {
    totalHT: '1234.56',
    totalTVA: '222.22',
    totalTTC: '1456.78',
    escomptePourcentage: '0.50',
    dateLimiteEscompte: '2026-01-15',
    montantPaye: '0.00',
    montantEscompte: '0.00',
  };
  assert.equal(getCashDiscountPreview(invoice, '2026-01-15').discountHT, 6.17);
  assert.equal(getCashDiscountPreview(invoice, '2026-01-16'), null);
  assert.equal(getCashDiscountPreview({ ...invoice, montantPaye: '1.00' }, '2026-01-15'), null);
});
