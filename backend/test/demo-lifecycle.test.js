// Mode démo + cycle de vie essai → blocage → suppression (ComptaOrion).
// Étude : ~/workspace/demo-mode-design-2026-11-27.md (§4.8, §6.3).
//
// - Les tests unitaires (matrice d'éligibilité, paramètres, constantes)
//   s'exécutent toujours, sans base.
// - Les tests base de données sont gardés par DEMO_DB_TEST=1 + DATABASE_URL
//   et tournent dans un schéma jetable (aucune donnée existante touchée).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as databaseSchema from '../src/schema.js';
import {
  isEligibleForTrialPurge,
  getPlatformParams,
  trialEndDate,
  listTrialCandidates,
  listPurgeCandidates,
  purgeExpiredTrials,
  deleteEnterpriseData,
  DEFAULT_TRIAL_DELETION_DELAY_DAYS,
  DEFAULT_DEMO_RETENTION_DAYS,
} from '../src/services/trialLifecycle.js';
import { DEMO_SUBSCRIPTION_NOTE } from '../src/services/demoGuard.js';
import { TRIAL_SUBSCRIPTION_NOTE, TRIAL_DURATION_DAYS } from '../src/services/trialSubscription.js';
import { createDemoEnterprise, seedDemoEnterprise } from '../src/services/demoSeed.js';
import { getPlanCapabilities } from '../src/services/planEntitlements.js';
import { runtimeContext } from '../src/runtime-context.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-27T12:00:00.000Z');

function trialCandidate(overrides = {}) {
  return {
    id: 42,
    isDemo: false,
    remarques: TRIAL_SUBSCRIPTION_NOTE,
    planPrix: 0,
    statut: 'actif',
    hasConfirmedSale: false,
    dateFinEssai: new Date(NOW.getTime() - 31 * DAY), // essai fini il y a 31 j
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unitaires — matrice d'éligibilité §6.3
// ---------------------------------------------------------------------------

test('éligibilité suppression essai : essai expiré +31 j → éligible', () => {
  const verdict = isEligibleForTrialPurge(trialCandidate(), { delayDays: 30, now: NOW });
  assert.equal(verdict.eligible, true);
  assert.equal(verdict.reason, 'eligible');
});

test('éligibilité suppression essai : essai expiré +29 j → non éligible', () => {
  const verdict = isEligibleForTrialPurge(
    trialCandidate({ dateFinEssai: new Date(NOW.getTime() - 29 * DAY) }),
    { delayDays: 30, now: NOW },
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'delai-non-atteint');
});

test('éligibilité suppression essai : essai en cours → non éligible', () => {
  const verdict = isEligibleForTrialPurge(
    trialCandidate({ dateFinEssai: new Date(NOW.getTime() + 5 * DAY) }),
    { delayDays: 30, now: NOW },
  );
  assert.equal(verdict.eligible, false);
});

test('éligibilité suppression essai : plan payant → non éligible', () => {
  // Cas R3 : la remarque d'essai est restée, mais le plan est devenu payant.
  const verdict = isEligibleForTrialPurge(
    trialCandidate({ planPrix: 29900 }),
    { delayDays: 30, now: NOW },
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'plan-payant');
});

test('éligibilité suppression essai : vente confirmée → non éligible', () => {
  const verdict = isEligibleForTrialPurge(
    trialCandidate({ hasConfirmedSale: true }),
    { delayDays: 30, now: NOW },
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'vente-confirmee');
});

test('éligibilité suppression essai : entreprise 1 (ORIONEXA) → jamais', () => {
  const verdict = isEligibleForTrialPurge(trialCandidate({ id: 1 }), { delayDays: 30, now: NOW });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'entreprise-1-protegee');
});

test('éligibilité suppression essai : démo → non éligible (purge démo séparée)', () => {
  const verdict = isEligibleForTrialPurge(trialCandidate({ isDemo: true }), { delayDays: 30, now: NOW });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'demo');
});

test('éligibilité suppression essai : abonnement suspendu → non éligible', () => {
  const verdict = isEligibleForTrialPurge(trialCandidate({ statut: 'suspendu' }), { delayDays: 30, now: NOW });
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'statut-suspendu');
});

