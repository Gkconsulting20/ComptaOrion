import express from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  budgetsProjetsAssociatifs,
  categoriesDepenses,
  comptesComptables,
  depenses,
  ecritures,
  financementsProjetsAssociatifs,
  paiementsDepensesProjets,
  projetsAssociatifs,
  versementsFinancementsProjets,
} from '../schema.js';
import { createEcritureComptable } from '../services/comptabiliteService.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();
const positiveAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 999999999999999.99;
const safeId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const isoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

async function findProject(id, entrepriseId, executor = db) {
  if (!safeId(id)) return null;
  const [project] = await executor.select().from(projetsAssociatifs)
    .where(and(eq(projetsAssociatifs.id, Number(id)), eq(projetsAssociatifs.entrepriseId, entrepriseId)))
    .limit(1);
  return project || null;
}

async function getProjectTotals(project, entrepriseId) {
  const [budgets] = await db.select({ total: sql`COALESCE(SUM(${budgetsProjetsAssociatifs.montantAlloue}), 0)` })
    .from(budgetsProjetsAssociatifs)
    .where(and(eq(budgetsProjetsAssociatifs.projetId, project.id), eq(budgetsProjetsAssociatifs.entrepriseId, entrepriseId)));
  const [expenses] = await db.select({ total: sql`COALESCE(SUM(${depenses.montant}), 0)` })
    .from(depenses)
    .where(and(
      eq(depenses.projetId, project.id),
      eq(depenses.entrepriseId, entrepriseId),
      sql`COALESCE(${depenses.statut}, '') NOT IN ('rejetée', 'rejetee', 'annulee', 'annulée')`,
    ));
  const [payments] = await db.select({ total: sql`COALESCE(SUM(${paiementsDepensesProjets.montant}), 0)` })
    .from(paiementsDepensesProjets)
    .innerJoin(depenses, eq(paiementsDepensesProjets.depenseId, depenses.id))
    .where(and(
      eq(depenses.projetId, project.id),
      eq(depenses.entrepriseId, entrepriseId),
    ));
  const [pendingExpenses] = await db.select({ total: sql`COALESCE(SUM(${depenses.montant}), 0)` })
    .from(depenses)
    .where(and(
      eq(depenses.projetId, project.id),
      eq(depenses.entrepriseId, entrepriseId),
      sql`COALESCE(${depenses.statut}, '') IN ('en_attente', 'soumise')`,
    ));
  const [pledges] = await db.select({ total: sql`COALESCE(SUM(${financementsProjetsAssociatifs.montantEngage}), 0)` })
    .from(financementsProjetsAssociatifs)
    .where(and(eq(financementsProjetsAssociatifs.projetId, project.id), eq(financementsProjetsAssociatifs.entrepriseId, entrepriseId)));
  const receivedForProject = await db.select({ total: sql`COALESCE(SUM(${versementsFinancementsProjets.montant}), 0)` })
    .from(versementsFinancementsProjets)
    .innerJoin(financementsProjetsAssociatifs, eq(versementsFinancementsProjets.financementId, financementsProjetsAssociatifs.id))
    .where(and(eq(financementsProjetsAssociatifs.projetId, project.id), eq(financementsProjetsAssociatifs.entrepriseId, entrepriseId)));
  const budgetLines = Number(budgets.total);
  const committed = Number(expenses.total);
  const spent = Number(payments.total);
  return {
    budgetLines,
    spent,
    committed,
    unpaid: Math.max(0, committed - spent),
    pendingApproval: Number(pendingExpenses.total),
    pledged: Number(pledges.total),
    received: Number(receivedForProject[0]?.total || 0),
    budgetRemaining: Number(project.budgetTotal) - committed,
    budgetAllocatedRemaining: Number(project.budgetTotal) - budgetLines,
  };
}

