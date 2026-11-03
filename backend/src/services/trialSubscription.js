export const TRIAL_DURATION_DAYS = 30;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const TRIAL_SUBSCRIPTION_NOTE = 'Essai gratuit de 30 jours, sans paiement';

export function getTrialExpirationDate(startedAt = new Date()) {
  return new Date(new Date(startedAt).getTime() + TRIAL_DURATION_MS);
}

export function getTrialExpirationTimestamp(startedAt) {
  const startedAtMs = new Date(startedAt).getTime();
  return Number.isFinite(startedAtMs) ? startedAtMs + TRIAL_DURATION_MS : null;
}
