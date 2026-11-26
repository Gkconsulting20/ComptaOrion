// Bilan après clôture d'exercice — régression du double-compte (21 nov. 2026).
//
// Scénario prouvé en direct sur une entreprise test (depuis supprimée) :
//   - ouverture 2025-01-05 : D 57 / C 101 = 100 000
//   - loyer 2025-06-10    : D 613 / C 57 = 25 000
//   - clôture 2025 (OD, 2025-12-31) : C 613 / D 129 = 25 000
//   - ouverture AN-2026 (2026-01-01) : D 57 75 000 / D 129 25 000 / C 101 100 000
// Avant correction, le bilan 2026 était déséquilibré : actif 57 = 150 000,
// passif 101 = 200 000 + 129 = 50 000 (total 250 000, écart 100 000).
// Après correction : actif 75 000, passif 101 = 100 000 + 129 = 25 000
// (perte déduite), équilibre true.
//
// Ces tests portent sur les fonctions pures de services/bilanService.js
// (aucune base de données). La sélection SQL de l'ouverture
// (findLatestActiveOpening) et les deux routes restent à vérifier en direct
// après déploiement, sur une entreprise test.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculerBilan,
  contributionCapitauxPropres,
  filterLignesBilan,
  findLatestActiveOpening,
  soldesParCompte,
} from '../src/services/bilanService.js';

const comptes = [
  { id: 1, numero: '101', nom: 'Capital social' },
  { id: 2, numero: '129', nom: 'Résultat de l’exercice (perte)' },
  { id: 3, numero: '57', nom: 'Caisse' },
  { id: 4, numero: '613', nom: 'Loyers' },
];

function ligne(ecritureId, dateEcriture, compteId, debit, credit) {
  return { ecritureId, dateEcriture, compteId, debit: String(debit), credit: String(credit) };
}

// e1 — ouverture 2025-01-05 : D 57 / C 101 = 100 000
const lignesAvantCloture = [
  ligne(1, '2025-01-05', 3, 100000, 0),
  ligne(1, '2025-01-05', 1, 0, 100000),
  // e2 — loyer 2025-06-10 : D 613 / C 57 = 25 000
  ligne(2, '2025-06-10', 4, 25000, 0),
  ligne(2, '2025-06-10', 3, 0, 25000),
];
// e3 — clôture 2025 (OD, 2025-12-31) : C 613 / D 129 = 25 000
const lignesCloture = [
  ligne(3, '2025-12-31', 4, 0, 25000),
  ligne(3, '2025-12-31', 2, 25000, 0),
];
// e4 — ouverture AN-2026 (2026-01-01) : D 57 75 000 / D 129 25 000 / C 101 100 000
const lignesOuverture = [
  ligne(4, '2026-01-01', 3, 75000, 0),
  ligne(4, '2026-01-01', 2, 25000, 0),
  ligne(4, '2026-01-01', 1, 0, 100000),
];
// e5 — contrepassation de la clôture (2025-12-31) : D 613 / C 129 = 25 000
// e6 — contrepassation de l'ouverture (2026-01-01) : C 57 75 000 / C 129 25 000 / D 101 100 000
const lignesContrepassation = [
  ligne(5, '2025-12-31', 4, 25000, 0),
  ligne(5, '2025-12-31', 2, 0, 25000),
  ligne(6, '2026-01-01', 3, 0, 75000),
  ligne(6, '2026-01-01', 2, 0, 25000),
  ligne(6, '2026-01-01', 1, 100000, 0),
];

const opening2026 = { ecritureOuvertureId: 4, dateEcriture: '2026-01-01' };

function capitauxParNumero(resultat) {
  return new Map(
    resultat.passif.capitauxPropres.map((item) => [item.compte, item.montant])
  );
}

test('contributionCapitauxPropres : un solde créditeur augmente le passif, un solde débiteur le diminue', () => {
  // 101 créditeur (solde −100 000) : +100 000 au passif.
  assert.equal(contributionCapitauxPropres(-100000), 100000);
  // 129 débiteur (perte reportée, solde +25 000) : −25 000 au passif.
  assert.equal(contributionCapitauxPropres(25000), -25000);
});