router.get('/projects', async (req, res) => {
  try {
    const projects = await db.select().from(projetsAssociatifs)
      .where(eq(projetsAssociatifs.entrepriseId, req.entrepriseId))
      .orderBy(desc(projetsAssociatifs.createdAt));
    res.json(await Promise.all(projects.map(async (project) => ({
      ...project,
      totals: await getProjectTotals(project, req.entrepriseId),
    }))));
  } catch (error) {
    console.error('Erreur liste projets associatifs:', error.message);
    res.status(500).json({ error: 'Impossible de charger les projets.' });
  }
});

router.post('/projects', async (req, res) => {
  const { code, nom, description, bailleur, referenceConvention, dateDebut, dateFin, budgetTotal, devise = 'FCFA' } = req.body;
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(normalizedCode) || !String(nom || '').trim() ||
      !positiveAmount(budgetTotal) || !isoDate(dateDebut) || (dateFin && (!isoDate(dateFin) || dateFin < dateDebut)) ||
      !/^[A-Z0-9]{2,10}$/i.test(devise)) {
    return res.status(400).json({ error: 'Code, nom, dates, devise ou budget du projet invalide.' });
  }
  try {
    const project = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${Number(req.entrepriseId)}, 765432)`);
      const [existing] = await tx.select({ id: projetsAssociatifs.id }).from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.entrepriseId, req.entrepriseId), eq(projetsAssociatifs.code, normalizedCode))).limit(1);
      if (existing) return null;
      const [created] = await tx.insert(projetsAssociatifs).values({
        entrepriseId: req.entrepriseId,
        code: normalizedCode,
        nom: String(nom).trim(),
        description: String(description || '').trim() || null,
        bailleur: String(bailleur || '').trim() || null,
        referenceConvention: String(referenceConvention || '').trim() || null,
        dateDebut,
        dateFin: dateFin || null,
        budgetTotal: Number(budgetTotal).toFixed(2),
        devise: devise.toUpperCase(),
        userId: req.user.id,
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'projets_associatifs',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Projet associatif créé: ${created.code} - ${created.nom}`,
        executor: tx,
        required: true
      });
      return created;
    });
    if (!project) return res.status(409).json({ error: 'Ce code de projet est déjà utilisé.' });
    res.status(201).json(project);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ce code de projet est déjà utilisé.' });
    console.error('Erreur création projet associatif:', error.message);
    res.status(500).json({ error: 'Impossible de créer le projet.' });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      const project = await findProject(req.params.id, req.entrepriseId, tx);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };
      const changes = {};
      for (const key of ['nom', 'description', 'bailleur', 'referenceConvention']) {
        if (key in req.body) changes[key] = String(req.body[key] || '').trim() || null;
      }
      if ('statut' in req.body) {
        if (!['actif', 'suspendu', 'termine', 'archive'].includes(req.body.statut)) {
          return { status: 400, body: { error: 'Statut invalide.' } };
        }
        changes.statut = req.body.statut;
      }
      if ('budgetTotal' in req.body) {
        if (!positiveAmount(req.body.budgetTotal)) return { status: 400, body: { error: 'Le budget doit être positif.' } };
        changes.budgetTotal = Number(req.body.budgetTotal).toFixed(2);
      }
      if ('dateFin' in req.body) {
        if (req.body.dateFin && (!isoDate(req.body.dateFin) || req.body.dateFin < project.dateDebut)) {
          return { status: 400, body: { error: 'Date de fin invalide.' } };
        }
        changes.dateFin = req.body.dateFin || null;
      }
      changes.updatedAt = new Date();
      const [updated] = await tx.update(projetsAssociatifs).set(changes)
        .where(and(eq(projetsAssociatifs.id, project.id), eq(projetsAssociatifs.entrepriseId, req.entrepriseId)))
        .returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'projets_associatifs',
        recordId: project.id,
        ancienneValeur: project,
        nouvelleValeur: updated,
        description: `Projet associatif modifié: ${project.code}`,
        executor: tx,
        required: true
      });
      return { status: 200, body: updated };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur modification projet associatif:', error.message);
    res.status(500).json({ error: 'Impossible de mettre à jour le projet.' });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await db.select({
      id: comptesComptables.id,
      numero: comptesComptables.numero,
      nom: comptesComptables.nom,
    }).from(comptesComptables).where(eq(comptesComptables.entrepriseId, req.entrepriseId)).orderBy(comptesComptables.numero);
    res.json({
      treasury: accounts.filter((account) => /^(51|52|53|54|55|57)/.test(account.numero)),
      grants: accounts.filter((account) => /^(13|14|71|74)/.test(account.numero)),
      expenseAccounts: accounts.filter((account) => /^(2|6)/.test(account.numero)),
    });
  } catch (error) {
    console.error('Erreur comptes associatifs:', error.message);
    res.status(500).json({ error: 'Impossible de charger les comptes de financement.' });
  }
});

