export const CLOSED_FISCAL_PERIOD_CONSTRAINT = 'comptaorion_closed_fiscal_period';

export function markClosedFiscalPeriodConflict(error) {
  if (error?.constraint === CLOSED_FISCAL_PERIOD_CONSTRAINT) {
    error.status = 409;
    error.statusCode = 409;
  }
  return error;
}
