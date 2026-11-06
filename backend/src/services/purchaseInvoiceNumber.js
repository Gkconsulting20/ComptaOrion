export function getNextPurchaseInvoiceNumber(year, companyNumbers, globallyUsedNumbers) {
  const pattern = new RegExp(`^FACT-ACH-${Number(year)}-(\\d+)$`);
  const sequenceInCompany = (companyNumbers || []).reduce((maximum, value) => {
    const match = String(value || '').match(pattern);
    return match ? Math.max(maximum, Number(match[1]) || 0) : maximum;
  }, 0);
  const globallyUsed = new Set((globallyUsedNumbers || []).map((value) => String(value || '')));

  let sequence = sequenceInCompany + 1;
  let candidate = `FACT-ACH-${year}-${String(sequence).padStart(6, '0')}`;
  while (globallyUsed.has(candidate)) {
    sequence += 1;
    candidate = `FACT-ACH-${year}-${String(sequence).padStart(6, '0')}`;
  }
  return candidate;
}
