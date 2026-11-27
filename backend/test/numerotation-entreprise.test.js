// Numérotation cloisonnée à l'entreprise (27 nov. 2026, ordre de Cap) :
// chaque numéro généré porte l'id de l'entreprise, et la contrainte
// d'unicité en base est composite (entreprise_id, numero) — un même numéro
// est toléré pour 2 entreprises différentes. Ces tests sont purs
// (aucune base) : ils couvrent les helpers de documentNumbering.js.
// La preuve base (contrainte composite acceptant le même numéro pour
// 2 entreprises) est faite en vérification live après déploiement.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextDevisNumber,
  nextCommandeAchatNumber,
  nextBonLivraisonNumber,
} from '../src/services/documentNumbering.js';
import { getNextPurchaseInvoiceNumber } from '../src/services/purchaseInvoiceNumber.js';

test('devis : premier numéro porte l’id entreprise', () => {
  assert.equal(nextDevisNumber(5, null, 2026), 'DEV-2026-5-0001');
  assert.equal(nextDevisNumber(9, undefined, 2026), 'DEV-2026-9-0001');
});

test('devis : la séquence continue depuis l’ancien format sans id', () => {
  assert.equal(nextDevisNumber(5, 'DEV-2026-0003', 2026), 'DEV-2026-5-0004');
});

test('devis : la séquence continue depuis le nouveau format avec id', () => {
  assert.equal(nextDevisNumber(5, 'DEV-2026-5-0004', 2026), 'DEV-2026-5-0005');
});

test('devis : deux entreprises, même séquence, numéros distincts', () => {
  assert.equal(nextDevisNumber(5, 'DEV-2026-0001', 2026), 'DEV-2026-5-0002');
  assert.equal(nextDevisNumber(9, 'DEV-2026-0001', 2026), 'DEV-2026-9-0002');
});

test('devis : changement d’année repart à 0001', () => {
  assert.equal(nextDevisNumber(5, 'DEV-2025-0007', 2026), 'DEV-2026-5-0001');
});

test('devis : id entreprise invalide rejeté', () => {
  assert.throws(() => nextDevisNumber(0, null, 2026));
  assert.throws(() => nextDevisNumber('abc', null, 2026));
});

test('bon de commande : premier numéro porte l’id entreprise', () => {
  assert.equal(nextCommandeAchatNumber(7, null, 2026), 'CMD-2026-7-0001');
});

test('bon de commande : séquence continue depuis l’ancien et le nouveau format', () => {
  assert.equal(nextCommandeAchatNumber(7, 'CMD-2026-0003', 2026), 'CMD-2026-7-0004');
  assert.equal(nextCommandeAchatNumber(7, 'CMD-2026-7-0004', 2026), 'CMD-2026-7-0005');
});

test('bon de commande : deux entreprises, même séquence, numéros distincts', () => {
  assert.equal(nextCommandeAchatNumber(7, 'CMD-2026-0001', 2026), 'CMD-2026-7-0002');
  assert.equal(nextCommandeAchatNumber(12, 'CMD-2026-0001', 2026), 'CMD-2026-12-0002');
});

test('bon de livraison : premier numéro porte l’id entreprise', () => {
  assert.equal(nextBonLivraisonNumber(5, null), 'BL-5-000001');
});

test('bon de livraison : séquence continue depuis l’ancien format', () => {
  assert.equal(nextBonLivraisonNumber(5, 'BL-000041'), 'BL-5-000042');
});

test('bon de livraison : séquence continue depuis le nouveau format (id au milieu)', () => {
  assert.equal(nextBonLivraisonNumber(5, 'BL-5-000042'), 'BL-5-000043');
  assert.equal(nextBonLivraisonNumber(12, 'BL-12-000009'), 'BL-12-000010');
});

test('bon de livraison : deux entreprises, même séquence, numéros distincts', () => {
  assert.equal(nextBonLivraisonNumber(5, 'BL-000001'), 'BL-5-000002');
  assert.equal(nextBonLivraisonNumber(9, 'BL-000001'), 'BL-9-000002');
});

test('facture achat : numéro porte l’id entreprise, séquence par entreprise', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, ['FACT-ACH-2025-000099', 'FACT-ACH-2026-000004']),
    'FACT-ACH-2026-5-000005',
  );
});

test('facture achat : l’ancien format sans id continue la séquence', () => {
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, ['FACT-ACH-2026-000002']),
    'FACT-ACH-2026-5-000003',
  );
});

test('facture achat : les numéros des autres entreprises sont ignorés (pas de saut global)', () => {
  // L'entreprise 5 n'a aucune facture en 2026 : elle commence à 000001,
  // même si l'entreprise 9 a déjà utilisé 000001 et 000002.
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 5, []),
    'FACT-ACH-2026-5-000001',
  );
  assert.equal(
    getNextPurchaseInvoiceNumber(2026, 9, []),
    'FACT-ACH-2026-9-000001',
  );
});
