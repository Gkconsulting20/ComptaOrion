// Numérotation des documents cloisonnée à l'entreprise (27 nov. 2026, ordre de Cap).
//
// Chaque numéro généré porte l'id de l'entreprise (DEV/FACT/CMD/BL-AAAA-{eid}-NNNN),
// et la contrainte d'unicité en base est composite (entreprise_id, numero) : un même
// numéro est toléré pour 2 entreprises différentes. Les regex acceptent l'ancien
// format (sans id entreprise) pour que la séquence continue sans rupture sur les
// documents déjà créés — aucun document existant n'est renuméroté.
//
// Ces fonctions sont pures (aucun accès base) et testées sans base dans
// backend/test/numerotation-entreprise.test.js. La requête du dernier numéro
// reste dans la route appelante.

function assertEntrepriseId(entrepriseId) {
  const id = Number(entrepriseId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("L'identifiant de l'entreprise est invalide.");
  }
  return id;
}

function nextSequence(lastNumero, pattern, annee) {
  const match = String(lastNumero || '').match(pattern);
  if (!match) return 1;
  if (annee !== undefined && Number(match[1]) !== Number(annee)) return 1;
  return (parseInt(match[2], 10) || 0) + 1;
}

export function nextDevisNumber(entrepriseId, lastNumeroDevis, annee = new Date().getFullYear()) {
  const id = assertEntrepriseId(entrepriseId);
  const numero = nextSequence(lastNumeroDevis, /DEV-(\d{4})-(?:\d+-)?(\d+)/, annee);
  return `DEV-${annee}-${id}-${String(numero).padStart(4, '0')}`;
}

export function nextCommandeAchatNumber(entrepriseId, lastNumeroCommande, annee = new Date().getFullYear()) {
  const id = assertEntrepriseId(entrepriseId);
  const numero = nextSequence(lastNumeroCommande, /CMD-(\d{4})-(?:\d+-)?(\d+)/, annee);
  return `CMD-${annee}-${id}-${String(numero).padStart(4, '0')}`;
}

export function nextBonLivraisonNumber(entrepriseId, lastNumeroBL) {
  const id = assertEntrepriseId(entrepriseId);
  const match = String(lastNumeroBL || '').match(/(\d+)$/);
  const lastNumber = match ? parseInt(match[1], 10) || 0 : 0;
  return `BL-${id}-${String(lastNumber + 1).padStart(6, '0')}`;
}
