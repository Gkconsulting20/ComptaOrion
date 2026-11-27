// Taux de TVA — choix à l'inscription et presets affichés dans les modules.
//
// Le taux de l'entreprise est choisi à l'inscription (18 % par défaut,
// 0 % exonéré, ou taux personnalisé 0–100) et reste modifiable dans les
// paramètres. Les formulaires de vente et les listes de taxes partent de
// ce taux : l'aperçu ne doit plus afficher 18 % en dur pour une entreprise
// à 0 % ou à taux personnalisé.

export const TAUX_TVA_DEFAUT = 18;

/**
 * Résout le taux choisi dans le formulaire d'inscription.
 * choix : '18' | '0' | 'custom' ; personnalise : valeur du champ libre.
 * Retourne le taux (0–100) ou null si le taux personnalisé est invalide.
 */
export function resolveTauxTvaInscription(choix, personnalise) {
  if (choix === '0') return 0;
  if (choix === 'custom') {
    const texte = String(personnalise ?? '').trim();
    if (texte === '') return null;
    const taux = Number(texte);
    if (!Number.isFinite(taux) || taux < 0 || taux > 100) return null;
    return Math.round(taux * 100) / 100;
  }
  return TAUX_TVA_DEFAUT;
}

/**
 * Presets TVA affichés dans les paramètres (clients / fournisseurs).
 * Le taux de l'entreprise arrive en tête, suivi des taux usuels, sans
 * doublon ; l'exonération reste proposée. Les listes restent modifiables
 * par l'utilisateur ensuite (ajout / édition de taxes).
 */
export function buildTaxPresets(tauxEntreprise) {
  const taux = Number(tauxEntreprise);
  const base = Number.isFinite(taux) ? Math.round(taux * 100) / 100 : TAUX_TVA_DEFAUT;
  const valeurs = [];
  for (const valeur of [base, 18, 9, 0]) {
    if (!valeurs.includes(valeur)) valeurs.push(valeur);
  }
  return valeurs.map((valeur, index) => ({
    id: index + 1,
    nom:
      valeur === 0
        ? 'Exonéré'
        : valeur === base
          ? `TVA ${valeur}% — taux de l'entreprise`
          : `TVA ${valeur}%`,
    taux: valeur,
    codeComptable: valeur === 0 ? '-' : valeur === 9 ? '4432' : '4431',
  }));
}
