import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFiscalClosing,
  getFiscalPeriodForYear
} from '../src/services/fiscalYearClosing.js';

test('calcule les dates d’un exercice décalé selon le calendrier fiscal configuré', () => {
  assert.deepEqual(
    getFiscalPeriodForYear('2025-04-01', '2026-03-31', 2026),
    {
      fiscalYear: 2026,
      dateDebut: '2026-04-01',
      dateFin: '2027-03-31',
      dateOuvertureSuivante: '2027-04-01',
      exerciceSuivant: 2027
    }
  );
});

test('la clôture d’un bénéfice crédite le résultat et reprend les soldes historiques', () => {
  const period = getFiscalPeriodForYear('2025-01-01', '2025-12-31', 2025);
  const rows = [
    { date: '2024-12-31', compteComptableId: 1, numero: '311', nom: 'Stock', debit: '1000', credit: '0' },
    { date: '2024-12-31', compteComptableId: 2, numero: '101', nom: 'Capital', debit: '0', credit: '1000' },
    { date: '2025-04-10', compteComptableId: 3, numero: '701', nom: 'Ventes', debit: '0', credit: '1500' },
    { date: '2025-04-10', compteComptableId: 5, numero: '512', nom: 'Banque', debit: '1500', credit: '0' },
    { date: '2025-05-10', compteComptableId: 4, numero: '601', nom: 'Achats', debit: '1000', credit: '0' },
    { date: '2025-05-10', compteComptableId: 5, numero: '512', nom: 'Banque', debit: '0', credit: '1000' },
    { date: '2026-01-01', compteComptableId: 6, numero: '702', nom: 'Ventes suivantes', debit: '0', credit: '999' }
  ];

  const result = calculateFiscalClosing(rows, period, { id: 7, numero: '120', nom: 'Bénéfice' });
  assert.equal(result.resultatNet, 500);
  assert.equal(result.typeResultat, 'benefice');
  assert.equal(result.comptesResultat.totalProduits, 1500);
  assert.equal(result.comptesResultat.totalCharges, 1000);
  assert.equal(result.totalDebitClotureCents, 150000);
  assert.equal(result.totalCreditClotureCents, 150000);

  const openingBalances = new Map(result.lignesOuverture.map((line) => [
    line.compteComptableId,
    { debit: line.debitCents, credit: line.creditCents }
  ]));
  assert.deepEqual(openingBalances.get(1), { debit: 100000, credit: 0 });
  assert.deepEqual(openingBalances.get(2), { debit: 0, credit: 100000 });
  assert.deepEqual(openingBalances.get(5), { debit: 50000, credit: 0 });
  assert.deepEqual(openingBalances.get(7), { debit: 0, credit: 50000 });
  assert.equal(result.totalDebitOuvertureCents, result.totalCreditOuvertureCents);
});

test('la clôture d’une perte débite le compte de résultat et reste équilibrée', () => {
  const period = getFiscalPeriodForYear('2025-01-01', '2025-12-31', 2025);
  const rows = [
    { date: '2025-02-01', compteComptableId: 10, numero: '701', nom: 'Ventes', debit: '0', credit: '40' },
    { date: '2025-02-01', compteComptableId: 13, numero: '512', nom: 'Banque', debit: '40', credit: '0' },
    { date: '2025-03-01', compteComptableId: 11, numero: '601', nom: 'Achats', debit: '100', credit: '0' },
    { date: '2025-03-01', compteComptableId: 13, numero: '512', nom: 'Banque', debit: '0', credit: '100' }
  ];

  const result = calculateFiscalClosing(rows, period, { id: 12, numero: '129', nom: 'Perte' });
  assert.equal(result.resultatNet, -60);
  assert.equal(result.typeResultat, 'perte');
  assert.equal(result.compteResultatNumero, '129');
  assert.equal(result.totalDebitClotureCents, 10000);
  assert.equal(result.totalCreditClotureCents, 10000);
  assert.equal(result.totalDebitOuvertureCents, 6000);
  assert.equal(result.totalCreditOuvertureCents, 6000);
});

test('ne recompte pas les soldes antérieurs déjà repris par l’écriture d’ouverture', () => {
  const period = {
    ...getFiscalPeriodForYear('2025-01-01', '2025-12-31', 2026),
    balanceStartDate: '2026-01-01'
  };
  const rows = [
    { date: '2025-12-31', compteComptableId: 20, numero: '311', nom: 'Stock', debit: '100', credit: '0' },
    { date: '2025-12-31', compteComptableId: 21, numero: '101', nom: 'Capital', debit: '0', credit: '100' },
    { date: '2026-01-01', compteComptableId: 20, numero: '311', nom: 'Stock', debit: '100', credit: '0' },
    { date: '2026-01-01', compteComptableId: 21, numero: '101', nom: 'Capital', debit: '0', credit: '100' },
    { date: '2026-02-01', compteComptableId: 22, numero: '701', nom: 'Ventes', debit: '0', credit: '200' },
    { date: '2026-02-01', compteComptableId: 23, numero: '512', nom: 'Banque', debit: '200', credit: '0' },
    { date: '2026-03-01', compteComptableId: 24, numero: '601', nom: 'Charges', debit: '50', credit: '0' },
    { date: '2026-03-01', compteComptableId: 23, numero: '512', nom: 'Banque', debit: '0', credit: '50' }
  ];

  const result = calculateFiscalClosing(rows, period, { id: 25, numero: '120', nom: 'Bénéfice' });
  const openingBalances = new Map(result.lignesOuverture.map((line) => [
    line.compteComptableId,
    { debit: line.debitCents, credit: line.creditCents }
  ]));
  assert.deepEqual(openingBalances.get(20), { debit: 10000, credit: 0 });
  assert.deepEqual(openingBalances.get(21), { debit: 0, credit: 10000 });
  assert.deepEqual(openingBalances.get(23), { debit: 15000, credit: 0 });
  assert.deepEqual(openingBalances.get(25), { debit: 0, credit: 15000 });
  assert.equal(result.totalDebitOuvertureCents, result.totalCreditOuvertureCents);
});

test('rejette une période invalide au lieu de produire des dates ambiguës', () => {
  assert.throws(
    () => getFiscalPeriodForYear('2025-12-31', '2025-01-01', 2025),
    /invalides/
  );
});