router.get('/projects/:id/report', async (req, res) => {
  try {
    const project = await findProject(req.params.id, req.entrepriseId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
    const [budgets, expenses, financings, receipts] = await Promise.all([
      db.select({
        id: budgetsProjetsAssociatifs.id,
        poste: budgetsProjetsAssociatifs.poste,
        compteComptableId: budgetsProjetsAssociatifs.compteComptableId,
        montantAlloue: budgetsProjetsAssociatifs.montantAlloue,
        compteNumero: comptesComptables.numero,
        compteNom: comptesComptables.nom,
      }).from(budgetsProjetsAssociatifs)
        .leftJoin(comptesComptables, eq(budgetsProjetsAssociatifs.compteComptableId, comptesComptables.id))
        .where(and(eq(budgetsProjetsAssociatifs.projetId, project.id), eq(budgetsProjetsAssociatifs.entrepriseId, req.entrepriseId))),
      db.select({
        id: depenses.id,
        dateDepense: depenses.dateDepense,
        description: depenses.description,
        montant: depenses.montant,
        statut: depenses.statut,
        categorie: categoriesDepenses.nom,
      }).from(depenses).leftJoin(categoriesDepenses, eq(depenses.categorieId, categoriesDepenses.id))
        .where(and(eq(depenses.projetId, project.id), eq(depenses.entrepriseId, req.entrepriseId)))
        .orderBy(desc(depenses.dateDepense)),
      db.select().from(financementsProjetsAssociatifs)
        .where(and(eq(financementsProjetsAssociatifs.projetId, project.id), eq(financementsProjetsAssociatifs.entrepriseId, req.entrepriseId))),
      db.select({
        id: versementsFinancementsProjets.id,
        montant: versementsFinancementsProjets.montant,
        dateVersement: versementsFinancementsProjets.dateVersement,
        numeroPiece: versementsFinancementsProjets.numeroPiece,
        ecritureId: versementsFinancementsProjets.ecritureId,
        ecritureNumero: ecritures.numeroEcriture,
        financementId: versementsFinancementsProjets.financementId,
      }).from(versementsFinancementsProjets)
        .innerJoin(financementsProjetsAssociatifs, eq(versementsFinancementsProjets.financementId, financementsProjetsAssociatifs.id))
        .innerJoin(ecritures, eq(versementsFinancementsProjets.ecritureId, ecritures.id))
        .where(and(eq(versementsFinancementsProjets.entrepriseId, req.entrepriseId), eq(financementsProjetsAssociatifs.projetId, project.id)))
        .orderBy(desc(versementsFinancementsProjets.dateVersement)),
    ]);
    const expenseIds = expenses.map((expense) => expense.id);
    const paymentRows = expenseIds.length
      ? await db.select().from(paiementsDepensesProjets)
        .where(and(
          eq(paiementsDepensesProjets.entrepriseId, req.entrepriseId),
          inArray(paiementsDepensesProjets.depenseId, expenseIds),
        ))
        .orderBy(desc(paiementsDepensesProjets.datePaiement))
      : [];
    const entryIds = [...new Set(paymentRows.map((payment) => payment.ecritureId))];
    const accountIds = [...new Set(paymentRows.flatMap((payment) => [
      payment.compteTresorerieId,
      payment.compteChargeId,
    ]))];
    const [paymentEntries, paymentAccounts] = await Promise.all([
      entryIds.length
        ? db.select({ id: ecritures.id, numeroEcriture: ecritures.numeroEcriture })
          .from(ecritures)
          .where(and(eq(ecritures.entrepriseId, req.entrepriseId), inArray(ecritures.id, entryIds)))
        : [],
      accountIds.length
        ? db.select({
          id: comptesComptables.id,
          numero: comptesComptables.numero,
          nom: comptesComptables.nom,
        }).from(comptesComptables)
          .where(and(
            eq(comptesComptables.entrepriseId, req.entrepriseId),
            inArray(comptesComptables.id, accountIds),
          ))
        : [],
    ]);
    const entryNumbers = new Map(paymentEntries.map((entry) => [entry.id, entry.numeroEcriture]));
    const accountNumbers = new Map(paymentAccounts.map((account) => [account.id, account.numero]));
    const paymentsByExpense = new Map();
    for (const payment of paymentRows) {
      if (!paymentsByExpense.has(payment.depenseId)) paymentsByExpense.set(payment.depenseId, []);
      paymentsByExpense.get(payment.depenseId).push({
        id: payment.id,
        montant: payment.montant,
        datePaiement: payment.datePaiement,
        numeroPiece: payment.numeroPiece,
        ecritureNumero: entryNumbers.get(payment.ecritureId) || null,
        compteTresorerieNumero: accountNumbers.get(payment.compteTresorerieId) || null,
        compteChargeNumero: accountNumbers.get(payment.compteChargeId) || null,
      });
    }
    const expensesWithPayments = expenses.map((expense) => {
      const paiements = paymentsByExpense.get(expense.id) || [];
      const montantPaye = paiements.reduce((total, payment) => total + Number(payment.montant), 0);
      const rejected = ['rejetée', 'rejetee', 'annulee', 'annulée'].includes(String(expense.statut || '').toLowerCase());
      const soldeAPayer = rejected ? 0 : Math.max(0, Number(expense.montant) - montantPaye);
      const statutPaiement = rejected
        ? 'annulee'
        : soldeAPayer <= 0.005 ? 'payee' : montantPaye > 0 ? 'partiellement_payee' : 'non_payee';
      return { ...expense, montantPaye, soldeAPayer, statutPaiement, paiements };
    });
    const totals = await getProjectTotals(project, req.entrepriseId);
    res.json({ project, totals, budgets, expenses: expensesWithPayments, financings, receipts });
  } catch (error) {
    console.error('Erreur rapport associatif:', error.message);
    res.status(500).json({ error: 'Impossible de charger le suivi du projet.' });
  }
});

router.post('/projects/:id/budgets', async (req, res) => {
  const { id, poste, montantAlloue, compteComptableId } = req.body;
  if (!safeId(req.params.id) || !String(poste || '').trim() || String(poste).trim().length > 160 || !positiveAmount(montantAlloue) ||
      (compteComptableId && !safeId(compteComptableId))) {
    return res.status(400).json({ error: 'Poste budgétaire ou montant invalide.' });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [project] = await tx.select().from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.id, Number(req.params.id)), eq(projetsAssociatifs.entrepriseId, req.entrepriseId)))
        .for('update').limit(1);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };
      if (project.statut !== 'actif') return { status: 409, body: { error: 'Un projet suspendu, terminé ou archivé ne peut plus être budgété.' } };
      let account = null;
      if (compteComptableId) {
        const [foundAccount] = await tx.select().from(comptesComptables)
          .where(and(eq(comptesComptables.id, Number(compteComptableId)), eq(comptesComptables.entrepriseId, req.entrepriseId))).limit(1);
        if (!foundAccount || !/^6/.test(foundAccount.numero)) return { status: 400, body: { error: 'Le poste budgétaire doit utiliser un compte de charges de votre entreprise.' } };
        account = foundAccount;
      }
      const normalizedName = String(poste).trim();
      const [existing] = await tx.select().from(budgetsProjetsAssociatifs)
        .where(and(eq(budgetsProjetsAssociatifs.projetId, project.id), eq(budgetsProjetsAssociatifs.entrepriseId, req.entrepriseId),
          sql`lower(${budgetsProjetsAssociatifs.poste}) = lower(${normalizedName})`)).limit(1);
      const [total] = await tx.select({ total: sql`COALESCE(SUM(${budgetsProjetsAssociatifs.montantAlloue}), 0)` })
        .from(budgetsProjetsAssociatifs)
        .where(and(eq(budgetsProjetsAssociatifs.projetId, project.id), eq(budgetsProjetsAssociatifs.entrepriseId, req.entrepriseId)));
      const newTotal = Number(total.total) - Number(existing?.montantAlloue || 0) + Number(montantAlloue);
      if (newTotal > Number(project.budgetTotal) + 0.005) {
        return { status: 400, body: { error: 'La somme des postes dépasserait le budget total du projet.', budgetTotal: project.budgetTotal, montantPostes: Number(total.total) } };
      }
      const values = {
        entrepriseId: req.entrepriseId,
        projetId: project.id,
        poste: normalizedName,
        montantAlloue: Number(montantAlloue).toFixed(2),
        compteComptableId: account?.id || null,
      };
      const [line] = existing
        ? await tx.update(budgetsProjetsAssociatifs).set(values).where(eq(budgetsProjetsAssociatifs.id, existing.id)).returning()
        : await tx.insert(budgetsProjetsAssociatifs).values(values).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: existing ? 'UPDATE' : 'CREATE',
        table: 'budgets_projets_associatifs',
        recordId: line.id,
        ancienneValeur: existing || null,
        nouvelleValeur: line,
        description: `Poste budgétaire ${existing ? 'modifié' : 'créé'}: ${line.poste} (${project.code})`,
        executor: tx,
        required: true
      });
      return { status: existing ? 200 : 201, body: line };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur poste de budget associatif:', error.message);
    res.status(500).json({ error: 'Impossible d’enregistrer le poste budgétaire.' });
  }
});

