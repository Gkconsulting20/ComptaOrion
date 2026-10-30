export function formatMontant(value, showDecimals = false) {
  const num = parseFloat(value) || 0;
  if (showDecimals) {
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(num).toLocaleString('fr-FR');
}

export function formatMontantXOF(value, showDecimals = false) {
  return `${formatMontant(value, showDecimals)} XOF`;
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR');
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`;
}