test('filterLignesBilan : sans ouverture, toutes les lignes sont prises en compte', () => {
  const lignes = [...lignesAvantCloture, ...lignesCloture, ...lignesOuverture];
  assert.equal(filterLignesBilan(lignes, null).length, lignes.length);
});

test('filterLignesBilan : avec une ouverture, seules ses lignes et celles datées après elle comptent', () => {
  const lignes = [
    ...lignesAvantCloture,
    ...lignesCloture,
    ...lignesOuverture,
    // Une écriture ordinaire datée exactement le jour de l'ouverture : exclue.
    ligne(7, '2026-01-01', 3, 5000, 0),
    // Une écriture du lendemain : incluse.
    ligne(8, '2026-01-02', 3, 1000, 0),
  ];
  const prises = filterLignesBilan(lignes, opening2026);
  assert.deepEqual(
    prises.map((l) => l.ecritureId),
    [4, 4, 4, 8]
  );
});

test('soldesParCompte : somme débit − crédit par compte', () => {
  assert.deepEqual(soldesParCompte(lignesAvantCloture), {
    1: -100000,
    3: 75000,
    4: 25000,
  });
});

test('(a) bilan sans aucune clôture : comportement inchangé, équilibré', () => {
  const resultat = calculerBilan({
    comptes,
    lignes: lignesAvantCloture,
    opening: null,
    dateDebut: '2025-01-01',
    dateFin: '2025-12-31',
  });
  assert.equal(resultat.actif.total, 75000);
  assert.equal(resultat.passif.total, 75000);
  assert.equal(resultat.resultatNet, -25000);
  assert.equal(resultat.equilibre, true);
});

test('(a) bilan sans clôture, cumulatif sans dateDebut : équilibré', () => {
  const resultat = calculerBilan({
    comptes,
    lignes: lignesAvantCloture,
    opening: null,
    dateFin: '2026-12-31',
  });
  assert.equal(resultat.actif.total, 75000);
  assert.equal(resultat.passif.total, 75000);
  assert.equal(resultat.equilibre, true);
});

test('(b) bilan 2026 après clôture de 2025 : actif 75 000, passif 75 000, équilibré', () => {
  const resultat = calculerBilan({
    comptes,
    lignes: [...lignesAvantCloture, ...lignesCloture, ...lignesOuverture],
    opening: opening2026,
    dateDebut: '2026-01-01',
    dateFin: '2026-12-31',
  });
  // Les valeurs du bug : actif 150 000, passif 250 000 (écart 100 000).
  assert.equal(resultat.actif.total, 75000);
  assert.equal(resultat.passif.total, 75000);
  assert.equal(resultat.resultatNet, 0);
  assert.equal(resultat.equilibre, true);
  // Le 129 affiché est la perte REPORTÉE (ouverture), pas le résultat 2026
  // (resultatNet = 0, donc aucune ligne de résultat n'est ajoutée).
  assert.deepEqual(
    [...capitauxParNumero(resultat).entries()],
    [['101', 100000], ['129', 25000]]
  );
  const ligne129 = resultat.passif.capitauxPropres.find((item) => item.compte === '129');
  assert.equal(ligne129.nom, 'Résultat de l’exercice (perte)');
});

test('(b) bilan 2026 après clôture, sans dateDebut : le résultat net ne double-compte pas le 129 reporté', () => {
  // Sans dateDebut, le résultat net porte sur toutes les lignes 6/7 :
  // le loyer 2025 (D 25 000) est annulé par la ligne de clôture (C 25 000).
  const resultat = calculerBilan({
    comptes,
    lignes: [...lignesAvantCloture, ...lignesCloture, ...lignesOuverture],
    opening: opening2026,
    dateFin: '2026-12-31',
  });
  assert.equal(resultat.resultatNet, 0);
  assert.equal(resultat.actif.total, 75000);
  assert.equal(resultat.passif.total, 75000);
  assert.equal(resultat.equilibre, true);
});

