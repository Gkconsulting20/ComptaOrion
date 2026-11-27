// Cycle de vie essai → blocage → suppression + purge des démos.
// Étude : ~/workspace/demo-mode-design-2026-11-27.md (§6).
//
// Cycle confirmé par Cap (27 nov. 2026) : 30 jours d'essai → compte bloqué
// (calculé à chaque requête, jamais un drapeau en base) → 30 jours de blocage
// → suppression définitive de l'entreprise et de ses données.
//
// Sécurité (§6.3) : jamais de suppression immédiate, jamais sur un seul
// signal, re-vérification ligne par ligne avec SELECT ... FOR UPDATE dans la
// transaction de suppression, LIMIT par exécution, mode dry-run obligatoire
// tant que trial_purge_enabled = false (défaut).
import { db } from '../db.js';
import { and, eq, sql } from 'drizzle-orm';
import {
  entreprises, abonnements, plansAbonnement, saasClients, saasVentes,
  parametresPlateforme, suppressionsEntreprises,
} from '../schema.js';
import { MULTI_TENANT_TABLES, withPlatformAdminTransaction } from '../utils/rlsPolicies.js';
import { TRIAL_DURATION_DAYS, TRIAL_SUBSCRIPTION_NOTE } from './trialSubscription.js';

export const APPLICATION_NAME = 'comptaorion';
export const DEFAULT_TRIAL_DELETION_DELAY_DAYS = 30;
export const DEFAULT_DEMO_RETENTION_DAYS = 7;
export const PURGE_BATCH_LIMIT = 50;

const DEMO_MOTIF = 'demo_expiree';
const TRIAL_MOTIF = 'essai_expire_non_converti';

// ---------------------------------------------------------------------------
// Paramètres plateforme (table d'abord, variable d'environnement ensuite,
// défaut en dernier ; valeur invalide → défaut + avertissement)
// ---------------------------------------------------------------------------

export async function getPlatformParams(executor = db) {
  const defaults = {
    trialDeletionDelayDays: DEFAULT_TRIAL_DELETION_DELAY_DAYS,
    demoRetentionDays: DEFAULT_DEMO_RETENTION_DAYS,
    trialPurgeEnabled: false,
  };
  let rows = [];
  try {
    rows = await executor.select().from(parametresPlateforme);
  } catch (error) {
    console.warn('Lecture parametres_plateforme impossible, défauts appliqués:', error?.message);
  }
  const values = new Map(rows.map((row) => [row.cle, row.valeur]));
  const readInt = (key, envName, fallback) => {
    const raw = values.get(key) ?? process.env[envName];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      console.warn(`Paramètre ${key} invalide (${raw}) — défaut ${fallback} appliqué.`);
      return fallback;
    }
    return parsed;
  };
  const enabledRaw = values.get('trial_purge_enabled') ?? process.env.TRIAL_PURGE_ENABLED;
  return {
    trialDeletionDelayDays: readInt('trial_deletion_delay_days', 'TRIAL_DELETION_DELAY_DAYS', defaults.trialDeletionDelayDays),
    demoRetentionDays: readInt('demo_retention_days', 'DEMO_RETENTION_DAYS', defaults.demoRetentionDays),
    trialPurgeEnabled: String(enabledRaw ?? '').trim().toLowerCase() === 'true',
  };
}

