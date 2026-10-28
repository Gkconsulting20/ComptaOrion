import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { produitPrix, produits, valorisationsStock } from '../schema.js';

const toCents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const fromCents = (value) => Number(value || 0) / 100;
const toMilliUnits = (value) => Math.round(Number(value || 0) * 1000);
const fromMilliUnits = (value) => Number(value || 0) / 1000;

export function allocateMoneyByWeight(totalAmount, weights) {
  const totalCents = toCents(totalAmount);
  const positiveWeights = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const weightTotal = positiveWeights.reduce((sum, weight) => sum + weight, 0);
  const allocations = weights.map(() => 0);

  if (totalCents === 0 || weightTotal <= 0) {
    return { allocations, unallocated: fromCents(totalCents) };
  }

  const eligible = positiveWeights
    .map((weight, index) => ({ weight, index }))
    .filter(({ weight }) => weight > 0);
  let allocatedCents = 0;
  const fractionalShares = [];

  for (const { weight, index } of eligible) {
    const exactCents = totalCents * (weight / weightTotal);
    const floorCents = Math.floor(exactCents);
    allocations[index] = floorCents;
    allocatedCents += floorCents;
    fractionalShares.push({ index, fraction: exactCents - floorCents });
  }

  let remainder = totalCents - allocatedCents;
  fractionalShares.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; remainder > 0 && fractionalShares.length; i = (i + 1) % fractionalShares.length) {
    allocations[fractionalShares[i].index] += 1;
    remainder -= 1;
  }

  return {
    allocations: allocations.map(fromCents),
    unallocated: fromCents(remainder),
  };
}

const WEIGHT_UNIT_FACTORS_KG = Object.freeze({
  mg: 0.000001,
  milligramme: 0.000001,
  milligrammes: 0.000001,
  g: 0.001,
  gramme: 0.001,
  grammes: 0.001,
  kg: 1,
  kilo: 1,
  kilos: 1,
  kilogramme: 1,
  kilogrammes: 1,
  t: 1000,
  tonne: 1000,
  tonnes: 1000,
  lb: 0.45359237,
  lbs: 0.45359237,
  livre: 0.45359237,
  livres: 0.45359237,
  oz: 0.028349523125,
  once: 0.028349523125,
  onces: 0.028349523125,
});

