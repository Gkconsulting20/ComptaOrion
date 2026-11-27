// Taux de TVA de l'entreprise — validation unique.
//
// Le taux est choisi à l'inscription (18 % par défaut, 0 % exonéré, ou taux
// personnalisé 0–100) puis modifiable dans les paramètres de l'entreprise.
// Il est appliqué partout côté backend (factures, achats, devis) et affiché
// dans les formulaires de vente. Il n'y a PAS de déductibilité TVA sur les
// dépenses : une dépense est comptabilisée en TTC plein, comme dans Lite —
// la question produit (TVA déductible sur les dépenses ?) reste ouverte et
// n'est pas tranchée ici.

export const TAUX_TVA_DEFAUT = 18;

/**
 * Valide et normalise un taux de TVA (0–100, 2 décimales max).
 * Valeur absente (undefined / null / '') → taux par défaut (18 %).
 * Lance une Error (message en français, affichable) si le taux est invalide.
 */
export function parseTauxTva(value, { defaut = TAUX_TVA_DEFAUT } = {}) {
  if (value === undefined || value === null || value === '') return defaut;
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new Error('Le taux de TVA doit être un nombre entre 0 et 100.');
  }
  const taux = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(taux) || taux < 0 || taux > 100) {
    throw new Error('Le taux de TVA doit être un nombre entre 0 et 100.');
  }
  return Math.round(taux * 100) / 100;
}
