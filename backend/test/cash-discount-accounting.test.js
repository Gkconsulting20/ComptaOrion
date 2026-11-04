import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCashSettlementEntryLines } from '../src/services/cashDiscountAccounting.js';

function totals(lines) {
  return lines.reduce((result, line) => ({
    debit: result.debit + Number(line.debit || 0),
    credit: result.credit + Number(line.credit || 0),
  }), { debit: 0, credit: 0 });
}

test('l’escompte client est une charge 673 et ne modifie aucune ligne de TVA', () => {
  const lines = buildCashSettlementEntryLines({
    side: 'client',
    thirdPartyAccountId: 411,
    treasuryAccountId: 52,
    discountAccountId: 673,
    paymentAmount: 11700,
    discountHT: 100,
    thirdPartyName: 'Client',
    reference: 'V-001',
  });
  assert.deepEqual(lines.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })), [
    { compteComptableId: 52, debit: 11700, credit: 0 },
    { compteComptableId: 411, debit: 0, credit: 11800 },
    { compteComptableId: 673, debit: 100, credit: 0 },
  ]);
  assert.deepEqual(totals(lines), { debit: 11800, credit: 11800 });
});

test('l’escompte fournisseur est un produit 773 et ne modifie aucune ligne de TVA', () => {
  const lines = buildCashSettlementEntryLines({
    side: 'supplier',
    thirdPartyAccountId: 401,
    treasuryAccountId: 52,
    discountAccountId: 773,
    paymentAmount: 11700,
    discountHT: 100,
    thirdPartyName: 'Fournisseur',
    reference: 'A-001',
  });
  assert.deepEqual(lines.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })), [
    { compteComptableId: 401, debit: 11800, credit: 0 },
    { compteComptableId: 52, debit: 0, credit: 11700 },
    { compteComptableId: 773, debit: 0, credit: 100 },
  ]);
  assert.deepEqual(totals(lines), { debit: 11800, credit: 11800 });
});