export function trialEndDate(subscriptionCreatedAt) {
  return new Date(new Date(subscriptionCreatedAt).getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

// Les requêtes SQL brutes renvoient les horodatages comme des chaînes
// (timestamp sans fuseau via pg) ; Drizzle exige des objets Date.
function toDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Éligibilité — fonction pure (testée par la matrice §6.3)
// ---------------------------------------------------------------------------

/**
 * Une entreprise est supprimable si et seulement si TOUTES les conditions
 * sont vraies. `candidate` : { id, isDemo, remarques, planPrix, statut,
 * hasConfirmedSale, dateFinEssai }.
 */
export function isEligibleForTrialPurge(candidate, { delayDays = DEFAULT_TRIAL_DELETION_DELAY_DAYS, now = new Date() } = {}) {
  if (!candidate || !Number.isSafeInteger(Number(candidate.id))) {
    return { eligible: false, reason: 'candidat-manquant' };
  }
  if (Number(candidate.id) === 1) return { eligible: false, reason: 'entreprise-1-protegee' };
  if (candidate.isDemo) return { eligible: false, reason: 'demo' };
  if (candidate.remarques !== TRIAL_SUBSCRIPTION_NOTE) return { eligible: false, reason: 'pas-un-essai' };
  if (Number(candidate.planPrix) !== 0) return { eligible: false, reason: 'plan-payant' };
  if (candidate.statut !== 'actif') return { eligible: false, reason: `statut-${candidate.statut}` };
  if (candidate.hasConfirmedSale) return { eligible: false, reason: 'vente-confirmee' };
  const finEssai = new Date(candidate.dateFinEssai);
  if (!Number.isFinite(finEssai.getTime())) return { eligible: false, reason: 'fin-essai-inconnue' };
  const eligibleAt = new Date(finEssai.getTime() + Number(delayDays) * 24 * 60 * 60 * 1000);
  if (now < eligibleAt) return { eligible: false, reason: 'delai-non-atteint', eligibleAt };
  return { eligible: true, reason: 'eligible', eligibleAt, dateFinEssai: finEssai };
}

// ---------------------------------------------------------------------------
// Candidats
// ---------------------------------------------------------------------------

export async function listTrialCandidates(executor = db) {
  const result = await executor.execute(sql`
    SELECT e.id AS id, e.nom AS nom, e.email AS email,
      e.created_at AS "dateInscription", e.is_demo AS "isDemo",
      a.remarques AS remarques, a.statut AS statut,
      a.created_at AS "abonnementCreatedAt",
      p.prix AS "planPrix",
      EXISTS (
        SELECT 1 FROM saas_ventes v
        WHERE v.client_id = sc.id AND v.statut = 'confirmée'
      ) AS "hasConfirmedSale"
    FROM entreprises e
    LEFT JOIN abonnements a ON a.entreprise_id = e.id
    LEFT JOIN plans_abonnement p ON p.id = a.plan_id
    LEFT JOIN saas_clients sc ON sc.entreprise_id = e.id
    WHERE e.id <> 1
    ORDER BY e.created_at ASC
  `);
  const rows = result.rows || result || [];
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    isDemo: row.isDemo === true,
    planPrix: row.planPrix === null || row.planPrix === undefined ? null : Number(row.planPrix),
    hasConfirmedSale: row.hasConfirmedSale === true,
    dateFinEssai: row.abonnementCreatedAt ? trialEndDate(row.abonnementCreatedAt) : null,
  }));
}

