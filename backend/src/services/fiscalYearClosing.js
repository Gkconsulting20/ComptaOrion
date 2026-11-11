function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
}

function shiftDateByYears(value, years) {
  const normalized = dateOnly(value);
  if (!normalized) throw new Error('Les dates de l’exercice fiscal sont invalides.');
  const [year, month, day] = normalized.split('-').map(Number);
  const targetYear = year + years;
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

function addDays(value, days) {
  const normalized = dateOnly(value);
  if (!normalized) throw new Error('La date de fin de l’exercice est invalide.');
  const date = new Date(`${normalized}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getFiscalPeriodForYear(fiscalStart, fiscalEnd, fiscalYear) {
  const start = dateOnly(fiscalStart);
  const end = dateOnly(fiscalEnd);
  const year = Number(fiscalYear);
  if (!start || !end || start >= end || !Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error('L’exercice fiscal demandé ou ses dates sont invalides.');
  }

  const yearOffset = year - Number(start.slice(0, 4));
  const dateDebut = shiftDateByYears(start, yearOffset);
  const dateFin = shiftDateByYears(end, yearOffset);
  if (dateDebut >= dateFin) throw new Error('Les dates calculées de l’exercice fiscal sont invalides.');

  return {
    fiscalYear: year,
    dateDebut,
    dateFin,
    dateOuvertureSuivante: addDays(dateFin, 1),
    exerciceSuivant: year + 1
  };
}

function toCents(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) throw new Error('Un montant comptable est invalide.');
  return Math.round(amount * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function accountClass(account) {
  return String(account.numero || '').charAt(0);
}

export function calculateFiscalClosing(rows, period, resultAccount) {
  const profitAndLossAccounts = new Map();
  const balanceAccounts = new Map();

  for (const row of rows) {
    const movementDate = dateOnly(row.dateEcriture ?? row.date);
    if (!movementDate || movementDate > period.dateFin) continue;

    const account = {
      id: row.compteComptableId ?? row.accountId,
      numero: String(row.numero ?? row.accountNumber ?? ''),
      nom: row.nom ?? row.accountName ?? ''
    };
    const classe = accountClass(account);
    const signedCents = toCents(row.debit) - toCents(row.credit);

    if (['1', '2', '3', '4', '5'].includes(classe)
      && movementDate >= (period.balanceStartDate || '0000-01-01')) {
      const existing = balanceAccounts.get(account.id) || { account, soldeCents: 0 };
      existing.soldeCents += signedCents;
      balanceAccounts.set(account.id, existing);
    } else if (['6', '7'].includes(classe)
      && movementDate >= period.dateDebut
      && movementDate <= period.dateFin) {
      const existing = profitAndLossAccounts.get(account.id) || { account, soldeCents: 0 };
      existing.soldeCents += signedCents;
      profitAndLossAccounts.set(account.id, existing);
    }
  }

  const comptesCharges = [];
  const comptesProduits = [];
  let totalChargesCents = 0;
  let totalProduitsCents = 0;
  const lignesCloture = [];

  for (const { account, soldeCents } of profitAndLossAccounts.values()) {
    if (!soldeCents) continue;
    const classe = accountClass(account);
    if (classe === '6') {
      totalChargesCents += soldeCents;
      comptesCharges.push({ ...account, solde: fromCents(Math.abs(soldeCents)) });
    } else {
      totalProduitsCents -= soldeCents;
      comptesProduits.push({ ...account, solde: fromCents(Math.abs(soldeCents)) });
    }

    lignesCloture.push({
      compteComptableId: account.id,
      debitCents: soldeCents < 0 ? Math.abs(soldeCents) : 0,
      creditCents: soldeCents > 0 ? soldeCents : 0,
      libelle: `Solde compte ${account.numero} - ${account.nom}`
    });
  }

  const resultatNetCents = totalProduitsCents - totalChargesCents;
  const compteResultatNumero = resultatNetCents < 0 ? '129' : '120';
  let compteResultatOuverture = null;
  if (resultatNetCents !== 0) {
    if (resultAccount?.id && String(resultAccount.numero) === compteResultatNumero) {
      lignesCloture.push({
        compteComptableId: resultAccount.id,
        debitCents: resultatNetCents < 0 ? Math.abs(resultatNetCents) : 0,
        creditCents: resultatNetCents > 0 ? resultatNetCents : 0,
        libelle: `Résultat de l’exercice ${period.fiscalYear}`
      });
      compteResultatOuverture = {
        account: resultAccount,
        soldeCents: -resultatNetCents
      };
    }
  }

  const soldesOuverture = new Map();
  for (const [accountId, balance] of balanceAccounts) {
    if (balance.soldeCents !== 0) soldesOuverture.set(accountId, balance);
  }
  if (compteResultatOuverture) {
    const existing = soldesOuverture.get(compteResultatOuverture.account.id)
      || { account: compteResultatOuverture.account, soldeCents: 0 };
    existing.soldeCents += compteResultatOuverture.soldeCents;
    if (existing.soldeCents) soldesOuverture.set(compteResultatOuverture.account.id, existing);
    else soldesOuverture.delete(compteResultatOuverture.account.id);
  }

  let totalDebitClotureCents = 0;
  let totalCreditClotureCents = 0;
  for (const line of lignesCloture) {
    totalDebitClotureCents += line.debitCents;
    totalCreditClotureCents += line.creditCents;
  }

  const lignesOuverture = [];
  let totalDebitOuvertureCents = 0;
  let totalCreditOuvertureCents = 0;
  for (const { account, soldeCents } of soldesOuverture.values()) {
    if (soldeCents > 0) totalDebitOuvertureCents += soldeCents;
    else totalCreditOuvertureCents += Math.abs(soldeCents);
    lignesOuverture.push({
      compteComptableId: account.id,
      debitCents: Math.max(soldeCents, 0),
      creditCents: Math.max(-soldeCents, 0),
      libelle: `Report à nouveau ${account.numero}`
    });
  }

  return {
    resultatNet: fromCents(resultatNetCents),
    resultatNetCents,
    typeResultat: resultatNetCents < 0 ? 'perte' : resultatNetCents > 0 ? 'benefice' : 'equilibre',
    compteResultatNumero,
    comptesResultat: {
      charges: comptesCharges.sort((a, b) => a.numero.localeCompare(b.numero)),
      produits: comptesProduits.sort((a, b) => a.numero.localeCompare(b.numero)),
      totalCharges: fromCents(totalChargesCents),
      totalProduits: fromCents(totalProduitsCents)
    },
    comptesBilan: [...balanceAccounts.values()]
      .filter(({ soldeCents }) => soldeCents !== 0)
      .sort((a, b) => a.account.numero.localeCompare(b.account.numero))
      .map(({ account, soldeCents }) => ({ ...account, solde: fromCents(soldeCents) })),
    lignesCloture,
    lignesOuverture,
    totalDebitClotureCents,
    totalCreditClotureCents,
    totalDebitOuvertureCents,
    totalCreditOuvertureCents
  };
}
