import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as databaseSchema from '../src/schema.js';

test('parcours ERP dans un schéma jetable sans accès aux données existantes', {
  skip: process.env.ERP_FUNCTIONAL_TEST !== '1',
  timeout: 120000,
}, async () => {
  const schema = `erp_test_${randomUUID().replaceAll('-', '')}`;
  const adminConnectionString = process.env.DATABASE_URL;
  const previousTenantRls = process.env.TENANT_RLS_ENABLED;
  const admin = new pg.Pool({ connectionString: adminConnectionString });
  const rlsRole = `erp_rls_${randomUUID().replaceAll('-', '')}`;
  const rlsPassword = randomUUID().replaceAll('-', '');
  let roleCreated = false;
  let server, pool, worker, adminSchemaPool;
  try {
    const ddl = execFileSync(process.execPath, [
      'backend/node_modules/drizzle-kit/bin.cjs', 'export',
      '--dialect=postgresql', '--schema=./backend/src/schema.js',
    ], { encoding:'utf8' }).replaceAll('"public".', `"${schema}".`);
    const client = await admin.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(ddl);
    } finally { client.release(); }

    const adminUrl = new URL(adminConnectionString);
    const databaseName = decodeURIComponent(adminUrl.pathname.slice(1));
    const quotedRole = `"${rlsRole}"`;
    await admin.query(`CREATE ROLE ${quotedRole} LOGIN PASSWORD '${rlsPassword}' NOSUPERUSER NOBYPASSRLS`);
    roleCreated = true;
    await admin.query(`GRANT CONNECT ON DATABASE "${databaseName.replaceAll('"', '""')}" TO ${quotedRole}`);
    await admin.query(`GRANT USAGE, CREATE ON SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`ALTER TABLE "${schema}"."lite_idempotency" OWNER TO ${quotedRole}`);

    const roleStatus = await admin.query(
      'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
      [rlsRole],
    );
    assert.deepEqual(roleStatus.rows[0], { rolsuper: false, rolbypassrls: false },
      'Le rôle de test ne doit pas contourner RLS');

    const adminSchemaUrl = new URL(adminConnectionString);
    adminSchemaUrl.searchParams.set('options', `-c search_path=${schema}`);
    adminSchemaPool = new pg.Pool({ connectionString: adminSchemaUrl.toString() });
    const adminSchemaDb = drizzle({ client: adminSchemaPool, schema: databaseSchema });
    const appUrl = new URL(adminConnectionString);
    appUrl.username = rlsRole;
    appUrl.password = rlsPassword;
    appUrl.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = appUrl.toString();
    process.env.TENANT_RLS_ENABLED = 'true';

    const { enableRLS, checkRLSStatus, MULTI_TENANT_TABLES } =
      await import('../src/utils/rlsPolicies.js');
    const enabledTables = await enableRLS(adminSchemaDb);
    for (const requiredTable of ['clients', 'factures', 'produits', 'comptes_comptables', 'lignes_ecriture']) {
      assert.ok(enabledTables.includes(requiredTable), `RLS doit couvrir ${requiredTable}`);
    }
    const rlsStatus = await checkRLSStatus();
    assert.equal(rlsStatus.length, MULTI_TENANT_TABLES.length);
    assert.ok(rlsStatus.every((status) => status.rlsEnabled && status.forceRls),
      'Toutes les tables métier découvertes doivent appliquer et forcer RLS');

    const url = new URL(process.env.DATABASE_URL);
    // No outbound email/payment/AI in a functional test.
    delete process.env.SENDGRID_API_KEY;
    delete process.env.FEDAPAY_SECRET_KEY;
    process.env.AI_ENABLED = 'false';
    ({ pool } = await import('../src/db.js'));
    if (process.env.ERP_TEST_WORKER === '1') {
      const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
      worker = new Miniflare(convertV4MiniflareOptions({
        workers: [{
        modules:true,scriptPath:'generated-artifacts/worker/worker.js',
        compatibilityDate:'2026-02-01',compatibilityFlags:['nodejs_compat'],
          bindings:{NODE_ENV:'production',RUNTIME_CLOUDFLARE:'true',AI_ENABLED:'false',
            TENANT_RLS_ENABLED:'true',
          DATABASE_URL:process.env.DATABASE_URL,JWT_SECRET:randomUUID(),JWT_REFRESH_SECRET:randomUUID()},
        r2Buckets:['UPLOADS'],
        }],
      }));
    } else {
      const { default: app } = await import('../src/app.js');
      server = app.listen(0,'127.0.0.1');
      await once(server,'listening');
    }
    const origin=server ? `http://127.0.0.1:${server.address().port}` : 'https://test.local';
    let cookieJar = new Map();
    function storeResponseCookies(response) {
      let setCookies = response.headers.getSetCookie?.() || [];
      if (!setCookies.length) {
        const combined = response.headers.get('set-cookie');
        if (combined) setCookies = combined.split(/,(?=\s*[^;,=\s]+=)/);
      }
      for (const setCookie of setCookies) {
        const [pair, ...attributes] = setCookie.split(';');
        const separator = pair.indexOf('=');
        if (separator < 1) continue;
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        const pathAttribute = attributes.find(attribute => /^\s*path=/i.test(attribute));
        const cookiePath = pathAttribute ? pathAttribute.split('=')[1].trim() : '/';
        const key = `${name}:${cookiePath}`;
        if (attributes.some(attribute => /^\s*max-age=0\s*$/i.test(attribute))) {
          cookieJar.delete(key);
        } else {
          cookieJar.set(key, { name, value, path: cookiePath });
        }
      }
    }
    function requestCookieHeader(apiPath) {
      const requestPath = `/api${apiPath}`;
      return [...cookieJar.values()]
        .filter(cookie => cookie.path === '/' || requestPath.startsWith(cookie.path))
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
    }
    async function api(path, method='GET', body, expected=200, extraHeaders={}) {
      const cookie = requestCookieHeader(path);
      const init = {
        method, headers: { 'Content-Type':'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
        ...(body ? {body:JSON.stringify(body)} : {}),
      };
      const res=worker ? await worker.dispatchFetch(origin+'/api'+path,init) : await fetch(origin+'/api'+path,init);
      storeResponseCookies(res);
      const json=await res.json();
      assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(json).slice(0,400)}`);
      return json;
    }
    async function queryAsTenant(tenantId, query, params = []) {
      const client = await pool.connect();
      let transactionOpen = false;
      try {
        await client.query('BEGIN');
        transactionOpen = true;
        await client.query(
          "SELECT set_config('app.current_tenant', $1, true)",
          [String(tenantId)],
        );
        const result = await client.query(query, params);
        await client.query('COMMIT');
        transactionOpen = false;
        return result;
      } catch (error) {
        if (transactionOpen) await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const password=randomUUID()+'Aa9!';
    const signup=await api('/auth/register','POST',{
      username:'recette',email:'recette@example.invalid',password,entrepriseNom:'Entreprise de recette isolée',
    },201);
    const login=await api('/auth-security/login','POST',{email:'recette@example.invalid',password});
    assert.ok(login.session?.id);
    assert.equal(Object.hasOwn(login, 'token'), false, 'Le jeton ne doit pas être retourné au navigateur');
    const refreshBeforeRotation = requestCookieHeader('/auth-security/refresh')
      .match(/(?:^|;\s*)comptaorion_refresh=([^;]+)/)?.[1];
    await api('/auth-security/refresh','POST',null);
    const refreshAfterRotation = requestCookieHeader('/auth-security/refresh')
      .match(/(?:^|;\s*)comptaorion_refresh=([^;]+)/)?.[1];
    assert.ok(refreshBeforeRotation && refreshAfterRotation && refreshBeforeRotation !== refreshAfterRotation,
      'Le refresh token doit tourner sans être exposé dans le JSON');
    await api('/auth-security/session');
    const platformSubscriptions = await api('/saas-admin/abonnements');
    assert.ok(Array.isArray(platformSubscriptions),
      'Le rôle admin plateforme conserve l’accès SaaS via le contexte RLS privilégié');
    for(const path of ['/auth/me','/dashboard/global','/stock/receptions','/stock/alertes',
      '/stock/produits','/stock/rapports/valorisation','/depenses/list','/depenses/categories',
      '/comptabilite/plans','/comptabilite/comptes','/comptabilite/balance']) {
      await api(path);
    }
    const clientRecord=await api('/clients','POST',{nom:'Client recette'},201);
    const clientId=clientRecord.data.id;
    const unscopedClients=await pool.query('SELECT id FROM clients');
    assert.equal(unscopedClients.rowCount,0,'Sans contexte tenant, RLS doit masquer toutes les lignes');
    const productRecord=await api('/produits','POST',{reference:'TEST-ERP',nom:'Produit recette',
      quantite:10,prixVente:1000,prixAchat:500},201);
    const productId=productRecord.data.id;
    const invoice=await api('/factures','POST',{
      clientId,dateFacture:'2026-10-16',items:[{produitId:productId,quantite:2,prixUnitaire:1000}],
    },201);
    const f=invoice.data;
    assert.equal(Number(f.totalHT),2000);
    assert.equal(Number(f.totalTTC),2360);
    await api(`/factures/${f.id}/paiement`,'POST',{montant:2360,modePaiement:'especes'},201);
    const paid=await api(`/factures/${f.id}`);
    assert.equal(Number(paid.data.soldeRestant),0);
    assert.equal(paid.data.statut,'payee');
    const another=await api('/factures','POST',{
      clientId,items:[{produitId:productId,quantite:1,prixUnitaire:1000}],
    },201);
    const paymentCookie = requestCookieHeader(`/factures/${another.data.id}/paiement`);
    const paymentRequest={method:'POST',headers:{'Content-Type':'application/json',Cookie:paymentCookie},
      body:JSON.stringify({montant:1180,modePaiement:'especes'})};
    const paymentUrl=origin+`/api/factures/${another.data.id}/paiement`;
    const results=await Promise.all([0,1].map(()=>worker ?
      worker.dispatchFetch(paymentUrl,paymentRequest) : fetch(paymentUrl,paymentRequest)));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,400],'Deux paiements concurrents ne doivent pas dépasser le solde');
    await Promise.all(results.map(r=>r.arrayBuffer()));
    const { rows:[balance] }=await queryAsTenant(signup.user.entrepriseId,
      'SELECT COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit,COUNT(*)::int AS n FROM lignes_ecriture');
    assert.ok(balance.n>0,'Des lignes comptables doivent avoir été créées');
    assert.equal(Number(balance.debit),Number(balance.credit),'Écritures équilibrées');
    const expenseAccounts=await api('/comptabilite/comptes');
    const expenseAccount=expenseAccounts.find(account=>String(account.numero).startsWith('6') && account.actif);
    assert.ok(expenseAccount,'Un compte de charge SYSCOHADA doit être disponible pour le test');
    const expenseCategory=await api('/depenses/categories','POST',{
      nom:'Transport',compteComptableId:expenseAccount.id,
    },201);
    const associationProject=await api('/associations/projects','POST',{
      code:'ASSO-RECETTE',nom:'Projet associatif de recette',dateDebut:'2026-10-16',
      dateFin:'2026-12-31',budgetTotal:5000,devise:'FCFA',
    },201);
    await api(`/associations/projects/${associationProject.id}/budgets`,'POST',{
      poste:'Transport',montantAlloue:3000,
    },201);
    await api(`/associations/projects/${associationProject.id}/budgets`,'POST',{
      poste:'Formation',montantAlloue:3000,
    },400);
    const financing=await api(`/associations/projects/${associationProject.id}/financings`,'POST',{
      bailleur:'Bailleur recette',referenceConvention:'CONV-01',montantEngage:3000,
    },201);
    const associationAccounts=await api('/associations/accounts');
    assert.ok(associationAccounts.treasury.length,'Comptes banque/caisse SYSCOHADA exposés');
    assert.ok(associationAccounts.grants.length,'Comptes de financement SYSCOHADA exposés');
    assert.ok(associationAccounts.expenseAccounts.some(account=>/^6/.test(account.numero)),
      'Comptes de charges proposés pour les paiements');
    const receipt=await api(`/associations/projects/${associationProject.id}/financings/${financing.id}/receipts`,'POST',{
      montant:2000,dateVersement:'2026-10-16',numeroPiece:'RECU-ASSO-01',
      compteTresorerieId:associationAccounts.treasury[0].id,
      compteProduitId:associationAccounts.grants[0].id,
    },201);
    assert.ok(receipt.accountingEntry.id,'Le versement crée une écriture comptable');
    const { rows:[receiptBalance] }=await queryAsTenant(signup.user.entrepriseId,
      'SELECT COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit FROM lignes_ecriture WHERE ecriture_id=$1',
      [receipt.accountingEntry.id],
    );
    assert.equal(Number(receiptBalance.debit),2000);
    assert.equal(Number(receiptBalance.credit),2000,'Le reçu de subvention est équilibré');
    await api(`/associations/projects/${associationProject.id}/financings/${financing.id}/receipts`,'POST',{
      montant:2000,dateVersement:'2026-10-16',compteTresorerieId:associationAccounts.treasury[0].id,
      compteProduitId:associationAccounts.grants[0].id,
    },400);
    const associatedExpense=await api('/depenses/create','POST',{
      categorieId:expenseCategory.id,montant:1000,dateDepense:'2026-10-16',
      description:'Dépense du projet associatif',projetId:associationProject.id,
    });
    assert.equal(associatedExpense.projetId,associationProject.id,'La dépense ERP conserve son lien projet');
    const associationReport=await api(`/associations/projects/${associationProject.id}/report`);
    assert.equal(Number(associationReport.totals.spent),0,'Une dépense en attente ne compte pas comme payée');
    assert.equal(Number(associationReport.totals.committed),1000,'La dépense reste visible comme engagement');
    assert.equal(Number(associationReport.totals.unpaid),1000,'Le solde dû est distinct des paiements');
    assert.equal(Number(associationReport.totals.received),2000);
    assert.equal(associationReport.expenses.length,1);
    assert.equal(associationReport.receipts.length,1);
    const paymentPath=`/associations/projects/${associationProject.id}/expenses/${associatedExpense.id}/payments`;
    const paymentBody={
      montant:600,datePaiement:'2026-10-17',numeroPiece:'PAY-ASSO-01',
      compteTresorerieId:associationAccounts.treasury[0].id,
      compteChargeId:associationAccounts.expenseAccounts.find(account=>/^6/.test(account.numero)).id,
    };
    const paymentKey=`functional-payment-${randomUUID()}`;
    const payment=await api(paymentPath,'POST',paymentBody,201,{'X-Idempotency-Key':paymentKey});
    assert.equal(Number(payment.montantPaye),600);
    assert.equal(Number(payment.soldeAPayer),400);
    const { rows:[paymentBalance] }=await queryAsTenant(signup.user.entrepriseId,
      'SELECT COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit FROM lignes_ecriture WHERE ecriture_id=$1',
      [payment.accountingEntry.id],
    );
    assert.equal(Number(paymentBalance.debit),600,'Le paiement débite le compte de charge');
    assert.equal(Number(paymentBalance.credit),600,'Le paiement crédite la trésorerie');
    await new Promise(resolve=>setTimeout(resolve,30));
    const replay=await api(paymentPath,'POST',paymentBody,201,{'X-Idempotency-Key':paymentKey});
    assert.equal(replay.payment.id,payment.payment.id,'La répétition idempotente ne crée pas un second paiement');
    const partialReport=await api(`/associations/projects/${associationProject.id}/report`);
    assert.equal(Number(partialReport.totals.spent),600);
    assert.equal(Number(partialReport.totals.unpaid),400);
    assert.equal(partialReport.expenses[0].statutPaiement,'partiellement_payee');
    assert.equal(partialReport.expenses[0].paiements.length,1);
    await api(paymentPath,'POST',{...paymentBody,montant:500,numeroPiece:'PAY-ASSO-OVER'},400);
    await api(paymentPath,'POST',{...paymentBody,montant:400,datePaiement:'2026-10-18',numeroPiece:'PAY-ASSO-02'},201);
    const settledReport=await api(`/associations/projects/${associationProject.id}/report`);
    assert.equal(Number(settledReport.totals.spent),1000);
    assert.equal(Number(settledReport.totals.unpaid),0);
    assert.equal(settledReport.expenses[0].statutPaiement,'payee');
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5N0AAAAASUVORK5CYII=','base64');
    const form=new FormData();
    form.append('logo',new Blob([png],{type:'image/png'}),'recette.png');
    const encoded=new Request(origin+'/api/upload/logo',{method:'POST',body:form});
    const logoCookie=requestCookieHeader('/upload/logo');
    const logoRequest={method:'POST',headers:{...(logoCookie ? {Cookie:logoCookie} : {}),
      'Content-Type':encoded.headers.get('Content-Type')},body:await encoded.arrayBuffer()};
    const uploaded=worker ? await worker.dispatchFetch(origin+'/api/upload/logo',logoRequest) :
      await fetch(origin+'/api/upload/logo',logoRequest);
    const uploadedBody=await uploaded.json();
    assert.equal(uploaded.status,200,`Upload logo : ${JSON.stringify(uploadedBody)}`);
    const {logoUrl}=uploadedBody;
    const logo=worker ? await worker.dispatchFetch(origin+logoUrl) : await fetch(origin+logoUrl);
    assert.equal(logo.status,200);
    assert.deepEqual(Buffer.from(await logo.arrayBuffer()),png);
    await api('/upload/logo','DELETE');
    const firstCookieJar = new Map(cookieJar);
    await api('/auth/register','POST',{username:'second',email:'second@example.invalid',
      password,entrepriseNom:'Autre entreprise isolée'},201);
    const secondLogin=await api('/auth-security/login','POST',{email:'second@example.invalid',password});
    assert.ok(secondLogin.session?.id);
    const secondClient=await api('/clients','POST',{
      nom:'Autre client',entrepriseId:signup.user.entrepriseId,userId:signup.user.id,
    },201);
    assert.notEqual(Number(secondClient.data.entrepriseId),Number(signup.user.entrepriseId),
      'La création doit ignorer le tenant fourni par le client');
    const tenantBClients=await api('/clients');
    assert.deepEqual(tenantBClients.data.map(client=>client.id),[secondClient.data.id],
      'La liste client ne doit retourner que les données du tenant connecté');
    const secondProduct=await api('/produits','POST',{
      reference:'TEST-TENANT-B',nom:'Produit autre entreprise',quantite:1,
      prixVente:100,prixAchat:50,entrepriseId:signup.user.entrepriseId,
    },201);
    assert.notEqual(Number(secondProduct.data.entrepriseId),Number(signup.user.entrepriseId),
      'La création produit doit ignorer le tenant fourni par le client');
    await api(`/produits/${productId}`,'GET',null,404);
    await api(`/produits/${productId}`,'PUT',{nom:'Modification interdite'},404);
    const tenantBProducts=await api('/produits');
    assert.deepEqual(tenantBProducts.data.map(product=>product.id),[secondProduct.data.id],
      'La liste produit ne doit retourner que les données du tenant connecté');
    await api('/factures','POST',{clientId:secondClient.data.id,items:[{description:'Service',quantite:1,prixUnitaire:500}]},201);
    const isolatedAssociationProjects=await api('/associations/projects');
    assert.deepEqual(isolatedAssociationProjects,[],'Les projets associatifs sont isolés par entreprise');
    await api(`/associations/projects/${associationProject.id}/report`,'GET',null,404);
    await api(`/factures/${f.id}`,'GET',null,404);
    const forged=await api(`/stock/produits?entrepriseId=${signup.user.entrepriseId}`);
    assert.deepEqual(forged.map(product=>product.id),[secondProduct.data.id],
      'Un paramètre entreprise falsifié ne doit retourner que les produits du tenant connecté');
    cookieJar = firstCookieJar;
    await api('/ia/chat','POST',{message:'ne pas envoyer'},404);
    await api('/auth-security/logout','POST',{sessionId:login.session.id});
    await api('/auth-security/session','GET',null,401);
    console.log('Recette : connexion, facture/paiement, écritures équilibrées, dépenses, projets associatifs, budgets, reçus de subvention, isolation tenant et déconnexion vérifiés.');
  } finally {
    if(server) await new Promise(r=>server.close(r));
    if(worker) await worker.dispose();
    if(pool) await pool.end();
    if(adminSchemaPool) await adminSchemaPool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    if(roleCreated) {
      await admin.query(`DROP OWNED BY "${rlsRole}"`);
      await admin.query(`DROP ROLE "${rlsRole}"`);
    }
    await admin.end();
    if(adminConnectionString === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = adminConnectionString;
    if(previousTenantRls === undefined) delete process.env.TENANT_RLS_ENABLED;
    else process.env.TENANT_RLS_ENABLED = previousTenantRls;
  }
});