test('éligibilité suppression essai : remarque autre que l’essai → non éligible', () => {
  const verdict = isEligibleForTrialPurge(
    trialCandidate({ remarques: 'Démonstration — sans expiration d’essai' }),
    { delayDays: 30, now: NOW },
  );
  assert.equal(verdict.eligible, false);
  assert.equal(verdict.reason, 'pas-un-essai');
});

test('fin d’essai = création + 30 jours', () => {
  assert.equal(TRIAL_DURATION_DAYS, 30);
  const createdAt = new Date('2026-10-28T09:00:00.000Z');
  assert.equal(trialEndDate(createdAt).toISOString(), '2026-11-27T09:00:00.000Z');
});

test('la remarque démo diffère de la remarque d’essai (contournement §4.4)', () => {
  assert.notEqual(DEMO_SUBSCRIPTION_NOTE, TRIAL_SUBSCRIPTION_NOTE);
  assert.match(DEMO_SUBSCRIPTION_NOTE, /Démonstration/);
});

test('getPlatformParams : table d’abord, variable d’environnement ensuite, défaut en dernier', async () => {
  const stub = (rows) => ({
    select: () => ({ from: async () => rows }),
  });
  const fromTable = await getPlatformParams(stub([
    { cle: 'trial_deletion_delay_days', valeur: '45' },
    { cle: 'demo_retention_days', valeur: '3' },
    { cle: 'trial_purge_enabled', valeur: 'true' },
  ]));
  assert.deepEqual(fromTable, {
    trialDeletionDelayDays: 45,
    demoRetentionDays: 3,
    trialPurgeEnabled: true,
  });

  const invalid = await getPlatformParams(stub([
    { cle: 'trial_deletion_delay_days', valeur: 'n’importe quoi' },
  ]));
  assert.equal(invalid.trialDeletionDelayDays, DEFAULT_TRIAL_DELETION_DELAY_DAYS);
  assert.equal(invalid.demoRetentionDays, DEFAULT_DEMO_RETENTION_DAYS);
  assert.equal(invalid.trialPurgeEnabled, false);

  const failing = { select: () => { throw new Error('table absente'); } };
  const defaults = await getPlatformParams(failing);
  assert.equal(defaults.trialDeletionDelayDays, DEFAULT_TRIAL_DELETION_DELAY_DAYS);
  assert.equal(defaults.trialPurgeEnabled, false);
});

// ---------------------------------------------------------------------------
// Base de données — schéma jetable
// ---------------------------------------------------------------------------

const DB_ENABLED = process.env.DEMO_DB_TEST === '1' && Boolean(process.env.DATABASE_URL);