router.post('/projects/:id/financings', async (req, res) => {
  const { bailleur, referenceConvention, montantEngage } = req.body;
  if (!String(bailleur || '').trim() || String(bailleur).trim().length > 255 || !positiveAmount(montantEngage)) {
    return res.status(400).json({ error: 'Bailleur et montant engagé valide requis.' });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const project = await findProject(req.params.id, req.entrepriseId, tx);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };
      if (project.statut !== 'actif') return { status: 409, body: { error: 'Le projet n’accepte plus de financement.' } };
      const [financing] = await tx.insert(financementsProjetsAssociatifs).values({
        entrepriseId: req.entrepriseId,
        projetId: project.id,
        bailleur: String(bailleur).trim(),
        referenceConvention: String(referenceConvention || '').trim() || null,
        montantEngage: Number(montantEngage).toFixed(2),
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'financements_projets_associatifs',
        recordId: financing.id,
        nouvelleValeur: financing,
        description: `Financement engagé pour ${project.code}: ${financing.bailleur}`,
        executor: tx,
        required: true
      });
      return { status: 201, body: financing };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur financement associatif:', error.message);
    res.status(500).json({ error: 'Impossible d’enregistrer le financement.' });
  }
});

router.post('/projects/:id/financings/:financingId/receipts', async (req, res) => {
  const { montant, dateVersement, numeroPiece, compteTresorerieId, compteProduitId } = req.body;
  if (!safeId(req.params.id) || !safeId(req.params.financingId) || !positiveAmount(montant) || !isoDate(dateVersement) || (numeroPiece && String(numeroPiece).length > 120) ||
      !safeId(compteTresorerieId) || !safeId(compteProduitId)) {
    return res.status(400).json({ error: 'Montant, date, pièce ou comptes du versement invalides.' });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [project] = await tx.select().from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.id, Number(req.params.id)), eq(projetsAssociatifs.entrepriseId, req.entrepriseId)))
        .for('update').limit(1);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };
      const [financing] = await tx.select().from(financementsProjetsAssociatifs)
        .where(and(eq(financementsProjetsAssociatifs.id, Number(req.params.financingId)),
          eq(financementsProjetsAssociatifs.projetId, project.id),
          eq(financementsProjetsAssociatifs.entrepriseId, req.entrepriseId)))
        .for('update').limit(1);
      if (!financing) return { status: 404, body: { error: 'Financement introuvable.' } };
      const [received] = await tx.select({ total: sql`COALESCE(SUM(${versementsFinancementsProjets.montant}), 0)` })
        .from(versementsFinancementsProjets)
        .where(and(eq(versementsFinancementsProjets.financementId, financing.id),
          eq(versementsFinancementsProjets.entrepriseId, req.entrepriseId)));
      const remaining = Number(financing.montantEngage) - Number(received.total);
      if (Number(montant) > remaining + 0.005) {
        return { status: 400, body: { error: 'Le versement dépasse le montant restant à recevoir.', montantRestant: remaining } };
      }
      const [bank] = await tx.select().from(comptesComptables)
        .where(and(eq(comptesComptables.id, Number(compteTresorerieId)), eq(comptesComptables.entrepriseId, req.entrepriseId))).limit(1);
      const [income] = await tx.select().from(comptesComptables)
        .where(and(eq(comptesComptables.id, Number(compteProduitId)), eq(comptesComptables.entrepriseId, req.entrepriseId))).limit(1);
      if (!bank || !/^(51|52|53|54|55|57)/.test(bank.numero) || !income || !/^(13|14|71|74)/.test(income.numero)) {
        return { status: 400, body: { error: 'Choisissez un compte de banque/caisse et un compte adapté aux subventions.' } };
      }
      const value = Number(montant).toFixed(2);
      const entry = await createEcritureComptable({
        entrepriseId: req.entrepriseId,
        journalCode: bank.numero.startsWith('57') ? 'CA' : 'BQ',
        journalNom: bank.numero.startsWith('57') ? 'Caisse - financements associatifs' : 'Banque - financements associatifs',
        journalType: bank.numero.startsWith('57') ? 'caisse' : 'banque',
        dateEcriture: dateVersement,
        libelle: `Versement ${financing.bailleur} - ${project.code}`,
        numeroPiece: String(numeroPiece || `${project.code}-FIN-${Date.now()}`).trim(),
        lignes: [
          { compteComptableId: bank.id, debit: value, credit: '0.00', libelle: `Réception financement ${project.code}` },
          { compteComptableId: income.id, debit: '0.00', credit: value, libelle: `Subvention reçue - ${project.code}` },
        ],
        valide: true,
        executor: tx,
      });
      await tx.update(ecritures).set({ userId: req.user.id }).where(eq(ecritures.id, entry.id));
      const [receipt] = await tx.insert(versementsFinancementsProjets).values({
        entrepriseId: req.entrepriseId,
        financementId: financing.id,
        montant: value,
        dateVersement,
        numeroPiece: String(numeroPiece || '').trim() || null,
        compteTresorerieId: bank.id,
        compteProduitId: income.id,
        ecritureId: entry.id,
        userId: req.user.id,
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'versements_financements_projets',
        recordId: receipt.id,
        nouvelleValeur: { receipt, accountingEntry: entry },
        description: `Financement reçu pour ${project.code}: ${value}`,
        executor: tx,
        required: true
      });
      return { status: 201, body: { receipt, accountingEntry: entry, montantRestant: remaining - Number(value) } };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur versement financement associatif:', error.message);
    res.status(500).json({ error: 'Le versement et son écriture comptable ont été annulés.' });
  }
});

