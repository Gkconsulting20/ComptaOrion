const JOURNAL_NUMBER_WIDTHS = Object.freeze({
  achats: 6,
  ventes: 8,
});

export function getJournalNumberWidth(journalType) {
  return JOURNAL_NUMBER_WIDTHS[String(journalType || '').toLowerCase()] || 6;
}

export function formatJournalEntryNumber(journalCode, year, sequence, journalType) {
  const width = getJournalNumberWidth(journalType);
  const value = Number(sequence);
  if (!Number.isSafeInteger(value) || value <= 0 || value > (10 ** width) - 1) {
    throw new Error(`Le numéro de séquence doit être compris entre 1 et ${(10 ** width) - 1}.`);
  }
  const normalizedCode = String(journalCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,20}$/.test(normalizedCode)) {
    throw new Error('Le code du journal est invalide.');
  }
  if (!/^\d{4}$/.test(String(year))) {
    throw new Error('L’exercice de numérotation est invalide.');
  }
  return `${normalizedCode}-${year}-${String(value).padStart(width, '0')}`;
}

export function parseTrailingSequence(number) {
  const match = String(number || '').match(/-(\d+)$/);
  return match ? Number(match[1]) : 0;
}
