// Anomalies Dépenses (vérification phase 3, 27 nov. 2026) :
// A — écriture de charge à zéro à l'approbation comptable (D 625 0 / C 421 0) :
//      Postgres renvoie les décimales en chaîne, « 0.00 » est truthy, donc
//      `montantApprouve || montant` ne basculait jamais sur le montant réel.
// B — remboursement crédité sur le compte générique 52 au lieu de 521 :
//      `numero LIKE '52%'` sans ORDER BY retourne le premier compte du
//      préfixe, soit le 52 générique (inséré avant 521 dans le plan SYSCOHADA).
//
// Ces tests n'utilisent aucune base : les services reçoivent un exécuteur
// simulé qui évalue les clauses WHERE Drizzle (égalité exacte vs LIKE
// préfixe) sur un plan comptable SYSCOHADA miniature. Le préfixe y
// retourne le compte de plus petit id — comme en production, où le 52
// générique est inséré avant 512/521 : un code qui résout encore la
// banque par préfixe créditerait le 52 et ferait échouer ces tests.

// db.js exige DATABASE_URL à l'import : une valeur factice suffit, les
// fonctions testées reçoivent l'exécuteur simulé et ne touchent jamais
// la vraie base.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comptesComptables,
  comptesBancaires,
  ecritures,
  journaux,
  lignesEcritures,
} from '../src/schema.js';

const { createEcritureChargeNoteFrais, createEcritureDepense } = await import(
  '../src/services/comptabiliteService.js'
);
const { resolveMontantApprouve } = await import('../src/routes/dépenses.js');

// Plan SYSCOHADA miniature (ids = ordre d'insertion du plan par défaut) :
// le compte générique 52 (id 10) précède 512 (id 11) et 521 (id 12),
// comme le 57 générique (id 30) précède 571 (id 31).
const COMPTE_52_GENERIQUE = { id: 10, numero: '52', nom: 'Banques (compte principal)', actif: true };
const COMPTE_512 = { id: 11, numero: '512', nom: 'Banques', actif: true };
const COMPTE_521 = { id: 12, numero: '521', nom: 'Banques', actif: true };
const COMPTE_5121 = { id: 13, numero: '5121', nom: 'Banque principale', actif: true };
const COMPTE_421 = { id: 20, numero: '421', nom: 'Personnel - Rémunérations dues', actif: true };
const COMPTE_57_GENERIQUE = { id: 30, numero: '57', nom: 'Caisse (compte principal)', actif: true };
const COMPTE_571 = { id: 31, numero: '571', nom: 'Caisse', actif: true };
const COMPTE_625 = { id: 40, numero: '625', nom: 'Déplacements, missions et réceptions', actif: true };

const JOURNAL_BQ = { id: 5, code: 'BQ', nom: 'Journal de Banque', type: 'banque' };
const JOURNAL_CA = { id: 6, code: 'CA', nom: 'Journal de Caisse', type: 'caisse' };
const JOURNAL_OD = { id: 9, code: 'OD', nom: 'Journal des opérations diverses', type: 'od' };

function defaultAccounts() {
  return [
    COMPTE_52_GENERIQUE,
    COMPTE_512,
    COMPTE_521,
    COMPTE_5121,
    COMPTE_421,
    COMPTE_57_GENERIQUE,
    COMPTE_571,
    COMPTE_625,
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
    // Colonne Drizzle : on retient son nom et on s'arrête là — ses autres
    // propriétés (type, nom unique…) pollueraient la séquence de jetons.
    if (typeof node.name === 'string' && node.table) {
      tokens.push({ col: node.name });
      return tokens;
    }
    for (const key of Object.keys(node)) {
      // queryChunks porte la condition ; usedTables ne ferait que répéter
      // les colonnes de la table et brouillerait la lecture des jetons.
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
    // donc pas de mapping personnalisé), ecritures (pas de doublon DEP-x).
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

// ==========================================
// ANOMALIE A — montant approuvé résolu numériquement
// ==========================================

test('A — « 0.00 » (chaîne Postgres) ne doit pas écraser le montant de la dépense', () => {
  // Cas vécu : montantApprouve vaut le défaut de création 0, renvoyé par
  // Postgres sous forme de chaîne « 0.00 » (truthy) — l'ancien
  // `montantApprouve || montant` gardait « 0.00 » et la charge sortait à 0.
  assert.equal(resolveMontantApprouve({ montantApprouve: '0.00', montant: '25000.00' }), 25000);
  assert.equal(resolveMontantApprouve({ montantApprouve: '0.00', montant: 25000 }), 25000);
  assert.equal(resolveMontantApprouve({ montantApprouve: 0, montant: '25000.00' }), 25000);
  assert.equal(resolveMontantApprouve({ montantApprouve: null, montant: '25000.00' }), 25000);
  assert.equal(resolveMontantApprouve({ montantApprouve: undefined, montant: '12000.50' }), 12000.5);
});

test('A — un montant approuvé strictement positif est respecté (approbation partielle)', () => {
  assert.equal(resolveMontantApprouve({ montantApprouve: '15000.00', montant: '25000.00' }), 15000);
  assert.equal(resolveMontantApprouve({ montantApprouve: '25000.00', montant: '25000.00' }), 25000);
});

test('A — la charge est comptabilisée au montant réel, ventilée par catégorie (D 625 / C 421)', async () => {
  const { executor, insertedEcritures, insertedLignes } = createFakeExecutor();
  const { ecriture } = await createEcritureChargeNoteFrais({
    entrepriseId: 1,
    depenseId: 1,
    dateDepense: new Date('2026-11-27'),
    description: 'Déplacement client',
    montant: resolveMontantApprouve({ montantApprouve: '0.00', montant: '25000.00' }),
    compteChargeId: COMPTE_625.id,
    executor,
  });

  assert.equal(ecriture.numeroPiece, 'DEP-1');
  assert.equal(ecriture.totalDebit, '25000.00');
  assert.equal(ecriture.totalCredit, '25000.00');
  assert.equal(insertedEcritures.length, 1);
  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_625.id, debit: '25000.00', credit: '0.00' },
      { compteComptableId: COMPTE_421.id, debit: '0.00', credit: '25000.00' },
    ],
  );
});

