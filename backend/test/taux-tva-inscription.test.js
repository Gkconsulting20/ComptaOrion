// TVA à l'inscription (27 nov. 2026) : le taux choisi à l'inscription
// (18 % / 0 % / personnalisé) doit être validé côté backend avant d'être
// stocké sur l'entreprise — jamais inventé, jamais hors de 0–100.
// Tests purs (aucune base) : seule la validation est couverte ici ; la
// persistance est vérifiée en direct sur une entreprise test (inscription
// 0 % / 18 % / personnalisé, puis lecture du taux stocké).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTauxTva, TAUX_TVA_DEFAUT } from '../src/utils/tauxTva.js';

test('taux par défaut : 18 % quand rien n’est choisi', () => {
  assert.equal(TAUX_TVA_DEFAUT, 18);
  assert.equal(parseTauxTva(undefined), 18);
  assert.equal(parseTauxTva(null), 18);
  assert.equal(parseTauxTva(''), 18);
});

test('taux valides acceptés : 0 %, 18 %, personnalisé, chaîne numérique', () => {
  assert.equal(parseTauxTva(0), 0);
  assert.equal(parseTauxTva('0'), 0);
  assert.equal(parseTauxTva(18), 18);
  assert.equal(parseTauxTva('18'), 18);
  assert.equal(parseTauxTva(19.25), 19.25);
  assert.equal(parseTauxTva('7.5'), 7.5);
  assert.equal(parseTauxTva(100), 100);
});

test('taux invalides rejetés : négatif, > 100, non numérique, NaN', () => {
  for (const invalide of [-1, 100.01, 101, 'abc', '18%', NaN, Infinity, {}, []]) {
    assert.throws(
      () => parseTauxTva(invalide),
      /entre 0 et 100/,
      `devrait rejeter ${JSON.stringify(invalide)}`,
    );
  }
});

test('arrondi à 2 décimales (stockage decimal(5,2))', () => {
  assert.equal(parseTauxTva(19.255), 19.26);
  assert.equal(parseTauxTva('18.005'), 18.01);
});
