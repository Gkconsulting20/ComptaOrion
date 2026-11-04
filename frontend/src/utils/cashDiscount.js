export function getCashDiscountPreview(invoice, paymentDate) {
  if (!invoice) return null;

  const rate = Number(invoice.escomptePourcentage || 0);
  const deadline = String(invoice.dateLimiteEscompte || '').slice(0, 10);
  const paymentDay = String(paymentDate || '').slice(0, 10);
  const totalHTCents = Math.round(Number(invoice.totalHT || 0) * 100);
  const invoiceVatCents = Math.round(Number(invoice.montantTVA ?? invoice.totalTVA ?? 0) * 100);
  const invoiceTtcCents = Math.round(Number(
    invoice.totalTTC ?? (totalHTCents + invoiceVatCents) / 100,
  ) * 100);

  if (!Number.isFinite(rate) || rate <= 0 || rate > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paymentDay) ||
      paymentDay > deadline ||
      Number(invoice.montantPaye || 0) > 0 ||
      Number(invoice.montantEscompte || 0) > 0 ||
      totalHTCents <= 0) return null;

  const discountHTCents = Math.min(totalHTCents, Math.round(totalHTCents * rate / 100));
  return {
    discountHT: discountHTCents / 100,
    invoiceTVA: invoiceVatCents / 100,
    netTTC: Math.max(0, invoiceTtcCents - discountHTCents) / 100,
  };
}
