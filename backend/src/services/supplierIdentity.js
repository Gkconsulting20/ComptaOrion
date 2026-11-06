export function formatSupplierNumberFromId(id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    throw new Error('Identifiant interne fournisseur invalide.');
  }
  return `FOU${String(Number(id)).padStart(5, '0')}`;
}
