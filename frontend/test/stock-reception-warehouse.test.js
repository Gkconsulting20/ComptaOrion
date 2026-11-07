import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stockSource = await readFile(
  new URL('../src/modules/StockInventaire.jsx', import.meta.url),
  'utf8',
);

test('la réception recharge et présélectionne l’entrepôt disponible', () => {
  assert.match(stockSource, /api\.get\('\/stock\/entrepots'\)/);
  assert.match(stockSource, /activeWarehouses\.length === 1 \? String\(activeWarehouses\[0\]\.id\) : ''/);
});

test('sans entrepôt, la réception explique le blocage et permet d’en créer un', () => {
  assert.match(stockSource, /Aucun entrepôt actif n’est disponible, donc la liste est vide/);
  assert.match(stockSource, /Créer un entrepôt et revenir à la réception/);
  assert.match(stockSource, /await reload\('entrepots'\);[\s\S]*?handleOpenCommandeReception\(orderToResume\)/);
  assert.match(stockSource, /modal\.type === 'commandeReception' && activeEntrepots\.length === 0/);
});
