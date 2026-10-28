import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateLogisticsByWeight,
  allocateMoneyByWeight,
  calculateSellingPriceFromMarkup,
  calculateRemainingLayerValue,
  calculateWeightedAverageSaleCost,
  convertQuantityToBase,
  convertUnitPriceToBase,
  convertWeightToKg,
  splitCostVariance,
} from '../src/services/stockValuation.js';

test('convertit grammes, kilogrammes et tonnes en kilogrammes', () => {
  assert.equal(convertWeightToKg(500, 'g'), 0.5);
  assert.equal(convertWeightToKg(1, 'kg'), 1);
  assert.equal(convertWeightToKg(1, 't'), 1000);
});

test('convertit une tonne saisie vers le stock en kilogrammes et ajuste son prix unitaire', () => {
  assert.equal(convertQuantityToBase(1, 'tonne', 'kg'), 1000);
  assert.equal(convertUnitPriceToBase(10000, 't', 'kg'), 10);
});

test('répartit les frais selon les poids après conversion des unités principales', () => {
  const result = allocateLogisticsByWeight([
    { quantite: 200, uniteMesure: 'kg' },
    { quantite: 0.8, uniteMesure: 't' },
  ], 10000);

  assert.deepEqual(result.allocations, [2000, 8000]);
  assert.equal(result.totalWeightKg, 1000);
});

test('répartit les frais logistiques au prorata du poids total des articles', () => {
  const result = allocateLogisticsByWeight([
    { quantite: 2, poidsParUnite: 1, unitePoids: 'kg' },
    { quantite: 1, poidsParUnite: 500, unitePoids: 'g' },
  ], 300);

  assert.deepEqual(result.allocations, [240, 60]);
  assert.equal(result.unallocated, 0);
  assert.equal(result.totalWeightKg, 2.5);
});

test('convertit le poids par pièce pour répartir les frais logistiques', () => {
  const result = allocateLogisticsByWeight([
    { quantite: 10, poidsParUnite: 500, unitePoids: 'g' },
    { quantite: 1, poidsParUnite: 1, unitePoids: 'kg' },
  ], 300);

  assert.deepEqual(result.allocations, [250, 50]);
});

test('répartit les centimes restants sans perdre de montant', () => {
  const result = allocateMoneyByWeight(10, [1, 1, 1]);

  assert.equal(result.allocations.reduce((sum, amount) => sum + amount, 0), 10);
  assert.equal(result.unallocated, 0);
  assert.deepEqual(result.allocations, [3.34, 3.33, 3.33]);
});

test('ne répartit rien si le poids d’une ligne de stock manque', () => {
  const result = allocateLogisticsByWeight([
    { quantite: 2, poidsParUnite: 1, unitePoids: 'kg' },
    { quantite: 1, poidsParUnite: null, unitePoids: 'kg' },
  ], 25);

  assert.deepEqual(result.allocations, [0, 0]);
  assert.equal(result.unallocated, 25);
  assert.deepEqual(result.missingWeightIndexes, [1]);
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
