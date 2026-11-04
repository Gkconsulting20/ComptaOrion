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
  creditNotes = [],
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
  const eligibleCreditNotes = creditNotes.filter(note =>
    String(note.statut || 'validee').toLowerCase() === 'validee'
  );
  const debitNoteById = new Map(eligibleCreditNotes
    .filter(note => side === 'client' && String(note.operation || 'avoir') === 'debit')
    .map(note => [Number(note.id), note]));
  const eligiblePayments = payments.filter(payment => {
    if (payment.noteCreditId != null) {
      return side === 'client' && debitNoteById.has(Number(payment.noteCreditId));
    }
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
      libelle: side === 'client' ? 'Facture client' : 'Facture fournisseur',
      reference: invoice.numeroFacture || invoice.numeroFactureFournisseur || `#${invoice.id}`,
      description: invoice.description || null,
      debitCents,
      creditCents,
      source: invoice,
      inPeriod,
    };
  };

  const paymentMovement = (payment, inPeriod) => {
    const amountCents = moneyToCents(payment.montant) + moneyToCents(payment.montantEscompteTTC);
    const debitCents = side === 'fournisseur' ? amountCents : 0;
    const creditCents = side === 'client' ? amountCents : 0;
    const isNotePayment = payment.noteCreditId != null;
    const note = isNotePayment ? debitNoteById.get(Number(payment.noteCreditId)) : null;
    const discountCents = moneyToCents(payment.montantEscompteTTC);
    return {
      date: dateKey(payment.datePaiement),
      type: isNotePayment ? 'reglement_note_debit_client' : side === 'client' ? 'encaissement_client' : 'paiement_fournisseur',
      libelle: isNotePayment
        ? 'Règlement note de débit'
        : side === 'client'
          ? (discountCents ? 'Encaissement et escompte' : 'Encaissement')
          : (discountCents ? 'Règlement et escompte fournisseur' : 'Règlement fournisseur'),
      reference: payment.reference || note?.numero || `#${payment.id}`,
      description: payment.notes || null,
      debitCents,
      creditCents,
      source: payment,
      inPeriod,
    };
  };
  const creditNoteMovement = (note, inPeriod) => {
    const amountCents = moneyToCents(note.montantTTC);
    const isCustomerDebit = side === 'client' && String(note.operation || 'avoir') === 'debit';
    return {
      date: dateKey(note.dateAvoir),
      type: isCustomerDebit ? 'note_debit_client' : side === 'client' ? 'avoir_client' : 'avoir_fournisseur',
      libelle: isCustomerDebit ? 'Note de débit client' : side === 'client' ? 'Avoir client' : 'Avoir fournisseur',
      reference: note.numero || `#${note.id}`,
      description: note.motif || null,
      debitCents: side === 'fournisseur' || isCustomerDebit ? amountCents : 0,
      creditCents: side === 'client' && !isCustomerDebit ? amountCents : 0,
      source: note,
      inPeriod,
    };
  };

  const allMovements = [
    ...eligibleInvoices.map(invoice => invoiceMovement(invoice, false)),
    ...eligiblePayments.map(payment => paymentMovement(payment, false)),
    ...eligibleCreditNotes.map(note => creditNoteMovement(note, false)),
  ].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate) return byDate;
    const aIsInvoice = a.type.startsWith('facture');
    const bIsInvoice = b.type.startsWith('facture');
    if (aIsInvoice !== bIsInvoice) return aIsInvoice ? -1 : 1;
    const order = {
      facture_client: 0, facture_fournisseur: 0, note_debit_client: 0,
      avoir_client: 1, avoir_fournisseur: 1,
    };
    if ((order[a.type] ?? 2) !== (order[b.type] ?? 2)) return (order[a.type] ?? 2) - (order[b.type] ?? 2);
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
      libelle: movement.libelle,
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
  const periodCreditNotes = eligibleCreditNotes.filter(note => {
    const date = dateKey(note.dateAvoir);
    return date >= dateDebut && date <= dateFin;
  });
  const totalFactureCents = periodInvoices.reduce((sum, invoice) => sum + moneyToCents(invoice.totalTTC), 0);
  const totalEscompteCents = periodPayments.reduce((sum, payment) => sum + moneyToCents(payment.montantEscompteTTC), 0);
  const totalPayeCents = periodPayments.reduce((sum, payment) => sum + moneyToCents(payment.montant) + moneyToCents(payment.montantEscompteTTC), 0);
  const periodDebitNotes = periodCreditNotes.filter(note => side === 'client' && String(note.operation || 'avoir') === 'debit');
  const periodAvoirs = periodCreditNotes.filter(note => String(note.operation || 'avoir') !== 'debit');
  const totalAvoirCents = periodAvoirs.reduce((sum, note) => sum + moneyToCents(note.montantTTC), 0);
  const totalDebitNoteCents = periodDebitNotes.reduce((sum, note) => sum + moneyToCents(note.montantTTC), 0);

  return {
    factures: periodInvoices,
    paiements: periodPayments,
    avoirs: periodAvoirs,
    notesDebit: periodDebitNotes,
    mouvements: movements,
    totalFacture: centsToMoney(totalFactureCents),
    totalPaye: centsToMoney(totalPayeCents),
    totalAvoir: centsToMoney(totalAvoirCents),
    totalNoteDebit: centsToMoney(totalDebitNoteCents),
    totalEscompte: centsToMoney(totalEscompteCents),
    soldeOuverture: centsToMoney(openingAtStart),
    soldeCloture: centsToMoney(balanceCents),
    solde: centsToMoney(balanceCents),
  };
}
