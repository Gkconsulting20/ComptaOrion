import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatLocalizedNumber,
  normalizeLocalizedNumber,
  numberForEditing,
} from '../src/utils/localizedNumber.js';

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

test('accepte virgules décimales et espaces de milliers', () => {
  assert.equal(normalizeLocalizedNumber('1 234 567,89'), '1234567.89');
  assert.equal(normalizeLocalizedNumber('1 234 567.89'), '1234567.89');
  assert.equal(normalizeLocalizedNumber('1.234.567,89'), '1234567.89');
  assert.equal(normalizeLocalizedNumber('1,234,567'), '1234567');
});

test('garde le brouillon saisissable et formate après la saisie', () => {
  assert.equal(numberForEditing('1 234 567.50'), '1234567,50');
  assert.equal(formatLocalizedNumber('1234567.5', { step: '0.01' }), '1 234 567,50');
  assert.equal(formatLocalizedNumber('25.000000', { step: '0.000001' }), '25');
});

test('laisse les champs vides et refuse les caractères non numériques', () => {
  assert.equal(normalizeLocalizedNumber(''), '');
  assert.equal(normalizeLocalizedNumber('12a'), null);
});

test('les champs numériques de l’ERP utilisent la saisie localisée partagée', async () => {
  const sourceRoot = fileURLToPath(new URL('../src', import.meta.url));
  const files = (await filesUnder(sourceRoot)).filter((path) => path.endsWith('.jsx'));
  const sources = await Promise.all(files.map((path) => readFile(path, 'utf8')));
  for (let index = 0; index < files.length; index += 1) {
    assert.doesNotMatch(sources[index], /<input\b[^>]*\btype="number"/s, files[index]);
  }

  const formField = sources[files.findIndex((path) => path.endsWith('/components/FormField.jsx'))];
  assert.match(formField, /type === 'number' \? \([\s\S]*?<NumberInput/);
});
