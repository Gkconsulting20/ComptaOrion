import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSupplierInvoiceText } from '../src/utils/supplierInvoiceOcr.js';

test('extracts supplier invoice number, date and totals from French text', () => {
  const result = parseSupplierInvoiceText(`
    FACTURE N°: FT-2026-004
    Date: 17/02/2026
    Total HT: 450 000 FCFA
    Montant TVA: 81 000 FCFA
    Total TTC: 531 000 FCFA
  `);

  assert.equal(result.numeroFactureFournisseur, 'FT-2026-004');
  assert.equal(result.dateFacture, '2026-02-17');
  assert.equal(result.montantHT, 450000);
  assert.equal(result.montantTVA, 81000);
  assert.equal(result.montantTTC, 531000);
});

test('parses decimal-formatted amounts and ignores a VAT percentage as an amount', () => {
  const result = parseSupplierInvoiceText(`
    Invoice No: INV-25-009
    Date facture: 2025-12-03
    Total HT: 1.234,56
    TVA 18%
    Montant TVA: 222,22
    Net à payer: 1.456,78
  `);

  assert.equal(result.numeroFactureFournisseur, 'INV-25-009');
  assert.equal(result.dateFacture, '2025-12-03');
  assert.equal(result.montantHT, 1234.56);
  assert.equal(result.montantTVA, 222.22);
  assert.equal(result.montantTTC, 1456.78);
});

test('does not invent values when a label or date is absent or invalid', () => {
  const result = parseSupplierInvoiceText('Facture N°: F-1234\nDate: 31/02/2026\nTVA 18%');

  assert.equal(result.dateFacture, '');
  assert.equal(result.montantHT, null);
  assert.equal(result.montantTVA, null);
  assert.equal(result.montantTTC, null);
});

test('keeps invoice-image recognition in the browser without an upload request', async () => {
  const component = await readFile(new URL('../src/modules/SupplierInvoiceOcr.jsx', import.meta.url), 'utf8');

  assert.match(component, /import\('tesseract\.js'\)/);
  assert.doesNotMatch(component, /\bfetch\s*\(|api\.post|XMLHttpRequest/);
});