test('(c) bilan après réouverture de 2025 : retour au comportement sans clôture', () => {
  // Ouverture annulée (plus aucune clôture 'ferme') : toutes les lignes
  // comptent, clôture + ouverture + contrepassations s'annulent.
  const resultat = calculerBilan({
    comptes,
    lignes: [
      ...lignesAvantCloture,
      ...lignesCloture,
      ...lignesOuverture,
      ...lignesContrepassation,
    ],
    opening: null,
    dateFin: '2026-12-31',
  });
  assert.equal(resultat.actif.total, 75000);
  assert.equal(resultat.passif.total, 75000);
  assert.equal(resultat.resultatNet, -25000);
  assert.equal(resultat.equilibre, true);
  // Le 129 reporté est annulé par sa contrepassation (solde 0, donc absent
  // des soldes) : le seul 129 présent est la ligne de résultat de l'exercice,
  // preuve que la perte est de nouveau portée par le résultat net.
  const ligne129 = resultat.passif.capitauxPropres.find((item) => item.compte === '129');
  assert.equal(ligne129.nom, "Résultat de l'exercice (Perte)");
  assert.equal(ligne129.montant, 25000);
  assert.equal(capitauxParNumero(resultat).get('101'), 100000);
});

test('findLatestActiveOpening : retourne la ligne, null sinon, et refuse un identifiant invalide', async () => {
  function fakeExecutor(rows) {
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => Promise.resolve(rows),
    };
    return { select: () => chain };
  }
  assert.deepEqual(
    await findLatestActiveOpening(
      fakeExecutor([{ ecritureOuvertureId: 4, dateEcriture: '2026-01-01' }]),
      12,
      '2026-12-31'
    ),
    { ecritureOuvertureId: 4, dateEcriture: '2026-01-01' }
  );
  assert.equal(
    await findLatestActiveOpening(fakeExecutor([]), 12, '2026-12-31'),
    null
  );
  assert.equal(
    await findLatestActiveOpening(
      fakeExecutor([{ ecritureOuvertureId: null, dateEcriture: '2026-01-01' }]),
      12,
      '2026-12-31'
    ),
    null
  );
  // Identifiant d'entreprise invalide : la base n'est même pas interrogée.
  const throwingExecutor = {
    select: () => {
      throw new Error('ne doit pas interroger la base');
    },
  };
  assert.equal(await findLatestActiveOpening(throwingExecutor, 0, '2026-12-31'), null);
  assert.equal(await findLatestActiveOpening(throwingExecutor, Number.NaN, '2026-12-31'), null);
});

// ---------------------------------------------------------------------
// Banque à découvert (exercice 2026, erreur E4) : l'ancien endpoint
// /comptabilite/bilan reprenait le solde créditeur du compte 521 en
// positif à l'actif (actif 6 730 900 vs passif 986 500, écart =
// 2 × 2 872 200). Le découvert doit être classé en dettes au passif,
// comme le fait déjà /rapports/bilan.
//
// Soldes finaux du rapport (§2) : 101 −2 400 000, 31 +1 450 000,
// 401 −400 000, 411 +300 000, 4112 +88 500, 443 −391 500,
// 445 +538 200, 521 −2 872 200 (découvert), 571 +1 482 000,
// charges 4 380 000, produits 2 175 000, résultat −2 205 000.
// Bilan attendu : actif 3 858 700 = passif 3 858 700.

