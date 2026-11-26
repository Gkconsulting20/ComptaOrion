// Erreur E2 de l'exercice 2026 : annuler une facture (PUT statut
// annulee) ne contre-passait rien — 701 surévalué de 75 000, 443 de
// 13 500, 4112 soldé de 88 500 ; résultat affiché −2 205 000 au lieu
// de −2 280 000, TVA T1 polluée (108 000 au lieu de 94 500).
//
// La création passe D 411 / C 701 + C 443 ; l'annulation d'une facture
// brouillon doit l'effacer exactement (D 701 / D 443 / C 411). Une
// facture validée ne peut pas être annulée directement (il faut un
// avoir, compte 709) ; une facture déjà payée non plus.
//
// Ces tests portent sur les lignes pures de la contrepassation
// (services/comptabiliteService.js, sans base de données) : elles
// annulent exactement l'écriture d'origine, pour les montants du
// rapport comme pour une facture sans TVA.

import test from 'node:test';
import assert from 'node:assert/strict';
import { lignesAnnulationFactureVente } from '../src/services/comptabiliteService.js';

// Comptes du rapport : 4112 (client B), 701 (ventes), 443 (TVA).
const COMPTES = { client: 1263, ventes: 1436, tva: 1282 };

// Écriture d'origine de la facture annulée FACT-2026-16-0002 :
// D 4112 88 500 / C 701 75 000 + C 443 13 500.
const ECRITURE_ORIGINE = [
  { compteComptableId: 1263, debit: 88500, credit: 0 },
  { compteComptableId: 1436, debit: 0, credit: 75000 },
  { compteComptableId: 1282, debit: 0, credit: 13500 },
];

function solderParCompte(lignes) {
  const soldes = new Map();
  for (const ligne of lignes) {
    const precedent = soldes.get(ligne.compteComptableId) || 0;
    soldes.set(
      ligne.compteComptableId,
      precedent + Number(ligne.debit || 0) - Number(ligne.credit || 0),
    );
  }
  return soldes;
}

test('annulation de la facture du rapport : D 701 / D 443 / C 4112, équilibrée', () => {
  const lignes = lignesAnnulationFactureVente({
    compteClientId: COMPTES.client,
    compteVentesId: COMPTES.ventes,
    compteTvaId: COMPTES.tva,
    totalHT: 75000,
    totalTVA: 13500,
    totalTTC: 88500,
    numeroFacture: 'FACT-2026-16-0002',
    clientNom: 'Boutique Akou',
  });
  assert.deepEqual(
    lignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: 1436, debit: 75000, credit: 0 },
      { compteComptableId: 1282, debit: 13500, credit: 0 },
      { compteComptableId: 1263, debit: 0, credit: 88500 },
    ],
  );
  const totalDebit = lignes.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lignes.reduce((s, l) => s + l.credit, 0);
  assert.equal(totalDebit, totalCredit);
});

test('origine + annulation = 0 sur chaque compte : résultat et TVA restaurés', () => {
  const lignes = lignesAnnulationFactureVente({
    compteClientId: COMPTES.client,
    compteVentesId: COMPTES.ventes,
    compteTvaId: COMPTES.tva,
    totalHT: 75000,
    totalTVA: 13500,
    totalTTC: 88500,
    numeroFacture: 'FACT-2026-16-0002',
    clientNom: 'Boutique Akou',
  });
  const soldes = solderParCompte([...ECRITURE_ORIGINE, ...lignes]);
  assert.equal(soldes.get(1436), 0); // 701 : +75 000 puis −75 000
  assert.equal(soldes.get(1282), 0); // 443 : +13 500 puis −13 500
  assert.equal(soldes.get(1263), 0); // 4112 : soldé
});

test('facture sans TVA : annulation sans ligne 443, toujours équilibrée', () => {
  const lignes = lignesAnnulationFactureVente({
    compteClientId: COMPTES.client,
    compteVentesId: COMPTES.ventes,
    compteTvaId: COMPTES.tva,
    totalHT: 50000,
    totalTVA: 0,
    totalTTC: 50000,
    numeroFacture: 'FACT-2026-16-0009',
    clientNom: 'Client exonéré',
  });
  assert.deepEqual(
    lignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: 1436, debit: 50000, credit: 0 },
      { compteComptableId: 1263, debit: 0, credit: 50000 },
    ],
  );
});

test('la route PUT annule une facture brouillon avec contrepassation, jamais une facture payée', async () => {
  // Vérification de câblage (la logique comptable est testée ci-dessus,
  // l’API complète exige une base) : la route importe le helper, refuse
  // l’annulation d’une facture payée et restaure le statut si la
  // contrepassation échoue.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../src/routes/factures.js', import.meta.url), 'utf8',
  );
  assert.match(source, /createEcritureAnnulationFactureVente/);
  assert.match(source, /Une facture déjà payée ne peut pas être annulée directement/);
  assert.match(source, /remet la facture en brouillon/);
});
