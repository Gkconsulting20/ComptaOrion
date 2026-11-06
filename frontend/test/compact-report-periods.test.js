import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const periodFilterSource = readFileSync(
  new URL('../src/components/PeriodFilter.jsx', import.meta.url),
  'utf8',
);

test('les filtres de période des rapports utilisent le sélecteur compact par défaut', () => {
  assert.match(periodFilterSource, /compactSelector\s*=\s*true/);
  assert.match(periodFilterSource, /setPeriodeActive\(matchingPeriod\?\.id \|\| 'custom'\)/);
});
