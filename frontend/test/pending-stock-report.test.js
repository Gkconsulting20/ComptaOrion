import test from 'node:test';
import assert from 'node:assert/strict';
import { readPendingStockReport } from '../src/utils/pendingStockReport.js';

test('le stock non facturé lit les réponses directes du client API', () => {
  const report = { items: [{ id: 1 }], totaux: { valeur: 25000, lignes: 2 } };
  assert.equal(readPendingStockReport(report), report);
  assert.equal(readPendingStockReport({ data: report }), report);
});

test('une réponse absente ou invalide ne devient pas un faux rapport à zéro', () => {
  for (const response of [null, {}, { data: [] }, { items: [] }]) {
    assert.throws(() => readPendingStockReport(response), /rapport.*incomplet/);
  }
  const emptyReport = { items: [], totaux: { valeur: 0, lignes: 0 } };
  assert.equal(readPendingStockReport(emptyReport), emptyReport);
});