const comptesDecouvert = [
  { id: 1, numero: '101', nom: 'Capital social' },
  { id: 2, numero: '31', nom: 'Stock' },
  { id: 3, numero: '401', nom: 'Fournisseurs' },
  { id: 4, numero: '411', nom: 'Clients' },
  { id: 5, numero: '4112', nom: 'Clients - Ventes de services' },
  { id: 6, numero: '443', nom: 'État - TVA facturée' },
  { id: 7, numero: '445', nom: 'État - TVA récupérable' },
  { id: 8, numero: '521', nom: 'Banques' },
  { id: 9, numero: '571', nom: 'Caisse' },
  { id: 10, numero: '603', nom: 'Variation des stocks' },
  { id: 11, numero: '605', nom: 'Autres achats' },
  { id: 12, numero: '622', nom: 'Locations et charges locatives' },
  { id: 13, numero: '625', nom: 'Déplacements, missions et réceptions' },
  { id: 14, numero: '661', nom: 'Rémunérations du personnel' },
  { id: 15, numero: '701', nom: 'Ventes de marchandises' },
];

// Lignes choisies pour produire exactement les soldes finaux du rapport
// (la fonction pure somme les lignes par compte ; les écritures
// complètes de l'exercice sont dans le rapport).
const lignesDecouvert = [
  ligne(1, '2026-01-01', 1, 0, 2400000),
  ligne(1, '2026-12-31', 2, 1450000, 0),
  ligne(1, '2026-12-31', 3, 0, 400000),
  ligne(1, '2026-12-31', 4, 300000, 0),
  ligne(1, '2026-12-31', 5, 88500, 0),
  ligne(1, '2026-12-31', 6, 0, 391500),
  ligne(1, '2026-12-31', 7, 538200, 0),
  ligne(1, '2026-12-31', 8, 0, 2872200),
  ligne(1, '2026-12-31', 9, 1482000, 0),
  ligne(1, '2026-06-30', 10, 1420000, 0),
  ligne(1, '2026-06-30', 11, 120000, 0),
  ligne(1, '2026-06-30', 12, 960000, 0),
  ligne(1, '2026-06-30', 13, 80000, 0),
  ligne(1, '2026-06-30', 14, 1800000, 0),
  ligne(1, '2026-06-30', 15, 0, 2175000),
];

test('(d) banque à découvert : bilan équilibré, 521 en dettes au passif', () => {
  const resultat = calculerBilan({
    comptes: comptesDecouvert,
    lignes: lignesDecouvert,
    opening: null,
    dateDebut: '2026-01-01',
    dateFin: '2026-12-31',
  });
  // Les valeurs du bug : actif 6 730 900, passif 986 500, equilibre false.
  assert.equal(resultat.actif.total, 3858700);
  assert.equal(resultat.passif.total, 3858700);
  assert.equal(resultat.resultatNet, -2205000);
  assert.equal(resultat.equilibre, true);
  const dettes521 = resultat.passif.dettes.find((item) => item.compte === '521');
  assert.ok(dettes521, 'le compte 521 doit être classé en dettes');
  assert.equal(dettes521.montant, 2872200);
  assert.equal(
    resultat.actif.tresorerie.find((item) => item.compte === '521'),
    undefined,
  );
  // La caisse positive reste à l'actif.
  const caisse = resultat.actif.tresorerie.find((item) => item.compte === '571');
  assert.ok(caisse);
  assert.equal(caisse.montant, 1482000);
});

test('(d) banque positive : 521 reste à l’actif, bilan équilibré', () => {
  const lignes = lignesDecouvert.map((l) =>
    l.compteId === 8 ? ligne(l.ecritureId, l.dateEcriture, 8, 500000, 0) : l,
  );
  const resultat = calculerBilan({
    comptes: comptesDecouvert,
    lignes,
    opening: null,
    dateDebut: '2026-01-01',
    dateFin: '2026-12-31',
  });
  const banque = resultat.actif.tresorerie.find((item) => item.compte === '521');
  assert.ok(banque);
  assert.equal(banque.montant, 500000);
  assert.equal(
    resultat.passif.dettes.find((item) => item.compte === '521'),
    undefined,
  );
  // Solde modifié sans contrepartie : le bilan n'est plus équilibré, mais
  // la classification est vérifiée (actif +500 000, passif −2 872 200).
  assert.equal(resultat.actif.total, 4358700);
  assert.equal(resultat.passif.total, 986500);
});
