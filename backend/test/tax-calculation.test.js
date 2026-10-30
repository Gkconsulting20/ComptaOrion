import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerTva } from '../src/routes/impots.js';

test('calcule la TVA nette et le crédit à partir des soldes validés', async () => {
  const responses = [
    { rows: [
      { numero: '4431', nom: 'TVA facturée', montant: '181000.00' },
      { numero: '4433', nom: 'TVA collectée complémentaire', montant: '1000.00' }
    ] },
    { rows: [
      { numero: '4452', nom: 'TVA récupérable', montant: '81000.00' }
    ] }
  ];
  const executor = {
    execute: async () => responses.shift()
  };

  const due = await calculerTva(12, '2026-01-01', '2026-01-31', executor);
  assert.equal(due.tvaCollectee, 182000);
  assert.equal(due.tvaDeductible, 81000);
  assert.equal(due.tvaADecaisser, 101000);
  assert.equal(due.creditTVA, 0);
  assert.equal(due.comptesCollectee.length, 2);
  assert.equal(due.comptesDeductible.length, 1);

  const creditResponses = [
    { rows: [{ numero: '4431', nom: 'TVA facturée', montant: '50000.00' }] },
    { rows: [{ numero: '4452', nom: 'TVA récupérable', montant: '100000.00' }] }
  ];
  const credit = await calculerTva(12, '2026-02-01', '2026-02-28', {
    execute: async () => creditResponses.shift()
  });
  assert.equal(credit.tvaADecaisser, -50000);
  assert.equal(credit.creditTVA, 50000);
});
