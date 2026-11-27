// Paiement d'impôt — même piège que l'anomalie B des dépenses (f71de5c) :
// createEcriturePaiementImpot résolvait la trésorerie par préfixe
// (`numero LIKE '52%'` sans ORDER BY), ce qui retournait le compte
// générique 52 au lieu du 521 précis — 52 créditeur visible en dettes.
// Corrigé comme le remboursement : getCompteTresorerie (compte bancaire
// configuré, sinon 521 / 571 exact, préfixe seulement en repli). Le côté
// débit a été corrigé de la même façon : 4434 / 44 résolus par égalité
// exacte (rôle vat_payable / tax_payable pour un plan PERSONNALISE) —
// le LIKE '44%' dépendait de l'ordre d'insertion du plan et retournait
// 4434 avant 44 quand 4434 était inséré en premier (test ci-dessous :
// le plan simulé liste 4434 avant 44 pour prouver l'indépendance à l'ordre).
//
// Ces tests n'utilisent aucune base : la fonction reçoit un exécuteur
// simulé qui évalue les clauses WHERE Drizzle (égalité exacte vs LIKE
// préfixe) sur un plan comptable SYSCOHADA miniature. Le préfixe y
// retourne le compte de plus petit id — comme en production, où le 52
// générique est inséré avant 521 : un code qui résout encore la banque
// par préfixe créditerait le 52 et ferait échouer ces tests.
//
// db.js exige DATABASE_URL à l'import : une valeur factice suffit, les
// fonctions testées reçoivent l'exécuteur simulé et ne touchent jamais
// la vraie base.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comptesComptables,
  comptesBancaires,
  ecritures,
  journaux,
  lignesEcritures,
} from '../src/schema.js';

const { createEcriturePaiementImpot } = await import(
  '../src/services/comptabiliteService.js'
);

// Plan SYSCOHADA miniature (ids = ordre d'insertion du plan par défaut) :
// le compte générique 52 (id 10) précède 521 (id 12), comme le 57
// générique (id 30) précède 571 (id 31).
const COMPTE_52_GENERIQUE = { id: 10, numero: '52', nom: 'Banques (compte principal)', actif: true };
const COMPTE_521 = { id: 12, numero: '521', nom: 'Banques', actif: true };
const COMPTE_5121 = { id: 13, numero: '5121', nom: 'Banque principale', actif: true };
const COMPTE_57_GENERIQUE = { id: 30, numero: '57', nom: 'Caisse (compte principal)', actif: true };
const COMPTE_571 = { id: 31, numero: '571', nom: 'Caisse', actif: true };
const COMPTE_4434 = { id: 50, numero: '4434', nom: 'État - TVA due', actif: true };
const COMPTE_44 = { id: 51, numero: '44', nom: 'État et collectivités publiques', actif: true };

const JOURNAL_BQ = { id: 5, code: 'BQ', nom: 'Journal de Banque', type: 'banque' };
const JOURNAL_CA = { id: 6, code: 'CA', nom: 'Journal de Caisse', type: 'caisse' };
const JOURNAL_OD = { id: 9, code: 'OD', nom: 'Journal des opérations diverses', type: 'od' };

function defaultAccounts() {
  return [
    COMPTE_52_GENERIQUE,
    COMPTE_521,
    COMPTE_5121,
    COMPTE_57_GENERIQUE,
    COMPTE_571,
    COMPTE_4434,
    COMPTE_44,
  ];
}

// Aplatit une clause WHERE Drizzle en jetons ordonnés (colonnes,
// opérateurs, valeurs) pour distinguer une égalité exacte d'un LIKE.
function flattenWhere(node, tokens = [], seen = new Set(), depth = 0) {
  if (node === null || node === undefined || depth > 8) return tokens;
  if (typeof node === 'string') {
    tokens.push({ str: node });
    return tokens;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => flattenWhere(child, tokens, seen, depth + 1));
    return tokens;
  }
  if (typeof node === 'object') {
    if (seen.has(node)) return tokens;
    seen.add(node);
    if (Array.isArray(node.value)) {
      node.value.forEach((s) => {
        if (typeof s === 'string') tokens.push({ str: s });
      });
    } else if (typeof node.value === 'string' || typeof node.value === 'number') {
      tokens.push({ param: node.value });
      return tokens;
    }
    if (typeof node.name === 'string' && node.table) {
      tokens.push({ col: node.name });
      return tokens;
    }
    for (const key of Object.keys(node)) {
      if (['value', 'name', 'table', 'encoder', 'decoder', 'usedTables'].includes(key)) continue;
      flattenWhere(node[key], tokens, seen, depth + 1);
    }
  }
  return tokens;
}