router.post('/projects/:id/expenses', async (req, res) => {
  const depenseId = Number(req.body.depenseId);
  if (!safeId(req.params.id) || !safeId(depenseId)) return res.status(400).json({ error: 'Projet ou dépense invalide.' });
  try {
    const result = await db.transaction(async (tx) => {
      const [project] = await tx.select().from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.id, Number(req.params.id)), eq(projetsAssociatifs.entrepriseId, req.entrepriseId)))
        .for('update').limit(1);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };
      if (project.statut !== 'actif') return { status: 409, body: { error: 'Seul un projet actif peut recevoir de nouvelles dépenses.' } };
      const [expense] = await tx.select().from(depenses)
        .where(and(eq(depenses.id, depenseId), eq(depenses.entrepriseId, req.entrepriseId))).for('update').limit(1);
      if (!expense) return { status: 404, body: { error: 'Dépense introuvable.' } };
      if (expense.projetId && expense.projetId !== project.id) return { status: 409, body: { error: 'Cette dépense est déjà liée à un autre projet.' } };
      if (expense.projetId === project.id) return { status: 200, body: expense };
      const [linked] = await tx.update(depenses).set({ projetId: project.id, updatedAt: new Date() })
        .where(and(eq(depenses.id, expense.id), eq(depenses.entrepriseId, req.entrepriseId))).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'depenses',
        recordId: expense.id,
        ancienneValeur: expense,
        nouvelleValeur: linked,
        description: `Dépense rattachée au projet ${project.code}`,
        executor: tx,
        required: true
      });
      return { status: 200, body: linked };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Erreur liaison dépense-projet:', error.message);
    res.status(500).json({ error: 'Impossible de rattacher cette dépense.' });
  }
});

