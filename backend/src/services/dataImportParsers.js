import readXlsxFile from 'read-excel-file/web-worker';

const CSV_DELIMITERS = [',', ';', '\t', '|'];

function decodeText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : Buffer.from(buffer);
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\uFFFD')) {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^\uFEFF/, '');
}

function countDelimitersInFirstRecord(text) {
  const counts = new Map(CSV_DELIMITERS.map(delimiter => [delimiter, 0]));
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (character === '\n' || character === '\r')) break;
    if (!quoted && counts.has(character)) {
      counts.set(character, counts.get(character) + 1);
    }
  }

  return counts;
}

function detectCsvDelimiter(text) {
  const counts = countDelimitersInFirstRecord(text);
  return CSV_DELIMITERS.reduce((best, delimiter) =>
    counts.get(delimiter) > counts.get(best) ? delimiter : best, ',');
}

function parseDelimitedRecords(text, delimiter) {
  const records = [];
  let record = [];
  let value = '';
  let quoted = false;
  let afterQuote = false;

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (quoted) {
      if (character === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        value += character;
      }
      continue;
    }

    if (afterQuote && (character === ' ' || character === '\t')) continue;
    afterQuote = false;

    if (character === '"' && value.trim() === '') {
      value = '';
      quoted = true;
    } else if (character === delimiter) {
      record.push(value.trim());
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[i + 1] === '\n') i++;
      record.push(value.trim());
      if (record.some(cell => cell !== '')) records.push(record);
      record = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error('Le fichier CSV contient un champ texte entre guillemets qui n’est pas fermé.');
  }

  if (value !== '' || record.length > 0) {
    record.push(value.trim());
    if (record.some(cell => cell !== '')) records.push(record);
  }

  return records;
}

function makeUniqueHeaders(rawHeaders, columnCount) {
  const used = new Map();
  return Array.from({ length: columnCount }, (_, index) => {
    const base = String(rawHeaders[index] || '').trim() || `Colonne ${index + 1}`;
    const normalized = base.toLocaleLowerCase();
    const count = used.get(normalized) || 0;
    used.set(normalized, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function recordsToRows(records) {
  const nonEmptyRecords = records.filter(record => record.some(cell => String(cell ?? '').trim() !== ''));
  if (nonEmptyRecords.length === 0) return { headers: [], rows: [] };

  const columnCount = Math.max(...nonEmptyRecords.map(record => record.length));
  const headers = makeUniqueHeaders(nonEmptyRecords[0], columnCount);
  const rows = nonEmptyRecords.slice(1).map((values, index) => ({
    ligne: index + 2,
    data: Object.fromEntries(headers.map((header, column) => [
      header,
      String(values[column] ?? '').trim(),
    ])),
  }));

  return { headers, rows };
}

export function parseCSV(buffer, delimiter) {
  const text = decodeText(buffer);
  if (!text.trim()) return { headers: [], rows: [] };

  const selectedDelimiter = delimiter || detectCsvDelimiter(text);
  if (!CSV_DELIMITERS.includes(selectedDelimiter)) {
    throw new Error('Séparateur CSV non reconnu.');
  }

  return recordsToRows(parseDelimitedRecords(text, selectedDelimiter));
}

export async function parseExcel(buffer) {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const rows = await readXlsxFile(arrayBuffer);
  return recordsToRows(rows.map(row => row.map(value =>
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? ''),
  )));
}

const IIF_SECTION_BY_ENTITY = {
  clients: 'CUST',
  fournisseurs: 'VEND',
  plan_comptable: 'ACCNT',
  produits: 'INVITEM',
};

export function parseIIF(buffer, entityType) {
  const sections = {};
  let currentSection = null;
  let currentHeaders = [];

  for (const line of decodeText(buffer).split(/\r?\n/)) {
    if (line.startsWith('!')) {
      const parts = line.slice(1).split('\t');
      currentSection = parts[0];
      currentHeaders = parts.slice(1);
      sections[currentSection] = { headers: currentHeaders, rows: [] };
      continue;
    }

    if (!currentSection || !line.trim()) continue;
    const values = line.split('\t');
    if (values[0] !== currentSection) continue;

    const row = Object.fromEntries(currentHeaders.map((header, index) => [
      header,
      values[index + 1] || '',
    ]));
    sections[currentSection].rows.push({
      ligne: sections[currentSection].rows.length + 2,
      data: row,
    });
  }

  const preferredSection = IIF_SECTION_BY_ENTITY[entityType];
  const sectionName = preferredSection && sections[preferredSection]
    ? preferredSection
    : Object.keys(sections)[0];
  if (!sectionName) return { headers: [], rows: [] };
  if (preferredSection && !sections[preferredSection]) {
    throw new Error(`Le fichier IIF ne contient pas la section QuickBooks ${preferredSection} attendue pour ce type de données.`);
  }

  return {
    headers: sections[sectionName].headers,
    rows: sections[sectionName].rows,
    allSections: sections,
  };
}
