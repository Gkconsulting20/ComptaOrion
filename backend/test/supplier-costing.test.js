import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateLogisticsByValue,
  allocateMoneyByWeight,
  calculateSellingPriceFromMarkup,
  calculateRemainingLayerValue,
  calculateWeightedAverageSaleCost,
  splitCostVariance,
} from '../src/services/stockValuation.js';

test('répartit les frais logistiques au prorata de la valeur des articles', () => {
  const result = allocateLogisticsByValue([
    { quantite: 2, prixUnitaireReel: 500 },
    { quantite: 1, prixUnitaireReel: 2000 },
  ], 300);

  assert.deepEqual(result.allocations, [100, 200]);
  assert.equal(result.unallocated, 0);
});

test('répartit aussi les frais estimés des lignes de réception', () => {
  const result = allocateLogisticsByValue([
    { quantite_recue: 2, prix_unitaire_estime: 500 },
    { quantite_recue: 1, prix_unitaire_estime: 1000 },
  ], 300);

  assert.deepEqual(result.allocations, [150, 150]);
});

test('répartit les centimes restants sans perdre de montant', () => {
  const result = allocateMoneyByWeight(10, [1, 1, 1]);

  assert.equal(result.allocations.reduce((sum, amount) => sum + amount, 0), 10);
  assert.equal(result.unallocated, 0);
  assert.deepEqual(result.allocations, [3.34, 3.33, 3.33]);
});

test('conserve les frais non attribuables quand aucune ligne article n’a de valeur', () => {
  const result = allocateLogisticsByValue([
    { quantite: 0, prixUnitaireReel: 100 },
  ], 25);

  assert.deepEqual(result.allocations, [0]);
  assert.equal(result.unallocated, 25);
});

test('ne réévalue que la quantité restante de la réception', () => {
  assert.equal(calculateRemainingLayerValue(1200, 40, 100), 480);
  assert.equal(calculateRemainingLayerValue(1200, 0, 100), 0);
});

test('sépare la correction du stock de l’écart passé en charge', () => {
  assert.deepEqual(splitCostVariance(1000, 600), {
    inventoryAdjustment: 600,
    expenseVariance: 400,
  });
  assert.deepEqual(splitCostVariance(-1000, -300), {
    inventoryAdjustment: -300,
    expenseVariance: -700,
  });
});

test('calcule le prix catalogue en ajoutant la majoration au CMV', () => {
  assert.equal(calculateSellingPriceFromMarkup(100, 30), 130);
  assert.equal(calculateSellingPriceFromMarkup(0, 30), 0);
  assert.throws(() => calculateSellingPriceFromMarkup(100, -1), /marge/i);
});

test('valorise une vente au CMV pondéré sans recalculer le coût unitaire', () => {
  assert.equal(calculateWeightedAverageSaleCost(125, 3), 375);
  assert.equal(calculateWeightedAverageSaleCost(125, 0.125), 15.63);
});
