import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const MULTI_TENANT_TABLES = [
  'users',
  'clients',
  'fournisseurs',
  'factures',
  'factures_achat',
  'produits',
  'categories_produits',
  'entrepots',
  'mouvements_stock',
  'commandes_achat',
  'commandes_achat_items',
  'couts_logistiques_commande',
  'devis',
  'devis_items',
  'bons_livraison',
  'commandes_clients',
  'paiements_clients',
  'paiements_fournisseurs',
  'employes',
  'fiches_paie',
  'avances_salaire',
  'comptes_bancaires',
  'transactions_tresorerie',
  'rapprochements_bancaires',
  'depenses',
  'comptes_comptables',
  'journaux',
  'ecritures',
  'lignes_ecriture',
  'plans_comptables',
  'comptes',
  'immobilisations',
  'amortissements',
  'audit_log',
  'ecritures_recurrentes',
  'parametres_comptables'
];

export async function enableRLS() {
  console.log('🔒 Activation des politiques RLS...');
  
  for (const table of MULTI_TENANT_TABLES) {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      
      await db.execute(sql.raw(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON ${table}
      `));
      
      await db.execute(sql.raw(`
        CREATE POLICY tenant_isolation_policy ON ${table}
        FOR ALL
        USING (entreprise_id = current_setting('app.current_tenant')::integer)
        WITH CHECK (entreprise_id = current_setting('app.current_tenant')::integer)
      `));
      
      console.log(`✅ RLS activée pour ${table}`);
    } catch (err) {
      console.warn(`⚠️  RLS non applicable pour ${table}: ${err.message}`);
    }
  }
  
  console.log('🔒 Politiques RLS configurées');
}

export async function setCurrentTenant(entrepriseId) {
  await db.execute(sql.raw(`SET app.current_tenant = '${entrepriseId}'`));
}

export async function disableRLSForMigration() {
  for (const table of MULTI_TENANT_TABLES) {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`));
    } catch (err) {
    }
  }
}

export async function checkRLSStatus() {
  const results = [];
  
  for (const table of MULTI_TENANT_TABLES) {
    try {
      const [result] = await db.execute(sql.raw(`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = '${table}'
      `));
      results.push({
        table,
        rlsEnabled: result?.relrowsecurity || false
      });
    } catch (err) {
      results.push({ table, rlsEnabled: false, error: err.message });
    }
  }
  
  return results;
}

export default {
  enableRLS,
  setCurrentTenant,
  disableRLSForMigration,
  checkRLSStatus,
  MULTI_TENANT_TABLES
};
