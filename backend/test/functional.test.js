import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

test('parcours ERP dans un schéma jetable sans accès aux données existantes', {
  skip: process.env.ERP_FUNCTIONAL_TEST !== '1',
  timeout: 120000,
}, async () => {
  const schema = `erp_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let server, pool, worker;
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
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
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
    let token;
    async function api(path, method='GET', body, expected=200) {
      const init = {
        method, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        ...(body ? {body:JSON.stringify(body)} : {}),
      };
      const res=worker ? await worker.dispatchFetch(origin+'/api'+path,init) : await fetch(origin+'/api'+path,init);
      const json=await res.json();
      assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(json).slice(0,400)}`);
      return json;
    }
    const password=randomUUID()+'Aa9!';
    const signup=await api('/auth/register','POST',{
      username:'recette',email:'recette@example.invalid',password,entrepriseNom:'Entreprise de recette isolée',
    },201);
    const login=await api('/auth-security/login','POST',{email:'recette@example.invalid',password});
    assert.ok(login.token);
    token=login.token;
    for(const path of ['/auth/me','/dashboard/global','/stock/receptions','/stock/alertes',
      '/stock/produits','/stock/rapports/valorisation','/depenses/list','/depenses/categories',
      '/immobilisations/list','/immobilisations/categories','/immobilisations/registre',
      '/comptabilite/plans','/comptabilite/comptes','/comptabilite/balance']) {
      await api(path);
    }
    const clientRecord=await api('/clients','POST',{nom:'Client recette'},201);
    const clientId=clientRecord.data.id;
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
    const paymentRequest={method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({montant:1180,modePaiement:'especes'})};
    const paymentUrl=origin+`/api/factures/${another.data.id}/paiement`;
    const results=await Promise.all([0,1].map(()=>worker ?
      worker.dispatchFetch(paymentUrl,paymentRequest) : fetch(paymentUrl,paymentRequest)));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,400],'Deux paiements concurrents ne doivent pas dépasser le solde');
    await Promise.all(results.map(r=>r.arrayBuffer()));
    const { rows:[balance] }=await pool.query('SELECT COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit,COUNT(*)::int AS n FROM lignes_ecriture');
    assert.ok(balance.n>0,'Des lignes comptables doivent avoir été créées');
    assert.equal(Number(balance.debit),Number(balance.credit),'Écritures équilibrées');
    const category=await api('/immobilisations/categories','POST',{nom:'Matériel',dureeVie:5,methodeAmortissement:'lineaire'});
    await api('/immobilisations/create','POST',{reference:'IMMO-TEST',description:'Matériel recette',
      categorieId:category.id,dateAcquisition:'2026-10-16',valeurAcquisition:100000});
    const expenseCategory=await api('/depenses/categories','POST',{nom:'Transport'});
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
    const receipt=await api(`/associations/projects/${associationProject.id}/financings/${financing.id}/receipts`,'POST',{
      montant:2000,dateVersement:'2026-10-16',numeroPiece:'RECU-ASSO-01',
      compteTresorerieId:associationAccounts.treasury[0].id,
      compteProduitId:associationAccounts.grants[0].id,
    },201);
    assert.ok(receipt.accountingEntry.id,'Le versement crée une écriture comptable');
    const { rows:[receiptBalance] }=await pool.query(
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
    assert.equal(Number(associationReport.totals.spent),1000);
    assert.equal(Number(associationReport.totals.received),2000);
    assert.equal(associationReport.expenses.length,1);
    assert.equal(associationReport.receipts.length,1);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5N0AAAAASUVORK5CYII=','base64');
    const form=new FormData();
    form.append('logo',new Blob([png],{type:'image/png'}),'recette.png');
    const encoded=new Request(origin+'/api/upload/logo',{method:'POST',body:form});
    const logoRequest={method:'POST',headers:{Authorization:`Bearer ${token}`,
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
    const firstToken=token;
    const second=await api('/auth/register','POST',{username:'second',email:'second@example.invalid',
      password,entrepriseNom:'Autre entreprise isolée'},201);
    token=second.token;
    const secondClient=await api('/clients','POST',{nom:'Autre client'},201);
    await api('/factures','POST',{clientId:secondClient.data.id,items:[{description:'Service',quantite:1,prixUnitaire:500}]},201);
    const isolatedAssociationProjects=await api('/associations/projects');
    assert.deepEqual(isolatedAssociationProjects,[],'Les projets associatifs sont isolés par entreprise');
    await api(`/associations/projects/${associationProject.id}/report`,'GET',null,404);
    await api(`/factures/${f.id}`,'GET',null,404);
    const forged=await api(`/stock/produits?entrepriseId=${signup.user.entrepriseId}`);
    assert.equal(forged.length,0,'Le paramètre entreprise ne doit pas donner accès aux produits tiers');
    token=firstToken;
    await api('/ia/chat','POST',{message:'ne pas envoyer'},404);
    await api('/auth-security/logout','POST',{sessionId:login.session.id});
    console.log('Recette : connexion, facture/paiement, écritures équilibrées, dépenses, projets associatifs, budgets, reçus de subvention, isolation tenant et déconnexion vérifiés.');
  } finally {
    if(server) await new Promise(r=>server.close(r));
    if(worker) await worker.dispose();
    if(pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
