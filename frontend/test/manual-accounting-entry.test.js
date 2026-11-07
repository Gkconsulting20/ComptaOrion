import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/modules/ModuleComptabilite.jsx', import.meta.url),
  'utf8',
);

test('la saisie manuelle envoie les lignes avec le contrat comptable attendu', () => {
  assert.match(source, /compteComptableId:\s*parseInt\(ligne\.compteId,\s*10\)/);
  assert.match(source, /lignes:\s*lignesEcriture/);
  assert.match(source, /api\.post\('\/comptabilite\/ecritures',\s*ecritureData\)/);
  assert.doesNotMatch(source, /api\.post\('\/comptabilite\/lignes'/);
  assert.doesNotMatch(source, /\/comptabilite\/ecritures\/\$\{ecritureCreated\.id\}\/valider/);
});