function normalizeWeightUnit(unit) {
  return String(unit || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

export function getWeightUnitFactorKg(unit) {
  return WEIGHT_UNIT_FACTORS_KG[normalizeWeightUnit(unit)] ?? null;
}

export function convertQuantityToBase(quantity, inputUnit, stockUnit) {
  const amount = Number(quantity);
  const input = normalizeWeightUnit(inputUnit);
  const base = normalizeWeightUnit(stockUnit);
  if (!Number.isFinite(amount) || amount < 0 || !input || !base) {
    throw new Error('Quantité ou unité de mesure invalide.');
  }
  if (input === base) return amount;

  const inputFactorKg = getWeightUnitFactorKg(input);
  const baseFactorKg = getWeightUnitFactorKg(base);
  if (inputFactorKg === null || baseFactorKg === null) {
    throw new Error(`Conversion impossible de « ${inputUnit} » vers l’unité principale « ${stockUnit} ».`);
  }
  return amount * inputFactorKg / baseFactorKg;
}

export function convertUnitPriceToBase(price, inputUnit, stockUnit) {
  const amount = Number(price);
  const input = normalizeWeightUnit(inputUnit);
  const base = normalizeWeightUnit(stockUnit);
  if (!Number.isFinite(amount) || amount < 0 || !input || !base) {
    throw new Error('Prix ou unité de mesure invalide.');
  }
  if (input === base) return amount;

  const inputFactorKg = getWeightUnitFactorKg(input);
  const baseFactorKg = getWeightUnitFactorKg(base);
  if (inputFactorKg === null || baseFactorKg === null) {
    throw new Error(`Conversion impossible de « ${inputUnit} » vers l’unité principale « ${stockUnit} ».`);
  }
  return amount * baseFactorKg / inputFactorKg;
}

export function convertWeightToKg(value, unit) {
  const amount = Number(value);
  const factor = getWeightUnitFactorKg(unit);
  if (!Number.isFinite(amount) || amount < 0 || factor === null) {
    throw new Error(`Poids ou unité de poids invalide (${unit || 'non définie'}).`);
  }
  return amount * factor;
}

export function allocateLogisticsByWeight(lines, logisticsTotal) {
  const weightsKg = [];
  const missingWeightIndexes = [];

  for (const [index, line] of lines.entries()) {
    const quantity = Math.max(0, Number(
      line.quantite ?? line.quantite_recue ?? line.quantiteRecue ?? line.quantity
    ) || 0);
    if (quantity === 0) {
      weightsKg.push(0);
      continue;
    }

    try {
      const explicitTotalKg = line.poidsTotalKg ?? line.poids_total_kg;
      const weightPerUnit = line.poidsParUnite ?? line.poids_par_unite ??
        line.product_poids_par_unite ?? line.poidsParUniteStock;
      const weightUnit = line.unitePoids ?? line.unite_poids ??
        line.product_unite_poids ?? line.unitePoidsParUnite;
      const stockUnit = line.uniteMesure ?? line.unite_mesure ?? line.product_unite_mesure;
      const kgPerStockUnit = getWeightUnitFactorKg(stockUnit) ??
        (weightPerUnit !== undefined && weightPerUnit !== null && weightPerUnit !== ''
          ? convertWeightToKg(weightPerUnit, weightUnit || 'kg')
          : null);
      const normalizedLineWeightKg = explicitTotalKg !== undefined && explicitTotalKg !== null
        ? Number(explicitTotalKg)
        : kgPerStockUnit === null
          ? null
          : kgPerStockUnit * quantity;
      if (!Number.isFinite(normalizedLineWeightKg) || normalizedLineWeightKg <= 0) {
        throw new Error('Poids total nul ou invalide.');
      }
      weightsKg.push(normalizedLineWeightKg);
    } catch {
      missingWeightIndexes.push(index);
      weightsKg.push(0);
    }
  }

  if (missingWeightIndexes.length > 0) {
    const totalCents = toCents(logisticsTotal);
    return {
      allocations: lines.map(() => 0),
      unallocated: fromCents(totalCents),
      totalWeightKg: weightsKg.reduce((sum, weight) => sum + weight, 0),
      weightsKg,
      missingWeightIndexes,
    };
  }

  const allocation = allocateMoneyByWeight(logisticsTotal, weightsKg);
  return {
    ...allocation,
    totalWeightKg: weightsKg.reduce((sum, weight) => sum + weight, 0),
    weightsKg,
    missingWeightIndexes,
  };
}

export function calculateRemainingLayerValue(totalLayerValue, remainingQuantity, originalQuantity) {
  const originalMilli = toMilliUnits(originalQuantity);
  const remainingMilli = Math.max(0, Math.min(toMilliUnits(remainingQuantity), originalMilli));
  if (originalMilli <= 0 || remainingMilli <= 0) return 0;
  return fromCents(Math.round(toCents(totalLayerValue) * remainingMilli / originalMilli));
}

export function splitCostVariance(totalVariance, inventoryAdjustment) {
  const varianceCents = toCents(totalVariance);
  const inventoryCents = toCents(inventoryAdjustment);
  return {
    inventoryAdjustment: fromCents(inventoryCents),
    expenseVariance: fromCents(varianceCents - inventoryCents),
  };
}

export function calculateSellingPriceFromMarkup(cmv, marginPercent) {
  const cost = Number(cmv);
  const margin = Number(marginPercent);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin) || margin < 0 || margin > 1000) {
    throw new Error('Le CMV ou le taux de marge est invalide.');
  }
  return Math.round((cost * (1 + margin / 100) + Number.EPSILON) * 100) / 100;
}

