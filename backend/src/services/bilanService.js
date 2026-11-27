// Bilan après clôture d'exercice.
//
// Problème : les routes /bilan et /rapports/bilan calculaient les soldes en
// cumulant TOUTES les écritures valides depuis le début jusqu'à dateFin.
// Après une clôture, les écritures d'avant-clôture ET l'écriture d'ouverture
// à nouveaux (journal AN) qui les reprend étaient donc comptées deux fois
// (ex. 57 : 100 000 − 25 000 + 75 000 = 150 000 au lieu de 75 000).
//
// Correction en deux parties :
//   1. Base à nouveaux : les soldes repartent de la DERNIÈRE ouverture à
//      nouveaux ACTIVE (clotures_exercices.statut = 'ferme'). Les soldes
//      sont alors les lignes de cette écriture d'ouverture + les lignes des
//      écritures datées APRÈS elle. Sans ouverture active (jamais clôturé,
//      ou exercice réouvert), le comportement est inchangé : toutes les
//      lignes valides jusqu'à dateFin.
//   2. Signe de la classe 1 : la contribution d'un compte de capitaux
//      propres au passif total est −solde (crédit − débit). Un compte 129
//      débiteur (perte reportée) DIMINUE donc le passif, au lieu de
//      l'augmenter comme le faisait Math.abs(solde).
//
// Le résultat net (classes 6/7 sur [dateDebut, dateFin]) n'est pas modifié :
// l'écriture de clôture solde les comptes 6/7, donc leurs lignes
// d'avant-clôture s'annulent avec celles de la clôture dans la somme.

import { and, desc, eq, lte } from 'drizzle-orm';
import { cloturesExercices, ecritures } from '../schema.js';

/**
 * Dernière ouverture à nouveaux ACTIVE pour l'entreprise.
 * Source de vérité : la table clotures_exercices — la ligne la plus récente
 * avec statut = 'ferme', dont l'écriture d'ouverture est datée au plus tard
 * à dateFin (si dateFin est fourni ; sinon la plus récente).
 * Une ouverture réouverte (statut = 'reouvert') ne sert pas de base : ses
 * lignes sont annulées par la contrepassation de réouverture.
 * Retourne { ecritureOuvertureId, dateEcriture } ou null.
 */
export async function findLatestActiveOpening(executor, entrepriseId, dateFin) {
  if (!Number.isSafeInteger(entrepriseId) || entrepriseId <= 0) return null;
  const conditions = [
    eq(cloturesExercices.entrepriseId, entrepriseId),
    eq(cloturesExercices.statut, 'ferme'),
    eq(ecritures.entrepriseId, entrepriseId),
  ];
  if (dateFin) {
    conditions.push(lte(ecritures.dateEcriture, new Date(dateFin)));
  }
  const [row] = await executor
    .select({
      ecritureOuvertureId: cloturesExercices.ecritureOuvertureId,
      dateEcriture: ecritures.dateEcriture,
    })
    .from(cloturesExercices)
    .innerJoin(ecritures, eq(ecritures.id, cloturesExercices.ecritureOuvertureId))
    .where(and(...conditions))
    .orderBy(desc(cloturesExercices.dateOuvertureSuivante), desc(cloturesExercices.revision))
    .limit(1);
  if (!row || !row.ecritureOuvertureId || !row.dateEcriture) return null;
  return { ecritureOuvertureId: row.ecritureOuvertureId, dateEcriture: row.dateEcriture };
}

/** Normalise une date (chaîne 'YYYY-MM-DD' ou Date) en 'YYYY-MM-DD'. */
export function toDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || '').slice(0, 10);
}

function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Filtre les lignes comptables prises en compte pour le bilan.
 * Sans ouverture active : toutes les lignes (comportement historique).
 * Avec une ouverture : uniquement les lignes de l'écriture d'ouverture
 * elle-même (identifiée par son id) et celles des écritures datées
 * STRICTEMENT après la date d'ouverture. Les écritures d'avant-clôture —
 * y compris l'écriture de clôture — sont exclues : leurs soldes sont déjà
 * repris dans l'écriture d'ouverture.
 * Ligne attendue : { ecritureId, dateEcriture, compteId, debit, credit }.
 */
export function filterLignesBilan(lignes, opening) {
  if (!opening) return lignes;
  const dateOuverture = toTime(opening.dateEcriture);
  if (dateOuverture === null) return lignes;
  return lignes.filter((ligne) => {
    if (Number(ligne.ecritureId) === Number(opening.ecritureOuvertureId)) return true;
    const dateLigne = toTime(ligne.dateEcriture);
    return dateLigne !== null && dateLigne > dateOuverture;
  });
}

/** Soldes signés (débit − crédit) par compte. */
export function soldesParCompte(lignes) {
  const soldes = {};
  for (const ligne of lignes) {
    const compteId = ligne.compteId ?? ligne.compteComptableId;
    if (soldes[compteId] === undefined) soldes[compteId] = 0;
    soldes[compteId] += parseFloat(ligne.debit || 0) - parseFloat(ligne.credit || 0);
  }
  return soldes;
}

/**
 * Contribution d'un compte de classe 1 (capitaux propres) au passif total.
 * Le passif total est (crédit − débit) : un solde créditeur (ex. 101)
 * l'augmente, un solde débiteur (ex. 129, perte reportée) le diminue.
 * Le montant AFFICHÉ de la ligne reste Math.abs(solde) ; seule la
 * contribution au total est signée.
 */
export function contributionCapitauxPropres(solde) {
  return -solde;
}

