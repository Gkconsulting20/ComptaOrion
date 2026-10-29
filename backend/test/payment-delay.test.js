import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWeightedPaymentDelay } from '../src/services/dashboardMetrics.js';

test('calcule les délais depuis la date de facture et pondère les paiements partiels', () => {
  const invoices = [
    { id: 1, dateFacture: '2026-01-01', createdAt: '2026-10-29', totalTTC: '100.00' },
  ];
  const payments = [
    { factureId: 1, datePaiement: '2026-01-11', montant: '50.00' },
    { factureId: 1, datePaiement: '2026-01-21', montant: '50.00' },
  ];

  assert.equal(calculateWeightedPaymentDelay(invoices, payments), 15);
});

test('ignore les factures impayées et plafonne les paiements au montant de la facture', () => {
  const invoices = [
    { id: 1, dateFacture: '2026-01-01', totalTTC: '100.00' },
    { id: 2, dateFacture: '2026-01-01', totalTTC: '50.00' },
  ];
  const payments = [
    { factureId: 1, datePaiement: '2026-01-11', montant: '150.00' },
  ];

  assert.equal(calculateWeightedPaymentDelay(invoices, payments), 10);
});

test('retourne zéro quand aucun paiement valide ne peut être calculé', () => {
  assert.equal(calculateWeightedPaymentDelay(
    [{ id: 1, dateFacture: '2026-01-10', totalTTC: '100.00' }],
    [{ factureId: 1, datePaiement: '2026-01-01', montant: '100.00' }],
  ), 0);
});