export async function listDemoCandidates(executor = db, retentionDays = DEFAULT_DEMO_RETENTION_DAYS) {
  const result = await executor.execute(sql`
    SELECT id, nom, email, created_at AS "dateInscription"
    FROM entreprises
    WHERE is_demo = true
      AND created_at < now() - make_interval(days => ${Number(retentionDays)})
    ORDER BY created_at ASC
  `);
  const rows = result.rows || result || [];
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

/** Candidats annotés (essais + démos) pour l'Admin SaaS et le dry-run. */
export async function listPurgeCandidates(executor = db, { now = new Date() } = {}) {
  const params = await getPlatformParams(executor);
  const trials = await listTrialCandidates(executor);
  const annotatedTrials = trials.map((candidate) => {
    const verdict = isEligibleForTrialPurge(candidate, { delayDays: params.trialDeletionDelayDays, now });
    return { ...candidate, motif: TRIAL_MOTIF, ...verdict };
  });
  const demos = await listDemoCandidates(executor, params.demoRetentionDays);
  const annotatedDemos = demos.map((candidate) => ({
    ...candidate, motif: DEMO_MOTIF, eligible: true, reason: 'demo-expiree',
    dateSuppressionEligible: new Date(
      new Date(candidate.dateInscription).getTime() + params.demoRetentionDays * 24 * 60 * 60 * 1000,
    ),
  }));
  return { params, trials: annotatedTrials, demos: annotatedDemos };
}

// ---------------------------------------------------------------------------
// Suppression ordonnée d'une entreprise (enfants d'abord, entreprises en dernier)
// ---------------------------------------------------------------------------

const byEntrepriseId = (id) => sql`entreprise_id = ${id}`;

// Ordre enfant → parent. Chaque étape : { table, where(id) }.
// La couverture est vérifiée à l'exécution contre MULTI_TENANT_TABLES :
// toute table tenant absente de cette liste fait échouer la suppression
// (fail closed) plutôt que de laisser des données orphelines.
const DELETE_STEPS = [
  // Tables sans entreprise_id (jointures) — d'abord, car elles référencent
  // des lignes tenant qui vont disparaître.
  { table: 'import_records', where: (id) => sql`batch_id IN (SELECT id FROM import_batches WHERE entreprise_id = ${id})` },
  { table: 'ligne_inventaires_tournants', where: (id) => sql`inventaire_id IN (SELECT id FROM inventaires_tournants WHERE entreprise_id = ${id})` },
  { table: 'password_reset_tokens', where: (id) => sql`user_id IN (SELECT id FROM users WHERE entreprise_id = ${id})` },
  { table: 'sessions', where: (id) => sql`enterprise_id = ${id}` },
  { table: 'audit_connexions', where: (id) => sql`enterprise_id = ${id}` },
  { table: 'saas_ventes', where: (id) => sql`client_id IN (SELECT id FROM saas_clients WHERE entreprise_id = ${id}) OR abonnement_id IN (SELECT id FROM abonnements WHERE entreprise_id = ${id})` },
  { table: 'webhook_deliveries', where: (id) => sql`subscription_id IN (SELECT id FROM webhook_subscriptions WHERE entreprise_id = ${id})` },
  { table: 'inscriptions_en_attente', where: (id) => sql`entreprise_id_pour_renouvellement = ${id}` },
  // Lignes de documents et écritures (enfants directs).
  { table: 'histo_generation', where: byEntrepriseId },
  { table: 'versements_financements_projets', where: byEntrepriseId },
  { table: 'paiements_depenses_projets', where: byEntrepriseId },
  { table: 'budgets_projets_associatifs', where: byEntrepriseId },
  { table: 'financements_projets_associatifs', where: byEntrepriseId },
  { table: 'stock_pending', where: byEntrepriseId },
  { table: 'logistique_pending', where: byEntrepriseId },
  { table: 'historique_emails', where: byEntrepriseId },
  { table: 'lignes_reception', where: byEntrepriseId },
  { table: 'lignes_ecriture', where: byEntrepriseId },
  { table: 'notes_credit_items', where: byEntrepriseId },
  { table: 'facture_items', where: byEntrepriseId },
  { table: 'facture_achat_items', where: byEntrepriseId },
  { table: 'devis_items', where: byEntrepriseId },
  { table: 'commande_items', where: byEntrepriseId },
  { table: 'commandes_achat_items', where: byEntrepriseId },
  { table: 'bon_livraison_items', where: byEntrepriseId },
  { table: 'couts_logistiques_commande', where: byEntrepriseId },
  { table: 'produit_prix', where: byEntrepriseId },
  { table: 'valorisations_stock', where: byEntrepriseId },
  { table: 'mouvements_stock', where: byEntrepriseId },
  { table: 'paiements', where: byEntrepriseId },
  { table: 'paiements_fournisseurs', where: byEntrepriseId },
  { table: 'remboursements_employes', where: byEntrepriseId },
  { table: 'approvals_depenses', where: byEntrepriseId },
  { table: 'transactions_tresorerie', where: byEntrepriseId },
  { table: 'ecriture_sequences', where: byEntrepriseId },
  { table: 'ecritures_recurrentes', where: byEntrepriseId },
  { table: 'clotures_exercices', where: byEntrepriseId },
  { table: 'factures_abonnement', where: byEntrepriseId },
  // Documents parents.
  { table: 'notes_credit', where: byEntrepriseId },
  { table: 'factures', where: byEntrepriseId },
  { table: 'factures_achat', where: byEntrepriseId },
  { table: 'devis', where: byEntrepriseId },
  { table: 'commandes', where: byEntrepriseId },
  { table: 'bons_livraison', where: byEntrepriseId },
  { table: 'commandes_achat', where: byEntrepriseId },
  { table: 'bons_reception', where: byEntrepriseId },
  { table: 'depenses', where: byEntrepriseId },
  { table: 'projets_associatifs', where: byEntrepriseId },
  { table: 'inventaires_tournants', where: byEntrepriseId },
  { table: 'stock_par_entrepot', where: byEntrepriseId },
  { table: 'alertes_stock', where: byEntrepriseId },
  { table: 'rapprochements_bancaires', where: byEntrepriseId },
  { table: 'comptes_bancaires', where: byEntrepriseId },
  { table: 'categories_depenses', where: byEntrepriseId },
  { table: 'comptes_automatiques', where: byEntrepriseId },
  { table: 'soldes_comptes', where: byEntrepriseId },
  { table: 'comptes', where: byEntrepriseId },
  { table: 'comptes_comptables', where: byEntrepriseId },
  { table: 'ecritures', where: byEntrepriseId },
  { table: 'journaux', where: byEntrepriseId },
  { table: 'entrepots', where: byEntrepriseId },
  { table: 'produits', where: byEntrepriseId },
  { table: 'categories_stock', where: byEntrepriseId },
  { table: 'fournisseurs', where: byEntrepriseId },
  { table: 'clients', where: byEntrepriseId },
  { table: 'employes', where: byEntrepriseId },
  { table: 'audit_logs', where: byEntrepriseId },
  { table: 'declarations_fiscales', where: byEntrepriseId },
  { table: 'parametres_fiscaux', where: byEntrepriseId },
  { table: 'parametres_comptables', where: byEntrepriseId },
  { table: 'plans_comptables', where: byEntrepriseId },
  { table: 'api_keys', where: byEntrepriseId },
  { table: 'webhook_subscriptions', where: byEntrepriseId },
  { table: 'backup_jobs', where: byEntrepriseId },
  { table: 'backup_configs', where: byEntrepriseId },
  { table: 'export_history', where: byEntrepriseId },
  { table: 'import_batches', where: byEntrepriseId },
  { table: 'import_mapping_templates', where: byEntrepriseId },
  { table: 'taux_change', where: byEntrepriseId },
  { table: 'idempotency', where: byEntrepriseId },
  { table: 'accountant_invitations', where: byEntrepriseId },
  // Utilisateurs, puis SaaS, puis l'entreprise elle-même.
  { table: 'users', where: byEntrepriseId },
  { table: 'abonnements', where: byEntrepriseId },
  { table: 'saas_clients', where: byEntrepriseId },
];

export function assertDeleteCoverage() {
  const covered = new Set(DELETE_STEPS.map((step) => step.table));
  const missing = MULTI_TENANT_TABLES.filter((table) => !covered.has(table));
  if (missing.length > 0) {
    throw new Error(
      `Suppression impossible : tables tenant non couvertes par l'ordre de suppression : ${missing.join(', ')}.`,
    );
  }
}

/**
 * Supprime une entreprise et TOUTES ses données, dans une transaction :
 * journalisation dans suppressions_entreprises (sauf journal: false, pour le
 * nettoyage compensatoire d'une création démo en échec) puis suppressions
 * ordonnées, entreprises en dernier. Ne supprime jamais l'entreprise 1.
 */
export async function deleteEnterpriseData(entrepriseId, {
  motif = TRIAL_MOTIF,
  supprimePar = 'systeme:purge-essais',
  journal = true,
  dateInscription = null,
  dateFinEssai = null,
  dateBlocage = null,
  dateSuppressionEligible = null,
  delaiJoursApplique = DEFAULT_TRIAL_DELETION_DELAY_DAYS,
  uploads = null,
} = {}) {
  const id = Number(entrepriseId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Identifiant d’entreprise invalide.');
  assertDeleteCoverage();

  const result = await withPlatformAdminTransaction(async (tx) => {
    const [locked] = await tx.execute(sql`
      SELECT id, nom, email, is_demo AS "isDemo", created_at AS "createdAt"
      FROM entreprises WHERE id = ${id} FOR UPDATE
    `).then((r) => r.rows || r || []);
    if (!locked) return { deleted: false, entrepriseId: id, reason: 'introuvable' };
    // L'entreprise ORIONEXA (id 1) ne peut jamais être supprimée — sauf si
    // c'est une démonstration (dans un schéma neuf, la première entreprise
    // créée porte l'id 1 ; une démo reste jetable par définition).
    if (id === 1 && locked.isDemo !== true) {
      throw new Error('L’entreprise ORIONEXA (id 1) ne peut jamais être supprimée.');
    }

    // Compteurs relevés AVANT suppression (détails du journal).
    const counts = {};
    for (const step of DELETE_STEPS) {
      const counted = await tx.execute(sql`
        SELECT COUNT(*)::int AS n FROM ${sql.identifier(step.table)} WHERE ${step.where(id)}
      `);
      counts[step.table] = Number((counted.rows || counted || [])[0]?.n || 0);
    }

    if (journal) {
      await tx.insert(suppressionsEntreprises).values({
        application: APPLICATION_NAME,
        entrepriseId: id,
        entrepriseNom: locked.nom || `Entreprise ${id}`,
        entrepriseEmail: locked.email || null,
        motif,
        dateInscription: toDate(dateInscription) || toDate(locked.createdAt),
        dateFinEssai: toDate(dateFinEssai),
        dateBlocage: toDate(dateBlocage) || toDate(dateFinEssai),
        dateSuppressionEligible: toDate(dateSuppressionEligible),
        delaiJoursApplique,
        supprimePar,
        details: { counts },
      });
    }

    for (const step of DELETE_STEPS) {
      await tx.execute(sql`
        DELETE FROM ${sql.identifier(step.table)} WHERE ${step.where(id)}
      `);
    }
    await tx.delete(entreprises).where(eq(entreprises.id, id));
    return { deleted: true, entrepriseId: id, counts, nom: locked.nom };
  });

  // Fichiers R2 (logos) : après le commit, au mieux (jamais bloquant).
  if (result.deleted && uploads?.list && uploads?.delete) {
    try {
      const listed = await uploads.list({ prefix: `logos/entreprise-${id}-` });
      const objects = listed?.objects || [];
      for (const object of objects) {
        await uploads.delete(object.key).catch(() => {});
      }
    } catch (error) {
      console.warn(`Logos R2 de l'entreprise ${id} non supprimés:`, error?.message);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Purge (cron quotidien + endpoint admin manuel — même service, même prédicat)
// ---------------------------------------------------------------------------

export async function purgeExpiredTrials({
  executor = db,
  dryRun = null,
  limit = PURGE_BATCH_LIMIT,
  now = new Date(),
  deletedBy = 'systeme:purge-essais',
  uploads = null,
  ids = null,
} = {}) {
  const params = await getPlatformParams(executor);
  // Bascule explicite obligatoire : sans trial_purge_enabled, le run est un
  // dry-run (sélection + journalisation, aucune suppression réelle).
  const effectiveDryRun = dryRun === true || !params.trialPurgeEnabled;
  const forcedDryRun = dryRun === false && !params.trialPurgeEnabled;
  const wantedIds = Array.isArray(ids) && ids.length > 0
    ? new Set(ids.map((v) => Number(v)).filter((v) => Number.isSafeInteger(v) && v > 0))
    : null;

  const summary = {
    dryRun: effectiveDryRun,
    forcedDryRun,
    params,
    at: now.toISOString(),
    trials: { found: 0, eligible: 0, deleted: 0, skipped: [] },
    demos: { found: 0, eligible: 0, deleted: 0, skipped: [] },
    errors: [],
  };

  const { trials, demos } = await listPurgeCandidates(executor, { now });
  summary.trials.found = trials.length;
  summary.demos.found = demos.length;

  const trialTargets = trials
    .filter((c) => c.eligible)
    .filter((c) => !wantedIds || wantedIds.has(c.id))
    .slice(0, limit);
  summary.trials.eligible = trialTargets.length;
  const demoTargets = demos
    .filter((c) => !wantedIds || wantedIds.has(c.id))
    .slice(0, Math.max(0, limit - trialTargets.length));
  summary.demos.eligible = demoTargets.length;

  for (const candidate of trialTargets) {
    try {
      if (effectiveDryRun) continue;
      // Re-vérification ligne par ligne : si la conversion a eu lieu entre
      // la sélection et la suppression, la ligne est sautée et journalisée.
      const fresh = (await listTrialCandidates(executor)).find((c) => c.id === candidate.id);
      const verdict = isEligibleForTrialPurge(fresh, { delayDays: params.trialDeletionDelayDays, now });
      if (!verdict.eligible) {
        summary.trials.skipped.push({ id: candidate.id, reason: `revérification: ${verdict.reason}` });
        continue;
      }
      const deleted = await deleteEnterpriseData(candidate.id, {
        motif: TRIAL_MOTIF,
        supprimePar: deletedBy,
        dateInscription: fresh.dateInscription || null,
        dateFinEssai: verdict.dateFinEssai,
        dateBlocage: verdict.dateFinEssai,
        dateSuppressionEligible: verdict.eligibleAt,
        delaiJoursApplique: params.trialDeletionDelayDays,
        uploads,
      });
      if (deleted.deleted) summary.trials.deleted += 1;
      else summary.trials.skipped.push({ id: candidate.id, reason: deleted.reason || 'non-supprimé' });
    } catch (error) {
      summary.errors.push({ id: candidate.id, motif: TRIAL_MOTIF, error: error?.message });
    }
  }

  for (const candidate of demoTargets) {
    try {
      if (effectiveDryRun) continue;
      const deleted = await deleteEnterpriseData(candidate.id, {
        motif: DEMO_MOTIF,
        supprimePar: deletedBy,
        dateInscription: candidate.dateInscription || null,
        dateFinEssai: null,
        dateBlocage: null,
        dateSuppressionEligible: candidate.dateSuppressionEligible || null,
        delaiJoursApplique: params.demoRetentionDays,
        uploads,
      });
      if (deleted.deleted) summary.demos.deleted += 1;
      else summary.demos.skipped.push({ id: candidate.id, reason: deleted.reason || 'non-supprimé' });
    } catch (error) {
      summary.errors.push({ id: candidate.id, motif: DEMO_MOTIF, error: error?.message });
    }
  }

  console.log(JSON.stringify({ purge: 'purgeExpiredTrials', ...summary }));
  return summary;
}