test('A — une charge de montant nul ou invalide ne crée aucune écriture', async () => {
  for (const montant of ['0.00', 0, 'abc', null, -500]) {
    const { executor, insertedEcritures, insertedLignes } = createFakeExecutor();
    await assert.rejects(
      () =>
        createEcritureChargeNoteFrais({
          entrepriseId: 1,
          depenseId: 1,
          dateDepense: new Date('2026-11-27'),
          description: 'Déplacement client',
          montant,
          compteChargeId: COMPTE_625.id,
          executor,
        }),
      /strictement positif/,
    );
    assert.equal(insertedEcritures.length, 0);
    assert.equal(insertedLignes.length, 0);
  }
});

// ==========================================
// ANOMALIE B — remboursement sur le compte de trésorerie précis
// ==========================================

test('B — remboursement par virement : D 421 soldé / C 521 (jamais le 52 générique)', async () => {
  // Cas vécu : le remboursement créditait le compte générique 52 (visible
  // en dettes dans les deux bilans, 421 débiteur 50 000, banque 521
  // inchangée). L'exécuteur simulé reproduit le piège : un LIKE '52%'
  // y retourne le 52 (plus petit id du préfixe) — ce test échouerait
  // avec l'ancienne résolution par préfixe.
  const { executor, insertedEcritures, insertedLignes } = createFakeExecutor();
  const ecriture = await createEcritureDepense({
    entrepriseId: 1,
    reference: 'RMB-1',
    dateRemboursement: new Date('2026-11-27'),
    employeNom: 'Employé Test',
    description: 'Déplacement client',
    montant: '25000.00',
    modePaiement: 'virement',
    executor,
  });

  assert.equal(ecriture.numeroPiece, 'RMB-1');
  assert.equal(ecriture.journalId, JOURNAL_BQ.id);
  assert.equal(ecriture.totalDebit, '25000.00');
  assert.equal(ecriture.totalCredit, '25000.00');
  assert.equal(insertedEcritures.length, 1);
  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_421.id, debit: '25000.00', credit: '0.00' },
      { compteComptableId: COMPTE_521.id, debit: '0.00', credit: '25000.00' },
    ],
  );
});

test('B — remboursement en espèces : D 421 soldé / C 571 (jamais le 57 générique)', async () => {
  const { executor, insertedLignes } = createFakeExecutor();
  await createEcritureDepense({
    entrepriseId: 1,
    reference: 'RMB-2',
    dateRemboursement: new Date('2026-11-27'),
    employeNom: 'Employé Test',
    description: 'Déplacement client',
    montant: '15000.00',
    modePaiement: 'especes',
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_421.id, debit: '15000.00', credit: '0.00' },
      { compteComptableId: COMPTE_571.id, debit: '0.00', credit: '15000.00' },
    ],
  );
});

test('B — avec un compte bancaire configuré, le remboursement utilise son compte comptable', async () => {
  const { executor, insertedLignes } = createFakeExecutor({
    bankLinks: [{ id: 7, compteComptableId: COMPTE_5121.id, entrepriseId: 1, actif: true }],
  });
  await createEcritureDepense({
    entrepriseId: 1,
    reference: 'RMB-3',
    dateRemboursement: new Date('2026-11-27'),
    employeNom: 'Employé Test',
    description: 'Déplacement client',
    montant: '25000.00',
    modePaiement: 'virement',
    compteBancaireId: 7,
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_421.id, debit: '25000.00', credit: '0.00' },
      { compteComptableId: COMPTE_5121.id, debit: '0.00', credit: '25000.00' },
    ],
  );
});

test('B — plan sans compte 521 : repli sur le 52 sans planter (dégradation gracieuse)', async () => {
  const { executor, insertedLignes } = createFakeExecutor({
    accounts: defaultAccounts().filter((a) => a.numero !== '521' && a.numero !== '5121'),
  });
  await createEcritureDepense({
    entrepriseId: 1,
    reference: 'RMB-4',
    dateRemboursement: new Date('2026-11-27'),
    employeNom: 'Employé Test',
    description: 'Déplacement client',
    montant: '25000.00',
    modePaiement: 'virement',
    executor,
  });

  assert.deepEqual(
    insertedLignes.map(({ compteComptableId, debit, credit }) => ({ compteComptableId, debit, credit })),
    [
      { compteComptableId: COMPTE_421.id, debit: '25000.00', credit: '0.00' },
      { compteComptableId: COMPTE_52_GENERIQUE.id, debit: '0.00', credit: '25000.00' },
    ],
  );
});