export function calculateWeightedAverageSaleCost(cmv, quantity) {
  const cost = Number(cmv);
  const qty = Number(quantity);
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(qty) || qty < 0) {
    throw new Error('Le CMV ou la quantité vendue est invalide.');
  }
  return fromCents(toCents(cost * qty));
}

export async function synchronizeActiveProductPrices(executor, entrepriseId, produitId, cmv) {
  const activePrices = await executor.select().from(produitPrix).where(and(
    eq(produitPrix.entrepriseId, entrepriseId),
    eq(produitPrix.produitId, produitId),
    eq(produitPrix.actif, true),
    sql`${produitPrix.dateEffet} <= CURRENT_DATE`,
    sql`(${produitPrix.dateExpiration} IS NULL OR ${produitPrix.dateExpiration} >= CURRENT_DATE)`
  )).orderBy(desc(produitPrix.dateEffet), desc(produitPrix.createdAt));

  let defaultPrice = null;
  for (const price of activePrices) {
    const calculatedPrice = calculateSellingPriceFromMarkup(cmv, price.margeBruteCible);
    const [updatedPrice] = await executor.update(produitPrix).set({
      coutAchat: Number(cmv).toFixed(2),
      prixVenteCalcule: calculatedPrice.toFixed(2),
      updatedAt: new Date(),
    }).where(and(
      eq(produitPrix.id, price.id),
      eq(produitPrix.entrepriseId, entrepriseId)
    )).returning();

    if (!defaultPrice && price.categorieClient === 'standard' && price.canalVente === 'tous') {
      defaultPrice = Number(updatedPrice?.prixVenteManuel ?? updatedPrice?.prixVenteCalcule);
    }
  }

  if (defaultPrice !== null && Number.isFinite(defaultPrice)) {
    await executor.update(produits).set({
      prixVente: defaultPrice.toFixed(2),
      updatedAt: new Date(),
    }).where(and(
      eq(produits.id, produitId),
      eq(produits.entrepriseId, entrepriseId)
    ));
  }
}

async function updateProductAverageCost(executor, entrepriseId, produitId) {
  const [totals] = await executor.select({
    quantity: sql`COALESCE(SUM(${valorisationsStock.quantite}), 0)`,
    value: sql`COALESCE(SUM(${valorisationsStock.coutTotal}), 0)`,
  }).from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    sql`${valorisationsStock.quantite} > 0`
  ));

  const quantity = Number(totals?.quantity || 0);
  const value = Number(totals?.value || 0);
  if (quantity <= 0) return;

  const nextCost = Math.round((value / quantity + Number.EPSILON) * 100) / 100;
  const [product] = await executor.select({ coutMoyen: produits.coutMoyen })
    .from(produits)
    .where(and(
      eq(produits.id, produitId),
      eq(produits.entrepriseId, entrepriseId)
    )).for('update').limit(1);
  if (!product || Math.abs(Number(product.coutMoyen || 0) - nextCost) < 0.005) return;

  await executor.update(produits).set({
    coutMoyen: nextCost.toFixed(2),
    updatedAt: new Date(),
  }).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  ));
  await synchronizeActiveProductPrices(executor, entrepriseId, produitId, nextCost);
}

export async function ensureOpeningValuationLayer(executor, { entrepriseId, produitId, productSnapshot }) {
  let [product] = await executor.select().from(produits).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  )).for('update').limit(1);
  product ||= productSnapshot;

  if (!product) return false;

  const [layerTotals] = await executor.select({
    quantity: sql`COALESCE(SUM(${valorisationsStock.quantite}), 0)`,
  }).from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    sql`${valorisationsStock.quantite} > 0`
  ));
  const productQuantity = Math.max(0, Number(product.quantite || 0));
  const quantity = Math.max(0, productQuantity - Number(layerTotals?.quantity || 0));
  if (quantity <= 0) return false;

  const unitCost = Math.max(0, Number(product.coutMoyen || product.prixAchat || 0));
  await executor.insert(valorisationsStock).values({
    entrepriseId,
    produitId,
    mouvementId: null,
    methode: product.valorisationMethod || 'CMP',
    coutUnitaire: unitCost.toFixed(2),
    coutTotal: fromCents(toCents(quantity * unitCost)).toFixed(2),
    quantite: quantity.toFixed(3),
  });
  return true;
}

