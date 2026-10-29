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
  if (journal?.code !== 'BQ') {
    return { skipped: 'L’écriture n’appartient pas au journal de banque.' };
  }

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
  if (linkedBankAccounts.length > 1) {
    throw Object.assign(new Error('Plusieurs comptes bancaires utilisent le même compte comptable; synchronisation ambiguë.'), { status: 409 });
  }

  const bankAccount = linkedBankAccounts[0];
  const netMovement = lines
    .filter((line) => Number(line.compteComptableId) === Number(bankAccount.compteComptableId))
    .reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
  if (Math.abs(netMovement) < 0.005) {
    return { skipped: 'Aucun mouvement net sur le compte bancaire lié.' };
  }

  const reference = String(entry.numeroPiece || `ECR-${entry.id}`).trim().slice(0, 100);
  const [existing] = await executor.select().from(transactionsTresorerie).where(and(
    eq(transactionsTresorerie.entrepriseId, tenantId),
    eq(transactionsTresorerie.compteBancaireId, bankAccount.id),
    eq(transactionsTresorerie.numeroPiece, reference),
  )).limit(1);
  if (existing) return { transaction: existing, alreadySynchronized: true };

  const movementType = netMovement > 0 ? 'encaissement' : 'decaissement';
  const paymentMatch = await findExistingPaymentMovement({
    executor,
    tenantId,
    reference,
    bankAccountId: bankAccount.id,
    movementType,
  });
  if (paymentMatch) return { transaction: paymentMatch, alreadySynchronized: true };

  const [created] = await executor.insert(transactionsTresorerie).values({
    entrepriseId: tenantId,
    compteBancaireId: bankAccount.id,
    type: movementType,
    montant: Math.abs(netMovement).toFixed(2),
    dateTransaction: entry.dateEcriture,
    categorie: 'Écriture comptable',
    description: entry.libelle || `Écriture ${entry.numeroEcriture || entry.id}`,
    numeroPiece: reference,
    modePaiement: 'virement',
    userId: auditInfo.userId || null,
  }).returning();

  await executor.update(comptesBancaires).set({
    soldeActuel: sql`COALESCE(${comptesBancaires.soldeActuel}, 0) + ${netMovement}`,
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
    recordId: created.id,
    nouvelleValeur: created,
    description: `Mouvement bancaire synchronisé depuis l’écriture ${entry.numeroEcriture || entry.id}`,
    executor,
    required: true,
  });

  return { transaction: created, created: true };
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
