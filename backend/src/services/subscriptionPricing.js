// Tarification des abonnements — logique pure (sans accès base), testée par
// test/saas-free-months.test.js.
//
// Offre commerciale (décision ORIONEXA, 20 nov. 2026) : chaque NOUVEL abonnement
// payant inclut 2 mois gratuits. L'essai gratuit reste à 30 jours et n'est pas
// concerné. Les 2 mois gratuits font partie de la durée : le client paie
// prix × (durée − 2), la facturation commence au 3e mois. La commission du
// commercial n'est due que quand le client paie, donc à partir de la date de
// début de facturation. Durée ≤ 2 mois : le client ne paie rien (montant 0).

export const FREE_MONTHS_ON_SUBSCRIPTION = 2;

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function formatDateISO(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Nombre de mois effectivement payés par le client sur cet abonnement. */
export function paidMonthsFor(dureeEnMois, freeMonths = FREE_MONTHS_ON_SUBSCRIPTION) {
  return Math.max(0, (dureeEnMois || 1) - freeMonths);
}

/** Date de début de facturation = début + mois gratuits. */
export function billingStartDateFor(dateDebut, freeMonths = FREE_MONTHS_ON_SUBSCRIPTION) {
  return addMonths(dateDebut, freeMonths);
}

/**
 * Termes d'un nouvel abonnement payant : durée, mois gratuits, mois payés,
 * date de début de facturation, montant de la vente et commission.
 * `tauxCommission` est une fraction (0.10 = 10 %).
 */
export function subscriptionSaleTerms({ prixMensuel, dureeEnMois, tauxCommission, dateDebut }) {
  const duree = dureeEnMois || 1;
  const freeMonths = FREE_MONTHS_ON_SUBSCRIPTION;
  const paidMonths = paidMonthsFor(duree, freeMonths);
  const billingStartDate = billingStartDateFor(dateDebut, freeMonths);
  const montantVente = parseFloat(prixMensuel) * paidMonths;
  const commission = montantVente * (tauxCommission ?? 0.10);
  return { duree, freeMonths, paidMonths, billingStartDate, montantVente, commission };
}

/**
 * Miroir JS de la condition MRR du tableau de bord SaaS (saas-admin.js) :
 * un abonnement actif contribue au MRR à hauteur de son prix mensuel une fois
 * la facturation commencée ; en période gratuite il ne contribue pas ; un
 * abonnement sans mois payé (durée ≤ mois gratuits) ne contribue jamais.
 * Les lignes anciennes (dateDebutFacturation et dureeEnMois NULL) contribuent
 * normalement. `today` est une date 'YYYY-MM-DD' ou un objet Date.
 */
export function contributesToMrr(sub, today = new Date()) {
  if (sub.statut !== 'actif') return false;
  const todayISO = today instanceof Date ? formatDateISO(today) : today;
  const billingStart = sub.dateDebutFacturation
    ? (sub.dateDebutFacturation instanceof Date
      ? formatDateISO(sub.dateDebutFacturation)
      : String(sub.dateDebutFacturation).slice(0, 10))
    : null;
  if (billingStart !== null && billingStart > todayISO) return false;
  if (sub.dureeEnMois != null && sub.dureeEnMois <= (sub.moisGratuits ?? 0)) return false;
  return true;
}