router.post('/projects/:id/expenses/:expenseId/payments', async (req, res) => {
  const {
    montant,
    datePaiement,
    numeroPiece,
    compteTresorerieId,
    compteChargeId,
  } = req.body;
  if (!safeId(req.params.id) || !safeId(req.params.expenseId) ||
      !positiveAmount(montant) || !isoDate(datePaiement) ||
      (numeroPiece && String(numeroPiece).length > 120) ||
      !safeId(compteTresorerieId) || !safeId(compteChargeId)) {
    return res.status(400).json({ error: 'Montant, date, pièce ou comptes du paiement invalides.' });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [project] = await tx.select().from(projetsAssociatifs)
        .where(and(
          eq(projetsAssociatifs.id, Number(req.params.id)),
          eq(projetsAssociatifs.entrepriseId, req.entrepriseId),
        ))
        .for('update')
        .limit(1);
      if (!project) return { status: 404, body: { error: 'Projet introuvable.' } };

      const [expense] = await tx.select().from(depenses)
        .where(and(
          eq(depenses.id, Number(req.params.expenseId)),
          eq(depenses.projetId, project.id),
          eq(depenses.entrepriseId, req.entrepriseId),
        ))
        .for('update')
        .limit(1);
      if (!expense) return { status: 404, body: { error: 'Dépense introuvable dans ce projet.' } };
      if (['rejetée', 'rejetee', 'annulee', 'annulée'].includes(String(expense.statut || '').toLowerCase())) {
        return { status: 409, body: { error: 'Une dépense rejetée ou annulée ne peut pas être payée.' } };
      }

      const [alreadyPaid] = await tx.select({
        total: sql`COALESCE(SUM(${paiementsDepensesProjets.montant}), 0)`,
      }).from(paiementsDepensesProjets)
        .where(and(
          eq(paiementsDepensesProjets.depenseId, expense.id),
          eq(paiementsDepensesProjets.entrepriseId, req.entrepriseId),
        ));
      const remaining = Number(expense.montant) - Number(alreadyPaid.total);
      if (Number(montant) > remaining + 0.005) {
        return {
          status: 400,
          body: { error: 'Le paiement dépasse le solde restant de la dépense.', montantRestant: Math.max(0, remaining) },
        };
      }

      const [bank] = await tx.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, Number(compteTresorerieId)),
          eq(comptesComptables.entrepriseId, req.entrepriseId),
        ))
        .limit(1);
      const [charge] = await tx.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, Number(compteChargeId)),
          eq(comptesComptables.entrepriseId, req.entrepriseId),
        ))
        .limit(1);
      if (!bank || !/^(51|52|53|54|55|57)/.test(bank.numero) ||
          !charge || !/^(2|6)/.test(charge.numero)) {
        return { status: 400, body: { error: 'Choisissez un compte de trésorerie (51–57) et un compte de charge ou d’immobilisation (2 ou 6).' } };
      }

      const amount = Number(montant).toFixed(2);
      const piece = String(numeroPiece || `${project.code}-D${expense.id}-PAY-${Date.now()}`).trim();
      const journalCode = bank.numero.startsWith('57') ? 'CA' : 'BQ';
      const entry = await createEcritureComptable({
        entrepriseId: req.entrepriseId,
        journalCode,
        journalNom: bank.numero.startsWith('57') ? 'Journal de caisse - dépenses de projet' : 'Journal de banque - dépenses de projet',
        journalType: bank.numero.startsWith('57') ? 'caisse' : 'banque',
        dateEcriture: datePaiement,
        libelle: `Paiement ${expense.description || 'dépense'} - ${project.code}`,
        numeroPiece: piece,
        lignes: [
          {
            compteComptableId: charge.id,
            debit: amount,
            credit: '0.00',
            libelle: `Dépense ${project.code} - ${expense.description || ''}`,
          },
          {
            compteComptableId: bank.id,
            debit: '0.00',
            credit: amount,
            libelle: `Règlement ${project.code} - ${expense.description || ''}`,
          },
        ],
        valide: true,
        executor: tx,
      });
      await tx.update(ecritures).set({ userId: req.user.id }).where(eq(ecritures.id, entry.id));

      const [payment] = await tx.insert(paiementsDepensesProjets).values({
        entrepriseId: req.entrepriseId,
        depenseId: expense.id,
        montant: amount,
        datePaiement,
        numeroPiece: piece,
        compteTresorerieId: bank.id,
        compteChargeId: charge.id,
        ecritureId: entry.id,
        userId: req.user.id,
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'paiements_depenses_projets',
        recordId: payment.id,
        nouvelleValeur: { payment, accountingEntry: entry },
        description: `Paiement de dépense du projet ${project.code}: ${amount}`,
        executor: tx,
        required: true
      });
      return {
        status: 201,
        body: {
          payment,
          accountingEntry: entry,
          montantPaye: Number(alreadyPaid.total) + Number(amount),
          soldeAPayer: Math.max(0, remaining - Number(amount)),
        },
      };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Cette pièce de paiement existe déjà.' });
    console.error('Erreur paiement dépense associative:', error.message);
    res.status(500).json({ error: 'Le paiement et son écriture comptable ont été annulés.' });
  }
});

