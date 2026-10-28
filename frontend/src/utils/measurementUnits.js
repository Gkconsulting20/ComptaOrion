const MASS_UNITS = [
  { value: 'mg', label: 'Milligramme (mg)', factorKg: 0.000001 },
  { value: 'g', label: 'Gramme (g)', factorKg: 0.001 },
  { value: 'kg', label: 'Kilogramme (kg)', factorKg: 1 },
  { value: 't', label: 'Tonne (t)', factorKg: 1000 },
];

const normalize = (unit) => String(unit || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');

const FACTORS = new Map([
  ['mg', 0.000001], ['milligramme', 0.000001], ['milligrammes', 0.000001],
  ['g', 0.001], ['gramme', 0.001], ['grammes', 0.001],
  ['kg', 1], ['kilo', 1], ['kilos', 1], ['kilogramme', 1], ['kilogrammes', 1],
  ['t', 1000], ['tonne', 1000], ['tonnes', 1000],
]);

export function isMassUnit(unit) {
  return FACTORS.has(normalize(unit));
}

export function getMeasurementUnitOptions(stockUnit) {
  if (isMassUnit(stockUnit)) {
    const baseFactor = FACTORS.get(normalize(stockUnit));
    return MASS_UNITS.map((option) => option.factorKg === baseFactor
      ? { ...option, value: String(stockUnit), label: `${option.label} — unité principale` }
      : option);
  }
  const value = String(stockUnit || 'pièce');
  return [{ value, label: value }];
}

export function convertPriceFromBase(pricePerBaseUnit, inputUnit, stockUnit) {
  const price = Number(pricePerBaseUnit);
  const inputFactor = FACTORS.get(normalize(inputUnit));
  const baseFactor = FACTORS.get(normalize(stockUnit));
  if (!Number.isFinite(price) || inputFactor === undefined || baseFactor === undefined) return price;
  return price * inputFactor / baseFactor;
}

export function convertPriceBetweenUnits(pricePerOldUnit, oldUnit, newUnit) {
  const price = Number(pricePerOldUnit);
  const oldFactor = FACTORS.get(normalize(oldUnit));
  const newFactor = FACTORS.get(normalize(newUnit));
  if (!Number.isFinite(price) || oldFactor === undefined || newFactor === undefined || oldFactor === 0) {
    return price;
  }
  return price * newFactor / oldFactor;
}

export function convertQuantityBetweenUnits(quantityInOldUnit, oldUnit, newUnit) {
  const quantity = Number(quantityInOldUnit);
  const oldFactor = FACTORS.get(normalize(oldUnit));
  const newFactor = FACTORS.get(normalize(newUnit));
  if (!Number.isFinite(quantity) || oldFactor === undefined || newFactor === undefined || newFactor === 0) {
    return quantity;
  }
  return quantity * oldFactor / newFactor;
}

export function getUnitLabel(unit) {
  return MASS_UNITS.find((option) => normalize(option.value) === normalize(unit))?.label || unit || 'unité';
}