test('création de 2 démos consécutives, seed cohérent, purge dry-run', {
  skip: !DB_ENABLED,
  // Latence Neon (réveil à froid + ~800 allers-retours pour 2 seeds) : large.
  timeout: 600000,
}, async () => {
  const schema = `demo_test_${randomUUID().replaceAll('-', '')}`;
  const adminConnectionString = process.env.DATABASE_URL;
  const admin = new pg.Pool({ connectionString: adminConnectionString });
  let schemaPool;
  try {
    const ddl = execFileSync(process.execPath, [
      'backend/node_modules/drizzle-kit/bin.cjs', 'export',
      '--dialect=postgresql', '--schema=./backend/src/schema.js',
    ], { encoding: 'utf8' }).replaceAll('"public".', `"${schema}".`);
    const client = await admin.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(ddl);
    } finally { client.release(); }

    const schemaUrl = new URL(adminConnectionString);
    // Le pooler Neon refuse le paramètre de démarrage `options` (search_path) :
    // le pool du schéma jetable utilise la connexion directe.
    schemaUrl.hostname = schemaUrl.hostname.replace('-pooler', '');
    schemaUrl.searchParams.set('options', `-c search_path=${schema}`);
    schemaPool = new pg.Pool({ connectionString: schemaUrl.toString() });
    const schemaDb = drizzle({ client: schemaPool, schema: databaseSchema });

    await runtimeContext.run({ db: schemaDb, pool: schemaPool }, async () => {
      // Plan d'essai prix 0 (celui de la production) + paramètres de purge.
      const [plan] = await schemaDb.insert(databaseSchema.plansAbonnement).values({
        nom: 'Essai Gratuit', prix: '0.00', devise: 'XOF', periode: 'mensuel',
        limiteUtilisateurs: 1, limiteEntreprises: 1, stockageGb: 1,
        descriptionFeatures: 'Essai gratuit 30 jours', actif: true,
      }).returning();
      assert.ok(plan.id, 'plan essai créé');
      await schemaDb.insert(databaseSchema.parametresPlateforme).values([
        { cle: 'trial_deletion_delay_days', valeur: '30' },
        { cle: 'demo_retention_days', valeur: '7' },
        { cle: 'trial_purge_enabled', valeur: 'false' },
      ]);
      // Entreprise gardienne id 1 : en production, l'id 1 est ORIONEXA et les
      // démos portent des ids supérieurs ; sans elle, la 1re démo du schéma
      // jetable porterait l'id 1 et serait exclue par le garde « id <> 1 ».
      await schemaDb.insert(databaseSchema.entreprises).values({
        nom: 'Gardien id 1 (test)', email: 'gardien@test.invalid',
        pays: 'Togo', devise: 'XOF', tauxTva: '18.00', systemeComptable: 'SYSCOHADA',
      });

      // --- 2 démos consécutives -------------------------------------------
      const demo1 = await createDemoEnterprise({});
      const demo2 = await createDemoEnterprise({});
      assert.notEqual(demo1.entreprise.id, demo2.entreprise.id, 'deux entreprises distinctes');
      assert.equal(demo1.entreprise.isDemo, true);
      assert.equal(demo2.entreprise.isDemo, true);
      assert.notEqual(demo1.user.email, demo2.user.email, 'e-mails démo distincts');
      assert.notEqual(demo1.user.username, demo2.user.username, 'usernames démo distincts');

      // --- Garde d'essai : la démo n'est jamais un essai -------------------
      const [abonnement] = await schemaDb.select().from(databaseSchema.abonnements)
        .where(eq(databaseSchema.abonnements.entrepriseId, demo1.entreprise.id));
      assert.equal(abonnement.remarques, DEMO_SUBSCRIPTION_NOTE);
      assert.notEqual(abonnement.remarques, TRIAL_SUBSCRIPTION_NOTE);
      assert.equal(abonnement.statut, 'actif');
      assert.ok(new Date(abonnement.dateExpiration).getTime() > Date.now() + 9 * 365 * DAY,
        'expiration démo ≈ +10 ans');
      // getTrialAccess() retourne null quand la remarque ≠ TRIAL_SUBSCRIPTION_NOTE
      // (c'est le prédicat exact de routes/auth-security.js, l.25-54).
      const trialAccess = abonnement.remarques === TRIAL_SUBSCRIPTION_NOTE ? 'essai' : null;
      assert.equal(trialAccess, null);

      const capabilities = await getPlanCapabilities(schemaDb, demo1.entreprise.id);
      assert.equal(capabilities.isTrial, true, 'plan démo reconnu comme essai (prix 0)');
      assert.equal(capabilities.automaticCosting, true, 'CMUP automatique en démo');
      assert.equal(capabilities.ocr, true, 'lecture OCR en démo (fonctions Premium incluses)');
      assert.equal(capabilities.associationAccounting, true, 'comptabilité associative en démo (fonctions Premium incluses)');

      // --- Seed cohérent ----------------------------------------------------
      const comptes = await schemaDb.select().from(databaseSchema.comptesComptables)
        .where(eq(databaseSchema.comptesComptables.entrepriseId, demo1.entreprise.id));
      assert.equal(comptes.length, 266, 'plan SYSCOHADA complet (266 comptes)');
      const comptesAuto = await schemaDb.select().from(databaseSchema.comptesAutomatiques)
        .where(eq(databaseSchema.comptesAutomatiques.entrepriseId, demo1.entreprise.id));
      // 21 rôles sur 23 : 673 (escomptes accordés) et 773 (escomptes obtenus)
      // n'existent pas dans le plan SYSCOHADA et sont ignorés (voir seed).
      assert.equal(comptesAuto.length, 21, '21 comptes automatiques configurés (2 rôles d’escompte absents du plan)');
      const rolesConfigures = new Set(comptesAuto.map((c) => c.roleKey));
      assert.equal(rolesConfigures.has('cash_discount_granted'), false);
      assert.equal(rolesConfigures.has('cash_discount_received'), false);
      assert.equal(rolesConfigures.has('stock'), true);
      assert.equal(rolesConfigures.has('supplier'), true);
      assert.equal(rolesConfigures.has('customer'), true);

      const facturesDemo = await schemaDb.select().from(databaseSchema.factures)
        .where(eq(databaseSchema.factures.entrepriseId, demo1.entreprise.id));
      assert.equal(facturesDemo.length, 5, '5 factures seedées');
      const byNumero = Object.fromEntries(facturesDemo.map((f) => [f.numeroFacture, f]));
      const f1 = Object.values(byNumero).find((f) => Number(f.totalTTC) === 383500);
      assert.ok(f1, 'facture F1 (383 500) trouvée');
      assert.equal(f1.statut, 'payee');
      assert.equal(Number(f1.montantPaye), 383500);
      const f2 = Object.values(byNumero).find((f) => Number(f.totalTTC) === 177000);
      assert.equal(f2.statut, 'envoyee');
      assert.equal(Number(f2.soldeRestant), 77000, 'F2 : solde restant 77 000');
      const f3 = Object.values(byNumero).find((f) => Number(f.totalTTC) === 212400);
      assert.equal(f3.statut, 'envoyee', 'F3 envoyée, échéance dépassée');
      const f4 = Object.values(byNumero).find((f) => Number(f.totalTTC) === 224200);
      assert.equal(f4.statut, 'brouillon', 'F4 brouillon, sans sortie de stock');

      const produitsDemo = await schemaDb.select().from(databaseSchema.produits)
        .where(eq(databaseSchema.produits.entrepriseId, demo1.entreprise.id));
      const riz = produitsDemo.find((p) => p.nom === 'Riz 50 kg');
      assert.equal(Number(riz.quantite), 47, 'stock Riz final : 40 +20 −5 −10 +2 = 47');
      const huile = produitsDemo.find((p) => p.nom === 'Huile 5 L');
      assert.equal(Number(huile.quantite), 40, 'stock Huile final : 60 −20 = 40');
      const ciment = produitsDemo.find((p) => p.nom === 'Ciment 50 kg');
      assert.equal(Number(ciment.quantite), 100, 'stock Ciment final : 100');

      const banques = await schemaDb.select().from(databaseSchema.comptesBancaires)
        .where(eq(databaseSchema.comptesBancaires.entrepriseId, demo1.entreprise.id));
      const banque = banques.find((b) => b.type === 'banque');
      const caisse = banques.find((b) => b.type === 'caisse');
      assert.equal(Number(banque.soldeActuel), 794300, 'solde banque : 794 300');
      assert.equal(Number(caisse.soldeActuel), 179200, 'solde caisse : 179 200');

      // Bilan des écritures : toute écriture est équilibrée par construction.
      const balance = await schemaDb.execute(sql`
        SELECT COALESCE(SUM(le.debit), 0)::float AS debits,
               COALESCE(SUM(le.credit), 0)::float AS credits
        FROM lignes_ecriture le
        JOIN ecritures e ON le.ecriture_id = e.id
        WHERE e.entreprise_id = ${demo1.entreprise.id}
      `);
      const { debits, credits } = balance.rows[0];
      assert.ok(Math.abs(debits - credits) < 0.01, `écritures équilibrées : débits ${debits}, crédits ${credits}`);

      // TVA du mois précédent : collectée 22 500 − déductible 10 800 = 11 700.
      const declarations = await schemaDb.select().from(databaseSchema.declarationsFiscales)
        .where(eq(databaseSchema.declarationsFiscales.entrepriseId, demo1.entreprise.id));
      assert.equal(declarations.length, 1, 'une déclaration TVA (mois précédent)');
      assert.equal(declarations[0].statut, 'payée');
      assert.equal(Number(declarations[0].montant), 11700, 'TVA octobre à décaisser : 11 700');

      // --- Purge dry-run : rien ne disparaît --------------------------------
      const summary = await purgeExpiredTrials({ executor: schemaDb, dryRun: true });
      assert.equal(summary.dryRun, true, 'dry-run forcé par trial_purge_enabled=false');
      assert.equal(summary.trials.deleted, 0);
      assert.equal(summary.demos.deleted, 0);
      const stillThere = await schemaDb.select({ id: databaseSchema.entreprises.id })
        .from(databaseSchema.entreprises)
        .where(eq(databaseSchema.entreprises.isDemo, true));
      assert.equal(stillThere.length, 2, 'les 2 démos survivent au dry-run');

      // --- Candidats : la démo n'est jamais candidate à la purge essai -------
      const candidates = await listTrialCandidates(schemaDb);
      assert.equal(candidates.filter((c) => c.isDemo).length, 2, '2 démos listées');
      const { trials } = await listPurgeCandidates(schemaDb);
      assert.equal(trials.filter((c) => c.eligible).length, 0, 'aucune démo éligible à la purge essai');

      // --- Suppression réelle d'une démo (procédure ordonnée) ---------------
      const deleted = await deleteEnterpriseData(demo1.entreprise.id, {
        motif: 'demo_expiree', supprimePar: 'test:demo-lifecycle',
      });
      assert.equal(deleted.deleted, true);
      const gone = await schemaDb.select().from(databaseSchema.entreprises)
        .where(eq(databaseSchema.entreprises.id, demo1.entreprise.id));
      assert.equal(gone.length, 0, 'entreprise démo supprimée');
      const journal = await schemaDb.select().from(databaseSchema.suppressionsEntreprises)
        .where(eq(databaseSchema.suppressionsEntreprises.entrepriseId, demo1.entreprise.id));
      assert.equal(journal.length, 1, 'suppression journalisée');
      assert.equal(journal[0].motif, 'demo_expiree');
      const facturesRestantes = await schemaDb.select().from(databaseSchema.factures)
        .where(eq(databaseSchema.factures.entrepriseId, demo1.entreprise.id));
      assert.equal(facturesRestantes.length, 0, 'aucune donnée orpheline');

      // La 2e démo survit (suppression ciblée, pas de suppression en masse).
      const demo2StillThere = await schemaDb.select().from(databaseSchema.entreprises)
        .where(eq(databaseSchema.entreprises.id, demo2.entreprise.id));
      assert.equal(demo2StillThere.length, 1);
    });
  } finally {
    if (schemaPool) await schemaPool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});

