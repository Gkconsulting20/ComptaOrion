const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const VALID_SALES_STATUSES = Object.freeze(['envoyee', 'payee', 'retard']);
export const VALID_PURCHASE_STATUSES = Object.freeze(['validee', 'partiellement_payee', 'payee']);

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function sumMoney(rows, field) {
  const cents = rows.reduce((sum, row) => sum + Math.round(toNumber(row?.[field]) * 100), 0);
  return cents / 100;
}

export function dateOnly(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function countInclusiveDays(start, end) {
  const startDate = dateOnly(start);
  const endDate = dateOnly(end);
  if (!startDate || !endDate || startDate > endDate) return 0;

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.floor((endUtc - startUtc) / 86400000) + 1;
}

export function outstandingBalanceAt(invoices, payments, cutoff, statuses, inclusive = true) {
  const cutoffDate = dateOnly(cutoff);
  if (!cutoffDate) return null;
  const allowedStatuses = new Set(statuses);
  const validInvoices = invoices.filter((invoice) => {
    const invoiceDate = dateOnly(invoice.dateFacture);
    const withinCutoff = invoiceDate && (inclusive ? invoiceDate <= cutoffDate : invoiceDate < cutoffDate);
    return withinCutoff && allowedStatuses.has(invoice.statut);
  });
  const validInvoiceIds = new Set(validInvoices.map((invoice) => Number(invoice.id)));
  const paymentsByInvoice = new Map();

  for (const payment of payments) {
    const invoiceId = Number(payment.factureId);
    const paymentDate = dateOnly(payment.datePaiement);
    const withinCutoff = paymentDate && (inclusive ? paymentDate <= cutoffDate : paymentDate < cutoffDate);
    if (!validInvoiceIds.has(invoiceId) || !withinCutoff) continue;
    paymentsByInvoice.set(
      invoiceId,
      (paymentsByInvoice.get(invoiceId) || 0) + Math.round(toNumber(payment.montant) * 100),
    );
  }

  const balanceCents = validInvoices.reduce((sum, invoice) => {
    const invoiceCents = Math.round(toNumber(invoice.totalTTC) * 100);
    return sum + Math.max(0, invoiceCents - (paymentsByInvoice.get(Number(invoice.id)) || 0));
  }, 0);
  return balanceCents / 100;
}

export function calculateWorkingCapitalDays(openingBalance, closingBalance, periodFlow, periodDays) {
  const flowCents = Math.round(toNumber(periodFlow) * 100);
  const days = Number(periodDays);
  if (flowCents <= 0 || !Number.isFinite(days) || days <= 0) return null;

  const averageBalance = (Math.max(0, toNumber(openingBalance)) + Math.max(0, toNumber(closingBalance))) / 2;
  return Math.max(0, Math.round((averageBalance / (flowCents / 100)) * days));
}

export function calculateGrossMargin(salesHT, cmv, complete) {
  const revenue = toNumber(salesHT);
  if (!complete || revenue <= 0) return { cmv: null, marginPercent: null };
  const cost = roundMoney(cmv);
  return {
    cmv: cost,
    marginPercent: Math.round(((revenue - cost) / revenue) * 10000) / 100,
  };
}

export function calculateNetCashflow(transactions) {
  const cents = transactions.reduce((sum, transaction) => {
    const amount = Math.round(toNumber(transaction.montant) * 100);
    if (transaction.type === 'encaissement') return sum + amount;
    if (transaction.type === 'decaissement') return sum - amount;
    return sum;
  }, 0);
  return cents / 100;
}

export function calculateCurrentInventoryValue(products, valuationLayers) {
  const layersByProduct = new Map();
  for (const layer of valuationLayers) {
    const productId = Number(layer.produitId);
    const totals = layersByProduct.get(productId) || { quantity: 0, value: 0 };
    totals.quantity += toNumber(layer.quantite);
    totals.value += toNumber(layer.coutTotal);
    layersByProduct.set(productId, totals);
  }

  let total = 0;
  for (const product of products) {
    const quantity = Math.max(0, toNumber(product.quantite));
    if (quantity === 0) continue;

    const layerTotals = layersByProduct.get(Number(product.id)) || { quantity: 0, value: 0 };
    if (String(product.valorisationMethod || 'CMP').toUpperCase() === 'FIFO') {
      if (Math.abs(layerTotals.quantity - quantity) > 0.001) return { value: null, complete: false };
      total += layerTotals.value;
      continue;
    }

    const averageCost = toNumber(product.coutMoyen);
    if (averageCost <= 0) return { value: null, complete: false };
    total += quantity * averageCost;
  }

  return { value: roundMoney(total), complete: true };
}

export function calculateCashConversionCycle(dso, dio, dpo) {
  if (![dso, dio, dpo].every((value) => Number.isFinite(Number(value)))) return null;
  return Number(dso) + Number(dio) - Number(dpo);
}
