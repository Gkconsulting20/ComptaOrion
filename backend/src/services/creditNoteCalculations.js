function toCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Montant invalide.');
  return Math.round(amount * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function toMilliUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Quantité invalide.');
  return Math.round(amount * 1000);
}

export function calculateReturnedLine({
  quantityOriginal,
  quantityAlreadyReturned = 0,
  quantityRequested,
  totalOriginalHT,
  historicalUnitCost = null,
}) {
  const originalMilli = toMilliUnits(quantityOriginal);
  const returnedMilli = toMilliUnits(quantityAlreadyReturned);
  const requestedMilli = toMilliUnits(quantityRequested);
  if (originalMilli <= 0 || requestedMilli <= 0) {
    throw new Error('La quantité retournée doit être positive.');
  }
  if (returnedMilli + requestedMilli > originalMilli) {
    throw new Error('La quantité retournée dépasse la quantité de la facture d’origine.');
  }

  const totalOriginalCents = toCents(totalOriginalHT);
  const totalHTCents = Math.round(totalOriginalCents * requestedMilli / originalMilli);
  const costStockCents = historicalUnitCost == null
    ? null
    : Math.round(Number(historicalUnitCost) * 100 * requestedMilli / 1000);

  return {
    quantite: requestedMilli / 1000,
    totalHT: fromCents(totalHTCents),
    coutStock: costStockCents == null ? null : fromCents(costStockCents),
  };
}

export function calculateCreditNoteVat(totalHT, invoiceTotalHT, invoiceTotalTVA) {
  const creditHTCents = toCents(totalHT);
  const invoiceHTCents = toCents(invoiceTotalHT);
  const invoiceVatCents = toCents(invoiceTotalTVA);
  if (creditHTCents < 0 || invoiceHTCents <= 0 || invoiceVatCents < 0) {
    throw new Error('Les montants de la facture d’origine sont invalides.');
  }
  return fromCents(Math.round(invoiceVatCents * creditHTCents / invoiceHTCents));
}