export async function createStockValuationLayer(executor, {
  entrepriseId,
  produitId,
  mouvementId,
  quantity,
  totalCost,
  unitCost,
  productSnapshot,
  ensureOpening = true,
}) {
  const quantityValue = Number(quantity);
  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    throw new Error('La quantité de la couche de valorisation doit être positive.');
  }

  if (ensureOpening) {
    await ensureOpeningValuationLayer(executor, { entrepriseId, produitId, productSnapshot });
  }

  if (mouvementId) {
    const [existing] = await executor.select({ id: valorisationsStock.id })
      .from(valorisationsStock)
      .where(and(
        eq(valorisationsStock.entrepriseId, entrepriseId),
        eq(valorisationsStock.mouvementId, mouvementId)
      ))
      .limit(1)
      .for('update');
    if (existing) return existing;
  }

  const totalCostValue = Number.isFinite(Number(totalCost))
    ? Number(totalCost)
    : quantityValue * Number(unitCost || 0);
  const roundedTotal = fromCents(toCents(totalCostValue));
  const calculatedUnitCost = Number.isFinite(Number(unitCost))
    ? Number(unitCost)
    : roundedTotal / quantityValue;

  const [layer] = await executor.insert(valorisationsStock).values({
    entrepriseId,
    produitId,
    mouvementId: mouvementId || null,
    methode: productSnapshot?.valorisationMethod || 'CMP',
    coutUnitaire: calculatedUnitCost.toFixed(2),
    coutTotal: roundedTotal.toFixed(2),
    quantite: quantityValue.toFixed(3),
  }).returning();

  await updateProductAverageCost(executor, entrepriseId, produitId);
  return layer;
}

