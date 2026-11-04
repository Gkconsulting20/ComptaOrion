import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThirdPartyStatement } from '../src/services/thirdPartyLedger.js';

test('état client inclut les règlements de la période pour une facture antérieure', () => {
  const statement = buildThirdPartyStatement({
    side: 'client',
    dateDebut: '2026-02-01',
    dateFin: '2026-02-28',
    openingBalance: 25,
    invoices: [
      { id: 1, statut: 'envoyee', dateFacture: '2026-01-10', totalTTC: '100.00', numeroFacture: 'V-001' },
      { id: 2, statut: 'brouillon', dateFacture: '2026-02-05', totalTTC: '500.00', numeroFacture: 'V-002' },
      { id: 3, statut: 'envoyee', dateFacture: '2026-02-10', totalTTC: '40.00', numeroFacture: 'V-003' },
    ],
    payments: [
      { id: 1, factureId: 1, datePaiement: '2026-02-12', montant: '30.00', reference: 'R-001' },
    ],
  });

  assert.equal(statement.soldeOuverture, 125);
  assert.equal(statement.totalFacture, 40);
  assert.equal(statement.totalPaye, 30);
  assert.equal(statement.soldeCloture, 135);
  assert.deepEqual(statement.mouvements.map(row => [row.debit, row.credit, row.solde]), [
    [40, 0, 165],
    [0, 30, 135],
  ]);
});

test('état fournisseur utilise le TTC et présente facture au crédit, règlement au débit', () => {
  const statement = buildThirdPartyStatement({
    side: 'fournisseur',
    dateDebut: '2026-03-01',
    dateFin: '2026-03-31',
    invoices: [
      { id: 7, statut: 'payee', dateFacture: '2026-03-02', totalHT: '100.00', totalTTC: '118.00', numeroFacture: 'A-007' },
    ],
    payments: [
      { id: 4, factureId: 7, datePaiement: '2026-03-10', montant: '50.00', reference: 'PF-004' },
    ],
  });

  assert.equal(statement.totalFacture, 118);
  assert.equal(statement.totalPaye, 50);
  assert.equal(statement.solde, 68);
  assert.deepEqual(statement.mouvements.map(row => [row.debit, row.credit, row.solde]), [
    [0, 118, 118],
    [50, 0, 68],
  ]);
});

test('refuse une période inversée', () => {
  assert.throws(() => buildThirdPartyStatement({
    side: 'client',
    dateDebut: '2026-04-01',
    dateFin: '2026-03-31',
  }), /période/i);
});

test('un avoir client diminue le solde dû et apparaît au crédit du relevé', () => {
  const statement = buildThirdPartyStatement({
    side: 'client',
    dateDebut: '2026-03-01',
    dateFin: '2026-03-31',
    invoices: [{ id: 1, statut: 'payee', dateFacture: '2026-03-02', totalTTC: '118.00', numeroFacture: 'V-001' }],
    creditNotes: [{ id: 2, statut: 'validee', dateAvoir: '2026-03-12', montantTTC: '23.60', numero: 'AVC-2026-00000001' }],
  });
  assert.equal(statement.soldeCloture, 94.4);
  assert.equal(statement.totalAvoir, 23.6);
  assert.deepEqual(statement.mouvements.map(row => [row.libelle, row.debit, row.credit, row.solde]), [
    ['Facture client', 118, 0, 118],
    ['Avoir client', 0, 23.6, 94.4],
  ]);
});

test('un avoir fournisseur diminue le solde dû et apparaît au débit du relevé', () => {
  const statement = buildThirdPartyStatement({
    side: 'fournisseur',
    dateDebut: '2026-03-01',
    dateFin: '2026-03-31',
    invoices: [{ id: 1, statut: 'payee', dateFacture: '2026-03-02', totalTTC: '118.00', numeroFacture: 'A-001' }],
    creditNotes: [{ id: 2, statut: 'validee', dateAvoir: '2026-03-12', montantTTC: '23.60', numero: 'AVF-2026-000001' }],
  });
  assert.equal(statement.soldeCloture, 94.4);
  assert.equal(statement.totalAvoir, 23.6);
  assert.deepEqual(statement.mouvements.map(row => [row.libelle, row.debit, row.credit, row.solde]), [
    ['Facture fournisseur', 0, 118, 118],
    ['Avoir fournisseur', 23.6, 0, 94.4],
  ]);
});
