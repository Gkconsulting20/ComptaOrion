import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const purchasesRoute = readFileSync(
  new URL('../src/routes/achats.js', import.meta.url),
  'utf8'
);

test('le rapprochement fournisseur limite chaque mise à jour au tenant courant', () => {
  assert.match(
    purchasesRoute,
    /UPDATE bons_reception[\s\S]*?WHERE id = \$\{parseInt\(recId\)\} AND entreprise_id = \$\{req\.entrepriseId\}/
  );
  assert.match(
    purchasesRoute,
    /UPDATE stock_pending[\s\S]*?WHERE entreprise_id = \$\{req\.entrepriseId\}[\s\S]*?bon_reception_id = \$\{parseInt\(recId\)\}/
  );
  assert.match(
    purchasesRoute,
    /UPDATE logistique_pending[\s\S]*?WHERE entreprise_id = \$\{req\.entrepriseId\}[\s\S]*?bon_reception_id = \$\{parseInt\(recId\)\}/
  );
  assert.match(
    purchasesRoute,
    /UPDATE factures_achat[\s\S]*?WHERE id = \$\{newFacture\.id\} AND entreprise_id = \$\{req\.entrepriseId\}/
  );
});
