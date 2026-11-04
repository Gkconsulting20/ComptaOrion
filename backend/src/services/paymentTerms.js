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
