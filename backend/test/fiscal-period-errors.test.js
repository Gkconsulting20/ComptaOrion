import test from 'node:test';
import assert from 'node:assert/strict';
import { markClosedFiscalPeriodConflict, CLOSED_FISCAL_PERIOD_CONSTRAINT } from '../src/services/fiscalPeriodErrors.js';

test('une erreur PostgreSQL imbriquée devient un conflit lisible sans requête SQL', () => {
  const cause = Object.assign(new Error('Écriture refusée : exercice comptable 2025 fermé.'), {
    constraint: CLOSED_FISCAL_PERIOD_CONSTRAINT,
  });
  const wrapper = new Error('Failed query: INSERT INTO ecritures ...', { cause });
  assert.equal(markClosedFiscalPeriodConflict(wrapper), wrapper);
  assert.equal(wrapper.status, 409);
  assert.equal(wrapper.statusCode, 409);
  assert.equal(wrapper.message, cause.message);
});

test('les autres erreurs et les chaînes circulaires restent inchangées', () => {
  const error = new Error('Autre erreur');
  error.cause = error;
  markClosedFiscalPeriodConflict(error);
  assert.equal(error.status, undefined);
  assert.equal(error.message, 'Autre erreur');
});
