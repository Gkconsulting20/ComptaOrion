// Erreur E3 de l'exercice 2026 : déclarations TVA impossibles.
// - Couche 1 (400) : POST /impots/declarations/tva exigeait le pays Togo
//   dans les paramètres fiscaux du module, alors que l'entreprise
//   déclare déjà pays = Togo. Corrigé par resolvePaysFiscal : les
//   paramètres du module priment, sinon le pays de l'entreprise.
// - Couche 2 (500) : l'insert dans declarations_fiscales échouait et le
//   serveur ne retournait que « Failed query: insert into... » sans la
//   cause Postgres (perdue dans error.cause). La cause exacte n'a pas pu
//   être établie sans accès à la base live : le seul risque structurel
//   identifié dans le chemin de la déclaration est le Promise.all des
//   deux requêtes de calculerTva sur le client unique de la transaction
//   (le résumé TVA, qui utilise le pool, fonctionne). Les requêtes sont
//   désormais séquentielles, et la cause est exposée dans la réponse
//   (champ detail) pour le diagnostic en direct après déploiement.
//   Le résumé TVA n'est pas touché (mêmes totaux, mêmes requêtes).

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerTva, resolvePaysFiscal } from '../src/routes/impots.js';

test('resolvePaysFiscal : paramètres du module, sinon pays de l’entreprise', () => {
  assert.equal(resolvePaysFiscal('Togo', 'Bénin'), 'togo');
  assert.equal(resolvePaysFiscal(null, 'Togo'), 'togo');
  assert.equal(resolvePaysFiscal(undefined, ' Togo '), 'togo');
  assert.equal(resolvePaysFiscal('', 'TOGO'), 'togo');
  assert.equal(resolvePaysFiscal('Bénin', 'Togo'), 'bénin');
  assert.equal(resolvePaysFiscal(null, null), null);
  assert.equal(resolvePaysFiscal('', ''), null);
});

test('calculerTva : mêmes totaux que le résumé, sans requêtes concurrentes', async () => {
  const responses = [
    { rows: [
      { numero: '443', nom: 'État - TVA facturée', montant: '94500.00' },
    ] },
    { rows: [
      { numero: '445', nom: 'État - TVA récupérable', montant: '133200.00' },
    ] },
  ];
  // Exécuteur qui refuse toute concurrence (une seule requête à la fois,
  // comme le client unique d'une transaction) : l'ancien Promise.all
  // échouait ici, les requêtes séquentielles passent.
  let enCours = 0;
  const executor = {
    execute: async () => {
      if (enCours > 0) throw new Error('requête concurrente sur le client de transaction');
      enCours += 1;
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return responses.shift();
      } finally {
        enCours -= 1;
      }
    },
  };
  const totaux = await calculerTva(12, '2026-10-01', '2026-12-31', executor);
  assert.equal(totaux.tvaCollectee, 94500);
  assert.equal(totaux.tvaDeductible, 133200);
  assert.equal(totaux.tvaADecaisser, -38700);
  assert.equal(totaux.creditTVA, 38700);
});
