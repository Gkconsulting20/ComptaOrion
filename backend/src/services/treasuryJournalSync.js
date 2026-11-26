import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  comptesBancaires,
  ecritures,
  factures,
  facturesAchat,
  journaux,
  lignesEcritures,
  paiements,
  paiementsFournisseurs,
  transactionsTresorerie,
} from '../schema.js';
import { logAudit } from '../utils/auditLogger.js';

/**
 * Mouvements nets de trésorerie d'une écriture, par compte bancaire ou
 * de caisse lié (fonction pure, sans base).
 * lignes : [{ compteComptableId, debit, credit }] ; comptesBancaires :
 * [{ id, compteComptableId }] (banque comme caisse : la table
 * comptes_bancaires porte les deux). Retourne un mouvement par compte
 * lié dont le net (débit − crédit) est non nul : > 0 encaissement,
 * < 0 décaissement. Une écriture peut toucher plusieurs comptes
 * (ex. ouverture AN : D 521 + D 571) : chacun est synchronisé.
 * Testée dans test/tresorerie-synchronisation.test.js (scénario 2026).
 */
export function mouvementsTresorerieParCompte({ lignes, comptesBancaires }) {
  const nets = new Map();
  for (const ligne of lignes || []) {
    const compteId = Number(ligne.compteComptableId);
    if (!Number.isSafeInteger(compteId)) continue;
    const net = Number(ligne.debit || 0) - Number(ligne.credit || 0);
    nets.set(compteId, (nets.get(compteId) || 0) + net);
  }
  const mouvements = [];
  for (const compte of comptesBancaires || []) {
    const net = nets.get(Number(compte.compteComptableId));
    if (net === undefined || Math.abs(net) < 0.005) continue;
    mouvements.push({
      compteBancaireId: compte.id,
      compteComptableId: compte.compteComptableId,
      mouvementNet: net,
      type: net > 0 ? 'encaissement' : 'decaissement',
    });
  }
  return mouvements;
}

