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

test('l’offre distingue la saisie manuelle, l’OCR et le calcul Premium', () => {
  assert.match(offer, /Coût de revient et prix de vente définis manuellement/);
  assert.match(offer, /Lecture OCR des factures fournisseurs par photo/);
  assert.match(offer, /Coût moyen pondéré calculé depuis les réceptions/);
  assert.match(offer, /29 900,00 XOF/);
  assert.match(offer, /lien WhatsApp/);
});
