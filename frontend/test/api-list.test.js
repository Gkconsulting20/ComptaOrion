import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiList, readAutomaticCosting } from '../src/utils/apiList.js';

test('lit les listes renvoyées directement par les routes de stock', () => {
  const warehouses = [{ id: 1, nom: 'Dépôt principal' }];
  assert.deepEqual(readApiList(warehouses), warehouses);
});

test('lit les listes enveloppées des routes produits et commandes', () => {
  const products = [{ id: 2, nom: 'Tracteur' }];
  assert.deepEqual(readApiList({ success: true, data: products }, 'data'), products);
  assert.deepEqual(readApiList({ data: { data: products } }, 'data'), products);
});

test('retourne une liste vide pour une réponse invalide ou une erreur masquée', () => {
  assert.deepEqual(readApiList(null), []);
  assert.deepEqual(readApiList({ error: 'Erreur réseau' }), []);
  assert.deepEqual(readApiList({ data: { data: [] } }, 'data'), []);
});

test('lit le droit de calcul automatique dans la réponse réelle de l’API', () => {
  assert.equal(readAutomaticCosting({ success: true, automaticCosting: true }), true);
  assert.equal(readAutomaticCosting({ success: true, automaticCosting: false }), false);
  assert.equal(readAutomaticCosting({ data: { automaticCosting: true } }), true);
});
