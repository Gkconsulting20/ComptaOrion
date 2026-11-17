import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('les exports du grand livre et de la balance ont un contexte entreprise déclaré et chargé', async () => {
  const source = await readFile(new URL('../src/modules/ModuleComptabilite.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[entrepriseInfo, setEntrepriseInfo\] = useState/);
  assert.match(source, /api\.get\('\/parametres\/entreprise'\)/);
  assert.match(source, /setEntrepriseInfo\(entrepriseRes\.status/);
});

test('les transactions ont un bouton Générer accessible même en période compacte', async () => {
  const source = await readFile(new URL('../src/modules/TresorerieModule.jsx', import.meta.url), 'utf8');
  assert.match(source, /actions=\{<div[\s\S]*?onClick=\{loadTransactionsFiltered\}[\s\S]*?'Générer'/);
});
