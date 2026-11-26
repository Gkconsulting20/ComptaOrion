// Rejeu des 24 ventes de l'exercice comptable complet 2026 (26 nov. 2026).
//
// Contexte (RAPPORT_EXERCICE_2026.md, §3) : le coût des ventes était
// valorisé en FIFO alors que le libellé annonçait le coût moyen pondéré
// (écart +10 769 sur 24 ventes : CMUP attendu 1 430 769, réel FIFO
// 1 420 000). La cause : la méthode du produit était forcée à FIFO à la
// création (routes /produits et /stock/produits) et le PUT l'ignorait, donc
// consumeStockValuation prenait toujours la branche FIFO — le correctif R5
// (selectConsumptionUnitCost) n'était jamais atteint.
//
// Ces tests portent sur les fonctions pures de services/stockValuation.js
// (aucune base de données) : la mathématique de consommation extraite dans
// calculerConsommationStock, rejouée mois par mois avec les réceptions et
// les prix d'achat exacts du rapport.
//
// Scénario : chaque mois, réception A 20 sacs + réception B 10 bidons, puis
// vente A 10 sacs et vente B 5 bidons. Prix d'achat A : 6 500 (jan, fév,
// avr, juin, août, oct, déc), 7 000 (mars, mai, sep, nov), 7 500 (juil).
// Prix d'achat B : 10 000 (jan, fév, avr, juin, août, oct, déc),
// 11 000 (mars, mai, juil, sep, nov). Le stock initial valorisé 0 a été
// retiré par inventaire avant janvier : le rejeu part de couches vides.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculerConsommationStock,
  isValidValorisationMethod,
  normalizeValorisationMethod,
} from '../src/services/stockValuation.js';

// CMUP attendu par mois (rapport §3, A + B) et total.
const CMUP_ATTENDU_MENSUEL = [
  115000, 115000, 120000, 118000, 120333, 118810,
  121607, 120139, 121111, 120000, 120833, 119936,
];
const CMUP_ATTENDU_TOTAL = 1430769;
// FIFO vérifié couche par couche dans le rapport (24/24 ventes).
const FIFO_ATTENDU_TOTAL = 1420000;

const PRIX_A = [6500, 6500, 7000, 6500, 7000, 6500, 7500, 6500, 7000, 6500, 7000, 6500];
const PRIX_B = [10000, 10000, 11000, 10000, 11000, 10000, 11000, 10000, 11000, 10000, 11000, 10000];

function coutMoyenDesCouches(couches) {
  const quantite = couches.reduce((somme, couche) => somme + couche.quantite, 0);
  const valeur = couches.reduce((somme, couche) => somme + couche.coutTotal, 0);
  return quantite > 0 ? valeur / quantite : 0;
}

function rejouerExercice2026(methode) {
  let couchesA = [];
  let couchesB = [];
  let prochainId = 1;
  const mensuel = [];
  for (let mois = 0; mois < 12; mois += 1) {
    couchesA = [...couchesA, {
      id: prochainId++, quantite: 20, coutTotal: 20 * PRIX_A[mois],
    }];
    couchesB = [...couchesB, {
      id: prochainId++, quantite: 10, coutTotal: 10 * PRIX_B[mois],
    }];
    const venteA = calculerConsommationStock({
      couches: couchesA,
      quantite: 10,
      methode,
      coutMoyenStocke: coutMoyenDesCouches(couchesA),
    });
    const venteB = calculerConsommationStock({
      couches: couchesB,
      quantite: 5,
      methode,
      coutMoyenStocke: coutMoyenDesCouches(couchesB),
    });
    couchesA = venteA.couchesRestantes;
    couchesB = venteB.couchesRestantes;
    mensuel.push(venteA.coutConsomme + venteB.coutConsomme);
  }
  const valeurStockFinal = [...couchesA, ...couchesB]
    .reduce((somme, couche) => somme + couche.coutTotal, 0);
  const quantiteFinale = [...couchesA, ...couchesB]
    .reduce((somme, couche) => somme + couche.quantite, 0);
  return {
    mensuel,
    total: mensuel.reduce((somme, montant) => somme + montant, 0),
    valeurStockFinal,
    quantiteFinale,
  };
}

