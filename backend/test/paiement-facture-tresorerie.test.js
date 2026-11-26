// Erreur 3 de l'exercice 2026 : POST /factures/:id/paiement insérait
// type = 'entree' dans transactions_tresorerie, alors que l'enum
// transaction_type ne contient que 'encaissement' et 'decaissement'
// -> HTTP 500 systématique, aucun encaissement client possible via le
// module Factures. Les trois inserts concernés (paiement de facture,
// règlement de note de crédit, encaissement de chèque) sont des entrées
// d'argent : la valeur correcte comptablement est 'encaissement'.
// Le paiement fournisseur, lui, insère déjà 'decaissement'.
//
// Ces tests vérifient, sans base de données, que chaque insert dans
// transactions_tresorerie du code utilise une valeur de l'enum —
// 'entree'/'sortie' restent réservés aux mouvements de stock
// (enum stock_movement_type), jamais à la trésorerie.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transactionTypeEnum } from '../src/schema.js';

const VALEURS_ENUM = [...transactionTypeEnum.enumValues];
const FICHIERS = [
  '../src/routes/factures.js',
  '../src/routes/achats.js',
  '../src/services/treasuryJournalSync.js',
];

async function typesLitterauxApresInsert(source, index) {
  // Type littéral éventuel dans les ~800 caractères qui suivent chaque
  // insert(transactionsTresorerie) (l'objet values est adjacent).
  const fenetre = source.slice(index, index + 800);
  const match = fenetre.match(/type:\s*'([^']+)'/);
  return match ? match[1] : null;
}

test("l'enum transaction_type ne contient que encaissement et decaissement", () => {
  assert.deepEqual([...VALEURS_ENUM].sort(), ['decaissement', 'encaissement']);
});

test('chaque insert dans transactions_tresorerie utilise une valeur de l’enum', async () => {
  for (const fichier of FICHIERS) {
    const source = await readFile(new URL(fichier, import.meta.url), 'utf8');
    const marqueur = 'insert(transactionsTresorerie)';
    let position = source.indexOf(marqueur);
    let trouves = 0;
    while (position !== -1) {
      trouves += 1;
      const type = await typesLitterauxApresInsert(source, position);
      if (type !== null) {
        assert.ok(
          VALEURS_ENUM.includes(type),
          `${fichier} : type '${type}' hors enum transaction_type`,
        );
      }
      position = source.indexOf(marqueur, position + marqueur.length);
    }
    assert.ok(trouves > 0, `${fichier} : aucun insert transactions_tresorerie trouvé`);
  }
});

test("aucun insert de trésorerie n'utilise 'entree' ou 'sortie'", async () => {
  for (const fichier of FICHIERS) {
    const source = await readFile(new URL(fichier, import.meta.url), 'utf8');
    let position = source.indexOf('insert(transactionsTresorerie)');
    while (position !== -1) {
      const fenetre = source.slice(position, position + 800);
      assert.doesNotMatch(fenetre, /type:\s*'(entree|sortie)'/,
        `${fichier} : type de mouvement de stock utilisé en trésorerie`);
      position = source.indexOf('insert(transactionsTresorerie)', position + 1);
    }
  }
});
