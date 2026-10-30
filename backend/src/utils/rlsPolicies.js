import { db, pool } from '../db.js';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../schema.js';
import { runtimeContext } from '../runtime-context.js';

// Authentification publique, données globales SaaS et clés d'idempotence sont
// traitées hors du contexte tenant transactionnel.
const RLS_EXCLUDED_TABLES = new Set(['users', 'saas_clients', 'lite_idempotency']);

export const MULTI_TENANT_TABLES = Object.values(schema)
  .flatMap((table) => {
    try {
      const config = getTableConfig(table);
      return config.columns.some((column) => column.name === 'entreprise_id')
        ? [config.name]
        : [];
    } catch {
      return [];
    }
  })
  .filter((table) => !RLS_EXCLUDED_TABLES.has(table))
  .sort();

const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const tenantSettingSql = "NULLIF(NULLIF(current_setting('app.current_tenant', true), '*'), '')::integer";

async function applyToTenantTables(executor, action) {
  const run = async (transaction) => {
    for (const table of MULTI_TENANT_TABLES) {
      await action(transaction, quoteIdentifier(table));
    }
    return MULTI_TENANT_TABLES;
  };
  return typeof executor.transaction === 'function'
    ? executor.transaction(run)
    : run(executor);
}

export async function enableRLS(executor = db) {
  return applyToTenantTables(executor, async (transaction, table) => {
    await transaction.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    await transaction.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
    await transaction.execute(sql.raw(`DROP POLICY IF EXISTS tenant_isolation_policy ON ${table}`));
    await transaction.execute(sql.raw(`
      CREATE POLICY tenant_isolation_policy ON ${table}
      FOR ALL
      USING (current_setting('app.current_tenant', true) = '*' OR entreprise_id = ${tenantSettingSql})
      WITH CHECK (current_setting('app.current_tenant', true) = '*' OR entreprise_id = ${tenantSettingSql})
    `));
  });
}

export async function setCurrentTenant(transaction, entrepriseId) {
  const tenantId = Number(entrepriseId);
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
    throw new TypeError('Identifiant d’entreprise invalide pour le contexte RLS');
  }
  if (!transaction || typeof transaction.execute !== 'function') {
    throw new TypeError('Le contexte RLS doit être défini dans une transaction active');
  }
  await transaction.execute(sql`
    SELECT set_config('app.current_tenant', ${String(tenantId)}, true)
  `);
}

export async function withTenantTransaction(entrepriseId, callback) {
  if (typeof callback !== 'function') throw new TypeError('Une fonction de transaction tenant est requise');
  return db.transaction(async (transaction) => {
    await setCurrentTenant(transaction, entrepriseId);
    const context = runtimeContext.getStore();
    if (!context) return runtimeContext.run({ db: transaction }, () => callback(transaction));
    const previousDb = context.db;
    context.db = transaction;
    try {
      return await callback(transaction);
    } finally {
      if (previousDb === undefined) delete context.db;
      else context.db = previousDb;
    }
  });
}

export async function withPlatformAdminTransaction(callback) {
  if (typeof callback !== 'function') throw new TypeError('Une fonction de transaction admin est requise');
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT set_config('app.current_tenant', '*', true)`);
    const context = runtimeContext.getStore();
    if (!context) return runtimeContext.run({ db: transaction }, () => callback(transaction));
    const previousDb = context.db;
    context.db = transaction;
    try {
      return await callback(transaction);
    } finally {
      if (previousDb === undefined) delete context.db;
      else context.db = previousDb;
    }
  });
}

export async function disableRLSForMigration(executor = db) {
  return applyToTenantTables(executor, async (transaction, table) => {
    await transaction.execute(sql.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`));
  });
}

export async function checkRLSStatus() {
  const { rows } = await pool.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS "rlsEnabled",
           c.relforcerowsecurity AS "forceRls"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = ANY($1::text[])
  `, [MULTI_TENANT_TABLES]);
  const byTable = new Map(rows.map((row) => [row.table_name, row]));
  return MULTI_TENANT_TABLES.map((table) => byTable.get(table) || {
    table, rlsEnabled: false, forceRls: false, missing: true,
  });
}

export function createTenantMiddleware({ platformAdmin = false } = {}) {
  const enabled = process.env.TENANT_RLS_ENABLED === 'true';
  return (req, res, next) => {
    if (!enabled) return next();
    const tenantId = platformAdmin ? null : Number(req.entrepriseId);
    if (!platformAdmin && (!Number.isSafeInteger(tenantId) || tenantId <= 0)) {
      return res.status(401).json({ error: 'Entreprise non identifiée' });
    }

    const originalEnd = res.end.bind(res);
    const responseRollback = new Error('Réponse non réussie : transaction annulée');
    const requestAborted = new Error('Requête interrompue : transaction annulée');
    let endStarted = false;
    let resolveResponse;
    let rejectResponse;
    const responseFinished = new Promise((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    let transactionPromise;

    const sendTransactionFailure = () => {
      if (res.destroyed || res.writableEnded) return;
      if (!res.headersSent) {
        res.statusCode = 500;
        res.removeHeader('Content-Length');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      originalEnd(JSON.stringify({ error: 'Erreur de transaction sécurisée' }));
    };

    res.end = (...args) => {
      if (endStarted) return res;
      endStarted = true;
      if (res.statusCode >= 400) rejectResponse(responseRollback);
      else resolveResponse();
      transactionPromise.then(
        () => originalEnd(...args),
        (error) => {
          if (error === responseRollback) originalEnd(...args);
          else sendTransactionFailure();
        },
      ).catch(sendTransactionFailure);
      return res;
    };

    res.once('close', () => {
      if (!endStarted && !res.writableFinished) rejectResponse(requestAborted);
    });

    const openTransaction = platformAdmin
      ? withPlatformAdminTransaction
      : (callback) => withTenantTransaction(tenantId, callback);
    transactionPromise = openTransaction(async () => {
      next();
      await responseFinished;
    });
    transactionPromise.catch((error) => {
      if (error === responseRollback || error === requestAborted) return;
      sendTransactionFailure();
    });
  };
}

export default {
  enableRLS,
  setCurrentTenant,
  withTenantTransaction,
  withPlatformAdminTransaction,
  disableRLSForMigration,
  checkRLSStatus,
  createTenantMiddleware,
  MULTI_TENANT_TABLES
};
