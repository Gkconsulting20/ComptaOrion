import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const periodFilterSource = readFileSync(
  new URL('../src/components/PeriodFilter.jsx', import.meta.url),
  'utf8',
);
const reportModulePaths = [
  '../src/modules/ClientsModule.jsx',
  '../src/modules/DepensesModule.jsx',
  '../src/modules/GestionFournisseurs.jsx',
  '../src/modules/ImpotsModule.jsx',
  '../src/modules/ModuleComptabilite.jsx',
  '../src/modules/StockInventaire.jsx',
  '../src/modules/TresorerieModule.jsx',
];

test('les filtres de période des rapports utilisent le sélecteur compact par défaut', () => {
  assert.match(periodFilterSource, /compactSelector\s*=\s*true/);
  assert.match(periodFilterSource, /setPeriodeActive\(matchingPeriod\?\.id \|\| 'custom'\)/);
  assert.equal((periodFilterSource.match(/onApply && \(/g) || []).length, 2,
    'Le bouton Appliquer ne doit apparaître que lorsque la vue peut charger le rapport immédiatement');
});

test('les rapports métier partagent une même barre compacte de titre et de période', () => {
  for (const path of reportModulePaths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /ReportPageHeader/, `${path} doit utiliser l’en-tête commun`);
    assert.match(source, /compactSelector=\{true\}/, `${path} doit utiliser le sélecteur compact`);
  }

  const accountingSource = readFileSync(
    new URL('../src/modules/ModuleComptabilite.jsx', import.meta.url),
    'utf8',
  );
  assert.match(accountingSource, /title="Balance générale"/,
    'La balance doit utiliser le même en-tête que les autres rapports');
});
