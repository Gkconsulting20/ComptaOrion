export function readPendingStockReport(response) {
  const report = Array.isArray(response?.items) ? response : response?.data;
  if (!Array.isArray(report?.items) || !report.totaux) {
    throw new Error('Le rapport des réceptions non facturées est incomplet. Réessayez son chargement.');
  }
  return report;
}
