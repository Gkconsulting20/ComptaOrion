function parseLocalizedAmount(value) {
  const raw = String(value || '').replace(/\u00a0|\u202f/g, ' ').trim();
  const match = raw.match(/-?\d[\d\s.,]*/);
  if (!match) return null;

  let number = match[0].replace(/\s/g, '');
  const lastComma = number.lastIndexOf(',');
  const lastDot = number.lastIndexOf('.');
  const decimalPosition = Math.max(lastComma, lastDot);

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalDigits = number.length - decimalPosition - 1;
    number = decimalDigits > 0 && decimalDigits <= 2
      ? `${number.slice(0, decimalPosition).replace(/[.,]/g, '')}.${number.slice(decimalPosition + 1)}`
      : number.replace(/[.,]/g, '');
  } else if (decimalPosition >= 0) {
    const decimalDigits = number.length - decimalPosition - 1;
    if (decimalDigits === 0 || decimalDigits === 3) {
      number = number.replace(/[.,]/g, '');
    } else {
      number = `${number.slice(0, decimalPosition).replace(/[.,]/g, '')}.${number.slice(decimalPosition + 1)}`;
    }
  }

  const parsed = Number(number);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function findLabeledAmount(lines, labelPattern) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!labelPattern.test(lines[index])) continue;

    for (const source of [lines[index], lines[index + 1] || '']) {
      const matches = [...source.matchAll(/-?\d[\d\s.,]*/g)];
      const amounts = matches.filter((match) => {
        const suffix = source.slice(match.index + match[0].length);
        return !/^\s*%/.test(suffix);
      });
      const amountMatch = amounts.at(-1);
      if (!amountMatch) continue;

      const amount = parseLocalizedAmount(amountMatch[0]);
      if (amount !== null) return amount;
    }
  }
  return null;
}

function normalizeDate(value) {
  const match = String(value || '').match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) return '';

  const year = match[4] || match[3];
  const month = match[5] || match[2];
  const day = match[6] || match[1];
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

export function parseSupplierInvoiceText(text) {
  const sourceText = String(text || '');
  const lines = sourceText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const joined = lines.join('\n');
  const invoiceNumberMatch = joined.match(
    /(?:facture\s*(?:n[°ºo]|num[eé]ro|#)?|n[°ºo]\s*facture|invoice\s*(?:no\.?|number|#)?)\s*[:#.\-]?\s*([a-z0-9][a-z0-9/_-]{2,})/i
  );
  const dateLine = lines.find(line => /\bdate\b/i.test(line));

  return {
    numeroFactureFournisseur: invoiceNumberMatch?.[1]?.replace(/[.,;:]+$/, '') || '',
    dateFacture: normalizeDate(dateLine || joined),
    montantHT: findLabeledAmount(lines, /\b(?:total\s*ht|montant\s*ht|hors\s*taxe|total\s*hors\s*taxe)\b/i),
    montantTVA: findLabeledAmount(lines, /\b(?:montant\s*(?:de\s*)?tva|total\s*tva|tva\s*(?:à\s*payer|due))\b/i),
    montantTTC: findLabeledAmount(lines, /\b(?:total\s*ttc|montant\s*ttc|net\s*[àa]\s*payer|total\s*toutes?\s*taxes\s*comprises)\b/i),
    texteReconnu: sourceText
  };
}
