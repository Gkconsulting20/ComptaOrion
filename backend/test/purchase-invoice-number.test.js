import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextPurchaseInvoiceNumber } from '../src/services/purchaseInvoiceNumber.js';

test('la séquence facture achat prend le maximum de l’exercice pour l’entreprise', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, [
      'FACT-ACH-2025-000099',
      'FACT-ACH-2026-000004',
      'FACT-ACH-2026-000002',
    ], [
      'FACT-ACH-2026-000002',
      'FACT-ACH-2026-000004',
    ]),
    'FACT-ACH-2026-000005',
  );
});

test('la séquence facture achat saute un numéro globalement déjà utilisé', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, [], [
      'FACT-ACH-2026-000001',
      'FACT-ACH-2026-000002',
    ]),
    'FACT-ACH-2026-000003',
  );
});
