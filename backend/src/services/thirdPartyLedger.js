const EXCLUDED_INVOICE_STATUSES = new Set(['brouillon', 'annulee']);

function moneyToCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function centsToMoney(value) {
  return Number((value / 100).toFixed(2));
}

function dateKey(value) {
  return String(value || '').slice(0, 10);
}

export function buildThirdPartyStatement({
  side,
  invoices = [],
  payments = [],
  dateDebut,
  dateFin,
  openingBalance = 0,
}) {
  if (!['client', 'fournisseur'].includes(side)) {
    throw new Error('Le type de compte tiers est invalide.');
  }
  if (!dateDebut || !dateFin || dateKey(dateDebut) > dateKey(dateFin)) {
    throw new Error('La période de l’état de compte est invalide.');
  }

  const eligibleInvoices = invoices.filter(invoice =>
    !EXCLUDED_INVOICE_STATUSES.has(String(invoice.statut || '').toLowerCase())
  );
  const invoiceById = new Map(eligibleInvoices.map(invoice => [Number(invoice.id), invoice]));
  const eligiblePayments = payments.filter(payment => {
    if (payment.factureId == null) return side === 'client';
    return invoiceById.has(Number(payment.factureId));
  });

  const invoiceMovement = (invoice, inPeriod) => {
    const amountCents = moneyToCents(invoice.totalTTC);
    const debitCents = side === 'client' ? amountCents : 0;
    const creditCents = side === 'fournisseur' ? amountCents : 0;
    return {
      date: dateKey(invoice.dateFacture),
      type: side === 'client' ? 'facture_client' : 'facture_fournisseur',
      reference: invoice.numeroFacture || invoice.numeroFactureFournisseur || `#${invoice.id}`,
      description: invoice.description || null,
      debitCents,
      creditCents,
      source: invoice,
      inPeriod,
    };
  };

  const paymentMovement = (payment, inPeriod) => {
    const amountCents = moneyToCents(payment.montant);
    const debitCents = side === 'fournisseur' ? amountCents : 0;
    const creditCents = side === 'client' ? amountCents : 0;
    return {
      date: dateKey(payment.datePaiement),
      type: side === 'client' ? 'encaissement_client' : 'paiement_fournisseur',
      reference: payment.reference || `#${payment.id}`,
      description: payment.notes || null,
      debitCents,
      creditCents,
      source: payment,
      inPeriod,
    };
  };

  const allMovements = [
    ...eligibleInvoices.map(invoice => invoiceMovement(invoice, false)),
    ...eligiblePayments.map(payment => paymentMovement(payment, false)),
  ].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate) return byDate;
    const aIsInvoice = a.type.startsWith('facture');
    const bIsInvoice = b.type.startsWith('facture');
    if (aIsInvoice !== bIsInvoice) return aIsInvoice ? -1 : 1;
    return String(a.reference).localeCompare(String(b.reference));
  });

  const openingCents = moneyToCents(openingBalance);
  let balanceCents = openingCents;
  for (const movement of allMovements) {
    if (movement.date >= dateDebut) break;
    balanceCents += side === 'client'
      ? movement.debitCents - movement.creditCents
      : movement.creditCents - movement.debitCents;
  }
  const openingAtStart = balanceCents;
  const periodMovements = allMovements.filter(movement =>
    movement.date >= dateDebut && movement.date <= dateFin
  );
  const movements = periodMovements.map(movement => {
    balanceCents += side === 'client'
      ? movement.debitCents - movement.creditCents
      : movement.creditCents - movement.debitCents;
    return {
      date: movement.date,
      type: movement.type,
      reference: movement.reference,
      description: movement.description,
      debit: centsToMoney(movement.debitCents),
      credit: centsToMoney(movement.creditCents),
      solde: centsToMoney(balanceCents),
    };
  });

  const periodInvoices = eligibleInvoices.filter(invoice => {
    const date = dateKey(invoice.dateFacture);
    return date >= dateDebut && date <= dateFin;
  });
  const periodPayments = eligiblePayments.filter(payment => {
    const date = dateKey(payment.datePaiement);
    return date >= dateDebut && date <= dateFin;
  });
  const totalFactureCents = periodInvoices.reduce((sum, invoice) => sum + moneyToCents(invoice.totalTTC), 0);
  const totalPayeCents = periodPayments.reduce((sum, payment) => sum + moneyToCents(payment.montant), 0);

  return {
    factures: periodInvoices,
    paiements: periodPayments,
    mouvements: movements,
    totalFacture: centsToMoney(totalFactureCents),
    totalPaye: centsToMoney(totalPayeCents),
    soldeOuverture: centsToMoney(openingAtStart),
    soldeCloture: centsToMoney(balanceCents),
    solde: centsToMoney(balanceCents),
  };
}
