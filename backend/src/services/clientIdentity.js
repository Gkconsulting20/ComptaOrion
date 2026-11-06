export function formatClientNumberFromId(id) {
  const clientId = Number(id);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) {
    throw new Error('Identifiant client invalide.');
  }
  return `CLI${String(clientId).padStart(5, '0')}`;
}
