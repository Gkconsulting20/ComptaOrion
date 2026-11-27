// TVA — choix à l'inscription et presets affichés (27 nov. 2026).
// Le formulaire d'inscription propose 18 % / 0 % / taux personnalisé ;
// les listes de taxes des modules partent du taux de l'entreprise au lieu
// d'afficher 18 % en dur. Tests purs (aucune base, aucun rendu).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTauxTvaInscription,
  buildTaxPresets,
  TAUX_TVA_DEFAUT,
} from '../src/utils/tauxTva.js';

test("inscription : 18 % par défaut, 0 % exonéré, personnalisé validé", () => {
  assert.equal(TAUX_TVA_DEFAUT, 18);
  assert.equal(resolveTauxTvaInscription('18'), 18);
  assert.equal(resolveTauxTvaInscription(undefined), 18);
  assert.equal(resolveTauxTvaInscription('0'), 0);
  assert.equal(resolveTauxTvaInscription('custom', '19.25'), 19.25);
  assert.equal(resolveTauxTvaInscription('custom', '0'), 0);
  assert.equal(resolveTauxTvaInscription('custom', '100'), 100);
});

test('inscription : taux personnalisé invalide → null (formulaire bloqué)', () => {
  for (const invalide of ['', 'abc', '-1', '101', '18%', null, undefined]) {
    assert.equal(
      resolveTauxTvaInscription('custom', invalide),
      null,
      `devrait rejeter ${JSON.stringify(invalide)}`,
    );
  }
});

test("presets : le taux de l'entreprise arrive en tête, sans doublon", () => {
  assert.deepEqual(
    buildTaxPresets(0).map((preset) => preset.taux),
    [0, 18, 9],
  );
  assert.deepEqual(
    buildTaxPresets(19.25).map((preset) => preset.taux),
    [19.25, 18, 9, 0],
  );
  assert.deepEqual(
    buildTaxPresets(18).map((preset) => preset.taux),
    [18, 9, 0],
  );
  assert.deepEqual(
    buildTaxPresets(undefined).map((preset) => preset.taux),
    [18, 9, 0],
  );
});

test('presets : libellés et codes comptables conservés (9 % → 4432, exonéré → -)', () => {
  const presets = buildTaxPresets(19.25);
  assert.equal(presets[0].nom, "TVA 19.25% — taux de l'entreprise");
  assert.equal(presets[0].codeComptable, '4431');
  assert.equal(presets.find((preset) => preset.taux === 9).codeComptable, '4432');
  assert.equal(presets.find((preset) => preset.taux === 0).nom, 'Exonéré');
  assert.equal(presets.find((preset) => preset.taux === 0).codeComptable, '-');
});
