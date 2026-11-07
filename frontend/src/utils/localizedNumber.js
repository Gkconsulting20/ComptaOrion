const MAX_DISPLAY_DECIMALS = 6;

export function normalizeLocalizedNumber(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';

  text = text
    .replace(/[\s\u00a0\u202f'’]/g, '')
    .replace(/[−–]/g, '-');

  if (!/^-?[0-9.,]*$/.test(text)) return null;

  const sign = text.startsWith('-') ? '-' : '';
  const unsigned = sign ? text.slice(1) : text;
  if (!unsigned) return null;

  const commaCount = (unsigned.match(/,/g) || []).length;
  const dotCount = (unsigned.match(/\./g) || []).length;
  if (!commaCount && !dotCount) return `${sign}${unsigned}`;

  const distinctSeparators = commaCount > 0 && dotCount > 0;
  if (!distinctSeparators && Math.max(commaCount, dotCount) > 1) {
    const separator = commaCount ? ',' : '.';
    const groups = unsigned.split(separator);
    const isThousandsGrouped = groups[0].length >= 1 && groups[0].length <= 3 &&
      groups.slice(1).every((group) => group.length === 3);
    if (isThousandsGrouped) return `${sign}${groups.join('')}`;
  }

  const lastSeparator = Math.max(unsigned.lastIndexOf(','), unsigned.lastIndexOf('.'));
  const integer = unsigned.slice(0, lastSeparator).replace(/[.,]/g, '') || '0';
  const fraction = unsigned.slice(lastSeparator + 1).replace(/[.,]/g, '');
  return `${sign}${integer}.${fraction}`;
}

function getFractionDigits(step, maxFractionDigits) {
  if (Number.isInteger(maxFractionDigits)) {
    return Math.min(MAX_DISPLAY_DECIMALS, Math.max(0, maxFractionDigits));
  }
  const stepText = String(step ?? '');
  const decimalPart = stepText.split('.')[1] || '';
  if (!decimalPart) return MAX_DISPLAY_DECIMALS;
  return Math.min(MAX_DISPLAY_DECIMALS, decimalPart.length);
}

export function formatLocalizedNumber(value, options = {}) {
  const normalized = normalizeLocalizedNumber(value);
  if (normalized === '') return '';
  if (normalized == null || normalized === '-') return String(value ?? '');

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) return String(value ?? '');

  const maximumFractionDigits = getFractionDigits(options.step, options.maximumFractionDigits);
  const minimumFractionDigits = Number.isInteger(options.minimumFractionDigits)
    ? Math.min(maximumFractionDigits, Math.max(0, options.minimumFractionDigits))
    : (String(options.step) === '0.01' ? 2 : 0);

  return new Intl.NumberFormat('fr-FR', {
    useGrouping: true,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numericValue).replace(/[\u00a0\u202f]/g, ' ');
}

export function numberForEditing(value) {
  const normalized = normalizeLocalizedNumber(value);
  if (normalized == null) return String(value ?? '');
  return normalized.replace('.', ',');
}
