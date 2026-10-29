import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCashConversionCycle,
  calculateCurrentInventoryValue,
  calculateGrossMargin,
  calculateNetCashflow,
  calculateWorkingCapitalDays,
  countInclusiveDays,
  outstandingBalanceAt,
  sumMoney,
  VALID_SALES_STATUSES,
} from '../src/services/dashboardMetrics.js';

test('calcule les jours de période de façon inclusive', () => {
  assert.equal(countInclusiveDays('2026-01-01', '2026-01-31'), 31);
  assert.equal(countInclusiveDays('2026-02-01', '2026-01-31'), 0);
});

test('calcule le solde client restant à une date donnée', () => {
  const invoices = [
    { id: 1, dateFacture: '2026-01-01', statut: 'envoyee', totalTTC: '100.00' },
    { id: 2, dateFacture: '2026-02-01', statut: 'brouillon', totalTTC: '900.00' },
  ];
  const payments = [
    { factureId: 1, montant: '40.00', datePaiement: '2026-01-15' },
    { factureId: 1, montant: '60.00', datePaiement: '2026-02-15' },
  ];

  assert.equal(outstandingBalanceAt(invoices, payments, '2026-01-31', VALID_SALES_STATUSES), 60);
  assert.equal(outstandingBalanceAt(invoices, payments, '2026-02-28', VALID_SALES_STATUSES), 0);
});

test('calcule DSO/DPO à partir du solde moyen et du flux de période', () => {
  assert.equal(calculateWorkingCapitalDays(1000, 3000, 20000, 30), 3);
  assert.equal(calculateWorkingCapitalDays(0, 0, 0, 30), null);
  assert.equal(calculateWorkingCapitalDays(0, 1000, 20000, 0), null);
});

test('la marge brute conserve les pertes et refuse un CMV incomplet', () => {
  assert.deepEqual(calculateGrossMargin(100, 130, true), { cmv: 130, marginPercent: -30 });
  assert.deepEqual(calculateGrossMargin(100, null, false), { cmv: null, marginPercent: null });
});

test('calcule le cash-flow à partir des encaissements et décaissements réels', () => {
  assert.equal(calculateNetCashflow([
    { type: 'encaissement', montant: '1250.50' },
    { type: 'decaissement', montant: '250.25' },
  ]), 1000.25);
});

test('valorise le stock au coût moyen ou par couches FIFO, sans reprendre prixAchat', () => {
  const cmp = calculateCurrentInventoryValue([
    { id: 1, quantite: '4', coutMoyen: '12.50', prixAchat: '99.00', valorisationMethod: 'CMP' },
  ], []);
  assert.deepEqual(cmp, { value: 50, complete: true });

  const fifo = calculateCurrentInventoryValue([
    { id: 2, quantite: '5', coutMoyen: '0', valorisationMethod: 'FIFO' },
  ], [
    { produitId: 2, quantite: '3', coutTotal: '30.00' },
    { produitId: 2, quantite: '2', coutTotal: '28.00' },
  ]);
  assert.deepEqual(fifo, { value: 58, complete: true });

  assert.deepEqual(calculateCurrentInventoryValue([
    { id: 3, quantite: '2', coutMoyen: '0', prixAchat: '15.00', valorisationMethod: 'CMP' },
  ], []), { value: null, complete: false });
});

test('ne calcule pas le cycle de conversion si le DIO manque', () => {
  assert.equal(calculateCashConversionCycle(12, null, 7), null);
  assert.equal(calculateCashConversionCycle(12, 25, 7), 30);
});

test('additionne les montants en centimes', () => {
  assert.equal(sumMoney([{ value: '0.10' }, { value: '0.20' }], 'value'), 0.3);
});
