export function buildCashSettlementEntryLines({
  side,
  thirdPartyAccountId,
  treasuryAccountId,
  discountAccountId,
  paymentAmount,
  discountHT = 0,
  thirdPartyName,
  reference,
}) {
  const payment = Number(paymentAmount);
  const discount = Number(discountHT || 0);
  if (!['client', 'supplier'].includes(side) ||
      !Number.isFinite(payment) || payment <= 0 ||
      !Number.isFinite(discount) || discount < 0) {
    throw new Error('Les paramètres de l’écriture de règlement sont invalides.');
  }
  if (!thirdPartyAccountId || !treasuryAccountId || (discount > 0 && !discountAccountId)) {
    return [];
  }

  const totalSettled = Number((payment + discount).toFixed(2));
  if (side === 'client') {
    return [
      {
        compteComptableId: treasuryAccountId,
        debit: payment,
        credit: 0,
        libelle: `Encaissement - ${reference}`,
      },
      {
        compteComptableId: thirdPartyAccountId,
        debit: 0,
        credit: totalSettled,
        libelle: `Règlement ${thirdPartyName}`,
      },
      ...(discount > 0 ? [{
        compteComptableId: discountAccountId,
        debit: discount,
        credit: 0,
        libelle: `Escompte accordé - ${reference}`,
      }] : []),
    ];
  }

  return [
    {
      compteComptableId: thirdPartyAccountId,
      debit: totalSettled,
      credit: 0,
      libelle: `Règlement ${thirdPartyName}`,
    },
    {
      compteComptableId: treasuryAccountId,
      debit: 0,
      credit: payment,
      libelle: `Décaissement - ${reference}`,
    },
    ...(discount > 0 ? [{
      compteComptableId: discountAccountId,
      debit: 0,
      credit: discount,
      libelle: `Escompte obtenu - ${reference}`,
    }] : []),
  ];
}
