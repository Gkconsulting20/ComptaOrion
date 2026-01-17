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
