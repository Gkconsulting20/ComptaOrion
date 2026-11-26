// Erreur E5 de l'exercice 2026 : soldes du module Trésorerie ≠
// comptabilité. La synchronisation ne couvrait que le journal BQ :
// banque du module −3 072 200 contre −2 872 200 en comptabilité
// (écart 200 000 = ouverture AN +2 000 000 et salaires SA −1 800 000
// non synchronisés), caisse du module 0,00 contre +1 482 000
// (aucune synchronisation du journal CA).
//
// Règle désormais : toute écriture validée dont une ligne touche un
// compte de trésorerie lié (banque ou caisse) est synchronisée, un
// mouvement par compte lié. Ces tests portent sur la fonction pure
// mouvementsTresorerieParCompte (sans base de données), rejouée sur
// les écritures du scénario 2026.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mouvementsTresorerieParCompte } from '../src/services/treasuryJournalSync.js';

// Comptes de trésorerie liés : banque (compte comptable 521, id 12)
// et caisse (compte comptable 571, id 13) — identifiants du rapport.
const COMPTES = [
  { id: 12, compteComptableId: 1213 }, // 521, id comptable fictif
  { id: 13, compteComptableId: 1331 }, // 571
];
const COMPTE_521 = 1213;
const COMPTE_571 = 1331;
const COMPTE_411 = 1256;
const COMPTE_401 = 1243;
const COMPTE_101 = 1213 - 1000; // autre compte, non lié
const COMPTE_661 = 1411;

function ligne(compteComptableId, debit, credit) {
  return { compteComptableId, debit: String(debit), credit: String(credit) };
}

test('ouverture AN 2026 : deux mouvements, banque +2 000 000 et caisse +500 000', () => {
  const mouvements = mouvementsTresorerieParCompte({
    lignes: [
      ligne(COMPTE_521, 2000000, 0),
      ligne(COMPTE_571, 500000, 0),
      ligne(COMPTE_411, 300000, 0),
      ligne(COMPTE_401, 0, 400000),
      ligne(COMPTE_101, 0, 2400000),
    ],
    comptesBancaires: COMPTES,
  });
  assert.deepEqual(mouvements, [
    { compteBancaireId: 12, compteComptableId: COMPTE_521, mouvementNet: 2000000, type: 'encaissement' },
    { compteBancaireId: 13, compteComptableId: COMPTE_571, mouvementNet: 500000, type: 'encaissement' },
  ]);
});

test('salaires SA : décaissement banque de 1 800 000', () => {
  const mouvements = mouvementsTresorerieParCompte({
    lignes: [
      ligne(COMPTE_661, 1800000, 0),
      ligne(COMPTE_521, 0, 1800000),
    ],
    comptesBancaires: COMPTES,
  });
  assert.deepEqual(mouvements, [
    { compteBancaireId: 12, compteComptableId: COMPTE_521, mouvementNet: -1800000, type: 'decaissement' },
  ]);
});

test('encaissement client en caisse : encaissement de 88 500 sur la caisse seule', () => {
  const mouvements = mouvementsTresorerieParCompte({
    lignes: [
      ligne(COMPTE_571, 88500, 0),
      ligne(COMPTE_411, 0, 88500),
    ],
    comptesBancaires: COMPTES,
  });
  assert.deepEqual(mouvements, [
    { compteBancaireId: 13, compteComptableId: COMPTE_571, mouvementNet: 88500, type: 'encaissement' },
  ]);
});

test('écriture sans compte de trésorerie : aucun mouvement', () => {
  const mouvements = mouvementsTresorerieParCompte({
    lignes: [
      ligne(COMPTE_411, 88500, 0),
      ligne(COMPTE_101, 0, 88500),
    ],
    comptesBancaires: COMPTES,
  });
  assert.deepEqual(mouvements, []);
});

test('mouvement net nul sur un compte lié : ignoré', () => {
  const mouvements = mouvementsTresorerieParCompte({
    lignes: [
      ligne(COMPTE_521, 100000, 100000),
      ligne(COMPTE_571, 50000, 0),
    ],
    comptesBancaires: COMPTES,
  });
  assert.deepEqual(mouvements, [
    { compteBancaireId: 13, compteComptableId: COMPTE_571, mouvementNet: 50000, type: 'encaissement' },
  ]);
});

test('scénario 2026 : banque et caisse du module rejoignent la comptabilité', () => {
  // Écarts du rapport : banque +200 000 (AN +2 000 000, SA −1 800 000),
  // caisse +1 482 000 (AN +500 000, 12 encaissements B de 88 500,
  // 4 transports de 20 000 en caisse — jamais synchronisés).
  const ecritures = [
    { lignes: [ligne(COMPTE_521, 2000000, 0), ligne(COMPTE_571, 500000, 0)] },
    { lignes: [ligne(COMPTE_661, 1800000, 0), ligne(COMPTE_521, 0, 1800000)] },
    ...Array.from({ length: 12 }, () => ({
      lignes: [ligne(COMPTE_571, 88500, 0), ligne(COMPTE_411, 0, 88500)],
    })),
    ...Array.from({ length: 4 }, () => ({
      lignes: [ligne(1400, 20000, 0), ligne(COMPTE_571, 0, 20000)],
    })),
  ];
  const totaux = new Map();
  for (const ecriture of ecritures) {
    for (const mouvement of mouvementsTresorerieParCompte({ lignes: ecriture.lignes, comptesBancaires: COMPTES })) {
      const signe = mouvement.type === 'encaissement' ? 1 : -1;
      totaux.set(
        mouvement.compteBancaireId,
        (totaux.get(mouvement.compteBancaireId) || 0) + signe * Math.abs(mouvement.mouvementNet),
      );
    }
  }
  assert.equal(totaux.get(12), 200000);
  assert.equal(totaux.get(13), 1482000);
});
