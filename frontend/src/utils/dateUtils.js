export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(dateStr);
}

export function formatDateFR(dateStr) {
  if (!dateStr) return '-';
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('fr-FR');
}

export function formatPeriodeFR(dateDebut, dateFin) {
  return `${formatDateFR(dateDebut)} au ${formatDateFR(dateFin)}`;
}

export function addDaysToIsoDate(dateValue, daysValue) {
  const date = String(dateValue || '').slice(0, 10);
  const days = Number(daysValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days) || days < 0 || days > 365) {
    return '';
  }
  const result = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== date) return '';
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
