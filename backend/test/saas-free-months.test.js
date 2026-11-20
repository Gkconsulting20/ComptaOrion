import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_MONTHS_ON_SUBSCRIPTION,
  addMonths,
  billingStartDateFor,
  contributesToMrr,
  formatDateISO,
  paidMonthsFor,
  subscriptionSaleTerms,
} from '../src/services/subscriptionPricing.js';

// Offre de lancement (décision ORIONEXA, 20 nov. 2026) : 2 mois gratuits sur
// chaque nouvel abonnement payant ; essai 30 jours inchangé ; facturation au
// 3e mois ; commission due quand le client paie.

test('offre : 2 mois gratuits sur chaque abonnement payant', () => {
  assert.equal(FREE_MONTHS_ON_SUBSCRIPTION, 2);
});

test('12 mois au plan à 19 900 XOF : le client paie 10 mois (199 000), commission 19 900', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 19900,
    dureeEnMois: 12,
    tauxCommission: 0.10,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.duree, 12);
  assert.equal(terms.freeMonths, 2);
  assert.equal(terms.paidMonths, 10);
  assert.equal(terms.montantVente, 199000);
  assert.equal(terms.commission, 19900);
  assert.equal(formatDateISO(terms.billingStartDate), '2027-01-20');
});

test('6 mois au plan Base (9 900 XOF) : 4 mois payés (39 600), commission 3 960', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 9900,
    dureeEnMois: 6,
    tauxCommission: 0.10,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.paidMonths, 4);
  assert.equal(terms.montantVente, 39600);
  assert.equal(terms.commission, 3960);
});

test('durée de 2 mois : entièrement gratuit, montant 0, commission 0', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 19900,
    dureeEnMois: 2,
    tauxCommission: 0.10,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.paidMonths, 0);
  assert.equal(terms.montantVente, 0);
  assert.equal(terms.commission, 0);
  assert.equal(formatDateISO(terms.billingStartDate), '2027-01-20');
});

test('durée de 1 mois : entièrement gratuit, montant 0, commission 0', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 19900,
    dureeEnMois: 1,
    tauxCommission: 0.10,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.paidMonths, 0);
  assert.equal(terms.montantVente, 0);
  assert.equal(terms.commission, 0);
});

test('24 mois à 29 900 XOF : 22 mois payés (657 800), commission 65 780', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 29900,
    dureeEnMois: 24,
    tauxCommission: 0.10,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.paidMonths, 22);
  assert.equal(terms.montantVente, 657800);
  assert.equal(terms.commission, 65780);
});

test('sans taux de commission : commission 0 mais montant calculé', () => {
  const terms = subscriptionSaleTerms({
    prixMensuel: 19900,
    dureeEnMois: 12,
    tauxCommission: 0,
    dateDebut: new Date('2026-11-20'),
  });
  assert.equal(terms.montantVente, 199000);
  assert.equal(terms.commission, 0);
});

test('addMonths et facturation : début 2026-11-20 → facturation 2027-01-20', () => {
  assert.equal(formatDateISO(addMonths(new Date('2026-11-20'), 2)), '2027-01-20');
  assert.equal(formatDateISO(billingStartDateFor(new Date('2026-11-20'))), '2027-01-20');
  assert.equal(paidMonthsFor(12), 10);
  assert.equal(paidMonthsFor(2), 0);
  assert.equal(paidMonthsFor(1), 0);
});

test('MRR : période gratuite ne contribue pas, facturation commencée contribue', () => {
  const enPeriodeGratuite = {
    statut: 'actif',
    dateDebutFacturation: '2027-01-20',
    dureeEnMois: 12,
    moisGratuits: 2,
  };
  assert.equal(contributesToMrr(enPeriodeGratuite, '2026-12-15'), false);
  assert.equal(contributesToMrr(enPeriodeGratuite, '2027-01-20'), true);
  assert.equal(contributesToMrr(enPeriodeGratuite, '2027-03-01'), true);
});

test('MRR : abonnement de 2 mois (aucun mois payé) ne contribue jamais', () => {
  const deuxMois = {
    statut: 'actif',
    dateDebutFacturation: '2027-01-20',
    dureeEnMois: 2,
    moisGratuits: 2,
  };
  assert.equal(contributesToMrr(deuxMois, '2027-01-20'), false);
  assert.equal(contributesToMrr(deuxMois, '2027-06-01'), false);
});

test('MRR : ligne ancienne (sans les nouveaux champs) contribue normalement', () => {
  const ancienne = { statut: 'actif', dateDebutFacturation: null, dureeEnMois: null, moisGratuits: null };
  assert.equal(contributesToMrr(ancienne, '2026-12-15'), true);
});

test('MRR : abonnement non actif ne contribue pas', () => {
  const suspendu = {
    statut: 'suspendu',
    dateDebutFacturation: '2026-11-20',
    dureeEnMois: 12,
    moisGratuits: 2,
  };
  assert.equal(contributesToMrr(suspendu, '2027-03-01'), false);
});