export async function consumeStockValuation(executor, { entrepriseId, produitId, quantity }) {
  const requestedMilli = toMilliUnits(quantity);
  if (requestedMilli <= 0) {
    return { trackedQuantity: 0, untrackedQuantity: 0, coutConsomme: 0 };
  }

  const [product] = await executor.select().from(produits).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  )).for('update').limit(1);
  if (product) {
    await ensureOpeningValuationLayer(executor, {
      entrepriseId,
      produitId,
      productSnapshot: product,
    });
  }

  const layers = await executor.select().from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    sql`${valorisationsStock.quantite} > 0`
  )).orderBy(asc(valorisationsStock.createdAt), asc(valorisationsStock.id)).for('update');

  const layerMilli = layers.map((layer) => Math.max(0, toMilliUnits(layer.quantite)));
  const availableMilli = layerMilli.reduce((sum, value) => sum + value, 0);
  const consumedMilli = Math.min(requestedMilli, availableMilli);
  if (consumedMilli <= 0) {
    return {
      trackedQuantity: 0,
      untrackedQuantity: fromMilliUnits(requestedMilli),
      coutConsomme: 0,
    };
  }

  const method = String(product?.valorisationMethod || 'CMP').toUpperCase();
  const remainingByLayer = layerMilli.slice();

  if (method === 'FIFO') {
    let toConsume = consumedMilli;
    for (let i = 0; i < remainingByLayer.length && toConsume > 0; i += 1) {
      const amount = Math.min(remainingByLayer[i], toConsume);
      remainingByLayer[i] -= amount;
      toConsume -= amount;
    }
  } else {
    let assigned = 0;
    const shares = layerMilli.map((value, index) => {
      const exact = consumedMilli * (value / availableMilli);
      const floor = Math.floor(exact);
      assigned += floor;
      return { index, floor, fraction: exact - floor };
    });
    let remainder = consumedMilli - assigned;
    shares.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    for (let i = 0; remainder > 0 && shares.length; i = (i + 1) % shares.length) {
      shares[i].floor += 1;
      remainder -= 1;
    }
    for (const share of shares) {
      remainingByLayer[share.index] = Math.max(0, layerMilli[share.index] - share.floor);
    }
  }

  let consumedCostCents = 0;
  const oldCostCentsByLayer = layers.map((layer) => toCents(layer.coutTotal));
  let newCostCentsByLayer = oldCostCentsByLayer.slice();

  if (method !== 'FIFO') {
    const oldTotalCents = oldCostCentsByLayer.reduce((sum, amount) => sum + amount, 0);
    const averageUnitCost = Number(product?.coutMoyen) > 0
      ? Number(product.coutMoyen)
      : fromCents(oldTotalCents) / fromMilliUnits(availableMilli);
    consumedCostCents = consumedMilli === availableMilli
      ? oldTotalCents
      : toCents(calculateWeightedAverageSaleCost(averageUnitCost, fromMilliUnits(consumedMilli)));
    const remainingTotalCents = Math.max(0, oldTotalCents - consumedCostCents);
    const remainingCostAllocations = allocateMoneyByWeight(
      fromCents(remainingTotalCents),
      remainingByLayer.map(fromMilliUnits)
    ).allocations;
    newCostCentsByLayer = remainingCostAllocations.map(toCents);
  }

  for (let i = 0; i < layers.length; i += 1) {
    const oldQuantityMilli = layerMilli[i];
    const newQuantityMilli = remainingByLayer[i];
    const oldCostCents = oldCostCentsByLayer[i];
    const newCostCents = method === 'FIFO'
      ? oldQuantityMilli > 0
        ? Math.round(oldCostCents * newQuantityMilli / oldQuantityMilli)
        : 0
      : newCostCentsByLayer[i];
    if (newQuantityMilli === oldQuantityMilli && newCostCents === oldCostCents) continue;
    if (method === 'FIFO') consumedCostCents += oldCostCents - newCostCents;
    await executor.update(valorisationsStock).set({
      quantite: fromMilliUnits(newQuantityMilli).toFixed(3),
      coutTotal: fromCents(newCostCents).toFixed(2),
    }).where(and(
      eq(valorisationsStock.id, layers[i].id),
      eq(valorisationsStock.entrepriseId, entrepriseId)
    ));
  }

  if (method === 'FIFO') {
    await updateProductAverageCost(executor, entrepriseId, produitId);
  }
  return {
    trackedQuantity: fromMilliUnits(consumedMilli),
    untrackedQuantity: fromMilliUnits(requestedMilli - consumedMilli),
    coutConsomme: fromCents(consumedCostCents),
  };
}

export async function revalueRemainingStockLayer(executor, {
  entrepriseId,
  produitId,
  mouvementId,
  originalQuantity,
  totalActualCost,
}) {
  await executor.select({ id: produits.id }).from(produits).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  )).for('update').limit(1);
  const [layer] = await executor.select().from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    eq(valorisationsStock.mouvementId, mouvementId)
  )).for('update').limit(1);
  if (!layer) {
    return { found: false, layerId: null, remainingQuantity: 0, oldValue: 0, newValue: 0, adjustment: 0 };
  }

  const remainingQuantity = Number(layer.quantite || 0);
  const oldValue = Number(layer.coutTotal || 0);
  const newValue = calculateRemainingLayerValue(totalActualCost, remainingQuantity, originalQuantity);
  const adjustment = fromCents(toCents(newValue) - toCents(oldValue));
  const actualUnitCost = Number(originalQuantity) > 0
    ? Number(totalActualCost) / Number(originalQuantity)
    : 0;

  await executor.update(valorisationsStock).set({
    coutUnitaire: actualUnitCost.toFixed(2),
    coutTotal: newValue.toFixed(2),
  }).where(and(
    eq(valorisationsStock.id, layer.id),
    eq(valorisationsStock.entrepriseId, entrepriseId)
  ));
  await updateProductAverageCost(executor, entrepriseId, produitId);

  return {
    found: true,
    layerId: layer.id,
    remainingQuantity,
    oldValue,
    newValue,
    adjustment,
  };
}

