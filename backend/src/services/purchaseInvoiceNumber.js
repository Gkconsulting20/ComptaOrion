// Numéro de facture fournisseur cloisonné à l'entreprise (27 nov. 2026, ordre de Cap).
//
// Format : FACT-ACH-{année}-{id entreprise}-{séquence 6 chiffres}.
// La séquence est le maximum des numéros DE CETTE ENTREPRISE pour l'exercice
// (+1). Les numéros des autres entreprises sont ignorés : deux entreprises
// peuvent avoir la même séquence, leurs numéros restent distincts grâce à
// l'id entreprise, et la contrainte en base est composite
// (entreprise_id, numero_facture). L'ancien format (sans id entreprise,
// FACT-ACH-AAAA-NNNNNN) est accepté pour que la séquence continue sans
// rupture sur les factures déjà créées.
//
// Historique : la version précédente dédupliquait globalement (elle sautait
// les numéros déjà utilisés par d'autres entreprises) ; ce couplage
// inter-entreprises est supprimé.
export function getNextPurchaseInvoiceNumber(year, entrepriseId, companyNumbers) {
  const id = Number(entrepriseId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("L'identifiant de l'entreprise est invalide.");
  }
  const pattern = new RegExp(`^FACT-ACH-${Number(year)}-(?:\\d+-)?(\\d+)$`);
  const sequence = (companyNumbers || []).reduce((maximum, value) => {
    const match = String(value || '').match(pattern);
    return match ? Math.max(maximum, Number(match[1]) || 0) : maximum;
  }, 0) + 1;
  return `FACT-ACH-${year}-${id}-${String(sequence).padStart(6, '0')}`;
}
