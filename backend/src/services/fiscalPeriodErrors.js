export const CLOSED_FISCAL_PERIOD_CONSTRAINT = 'comptaorion_closed_fiscal_period';

export function markClosedFiscalPeriodConflict(error) {
  let cause = error;
  const seen = new Set();
  while (cause && !seen.has(cause)) {
    seen.add(cause);
    if (cause.constraint === CLOSED_FISCAL_PERIOD_CONSTRAINT) {
      error.status = 409;
      error.statusCode = 409;
      error.message = cause.message;
      break;
    }
    cause = cause.cause;
  }
  return error;
}
