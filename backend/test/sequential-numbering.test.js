import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatJournalEntryNumber,
  getJournalNumberWidth,
  parseTrailingSequence
} from '../src/services/sequentialNumbering.js';

test('la séquence achats utilise six chiffres et la séquence ventes huit', () => {
  assert.equal(getJournalNumberWidth('achats'), 6);
  assert.equal(getJournalNumberWidth('ventes'), 8);
  assert.equal(getJournalNumberWidth('banque'), 6);

  assert.equal(formatJournalEntryNumber('AC', 2026, 1, 'achats'), 'AC-2026-000001');
  assert.equal(formatJournalEntryNumber('VT', 2026, 1, 'ventes'), 'VT-2026-00000001');
});

test('la séquence refuse de dépasser sa capacité ou un code invalide', () => {
  assert.throws(() => formatJournalEntryNumber('AC', 2026, 1_000_000, 'achats'));
  assert.throws(() => formatJournalEntryNumber('VT', 2026, 100_000_000, 'ventes'));
  assert.throws(() => formatJournalEntryNumber('AC/1', 2026, 1, 'achats'));
});

test('l’ancien numéro permet de reprendre la séquence à son suffixe', () => {
  assert.equal(parseTrailingSequence('AC-2026-01-000127'), 127);
  assert.equal(parseTrailingSequence('AC-2026-000006'), 6);
  assert.equal(parseTrailingSequence('sans-suffixe'), 0);
});
