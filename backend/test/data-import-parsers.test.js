import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parseExcel, parseIIF, parseLocalizedNumber } from '../src/services/dataImportParsers.js';

test('CSV preserves quoted delimiters, escaped quotes, line breaks and UTF-8 BOM', () => {
  const csv = '\uFEFFNom,Email,Note\r\n"Client, SARL",client@example.invalid,"ligne 1\r\nligne ""2"""';
  const parsed = parseCSV(Buffer.from(csv, 'utf8'));

  assert.deepEqual(parsed.headers, ['Nom', 'Email', 'Note']);
  assert.deepEqual(parsed.rows[0].data, {
    Nom: 'Client, SARL',
    Email: 'client@example.invalid',
    Note: 'ligne 1\r\nligne "2"',
  });
});

test('CSV detects semicolon files and keeps non-UTF-8 French text readable', () => {
  const latin1 = Buffer.from([
    0x4e, 0x6f, 0x6d, 0x3b, 0x56, 0x69, 0x6c, 0x6c, 0x65, 0x0d, 0x0a,
    0x53, 0x6f, 0x63, 0x69, 0xe9, 0x74, 0xe9, 0x3b, 0x4c, 0x6f, 0x6d, 0xe9,
  ]);
  const parsed = parseCSV(latin1);

  assert.deepEqual(parsed.headers, ['Nom', 'Ville']);
  assert.equal(parsed.rows[0].data.Nom, 'Société');
  assert.equal(parsed.rows[0].data.Ville, 'Lomé');
});

test('CSV maps missing cells to empty values and keeps duplicate headers distinct', () => {
  const parsed = parseCSV(Buffer.from('Nom,Nom,Email\nA,B\n'));

  assert.deepEqual(parsed.headers, ['Nom', 'Nom (2)', 'Email']);
  assert.deepEqual(parsed.rows[0].data, {
    Nom: 'A',
    'Nom (2)': 'B',
    Email: '',
  });
});

test('CSV rejects an unclosed quoted field instead of silently shifting columns', () => {
  assert.throws(
    () => parseCSV(Buffer.from('Nom,Email\n"Client,client@example.invalid')),
    /guillemets.*pas fermé/i,
  );
});

test('numeric import preserves French decimal and thousands separators', () => {
  assert.equal(parseLocalizedNumber('1 250,50'), 1250.5);
  assert.equal(parseLocalizedNumber('1.250,50'), 1250.5);
  assert.equal(parseLocalizedNumber('1,250.50'), 1250.5);
  assert.equal(parseLocalizedNumber('1250.50'), 1250.5);
  assert.equal(parseLocalizedNumber('1,234'), 1.234);
  assert.equal(parseLocalizedNumber('1.234'), 1.234);
  assert.equal(parseLocalizedNumber(''), null);
  assert.throws(() => parseLocalizedNumber('12,5,0'), /invalide/i);
});

test('IIF selects the section matching the requested entity', () => {
  const iif = [
    '!HDR\tVERSION\tDATE',
    'HDR\t1\t20260101',
    '!CUST\tNAME\tEMAIL',
    'CUST\tClient Démo\tclient@example.invalid',
    '!VEND\tNAME\tEMAIL',
    'VEND\tFournisseur Démo\tvendor@example.invalid',
  ].join('\r\n');

  const parsed = parseIIF(Buffer.from(iif, 'utf8'), 'clients');
  assert.deepEqual(parsed.headers, ['NAME', 'EMAIL']);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].data.NAME, 'Client Démo');
});

test('IIF rejects a file without the section expected for the selected data type', () => {
  const iif = '!VEND\tNAME\nVEND\tFournisseur Démo';
  assert.throws(() => parseIIF(Buffer.from(iif), 'clients'), /section QuickBooks CUST/i);
});

test('XLSX reads a minimal workbook with headers and data', async () => {
  const workbookBase64 = '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';
  const parsed = await parseExcel(Buffer.from(workbookBase64, 'base64'));

  assert.deepEqual(parsed.headers, ['Nom', 'Email']);
  assert.equal(parsed.rows[0].data.Nom, 'Client XLSX');
  assert.equal(parsed.rows[0].data.Email, 'xlsx@example.invalid');
});
