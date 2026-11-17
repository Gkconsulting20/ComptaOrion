import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guide = readFileSync(new URL('../../docs/Guide-demarrage-ComptaOrion.html', import.meta.url), 'utf8');
const offer = readFileSync(new URL('../src/pages/CommercialOffers.jsx', import.meta.url), 'utf8');

test('le guide explique les forfaits, le test de 30 jours et les règles de coût', () => {
  assert.match(guide, /Essai gratuit de 30 jours/);
  assert.match(guide, /En Base et Standard, renseignez vous-même le coût de revient et le prix de vente/);
  assert.match(guide, /En Premium et pendant l’essai/);
  assert.match(guide, /prix du devis fournisseur constitue un coût standard de référence/);
  assert.match(guide, /prix de vente calculé n’est pas disponible/);
});

test('le guide couvre commandes de stock, retours, chèques et rapports compacts', () => {
  assert.match(guide, /frais logistiques prévisionnels/);
  assert.match(guide, /Après la réception, le bon n’est plus modifiable/);
  assert.match(guide, /saisie directe des factures fournisseur/);
  assert.match(guide, /note de débit client/i);
  assert.match(guide, /compte « chèques à encaisser »/);
  assert.match(guide, /sélecteur compact en haut de l’écran/);
});

test('le guide décrit le verrouillage annuel et la réouverture avec audit', () => {
  assert.match(guide, /Comptabilité → Paramètres → Clôture Exercice/);
  assert.match(guide, /journal OD/);
  assert.match(guide, /journal AN/);
  assert.match(guide, /bloque les nouvelles écritures, modifications et suppressions/i);
  assert.match(guide, /Seul l’administrateur peut réouvrir l’exercice en indiquant un motif/i);
  assert.match(guide, /contrepassation/i);
  assert.match(guide, /ne ferme pas séparément les mois/i);
});

test('l’offre distingue la saisie manuelle, l’OCR et le calcul Premium', () => {
  assert.match(offer, /Coût de revient et prix de vente définis manuellement/);
  assert.match(offer, /Lecture OCR des factures fournisseurs par photo/);
  assert.match(offer, /Coût moyen pondéré calculé depuis les réceptions/);
  assert.match(offer, /29 900,00 XOF/);
  assert.match(offer, /lien WhatsApp/);
});

test('les prix du guide restent alignés sur les trois forfaits de l’offre', () => {
  const prices = [...offer.matchAll(/(?:monthlyPrice|annualPrice): '([^']+)'/g)].map(match => match[1]);
  assert.equal(prices.length, 6, 'Trois prix mensuels et trois prix annuels doivent être documentés');
  for (const price of prices) assert.ok(guide.includes(price), `Prix absent du guide : ${price}`);
});

test('le guide explique les comptes collectifs et le parcours réception vers facture', () => {
  assert.match(guide, /4111 pour les ventes de biens et 4112 pour les prestations de services/);
  assert.match(guide, /écriture comptable enregistrée est immédiatement validée/);
  assert.match(guide, /poids par unité et l’unité de poids/);
  assert.match(guide, /Si l’écart est nul, aucun compte d’écart n’est requis/);
  assert.match(guide, /pas de filtre de période/);
  assert.match(guide, /crédit du passif temporaire/);
  assert.doesNotMatch(guide, /Les écritures de tous les clients utilisent le compte collectif 4111/);
});

test('toutes les entrées du sommaire du guide pointent vers une section existante', () => {
  const ids = new Set([...guide.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  for (const [, anchor] of guide.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.has(anchor), `Section absente du guide : ${anchor}`);
  }
});

test('le guide distingue les possibilités fiscales des démarches officielles non intégrées', () => {
  const fiscalSection = guide.match(/<section id="impots">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(fiscalSection, 'La section Impôts doit être présente');
  for (const expected of [
    /Ce que vous pouvez faire/,
    /Ce que le module ne permet pas/,
    /Créer un brouillon TVA/,
    /enregistrer manuellement sa référence et sa date/,
    /Aucune connexion opérationnelle à l’OTR/,
    /Aucun paiement d’impôt depuis le module/,
    /Pas de calcul de l’impôt sur les sociétés dû/,
    /n’est pas le bénéfice imposable/,
    /ne vaut pas accusé de réception de l’administration/,
  ]) assert.match(fiscalSection, expected);
});