export async function applySupplierInvoiceCostsToRemainingLayers(executor, {
  entrepriseId,
  receiptRows,
  invoiceCostsByProduct,
}) {
  const rowsByProduct = new Map();
  for (const row of receiptRows) {
    const productId = Number(row.produit_id);
    if (!Number.isSafeInteger(productId) || productId <= 0) continue;
    const rows = rowsByProduct.get(productId) || [];
    rows.push(row);
    rowsByProduct.set(productId, rows);
  }

  let totalAdjustmentCents = 0;
  const warnings = [];
  const productsUpdated = [];
  const couchesRevalorisees = [];
  for (const productId of invoiceCostsByProduct.keys()) {
    if (!rowsByProduct.has(productId)) {
      warnings.push(`Produit ${productId} : aucune réception non facturée correspondante; l’écart reste en charge.`);
    }
  }

  for (const [productId, rows] of rowsByProduct) {
    const invoiceCost = invoiceCostsByProduct.get(productId);
    if (!invoiceCost) {
      warnings.push(`Produit ${productId} : aucune ligne de facture associée; l’écart reste en charge.`);
      continue;
    }

    const receivedQuantity = rows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.quantite_pending) || 0),
      0
    );
    if (Math.abs(receivedQuantity - invoiceCost.quantity) > 0.001) {
      warnings.push(
        `Produit ${productId} : quantité facturée (${invoiceCost.quantity}) différente de la quantité reçue (${receivedQuantity}); aucun reclassement du stock.`
      );
      continue;
    }

    const movementIds = rows.map((row) => Number(row.mouvement_stock_id));
    if (movementIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      warnings.push(`Produit ${productId} : une réception n’a pas de mouvement de stock traçable; l’écart reste en charge.`);
      continue;
    }

    const layers = await executor.select({
      movementId: valorisationsStock.mouvementId,
    }).from(valorisationsStock).where(and(
      eq(valorisationsStock.entrepriseId, entrepriseId),
      eq(valorisationsStock.produitId, productId),
      inArray(valorisationsStock.mouvementId, movementIds)
    ));
    const layerMovementIds = new Set(layers.map((layer) => Number(layer.movementId)));
    if (movementIds.some((id) => !layerMovementIds.has(id))) {
      warnings.push(
        `Produit ${productId} : valorisation de réception absente; le stock restant n’est pas estimé rétroactivement et l’écart reste en charge.`
      );
      continue;
    }

    const layerCosts = allocateMoneyByWeight(
      invoiceCost.totalCost,
      rows.map((row) => Math.max(0, Number(row.quantite_pending) || 0))
    );

    let productAdjustmentCents = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const result = await revalueRemainingStockLayer(executor, {
        entrepriseId,
        produitId: productId,
        mouvementId: movementIds[i],
        originalQuantity: rows[i].quantite_pending,
        totalActualCost: layerCosts.allocations[i],
      });
      productAdjustmentCents += toCents(result.adjustment);
      if (result.found) {
        couchesRevalorisees.push({
          layerId: result.layerId,
          produitId: productId,
          mouvementId: movementIds[i],
          quantiteRestante: result.remainingQuantity,
          ancienCoutTotal: result.oldValue,
          nouveauCoutTotal: result.newValue,
          ajustement: result.adjustment,
        });
      }
    }

    totalAdjustmentCents += productAdjustmentCents;
    productsUpdated.push({
      produitId: productId,
      ajustementStock: fromCents(productAdjustmentCents),
    });
  }

  return {
    ajustementStock: fromCents(totalAdjustmentCents),
    avertissements: warnings,
    produitsRevalorises: productsUpdated,
    couchesRevalorisees,
  };
}