/**
 * Calcul complet du bilan (même logique que GET /bilan) à partir de lignes
 * brutes, sans accès base : utile pour les tests.
 * comptes : [{ id, numero, nom }] ; lignes : { ecritureId, dateEcriture,
 * compteId, debit, credit } ; opening : { ecritureOuvertureId, dateEcriture }
 * ou null ; dateDebut / dateFin : bornes de la période du résultat net.
 */
export function calculerBilan({ comptes, lignes, opening, dateDebut, dateFin }) {
  const lignesPrises = filterLignesBilan(lignes, opening);
  const soldesMap = soldesParCompte(lignesPrises);

  // Résultat de la période (classe 6 / 7) — INCHANGÉ : il porte sur toutes
  // les lignes de [dateDebut, dateFin], ouverture comprise ou non. Après
  // une clôture, les lignes 6/7 d'avant-clôture sont annulées par celles de
  // l'écriture de clôture, donc le 129 reporté n'est pas double-compté.
  let totalCharges = 0;
  let totalProduits = 0;
  const comptesById = new Map(comptes.map((c) => [c.id, c]));
  for (const ligne of lignes) {
    if (dateDebut && toTime(ligne.dateEcriture) < toTime(dateDebut)) continue;
    if (dateFin && toTime(ligne.dateEcriture) > toTime(dateFin)) continue;
    const compte = comptesById.get(ligne.compteId);
    if (!compte) continue;
    const debit = parseFloat(ligne.debit || 0);
    const credit = parseFloat(ligne.credit || 0);
    if (compte.numero.startsWith('6')) totalCharges += debit - credit;
    else if (compte.numero.startsWith('7')) totalProduits += credit - debit;
  }
  const resultatNet = totalProduits - totalCharges;

  // Classification SYSCOHADA — identique à GET /bilan, sauf la classe 1
  // dont la contribution au passif est désormais signée (voir
  // contributionCapitauxPropres).
  const bilan = {
    actif: {
      immobilisations: [],
      amortissements: [],
      stocksCreances: [],
      tresorerie: [],
      total: 0,
    },
    passif: {
      capitauxPropres: [],
      dettes: [],
      total: 0,
    },
  };

  for (const compte of comptes) {
    const solde = soldesMap[compte.id] || 0;
    if (solde === 0) continue;

    const item = { compte: compte.numero, nom: compte.nom, montant: Math.abs(solde) };
    const classe = compte.numero.charAt(0);

    if (classe === '2') {
      // Comptes 28x / 29x = amortissements et provisions pour dépréciation
      // des immobilisations (solde créditeur) : ce sont des corrections
      // d'actif, à DÉDUIRE du total — comme le fait déjà /rapports/bilan.
      // L'ancien code les additionnait à l'actif (écart = 2 × le montant).
      if (compte.numero.startsWith('28') || compte.numero.startsWith('29')) {
        bilan.actif.amortissements.push(item);
        bilan.actif.total -= Math.abs(solde);
      } else {
        bilan.actif.immobilisations.push(item);
        bilan.actif.total += Math.abs(solde);
      }
    } else if (classe === '3') {
      // Compte 39x = dépréciation des stocks (solde créditeur) : à déduire
      // de l'actif, pas à additionner.
      if (compte.numero.startsWith('39')) {
        bilan.actif.total -= Math.abs(solde);
      } else {
        bilan.actif.stocksCreances.push(item);
        bilan.actif.total += Math.abs(solde);
      }
    } else if (classe === '4' && compte.numero.startsWith('49')) {
      // Compte 49x = dépréciation des comptes de tiers (solde créditeur) :
      // correction d'actif à déduire — l'ancien code le classait en
      // dettes au passif, ce qui gonflait le passif au lieu de réduire
      // l'actif (écart = 2 × le montant sur la différence actif−passif).
      bilan.actif.total -= Math.abs(solde);
    } else if (classe === '4' && solde > 0) {
      bilan.actif.stocksCreances.push(item);
      bilan.actif.total += solde;
    } else if (classe === '4' && solde < 0) {
      bilan.passif.dettes.push(item);
      bilan.passif.total += Math.abs(solde);
    } else if (classe === '5' && solde > 0) {
      // Solde débiteur : disponibilités à l'actif.
      bilan.actif.tresorerie.push(item);
      bilan.actif.total += solde;
    } else if (classe === '5' && solde < 0) {
      // Solde créditeur (banque à découvert) : dette au passif, comme
      // le fait déjà /rapports/bilan. L'ancien code reprenait le
      // découvert en positif à l'actif (écart = 2 × le découvert :
      // exercice 2026, actif 6 730 900 au lieu de 3 858 700).
      bilan.passif.dettes.push(item);
      bilan.passif.total += Math.abs(solde);
    } else if (classe === '1') {
      bilan.passif.capitauxPropres.push(item);
      bilan.passif.total += contributionCapitauxPropres(solde);
    }
  }

  // Intégrer le résultat de l'exercice aux capitaux propres (120 / 129).
  if (Math.abs(resultatNet) > 0.01) {
    const isPerte = resultatNet < 0;
    bilan.passif.capitauxPropres.push({
      compte: isPerte ? '129' : '120',
      nom: isPerte ? "Résultat de l'exercice (Perte)" : "Résultat de l'exercice (Bénéfice)",
      montant: Math.abs(resultatNet),
    });
    bilan.passif.total += isPerte ? -Math.abs(resultatNet) : Math.abs(resultatNet);
  }

  return {
    ...bilan,
    resultatNet,
    totalCharges,
    totalProduits,
    equilibre: Math.abs(bilan.actif.total - bilan.passif.total) < 1,
  };
}
