export function formatMontant(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMontantXOF(value) {
  return `${formatMontant(value)} XOF`;
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