test('seedDemoEnterprise échoue proprement sur une entreprise sans plan SYSCOHADA', {
  skip: !DB_ENABLED,
  timeout: 120000,
}, async () => {
  // Le seed exige les comptes automatiques : sans plan comptable, il doit
  // échouer (et la transaction annule tout) plutôt que de créer une démo
  // à moitié remplie.
  const schema = `demo_test_${randomUUID().replaceAll('-', '')}`;
  const adminConnectionString = process.env.DATABASE_URL;
  const admin = new pg.Pool({ connectionString: adminConnectionString });
  let schemaPool;
  try {
    const ddl = execFileSync(process.execPath, [
      'backend/node_modules/drizzle-kit/bin.cjs', 'export',
      '--dialect=postgresql', '--schema=./backend/src/schema.js',
    ], { encoding: 'utf8' }).replaceAll('"public".', `"${schema}".`);
    const client = await admin.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(ddl);
    } finally { client.release(); }

    const schemaUrl = new URL(adminConnectionString);
    // Le pooler Neon refuse le paramètre de démarrage `options` (search_path) :
    // le pool du schéma jetable utilise la connexion directe.
    schemaUrl.hostname = schemaUrl.hostname.replace('-pooler', '');
    schemaUrl.searchParams.set('options', `-c search_path=${schema}`);
    schemaPool = new pg.Pool({ connectionString: schemaUrl.toString() });
    const schemaDb = drizzle({ client: schemaPool, schema: databaseSchema });

    await runtimeContext.run({ db: schemaDb, pool: schemaPool }, async () => {
      const [entreprise] = await schemaDb.insert(databaseSchema.entreprises).values({
        nom: 'Entreprise sans plan (test)', email: 'test-sans-plan@demo.invalid',
        pays: 'Togo', devise: 'XOF', tauxTva: '18.00', systemeComptable: 'SYSCOHADA',
        isDemo: true,
      }).returning();
      await assert.rejects(
        () => seedDemoEnterprise(entreprise.id, 1),
        /Compte SYSCOHADA .* introuvable/,
        'le seed refuse une entreprise sans plan SYSCOHADA',
      );
      const comptes = await schemaDb.select().from(databaseSchema.comptesAutomatiques)
        .where(eq(databaseSchema.comptesAutomatiques.entrepriseId, entreprise.id));
      assert.equal(comptes.length, 0, 'transaction annulée : aucun compte automatique');
    });
  } finally {
    if (schemaPool) await schemaPool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