export async function synchroniserTransactionDepuisEcriture({
  entrepriseId,
  ecritureId,
  auditInfo = {},
  executor = db,
}) {
  const tenantId = Number(entrepriseId);
  const entryId = Number(ecritureId);
  const [entry] = await executor.select().from(ecritures).where(and(
    eq(ecritures.id, entryId),
    eq(ecritures.entrepriseId, tenantId),
  )).for('update').limit(1);

  if (!entry) throw Object.assign(new Error('Écriture non trouvée.'), { status: 404 });
  if (!entry.valide) throw Object.assign(new Error('Seule une écriture validée peut être synchronisée.'), { status: 409 });

  const [journal] = await executor.select().from(journaux).where(and(
    eq(journaux.id, entry.journalId),
    eq(journaux.entrepriseId, tenantId),
  )).limit(1);

  const lines = await executor.select().from(lignesEcritures).where(and(
    eq(lignesEcritures.ecritureId, entryId),
    eq(lignesEcritures.entrepriseId, tenantId),
  ));
  const accountIds = [...new Set(lines.map((line) => Number(line.compteComptableId)).filter(Number.isSafeInteger))];
  if (!accountIds.length) return { skipped: 'L’écriture ne contient pas de ligne comptable.' };

  const linkedBankAccounts = await executor.select().from(comptesBancaires).where(and(
    eq(comptesBancaires.entrepriseId, tenantId),
    eq(comptesBancaires.actif, true),
    inArray(comptesBancaires.compteComptableId, accountIds),
  ));
  if (linkedBankAccounts.length === 0) {
    return { skipped: 'Aucun compte bancaire actif n’est lié aux comptes de cette écriture.' };
  }

  // Avant correction, seuls les journaux BQ étaient synchronisés : les
  // écritures d'ouverture (AN, +2 000 000 en banque) et de salaires
  // (SA, −1 800 000) ne l'étaient pas, et la caisse (journal CA) jamais
  // — d'où l'écart module/comptabilité de l'exercice 2026 (banque
  // −3 072 200 au lieu de −2 872 200, caisse 0 au lieu de +1 482 000).
  // Règle désormais : tout journal dont une ligne touche un compte de
  // trésorerie lié est synchronisé, un mouvement par compte lié.
  const mouvements = mouvementsTresorerieParCompte({
    lignes: lines,
    comptesBancaires: linkedBankAccounts,
  });
  if (mouvements.length === 0) {
    return { skipped: 'Aucun mouvement net sur les comptes de trésorerie liés.' };
  }

  const reference = String(entry.numeroPiece || `ECR-${entry.id}`).trim().slice(0, 100);
  const modePaiement = journal?.code === 'CA' ? 'especes' : 'virement';
  const transactions = [];
  let created = false;
  let alreadySynchronized = false;
  for (const mouvement of mouvements) {
    const bankAccount = linkedBankAccounts.find(
      (compte) => Number(compte.id) === Number(mouvement.compteBancaireId),
    );
    const [existing] = await executor.select().from(transactionsTresorerie).where(and(
      eq(transactionsTresorerie.entrepriseId, tenantId),
      eq(transactionsTresorerie.compteBancaireId, bankAccount.id),
      eq(transactionsTresorerie.numeroPiece, reference),
    )).limit(1);
    if (existing) {
      transactions.push(existing);
      alreadySynchronized = true;
      continue;
    }

    const paymentMatch = await findExistingPaymentMovement({
      executor,
      tenantId,
      reference,
      bankAccountId: bankAccount.id,
      movementType: mouvement.type,
    });
    if (paymentMatch) {
      transactions.push(paymentMatch);
      alreadySynchronized = true;
      continue;
    }

    const [createdTransaction] = await executor.insert(transactionsTresorerie).values({
      entrepriseId: tenantId,
      compteBancaireId: bankAccount.id,
      type: mouvement.type,
      montant: Math.abs(mouvement.mouvementNet).toFixed(2),
      dateTransaction: entry.dateEcriture,
      categorie: 'Écriture comptable',
      description: entry.libelle || `Écriture ${entry.numeroEcriture || entry.id}`,
      numeroPiece: reference,
      modePaiement,
      userId: auditInfo.userId || null,
    }).returning();

    await executor.update(comptesBancaires).set({
      soldeActuel: sql`COALESCE(${comptesBancaires.soldeActuel}, 0) + ${mouvement.mouvementNet}`,
      updatedAt: new Date(),
    }).where(and(
      eq(comptesBancaires.id, bankAccount.id),
      eq(comptesBancaires.entrepriseId, tenantId),
    ));

    await logAudit({
      ...auditInfo,
      entrepriseId: tenantId,
      action: 'CREATE',
      table: 'transactions_tresorerie',
      recordId: createdTransaction.id,
      nouvelleValeur: createdTransaction,
      description: `Mouvement de trésorerie synchronisé depuis l’écriture ${entry.numeroEcriture || entry.id}`,
      executor,
      required: true,
    });

    transactions.push(createdTransaction);
    created = true;
  }

  return {
    transactions,
    transaction: transactions[0] || null,
    created,
    alreadySynchronized,
  };
}

async function findExistingPaymentMovement({ executor, tenantId, reference, bankAccountId, movementType }) {
  const [clientPayment] = await executor.select({
    invoiceNumber: factures.numeroFacture,
    amount: paiements.montant,
    date: paiements.datePaiement,
  }).from(paiements).innerJoin(factures, and(
    eq(factures.id, paiements.factureId),
    eq(factures.entrepriseId, paiements.entrepriseId),
  )).where(and(
    eq(paiements.entrepriseId, tenantId),
    eq(paiements.reference, reference),
  )).limit(1);

  const [supplierPayment] = clientPayment ? [] : await executor.select({
    invoiceNumber: facturesAchat.numeroFacture,
    amount: paiementsFournisseurs.montant,
    date: paiementsFournisseurs.datePaiement,
  }).from(paiementsFournisseurs).innerJoin(facturesAchat, and(
    eq(facturesAchat.id, paiementsFournisseurs.factureId),
    eq(facturesAchat.entrepriseId, paiementsFournisseurs.entrepriseId),
  )).where(and(
    eq(paiementsFournisseurs.entrepriseId, tenantId),
    eq(paiementsFournisseurs.reference, reference),
  )).limit(1);

  const payment = clientPayment || supplierPayment;
  if (!payment?.invoiceNumber) return null;

  const [transaction] = await executor.select().from(transactionsTresorerie).where(and(
    eq(transactionsTresorerie.entrepriseId, tenantId),
    eq(transactionsTresorerie.compteBancaireId, bankAccountId),
    eq(transactionsTresorerie.numeroPiece, payment.invoiceNumber),
    eq(transactionsTresorerie.dateTransaction, payment.date),
    eq(transactionsTresorerie.type, movementType),
    eq(transactionsTresorerie.montant, String(payment.amount)),
  )).limit(1);

  return transaction || null;
}
