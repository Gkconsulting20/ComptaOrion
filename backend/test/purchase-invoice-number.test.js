// Numérotation des factures fournisseurs cloisonnée à l'entreprise
// (27 nov. 2026, ordre de Cap) : FACT-ACH-{année}-{id entreprise}-{séquence}.
// La séquence est le maximum des numéros DE CETTE ENTREPRISE pour l'exercice.
// Les numéros des autres entreprises sont ignorés : fini la déduplication
// globale (l'ancien test « saute un numéro globalement déjà utilisé »
// décrivait un couplage inter-entreprises, supprimé).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextPurchaseInvoiceNumber } from '../src/services/purchaseInvoiceNumber.js';

test('la séquence facture achat prend le maximum de l’exercice pour l’entreprise', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, [
      'FACT-ACH-2025-000099',
      'FACT-ACH-2026-000004',
      'FACT-ACH-2026-000002',
    ]),
    'FACT-ACH-2026-5-000005',
  );
});

test('la séquence facture achat continue depuis le nouveau format avec id', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, [
      'FACT-ACH-2026-5-000004',
      'FACT-ACH-2026-5-000002',
    ]),
    'FACT-ACH-2026-5-000005',
  );
});

test('la séquence facture achat ne saute plus les numéros des autres entreprises', () => {
  // L'entreprise 5 n'a aucune facture en 2026 : elle commence à 000001,
  // même si d'autres entreprises ont déjà utilisé 000001 et 000002.
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, []),
    'FACT-ACH-2026-5-000001',
  );
});

test('deux entreprises ont la même séquence mais des numéros distincts', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, []),
    'FACT-ACH-2026-5-000001',
  );
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 9, []),
    'FACT-ACH-2026-9-000001',
  );
});