function createFakeExecutor({ accounts = defaultAccounts(), bankLinks = [] } = {}) {
  const journals = [JOURNAL_BQ, JOURNAL_CA, JOURNAL_OD];
  const insertedEcritures = [];
  const insertedLignes = [];
  let nextId = 100;

  function resolveSelect(table, clause) {
    const tokens = flattenWhere(clause);
    if (table === comptesComptables) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].col === 'numero' && tokens[i + 1]?.str?.includes('=')) {
          const value = tokens[i + 2]?.param;
          if (value !== undefined) return accounts.filter((a) => String(a.numero) === String(value));
        }
        if (tokens[i].col === 'numero' && tokens[i + 1]?.str?.includes('LIKE')) {
          const value = tokens[i + 2]?.str;
          if (typeof value === 'string' && value.endsWith('%')) {
            const prefix = value.slice(0, -1);
            return accounts
              .filter((a) => String(a.numero).startsWith(prefix))
              .sort((a, b) => a.id - b.id);
          }
        }
        if (tokens[i].col === 'id' && tokens[i + 1]?.str?.includes('=')) {
          const value = tokens[i + 2]?.param;
          if (value !== undefined) return accounts.filter((a) => a.id === Number(value));
        }
      }
      return [];
    }
    if (table === journaux) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].col === 'code' && tokens[i + 2]?.param !== undefined) {
          return journals.filter((j) => j.code === String(tokens[i + 2].param));
        }
      }
      return [];
    }
    if (table === comptesBancaires) {
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].col === 'id' && tokens[i + 2]?.param !== undefined) {
          return bankLinks.filter((b) => b.id === Number(tokens[i + 2].param));
        }
      }
      return [];
    }
    // entreprises (système comptable : aucune ligne = SYSCOHADA par défaut,
    // donc pas de mapping personnalisé), ecritures (pas de doublon).
    return [];
  }

  const executor = {
    select() {
      return {
        from(table) {
          return {
            where(clause) {
              return {
                limit(n) {
                  const rows = resolveSelect(table, clause);
                  return Promise.resolve(n === 1 ? rows.slice(0, 1) : rows);
                },
              };
            },
          };
        },
      };
    },
    insert(table) {
      return {
        values(row) {
          const inserted = { ...row, id: nextId++ };
          if (table === ecritures) insertedEcritures.push(inserted);
          if (table === lignesEcritures) insertedLignes.push(row);
          const promise = Promise.resolve([inserted]);
          return Object.assign(promise, { returning: () => Promise.resolve([inserted]) });
        },
      };
    },
    execute: async () => ({ rows: [{ derniere_sequence: 1 }] }),
    update() {
      throw new Error('update() inattendu dans ce test');
    },
  };
  return { executor, insertedEcritures, insertedLignes };
}

const baseParams = {
  entrepriseId: 1,
  reference: 'IMPOT-2026-T4',
  datePaiement: new Date('2026-11-27'),
  montant: '54000.00',
  periode: 'T4 2026',
};

test('paiement TVA par virement : D 4434 soldé / C 521 (jamais le 52 générique)', async () => {
  const { executor, insertedEcritures, insertedLignes } = createFakeExecutor();
  const ecriture = await createEcriturePaiementImpot({
    ...baseParams,
    typeImpot: 'tva',
    modePaiement: 'virement',
    executor,
  });

  assert.equal(ecriture.numeroPiece, 'IMPOT-2026-T4');
  assert.equal(ecriture.journalId, JOURNAL_BQ.id);
  assert.equal(ecriture.totalDebit, '54000.00');
  assert.equal(ecriture.totalCredit, '54000.00');
  assert.equal(insertedEcritures.length, 1);
  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_4434.id, debit: '54000.00', credit: '0.00' },
      { compteComptableId: COMPTE_521.id, debit: '0.00', credit: '54000.00' },
    ],
  );
});

test('paiement autre impôt en espèces : D 44 / C 571 (jamais le 57 générique)', async () => {
  const { executor, insertedLignes } = createFakeExecutor();
  await createEcriturePaiementImpot({
    ...baseParams,
    typeImpot: 'autre',
    modePaiement: 'especes',
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_44.id, debit: '54000.00', credit: '0.00' },
      { compteComptableId: COMPTE_571.id, debit: '0.00', credit: '54000.00' },
    ],
  );
});

test('avec un compte bancaire configuré, le paiement utilise son compte comptable', async () => {
  const { executor, insertedLignes } = createFakeExecutor({
    bankLinks: [{ id: 7, compteComptableId: COMPTE_5121.id, entrepriseId: 1, actif: true }],
  });
  await createEcriturePaiementImpot({
    ...baseParams,
    typeImpot: 'tva',
    modePaiement: 'virement',
    compteBancaireId: 7,
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_4434.id, debit: '54000.00', credit: '0.00' },
      { compteComptableId: COMPTE_5121.id, debit: '0.00', credit: '54000.00' },
    ],
  );
});

test('plan sans compte 521 : repli sur le 52 sans planter (dégradation gracieuse)', async () => {
  const { executor, insertedLignes } = createFakeExecutor({
    accounts: defaultAccounts().filter((a) => a.numero !== '521'),
  });
  await createEcriturePaiementImpot({
    ...baseParams,
    typeImpot: 'tva',
    modePaiement: 'virement',
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_4434.id, debit: '54000.00', credit: '0.00' },
      { compteComptableId: COMPTE_52_GENERIQUE.id, debit: '0.00', credit: '54000.00' },
    ],
  );
});
