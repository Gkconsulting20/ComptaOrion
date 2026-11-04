export const PAYMENT_TERM_DAYS = Object.freeze([0, 15, 30, 60]);

export const PREFERRED_PAYMENT_METHODS = Object.freeze([
  'mobile_money',
  'carte_bancaire',
  'virement',
  'especes',
  'cheque',
  'credit',
]);

export function isValidPaymentDelay(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= 365;
}

export function isValidCashDiscountTerms(rateValue, discountDaysValue, netDaysValue) {
  const rate = Number(rateValue ?? 0);
  const discountDays = Number(discountDaysValue ?? 0);
  const netDays = Number(netDaysValue);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 ||
      !Number.isInteger(discountDays) || discountDays < 0 || discountDays > 365 ||
      !isValidPaymentDelay(netDays)) return false;
  if (rate === 0) return discountDays === 0;
  return netDays > 0 && discountDays < netDays;
}

function toCents(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

export function calculateCashDiscount({
  totalHT,
  totalTVA,
  totalTTC,
  rate,
  discountDeadline,
  paymentDate,
  hasPriorPayments = false,
}) {
  const htCents = toCents(totalHT);
  const vatCents = toCents(totalTVA);
  const ttcCents = totalTTC == null ? htCents + vatCents : toCents(totalTTC);
  const percent = Number(rate || 0);
  const deadline = String(discountDeadline || '').slice(0, 10);
  const paidOn = String(paymentDate || '').slice(0, 10);
  if (htCents <= 0 || percent <= 0 || percent > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) ||
      paidOn > deadline || hasPriorPayments) return null;

  const discountHTCents = Math.min(htCents, Math.round(htCents * percent / 100));
  return {
    montantHT: fromCents(discountHTCents),
    montantTVA: 0,
    montantTTC: fromCents(discountHTCents),
    montantNetHT: fromCents(htCents),
    montantNetTVA: fromCents(vatCents),
    montantNetTTC: fromCents(Math.max(0, ttcCents - discountHTCents)),
  };
}

export function isValidPreferredPaymentMethods(value) {
  return Array.isArray(value) &&
    value.every(method => PREFERRED_PAYMENT_METHODS.includes(method)) &&
    new Set(value).size === value.length;
}

export function addDaysToIsoDate(dateValue, daysValue) {
  const days = Number(daysValue);
  const date = String(dateValue || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidPaymentDelay(days)) {
    throw new Error('La date de facture ou le délai de paiement est invalide.');
  }
  const result = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== date) {
    throw new Error('La date de facture est invalide.');
  }
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function preferredPaymentMethod(methods, fallback) {
  if (!Array.isArray(methods)) return fallback;
  const preferred = methods.find(method => PREFERRED_PAYMENT_METHODS.includes(method) && method !== 'credit');
  return preferred || fallback;
}