router.delete('/projects/:id/expenses/:expenseId', async (req, res) => {
  if (!safeId(req.params.id) || !safeId(req.params.expenseId)) {
    return res.status(400).json({ error: 'Projet ou dépense invalide.' });
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [expense] = await tx.select().from(depenses).where(and(
        eq(depenses.projetId, Number(req.params.id)),
        eq(depenses.id, Number(req.params.expenseId)),
        eq(depenses.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!expense) return null;
      const [unlinked] = await tx.update(depenses).set({ projetId: null, updatedAt: new Date() })
        .where(and(eq(depenses.projetId, Number(req.params.id)), eq(depenses.id, expense.id),
          eq(depenses.entrepriseId, req.entrepriseId))).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'depenses',
        recordId: expense.id,
        ancienneValeur: expense,
        nouvelleValeur: unlinked,
        description: 'Dépense détachée de son projet associatif',
        executor: tx,
        required: true
      });
      return unlinked;
    });
    if (!result) return res.status(404).json({ error: 'Dépense associée introuvable.' });
    res.json({ message: 'Dépense détachée du projet.' });
  } catch (error) {
    console.error('Erreur retrait dépense-projet:', error.message);
    res.status(500).json({ error: 'Impossible de détacher cette dépense.' });
  }
});

export default router;
