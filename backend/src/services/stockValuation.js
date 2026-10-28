import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { produits, valorisationsStock } from '../schema.js';

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

export function allocateLogisticsByValue(lines, logisticsTotal) {
  const weights = lines.map((line) => {
    const explicitTotal = line.totalLigne ?? line.total_ligne;
    if (explicitTotal !== undefined && explicitTotal !== null) {
      return Math.max(0, Number(explicitTotal) || 0);
    }
    const quantity = Math.max(0, Number(line.quantite ?? line.quantite_recue ?? line.quantity) || 0);
    const unitPrice = Math.max(0, Number(
      line.prixUnitaireReel ??
      line.prix_unitaire_reel ??
      line.prix_unitaire_estime ??
      line.prix_unitaire ??
      line.unitPrice
    ) || 0);
    return quantity * unitPrice;
  });
  return allocateMoneyByWeight(logisticsTotal, weights);
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

  await executor.update(produits).set({
    coutMoyen: (value / quantity).toFixed(2),
    updatedAt: new Date(),
  }).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  ));
}

export async function ensureOpeningValuationLayer(executor, { entrepriseId, produitId, productSnapshot }) {
  const [existingLayer] = await executor.select({ id: valorisationsStock.id })
    .from(valorisationsStock)
    .where(and(
      eq(valorisationsStock.entrepriseId, entrepriseId),
      eq(valorisationsStock.produitId, produitId),
      sql`${valorisationsStock.quantite} > 0`
    ))
    .limit(1)
    .for('update');
  if (existingLayer) return false;

  let product = productSnapshot;
  if (!product) {
    [product] = await executor.select().from(produits).where(and(
      eq(produits.id, produitId),
      eq(produits.entrepriseId, entrepriseId)
    )).for('update').limit(1);
  }
  if (!product) return false;

  const quantity = Math.max(0, Number(product.quantite || 0));
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
  if (requestedMilli <= 0) return { trackedQuantity: 0, untrackedQuantity: 0 };

  const [product] = await executor.select({
    valorisationMethod: produits.valorisationMethod,
  }).from(produits).where(and(
    eq(produits.id, produitId),
    eq(produits.entrepriseId, entrepriseId)
  )).for('update').limit(1);

  const layers = await executor.select().from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    sql`${valorisationsStock.quantite} > 0`
  )).orderBy(asc(valorisationsStock.createdAt), asc(valorisationsStock.id)).for('update');

  const layerMilli = layers.map((layer) => Math.max(0, toMilliUnits(layer.quantite)));
  const availableMilli = layerMilli.reduce((sum, value) => sum + value, 0);
  const consumedMilli = Math.min(requestedMilli, availableMilli);
  if (consumedMilli <= 0) {
    return { trackedQuantity: 0, untrackedQuantity: fromMilliUnits(requestedMilli) };
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

  for (let i = 0; i < layers.length; i += 1) {
    const oldQuantityMilli = layerMilli[i];
    const newQuantityMilli = remainingByLayer[i];
    if (newQuantityMilli === oldQuantityMilli) continue;

    const oldCostCents = toCents(layers[i].coutTotal);
    const newCostCents = oldQuantityMilli > 0
      ? Math.round(oldCostCents * newQuantityMilli / oldQuantityMilli)
      : 0;
    await executor.update(valorisationsStock).set({
      quantite: fromMilliUnits(newQuantityMilli).toFixed(3),
      coutTotal: fromCents(newCostCents).toFixed(2),
    }).where(and(
      eq(valorisationsStock.id, layers[i].id),
      eq(valorisationsStock.entrepriseId, entrepriseId)
    ));
  }

  await updateProductAverageCost(executor, entrepriseId, produitId);
  return {
    trackedQuantity: fromMilliUnits(consumedMilli),
    untrackedQuantity: fromMilliUnits(requestedMilli - consumedMilli),
  };
}

export async function revalueRemainingStockLayer(executor, {
  entrepriseId,
  produitId,
  mouvementId,
  originalQuantity,
  totalActualCost,
}) {
  const [layer] = await executor.select().from(valorisationsStock).where(and(
    eq(valorisationsStock.entrepriseId, entrepriseId),
    eq(valorisationsStock.produitId, produitId),
    eq(valorisationsStock.mouvementId, mouvementId)
  )).for('update').limit(1);
  if (!layer) return { found: false, remainingQuantity: 0, adjustment: 0 };

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

  return { found: true, remainingQuantity, adjustment };
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
  };
}
