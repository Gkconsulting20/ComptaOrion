import express from 'express';
import { db } from '../db.js';
import { depenses, categoriesDepenses, approvalsDepenses, remboursementsEmployes, employes, liteIdempotency, projetsAssociatifs } from '../schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { createEcritureDepense } from '../services/comptabiliteService.js';
import { claimIdempotentOperation } from '../middleware/idempotency.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();

router.get('/projects-options', async (req, res) => {
  try {
    const projects = await db.select({
      id: projetsAssociatifs.id,
      code: projetsAssociatifs.code,
      nom: projetsAssociatifs.nom,
      devise: projetsAssociatifs.devise,
    }).from(projetsAssociatifs)
      .where(and(eq(projetsAssociatifs.entrepriseId, req.entrepriseId), eq(projetsAssociatifs.statut, 'actif')));
    res.json(projects);
  } catch (error) {
    console.error('Erreur options projets dépenses:', error.message);
    res.status(500).json({ error: 'Impossible de charger les projets actifs.' });
  }
});

// ==========================================
// CRUD CATÉGORIES DÉPENSES
// ==========================================

router.get('/categories', async (req, res) => {
  try {
    const categories = await db.query.categoriesDepenses.findMany({
      where: eq(categoriesDepenses.entrepriseId, req.entrepriseId)
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { nom, description, limiteApproval } = req.body;
    const category = await db.transaction(async (tx) => {
      const [created] = await tx.insert(categoriesDepenses).values({
        entrepriseId: req.entrepriseId,
        nom,
        description,
        limiteApproval: parseFloat(limiteApproval) || 0
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'categories_depenses',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Catégorie de dépense créée: ${created.nom}`,
        executor: tx,
        required: true
      });
      return created;
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ENREGISTREMENT DÉPENSES
// ==========================================

router.post('/create', async (req, res) => {
  try {
    const { categorieId, montant, dateDepense, description, justificatifUrl, récurrente, fréquenceRécurrence } = req.body;
    const rawProjectId = req.body.projetId;
    const projetId = rawProjectId ? Number(rawProjectId) : null;
    if (rawProjectId && (!Number.isSafeInteger(projetId) || projetId <= 0)) {
      return res.status(400).json({ error: 'Projet associatif invalide' });
    }
    if (projetId) {
      const [project] = await db.select({ id: projetsAssociatifs.id })
        .from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.id, projetId), eq(projetsAssociatifs.entrepriseId, req.entrepriseId)))
        .limit(1);
      if (!project) return res.status(404).json({ error: 'Projet associatif introuvable ou inactif' });
      const [activeProject] = await db.select({ id: projetsAssociatifs.id }).from(projetsAssociatifs)
        .where(and(eq(projetsAssociatifs.id, projetId), eq(projetsAssociatifs.entrepriseId, req.entrepriseId), eq(projetsAssociatifs.statut, 'actif')))
        .limit(1);
      if (!activeProject) return res.status(409).json({ error: 'Ce projet n’accepte plus de nouvelles dépenses.' });
    }
    const numericAmount = Number(montant);
    const parsedDate = dateDepense ? new Date(dateDepense) : new Date();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Number.isNaN(parsedDate.getTime()) || !String(description || '').trim()) {
      return res.status(400).json({ error: 'Montant, date et description sont obligatoires et doivent être valides' });
    }
    const result = await db.transaction(async (tx) => {
    const idempotency = await claimIdempotentOperation({
      entrepriseId: req.entrepriseId,
      idempotencyKey: req.idempotencyKey,
      insertClaim: async () => {
        const [claim] = await tx.insert(liteIdempotency).values({
          entrepriseId: req.entrepriseId,
          idempotencyKey: req.idempotencyKey,
        }).onConflictDoNothing().returning();
        return claim;
      },
      findByKey: async () => {
        const [existing] = await tx.select().from(liteIdempotency)
          .where(eq(liteIdempotency.idempotencyKey, req.idempotencyKey))
          .limit(1);
        return existing;
      },
    });
    if (idempotency.replay) return idempotency;
    let categorie = null;

    if (categorieId) {
      [categorie] = await tx.select().from(categoriesDepenses).where(and(eq(categoriesDepenses.id, parseInt(categorieId)), eq(categoriesDepenses.entrepriseId, req.entrepriseId))).limit(1);
    }

    if (!categorie) {
      [categorie] = await tx.select().from(categoriesDepenses).where(eq(categoriesDepenses.entrepriseId, req.entrepriseId)).limit(1);
    }

    if (!categorie) {
      [categorie] = await tx.insert(categoriesDepenses).values({
        entrepriseId: req.entrepriseId,
        nom: 'Divers',
        description: 'Dépenses courantes enregistrées depuis ComptaOrion Lite'
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'categories_depenses',
        recordId: categorie.id,
        nouvelleValeur: categorie,
        description: 'Catégorie de dépense par défaut créée',
        executor: tx,
        required: true
      });
    }
    
    const depense = await tx.insert(depenses).values({
      entrepriseId: req.entrepriseId,
      projetId,
      employeId: req.user.id,
      categorieId: categorie.id,
      montant: numericAmount,
      dateDepense: parsedDate,
      description: String(description).trim(),
      justificatifUrl,
      récurrente: récurrente || false,
      fréquenceRécurrence,
      statut: 'en_attente',
      montantApprouve: 0
    }).returning();

    // Créer demande d'approbation initiale
    await tx.insert(approvalsDepenses).values({
      entrepriseId: req.entrepriseId,
      depenseId: depense[0].id,
      etape: 'manager',
      statut: 'en_attente'
    });

    // Audit
    await logAudit({
      ...extractAuditInfo(req),
      action: 'CREATE',
      table: 'depenses',
      recordId: depense[0].id,
      nouvelleValeur: depense[0],
      description: `Dépense créée: ${String(description).trim()} (${numericAmount} FCFA)`,
      executor: tx,
      required: true
    });

    const body = depense[0];
    if (req.idempotencyKey) await tx.update(liteIdempotency).set({ status: 'completed', responseStatus: 200, responseBody: body, updatedAt: new Date() }).where(and(eq(liteIdempotency.entrepriseId, req.entrepriseId), eq(liteIdempotency.idempotencyKey, req.idempotencyKey)));
    return { replay: false, status: 200, body };
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { employeId } = req.query;
    const where = [eq(depenses.entrepriseId, req.entrepriseId)];
    if (employeId) where.push(eq(depenses.employeId, parseInt(employeId)));

    const depensesList = await db.query.depenses.findMany({
      where: and(...where)
    });
    res.json(depensesList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WORKFLOW D'APPROBATION
// ==========================================

router.post('/approve/:depenseId/:etape', async (req, res) => {
  try {
    const { depenseId, etape } = req.params;
    const rawStatus = String(req.body.statut || '').trim().toLowerCase();
    const statut = ({ approuvee: 'approuvée', rejetee: 'rejetée' })[rawStatus] || rawStatus;
    const role = req.user?.role;
    if (!['manager', 'comptable'].includes(etape) || !['approuvée', 'rejetée'].includes(statut)) {
      return res.status(400).json({ error: 'Étape ou décision d’approbation invalide.' });
    }
    if (role !== 'admin' &&
        ((etape === 'manager' && role !== 'manager') ||
         (etape === 'comptable' && !['accountant', 'comptable'].includes(role)))) {
      return res.status(403).json({ error: 'Votre rôle ne permet pas cette approbation.' });
    }

    const result = await db.transaction(async (tx) => {
      const [expense] = await tx.select().from(depenses).where(and(
        eq(depenses.id, Number(depenseId)),
        eq(depenses.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!expense) return { status: 404, body: { error: 'Dépense non trouvée.' } };

      const [pendingApproval] = await tx.select().from(approvalsDepenses).where(and(
        eq(approvalsDepenses.depenseId, expense.id),
        eq(approvalsDepenses.entrepriseId, req.entrepriseId),
        eq(approvalsDepenses.etape, etape),
        eq(approvalsDepenses.statut, 'en_attente')
      )).for('update').limit(1);
      if (!pendingApproval) return { status: 409, body: { error: 'Cette étape est déjà traitée ou indisponible.' } };

      const [approval] = await tx.update(approvalsDepenses).set({
        statut,
        dateApprobation: new Date(),
        approbateurId: req.user.id,
        raison: String(req.body.raison || '').trim() || null
      }).where(and(
        eq(approvalsDepenses.id, pendingApproval.id),
        eq(approvalsDepenses.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'approvals_depenses',
        recordId: approval.id,
        ancienneValeur: pendingApproval,
        nouvelleValeur: approval,
        description: `Étape ${etape} ${statut} pour la dépense ${expense.id}`,
        executor: tx,
        required: true
      });

      let updatedExpense = expense;
      let nextApproval = null;
      if (statut === 'rejetée') {
        [updatedExpense] = await tx.update(depenses).set({ statut: 'rejetée', updatedAt: new Date() })
          .where(and(eq(depenses.id, expense.id), eq(depenses.entrepriseId, req.entrepriseId))).returning();
      } else if (etape === 'manager') {
        [nextApproval] = await tx.insert(approvalsDepenses).values({
          entrepriseId: req.entrepriseId,
          depenseId: expense.id,
          etape: 'comptable',
          statut: 'en_attente'
        }).returning();
      } else {
        [updatedExpense] = await tx.update(depenses).set({
          statut: 'approuvée',
          montantApprouve: expense.montant,
          updatedAt: new Date()
        }).where(and(eq(depenses.id, expense.id), eq(depenses.entrepriseId, req.entrepriseId))).returning();
      }

      if (updatedExpense !== expense) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'UPDATE',
          table: 'depenses',
          recordId: expense.id,
          ancienneValeur: expense,
          nouvelleValeur: updatedExpense,
          description: `Statut de la dépense ${expense.id} modifié après approbation`,
          executor: tx,
          required: true
        });
      }
      if (nextApproval) {
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'approvals_depenses',
          recordId: nextApproval.id,
          nouvelleValeur: nextApproval,
          description: `Étape comptable créée pour la dépense ${expense.id}`,
          executor: tx,
          required: true
        });
      }
      return {
        status: 200,
        body: { message: statut === 'rejetée' ? 'Dépense rejetée' : `Dépense approuvée pour l'étape: ${etape}`, approval }
      };
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// REMBOURSEMENT EMPLOYÉS
// ==========================================

router.post('/remboursement', async (req, res) => {
  try {
    const depenseId = Number(req.body.depenseId);
    const montantRembourse = Number(req.body.montantRembourse);
    const dateRemboursement = req.body.dateRemboursement;
    const methodePaiement = String(req.body.methodePaiement || '').trim();
    if (!Number.isSafeInteger(depenseId) || depenseId <= 0 || !Number.isFinite(montantRembourse) ||
        montantRembourse <= 0 || !dateRemboursement || Number.isNaN(new Date(dateRemboursement).getTime())) {
      return res.status(400).json({ error: 'Dépense, montant et date de remboursement invalides.' });
    }

    const remboursement = await db.transaction(async (tx) => {
      const [depense] = await tx.select().from(depenses).where(and(
        eq(depenses.id, depenseId),
        eq(depenses.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!depense) throw Object.assign(new Error('Dépense non trouvée.'), { status: 404 });
      if (!['approuvée', 'remboursée', 'partiellement_remboursée'].includes(String(depense.statut || ''))) {
        throw Object.assign(new Error('Seule une dépense approuvée peut être remboursée.'), { status: 409 });
      }

      const [previousRefunds] = await tx.select({
        total: sql`COALESCE(SUM(${remboursementsEmployes.montantRembourse}), 0)`
      }).from(remboursementsEmployes).where(and(
        eq(remboursementsEmployes.depenseId, depense.id),
        eq(remboursementsEmployes.entrepriseId, req.entrepriseId)
      ));
      const remaining = Number(depense.montantApprouve || 0) - Number(previousRefunds.total || 0);
      if (montantRembourse > remaining + 0.005) {
        throw Object.assign(new Error('Le remboursement dépasse le montant approuvé restant.'), { status: 400 });
      }

      let employeNom = 'Employé';
      if (depense.employeId) {
        const [employe] = await tx.select().from(employes).where(and(
          eq(employes.id, depense.employeId),
          eq(employes.entrepriseId, req.entrepriseId)
        )).limit(1);
        if (employe) employeNom = `${employe.prenom || ''} ${employe.nom || ''}`.trim();
      }

      const [created] = await tx.insert(remboursementsEmployes).values({
        entrepriseId: req.entrepriseId,
        depenseId,
        montantRembourse: montantRembourse.toFixed(2),
        dateRemboursement: new Date(dateRemboursement),
        methodePaiement: methodePaiement || null,
        statut: 'complété'
      }).returning();
      const totalRembourse = Number(previousRefunds.total || 0) + montantRembourse;
      const [updatedExpense] = await tx.update(depenses).set({
        montantRembourse: totalRembourse.toFixed(2),
        statut: totalRembourse >= Number(depense.montantApprouve || 0) - 0.005
          ? 'remboursée'
          : 'partiellement_remboursée',
        updatedAt: new Date()
      }).where(and(eq(depenses.id, depense.id), eq(depenses.entrepriseId, req.entrepriseId))).returning();

      let accountingEntry = null;
      try {
        accountingEntry = await createEcritureDepense({
          entrepriseId: req.entrepriseId,
          reference: `RMB-${created.id}`,
          dateRemboursement: new Date(dateRemboursement),
          employeNom,
          description: depense.description || 'Dépense',
          montant: montantRembourse.toFixed(2),
          modePaiement: methodePaiement === 'especes' ? 'especes' : 'virement',
          categorieCompte: '62',
          executor: tx
        });
      } catch (comptaError) {
        console.error('Erreur création écriture comptable dépense:', comptaError.message);
        throw comptaError;
      }

      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'remboursements_employes',
        recordId: created.id,
        nouvelleValeur: { remboursement: created, depense: updatedExpense, ecritureComptable: accountingEntry },
        description: `Remboursement de dépense enregistré: ${montantRembourse.toFixed(2)}`,
        executor: tx,
        required: true
      });
      return created;
    });
    res.status(201).json(remboursement);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ==========================================
// EXPORT EXCEL/CSV
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const { entrepriseId, format = 'json' } = req.query;

    const dépensesList = await db.query.depenses.findMany({
      where: eq(depenses.entrepriseId, parseInt(entrepriseId))
    });

    if (format === 'csv') {
      const headers = 'Date,Employé,Catégorie,Montant,Description,Statut,Montant Remboursé\n';
      const rows = dépensesList.map(d =>
        `"${d.dateDepense}","${d.employeId}","${d.categorieId}","${d.montant}","${d.description}","${d.statut}","${d.montantRembourse || 0}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="dépenses.csv"');
      res.send(headers + rows);
    } else {
      res.json(dépensesList);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