test('normalizeValorisationMethod : CMP par défaut, CMUP accepté comme alias, FIFO sur choix explicite', () => {
  assert.equal(normalizeValorisationMethod('CMP'), 'CMP');
  assert.equal(normalizeValorisationMethod('CMUP'), 'CMP');
  assert.equal(normalizeValorisationMethod('cmup'), 'CMP');
  assert.equal(normalizeValorisationMethod('FIFO'), 'FIFO');
  assert.equal(normalizeValorisationMethod('fifo'), 'FIFO');
  assert.equal(normalizeValorisationMethod(undefined), 'CMP');
  assert.equal(normalizeValorisationMethod(''), 'CMP');
  assert.equal(normalizeValorisationMethod('nimporte-quoi'), 'CMP');
  assert.equal(isValidValorisationMethod('CMP'), true);
  assert.equal(isValidValorisationMethod('CMUP'), true);
  assert.equal(isValidValorisationMethod('FIFO'), true);
  assert.equal(isValidValorisationMethod('LIFO'), false);
  assert.equal(isValidValorisationMethod(''), false);
});

test('rejeu 2026 en CMP : CMUP mensuel et total conformes au rapport', () => {
  const resultat = rejouerExercice2026('CMP');
  for (let mois = 0; mois < 12; mois += 1) {
    assert.ok(
      Math.abs(resultat.mensuel[mois] - CMUP_ATTENDU_MENSUEL[mois]) <= 1,
      `mois ${mois + 1} : attendu ${CMUP_ATTENDU_MENSUEL[mois]}, obtenu ${resultat.mensuel[mois]}`,
    );
  }
  assert.ok(
    Math.abs(resultat.total - CMUP_ATTENDU_TOTAL) <= 2,
    `total attendu ${CMUP_ATTENDU_TOTAL}, obtenu ${resultat.total}`,
  );
  // Stock final : achats totaux 2 870 000 − CMUP 1 430 769 = 1 439 231.
  // Le 1 450 000 du rapport (§2) est la valorisation FIFO des couches
  // restantes, pas la valeur en CMP : le compte 31 de l'exercice (FIFO)
  // ne peut pas être repris tel quel après le passage au CMUP.
  assert.equal(resultat.quantiteFinale, 180);
  assert.ok(Math.abs(resultat.valeurStockFinal - 1439231) <= 2,
    `stock final CMP attendu 1439231, obtenu ${resultat.valeurStockFinal}`);
});

test('rejeu 2026 en FIFO : total 1 420 000, l’écart historique est reproduit', () => {
  // Contrôle : le même rejeu en FIFO doit retomber sur le coût réel
  // constaté en 2026 (1 420 000), soit 10 769 de moins que le CMUP.
  const resultat = rejouerExercice2026('FIFO');
  assert.ok(Math.abs(resultat.total - FIFO_ATTENDU_TOTAL) <= 2,
    `total FIFO attendu ${FIFO_ATTENDU_TOTAL}, obtenu ${resultat.total}`);
  assert.ok(Math.abs(resultat.valeurStockFinal - 1450000) <= 2,
    `stock final FIFO attendu 1450000, obtenu ${resultat.valeurStockFinal}`);
});

test('calculerConsommationStock : vente totale vide le stock au coût exact des couches', () => {
  const resultat = calculerConsommationStock({
    couches: [
      { id: 1, quantite: 10, coutTotal: 65000 },
      { id: 2, quantite: 20, coutTotal: 140000 },
    ],
    quantite: 30,
    methode: 'CMP',
    coutMoyenStocke: 0,
  });
  assert.equal(resultat.coutConsomme, 205000);
  assert.equal(resultat.quantiteConsommee, 30);
  assert.equal(resultat.quantiteNonSuivie, 0);
  assert.deepEqual(resultat.couchesRestantes.map((c) => c.quantite), [0, 0]);
});

test('calculerConsommationStock : quantité supérieure au stock disponible', () => {
  const resultat = calculerConsommationStock({
    couches: [{ id: 1, quantite: 5, coutTotal: 50000 }],
    quantite: 10,
    methode: 'CMP',
    coutMoyenStocke: 10000,
  });
  assert.equal(resultat.quantiteConsommee, 5);
  assert.equal(resultat.quantiteNonSuivie, 5);
  assert.equal(resultat.coutConsomme, 50000);
});
