import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as databaseSchema from '../src/schema.js';
import { PURCHASE_NUMBERING_STATEMENTS } from '../scripts/purchase-numbering-migration.js';
import {
  FISCAL_PERIOD_LOCK_GUARD_SQL,
  BACKFILL_FISCAL_PERIOD_CLOSURES_SQL,
  backfillFiscalPeriodClosures,
} from '../scripts/fiscal-period-lock-migration.js';

test('parcours ERP dans un schéma jetable sans accès aux données existantes', {
  skip: process.env.ERP_FUNCTIONAL_TEST !== '1',
  // Le parcours complet fait des centaines d'appels API séquentiels
  // contre Neon : depuis ce bac à sable, il prend ~10 min (latence
  // réseau, et fichiers de test exécutés en parallèle). 900 s laisse
  // la marge sans masquer un vrai blocage.
  timeout: 900000,
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
      await client.query(FISCAL_PERIOD_LOCK_GUARD_SQL);
    } finally { client.release(); }

    const adminUrl = new URL(adminConnectionString);
    const databaseName = decodeURIComponent(adminUrl.pathname.slice(1));
    const quotedRole = `"${rlsRole}"`;
    await admin.query(`CREATE ROLE ${quotedRole} LOGIN PASSWORD '${rlsPassword}' NOSUPERUSER NOBYPASSRLS`);
    roleCreated = true;
    // Neon : neondb_owner n'est pas superuser et n'est pas membre du rôle
    // qu'il vient de créer — sans cette appartenance, ALTER TABLE ... OWNER TO,
    // SET ROLE et DROP OWNED BY échouent en 42501. On s'ajoute comme membre
    // (le créateur est administrateur du rôle) ; l'appartenance est révoquée
    // au nettoyage, avant DROP ROLE. Cela ne change pas les privilèges du
    // rôle lui-même (le test vérifie rolsuper/rolbypassrls = false).
    await admin.query(`GRANT ${quotedRole} TO CURRENT_USER`);
    await admin.query(`GRANT CONNECT ON DATABASE "${databaseName.replaceAll('"', '""')}" TO ${quotedRole}`);
    await admin.query(`GRANT USAGE, CREATE ON SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "${schema}" TO ${quotedRole}`);
    await admin.query(`ALTER TABLE "${schema}"."idempotency" OWNER TO ${quotedRole}`);

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
    const [freeTrialPlan] = await adminSchemaDb.insert(databaseSchema.plansAbonnement).values({
      nom: 'Essai Gratuit',
      prix: '0.00',
      devise: 'XOF',
      periode: 'mensuel',
      limiteUtilisateurs: 1,
      limiteEntreprises: 1,
      stockageGb: 1,
      descriptionFeatures: '1 utilisateur • 50 factures par mois',
      actif: true,
    }).returning();
    const [basePlan] = await adminSchemaDb.insert(databaseSchema.plansAbonnement).values({
      nom: 'Base',
      prix: '9900.00',
      devise: 'XOF',
      periode: 'mensuel',
      actif: true,
    }).returning();
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
    async function apiMultipart(path, fields, file, expected=200) {
      const cookie = requestCookieHeader(path);
      const boundary = `----ComptaOrionTest${randomUUID().replaceAll('-', '')}`;
      const parts = [];
      for (const [name, value] of Object.entries(fields)) {
        parts.push(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        );
      }
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
        `Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n${file.content}\r\n`,
      );
      parts.push(`--${boundary}--\r\n`);
      const body = Buffer.from(parts.join(''), 'utf8');
      const res = worker
        ? await worker.dispatchFetch(origin + '/api' + path, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body,
        })
        : await fetch(origin + '/api' + path, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body,
        });
      storeResponseCookies(res);
      const json = await res.json();
      assert.equal(res.status, expected, `POST ${path}: ${JSON.stringify(json).slice(0, 400)}`);
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
    const testYear=new Date().getFullYear();
    const password=randomUUID()+'Aa9!';
    const publicPlans = await api('/public/plans');
    // Fusion des plans (27 nov. 2026) : l'endpoint public liste les
    // forfaits mensuels actifs — essai gratuit + plans payants — tandis
    // que l'inscription elle-même reste limitée à l'essai (POST vérifie
    // prix = 0 ; cas « forfait payant refusé » ci-dessous).
    assert.deepEqual(publicPlans.map(plan => Number(plan.prix)), [0, 9900],
      'Les plans publics doivent être l’essai gratuit puis Base');
    assert.deepEqual(publicPlans.map(plan => plan.nom), ['Essai Gratuit', 'Base'],
      'Les plans publics doivent être nommés Essai Gratuit puis Base');
    assert.equal(
      publicPlans[0].descriptionFeatures,
      'Essai de 30 jours dès la création de votre organisation, sans paiement.',
    );
    await api('/auth/register','POST',{
      username:'ancien-parcours',email:'ancien@example.invalid',password,
      entrepriseNom:'Parcours désactivé',
    },410);
    assert.equal(
      (await adminSchemaDb.select().from(databaseSchema.entreprises)).length,
      0,
      'L’ancien endpoint ne doit créer aucune entreprise',
    );
    await api('/public/inscription','POST',{
      nomEntreprise:'Mot de passe non confirmé',
      nomAdministrateur:'Administrateur de test',
      email:'confirmation@example.invalid',
      motDePasse:password,
      confirmationMotDePasse:'mot-de-passe-different',
      planId:freeTrialPlan.id,
    },400);
    assert.equal(
      (await adminSchemaDb.select().from(databaseSchema.entreprises)).length,
      0,
      'Une confirmation incorrecte ne doit créer aucune entreprise',
    );
    const signup=await api('/public/inscription','POST',{
      nomEntreprise:'Entreprise de recette isolée',
      nomAdministrateur:'Administrateur de recette',
      email:'recette@example.invalid',
      motDePasse:password,
      confirmationMotDePasse:password,
      pays:'Togo',
      planId:freeTrialPlan.id,
    },201);
    assert.equal(signup.user.role,'admin','Le créateur reçoit le rôle administrateur');
    assert.equal(signup.entreprise.nom,'Entreprise de recette isolée');
    assert.equal(signup.abonnement.statut,'actif');
    assert.equal(Number(signup.abonnement.montantMensuel),0);
    assert.ok(
      Math.abs(Date.parse(signup.abonnement.createdAt) - Date.parse(signup.entreprise.createdAt)) < 5000,
      'La période d’essai doit commencer à la création de l’organisation',
    );
    assert.equal(
      Math.round((Date.parse(signup.abonnement.dateExpiration)-Date.parse(signup.abonnement.dateDebut))/86400000),
      30,
      'L’essai doit expirer après 30 jours',
    );
    await api('/public/inscription','POST',{
      nomEntreprise:'Forfait payant refusé',
      nomAdministrateur:'Administrateur de test',
      email:'payant@example.invalid',
      motDePasse:password,
      confirmationMotDePasse:password,
      planId:basePlan.id,
    },404);
    await api('/public/inscription','POST',{
      nomEntreprise:'Adresse déjà utilisée',
      nomAdministrateur:'Administrateur de test',
      email:'RECETTE@example.invalid',
      motDePasse:password,
      confirmationMotDePasse:password,
      planId:freeTrialPlan.id,
    },409);
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
    const { clearPlanCapabilitiesCache } = await import('../src/services/planEntitlements.js');
    const trialCapabilities = await api('/produits/capacites');
    assert.equal(trialCapabilities.automaticCosting, true,
      'L’essai gratuit doit inclure le calcul Premium pour permettre aux prospects de le tester');
    assert.equal(trialCapabilities.ocr, true,
      'L’essai gratuit doit inclure la lecture OCR pour permettre aux prospects de la tester');
    assert.equal(trialCapabilities.associationAccounting, true,
      'L’essai gratuit doit inclure la comptabilité associative pour permettre aux prospects de la tester');

    await adminSchemaPool.query(
      'UPDATE abonnements SET plan_id = $1 WHERE entreprise_id = $2',
      [basePlan.id, signup.user.entrepriseId],
    );
    clearPlanCapabilitiesCache();
    const standardCapabilities = await api('/produits/capacites');
    assert.equal(standardCapabilities.automaticCosting, false,
      'Le forfait Base doit rester en saisie manuelle');
    assert.equal(standardCapabilities.ocr, false,
      'La lecture OCR est réservée au Premium (fusion des plans, 27 nov. 2026)');
    assert.equal(standardCapabilities.associationAccounting, false,
      'La comptabilité associative est réservée au Premium (fusion des plans, 27 nov. 2026)');
    // Le garde du routeur associatif doit refuser le forfait Base.
    await api('/associations/projects', 'GET', null, 403);
    const manualProduct = await api('/produits', 'POST', {
      reference: 'MANUEL-PLAN',
      nom: 'Produit coût manuel',
      quantite: 2,
      prixAchat: 80,
      coutMoyen: 125,
      prixVente: 180,
    }, 201);
    assert.equal(Number(manualProduct.data.coutMoyen), 125);
    assert.equal(Number(manualProduct.data.prixVente), 180,
      'Les forfaits non-Premium doivent pouvoir saisir manuellement coût et prix');
    await api('/clients/prix-produits/calculer', 'POST', {
      produitId: manualProduct.data.id,
      margeBruteCible: 30,
    }, 403);

    const { consumeStockValuation, createStockValuationLayer, updateProductAverageCost } =
      await import('../src/services/stockValuation.js');
    const manualSaleCost = await adminSchemaDb.transaction((tx) => consumeStockValuation(tx, {
      entrepriseId: signup.user.entrepriseId,
      produitId: manualProduct.data.id,
      quantity: 2,
    }));
    assert.equal(manualSaleCost.trackedQuantity, 2);
    assert.equal(manualSaleCost.coutConsomme, 250,
      'La sortie de stock doit reprendre le coût unitaire saisi manuellement');
    const noAutomaticLayer = await adminSchemaDb.transaction((tx) => createStockValuationLayer(tx, {
      entrepriseId: signup.user.entrepriseId,
      produitId: manualProduct.data.id,
      quantity: 2,
      totalCost: 999,
      unitCost: 499.5,
    }));
    assert.equal(noAutomaticLayer, null,
      'Un forfait manuel ne doit pas créer de couche de coût calculée');
    await adminSchemaDb.transaction((tx) =>
      updateProductAverageCost(tx, signup.user.entrepriseId, manualProduct.data.id));
    const manualProductAfterReceipt = await adminSchemaPool.query(
      'SELECT cout_moyen, prix_vente FROM produits WHERE entreprise_id = $1 AND id = $2',
      [signup.user.entrepriseId, manualProduct.data.id],
    );
    assert.equal(Number(manualProductAfterReceipt.rows[0].cout_moyen), 125,
      'Une réception ne doit pas écraser le coût saisi pour Base');
    assert.equal(Number(manualProductAfterReceipt.rows[0].prix_vente), 180,
      'Une réception ne doit pas recalculer le prix saisi pour Base');
    await adminSchemaPool.query(
      'UPDATE produits SET quantite = 0 WHERE entreprise_id = $1 AND id = $2',
      [signup.user.entrepriseId, manualProduct.data.id],
    );
    // (a) Stock initial avec coût : écriture d'ouverture D 31 / C 101 et
    // couche d'ouverture à la création du produit.
    const openingProduct = await api('/produits', 'POST', {
      reference: 'OUV-STOCK-A',
      nom: 'Produit stock ouverture',
      quantite: 10,
      prixAchat: 5000,
      coutMoyen: 5000,
      prixVente: 7000,
    }, 201);
    assert.equal(Number(openingProduct.data.coutMoyen), 5000);
    const openingLayers = await adminSchemaPool.query(
      `SELECT quantite, cout_unitaire, cout_total FROM "${schema}".valorisations_stock
       WHERE entreprise_id = $1 AND produit_id = $2`,
      [signup.user.entrepriseId, openingProduct.data.id],
    );
    assert.equal(openingLayers.rows.length, 1,
      'La création doit poser une couche d’ouverture pour le stock initial');
    assert.equal(Number(openingLayers.rows[0].quantite), 10);
    assert.equal(Number(openingLayers.rows[0].cout_unitaire), 5000);
    assert.equal(Number(openingLayers.rows[0].cout_total), 50000);
    const openingEntry = await adminSchemaPool.query(
      `SELECT e.id, e.libelle FROM "${schema}".ecritures e
       WHERE e.entreprise_id = $1 AND e.numero_piece = $2`,
      [signup.user.entrepriseId, 'OUV-STOCK-OUV-STOCK-A'],
    );
    assert.equal(openingEntry.rows.length, 1,
      'La création doit passer une écriture d’ouverture de stock');
    assert.match(openingEntry.rows[0].libelle, /Stock d'ouverture/);
    const openingLines = await adminSchemaPool.query(
      `SELECT c.numero, l.debit, l.credit FROM "${schema}".lignes_ecriture l
       JOIN "${schema}".comptes_comptables c ON c.id = l.compte_comptable_id
       WHERE l.entreprise_id = $1 AND l.ecriture_id = $2`,
      [signup.user.entrepriseId, openingEntry.rows[0].id],
    );
    assert.equal(openingLines.rows.length, 2,
      'L’écriture d’ouverture doit avoir deux lignes (31 et 101)');
    const openingDebit = openingLines.rows.find((row) => row.numero.startsWith('31'));
    const openingCredit = openingLines.rows.find((row) => row.numero.startsWith('101'));
    assert.ok(openingDebit && Number(openingDebit.debit) === 50000 && Number(openingDebit.credit) === 0,
      'L’écriture d’ouverture doit débiter le 31 de quantité × coût (50000)');
    assert.ok(openingCredit && Number(openingCredit.debit) === 0 && Number(openingCredit.credit) === 50000,
      'L’écriture d’ouverture doit créditer le 101 de quantité × coût (50000)');
    // (b) Vente de tout le stock initial : le compte 31 ne part pas en
    // négatif (il ne contient plus que le stock du produit manuel, 250).
    const openingClient = await api('/clients', 'POST', {
      nom: 'Client stock ouverture',
      compteComptableId: 999999,
    }, 201);
    const openingInvoice = await api('/factures', 'POST', {
      clientId: openingClient.data.id,
      dateFacture: `${testYear}-01-16`,
      items: [{ produitId: openingProduct.data.id, quantite: 10, prixUnitaire: 7000 }],
    }, 201);
    await api(`/factures/${openingInvoice.data.id}`, 'PUT', { statut: 'envoyee' }, 200);
    const stockBalanceAfterSale = await adminSchemaPool.query(
      `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS solde
       FROM "${schema}".lignes_ecriture l
       JOIN "${schema}".comptes_comptables c ON c.id = l.compte_comptable_id
       WHERE l.entreprise_id = $1 AND c.numero LIKE '31%'`,
      [signup.user.entrepriseId],
    );
    assert.equal(Number(stockBalanceAfterSale.rows[0].solde), 250,
      'Après vente de tout le stock initial, le 31 ne doit contenir que le stock du produit manuel');
    const soldProduct = await adminSchemaPool.query(
      'SELECT quantite FROM produits WHERE entreprise_id = $1 AND id = $2',
      [signup.user.entrepriseId, openingProduct.data.id],
    );
    assert.equal(Number(soldProduct.rows[0].quantite), 0,
      'La vente doit décrémenter la quantité du produit vendu');
    // (c) Stock initial sans coût : aucune écriture, aucune couche, pas de crash.
    const noCostProduct = await api('/produits', 'POST', {
      reference: 'OUV-STOCK-C',
      nom: 'Produit sans coût',
      quantite: 5,
      prixAchat: 0,
      coutMoyen: 0,
      prixVente: 1000,
    }, 201);
    const noCostLayers = await adminSchemaPool.query(
      `SELECT id FROM "${schema}".valorisations_stock WHERE entreprise_id = $1 AND produit_id = $2`,
      [signup.user.entrepriseId, noCostProduct.data.id],
    );
    assert.equal(noCostLayers.rows.length, 0,
      'Un stock initial sans coût ne doit créer aucune couche');
    const noCostEntries = await adminSchemaPool.query(
      `SELECT id FROM "${schema}".ecritures WHERE entreprise_id = $1 AND numero_piece = $2`,
      [signup.user.entrepriseId, 'OUV-STOCK-OUV-STOCK-C'],
    );
    assert.equal(noCostEntries.rows.length, 0,
      'Un stock initial sans coût ne doit passer aucune écriture');
    await adminSchemaPool.query(
      'UPDATE abonnements SET plan_id = $1 WHERE entreprise_id = $2',
      [freeTrialPlan.id, signup.user.entrepriseId],
    );
    clearPlanCapabilitiesCache();
    assert.equal((await api('/produits/capacites')).automaticCosting, true,
      'Le retour à l’essai doit réactiver le calcul automatique');
    // R5 (CMP) : la consommation doit utiliser la moyenne calculée depuis
    // les couches, pas le coutMoyen stocké quand il est périmé.
    const staleCostProduct = await api('/produits', 'POST', {
      reference: 'COUT-PERIME',
      nom: 'Produit coût périmé',
      quantite: 10,
      prixAchat: 6000,
    }, 201);
    await adminSchemaDb.insert(databaseSchema.valorisationsStock).values({
      entrepriseId: signup.user.entrepriseId,
      produitId: staleCostProduct.data.id,
      mouvementId: null,
      methode: 'CMP',
      coutUnitaire: '6000.00',
      coutTotal: '60000.00',
      quantite: '10.000',
    });
    await adminSchemaPool.query(
      'UPDATE produits SET cout_moyen = $1 WHERE entreprise_id = $2 AND id = $3',
      ['5000.00', signup.user.entrepriseId, staleCostProduct.data.id],
    );
    const staleSaleCost = await adminSchemaDb.transaction((tx) =>
      consumeStockValuation(tx, {
        entrepriseId: signup.user.entrepriseId,
        produitId: staleCostProduct.data.id,
        quantity: 2,
      }));
    assert.equal(staleSaleCost.trackedQuantity, 2);
    assert.equal(staleSaleCost.coutConsomme, 12000,
      'La consommation CMP doit valoriser au coût moyen des couches (6000), pas au coutMoyen périmé (5000)');
    const importEntityTypes = await api('/import/entity-types');
    assert.deepEqual(importEntityTypes.data.map(item => item.id), [
      'clients', 'fournisseurs', 'plan_comptable', 'produits',
    ], 'L’API ne doit pas annoncer les imports factures/écritures non implémentés');
    const importAndCommit = async ({ source, entityType, filename, csv, mapping }) => {
      const upload = await apiMultipart('/import/upload', {
        sourceLogiciel: source,
        typeEntite: entityType,
      }, {
        filename,
        content: csv,
        contentType: 'text/csv',
      });
      await api(`/import/batches/${upload.data.batchId}/mapping`, 'POST', {
        mappingColonnes: mapping,
        optionsImport: {},
      });
      const validation = await api(`/import/batches/${upload.data.batchId}/validate`, 'POST', {});
      assert.equal(validation.data.valides, 1, `La ligne ${entityType} synthétique doit être valide`);
      const commit = await api(`/import/batches/${upload.data.batchId}/commit`, 'POST', {});
      assert.equal(commit.data.importes, 1, `La ligne ${entityType} synthétique doit être importée`);
      return { batchId: upload.data.batchId, preview: upload.data.previewRows[0] };
    };
    const importedClient = await importAndCommit({
      source: 'sage100',
      entityType: 'clients',
      filename: 'clients-sage.csv',
      csv: '\uFEFFNom;Email;Téléphone;Ville;Pays\r\n"Client; Démo";import-client@example.invalid;90000001;Lomé;Togo',
      mapping: {
        Nom: 'nom',
        Email: 'email',
        Téléphone: 'telephone',
        Ville: 'ville',
        Pays: 'pays',
      },
    });
    assert.equal(importedClient.preview.data.Nom, 'Client; Démo',
      'Le CSV Sage doit préserver les séparateurs placés entre guillemets');
    const importedClientRow = (await admin.query(
      `SELECT numero_client, code_auxiliaire, pays FROM "${schema}".clients WHERE entreprise_id = $1 AND email = $2`,
      [signup.user.entrepriseId, 'import-client@example.invalid'],
    )).rows[0];
    assert.match(importedClientRow.numero_client, /^CLI\d{5}(?:-\d+)?$/);
    assert.equal(importedClientRow.code_auxiliaire, importedClientRow.numero_client);
    assert.equal(importedClientRow.pays, 'Togo');

    await importAndCommit({
      source: 'excel',
      entityType: 'fournisseurs',
      filename: 'fournisseurs.csv',
      csv: 'Raison sociale,Email,Téléphone\n"Fournisseur, Démo",import-supplier@example.invalid,90000002',
      mapping: {
        'Raison sociale': 'raisonSociale',
        Email: 'email',
        Téléphone: 'telephone',
      },
    });
    const importedSupplierRow = (await admin.query(
      `SELECT numero_fournisseur, code_auxiliaire FROM "${schema}".fournisseurs WHERE entreprise_id = $1 AND email = $2`,
      [signup.user.entrepriseId, 'import-supplier@example.invalid'],
    )).rows[0];
    assert.match(importedSupplierRow.numero_fournisseur, /^FOU\d{5}$/);
    assert.equal(importedSupplierRow.code_auxiliaire, importedSupplierRow.numero_fournisseur);

    await importAndCommit({
      source: 'excel',
      entityType: 'plan_comptable',
      filename: 'plan-comptable.csv',
      csv: 'N° compte,Libellé,Type,Classe\n889912,Compte de test,charge,8',
      mapping: {
        'N° compte': 'numeroCompte',
        Libellé: 'libelle',
        Type: 'typeCompte',
        Classe: 'classe',
      },
    });
    const importedAccountRow = (await admin.query(
      `SELECT numero, nom, type, categorie FROM "${schema}".comptes_comptables WHERE entreprise_id = $1 AND numero = $2`,
      [signup.user.entrepriseId, '889912'],
    )).rows[0];
    assert.deepEqual(importedAccountRow, {
      numero: '889912',
      nom: 'Compte de test',
      type: 'charge',
      categorie: 'résultat',
    });

    await importAndCommit({
      source: 'sage100',
      entityType: 'produits',
      filename: 'produits.csv',
      csv: 'Nom;Prix de vente;Prix d’achat;Référence;Unité;Poids;Unité poids\r\n"Pompe; agricole";"1 250,50";"900,25";PMP-TEST;pièce;2,5;kg',
      mapping: {
        Nom: 'nom',
        'Prix de vente': 'prixVente',
        'Prix d’achat': 'prixAchat',
        Référence: 'reference',
        Unité: 'uniteMesure',
        Poids: 'poidsParUnite',
        'Unité poids': 'unitePoids',
      },
    });
    const importedProductRow = (await admin.query(
      `SELECT nom, prix_vente, prix_achat, reference, unite_mesure, poids_par_unite, unite_poids
       FROM "${schema}".produits WHERE entreprise_id = $1 AND reference = $2`,
      [signup.user.entrepriseId, 'PMP-TEST'],
    )).rows[0];
    assert.equal(importedProductRow.nom, 'Pompe; agricole');
    assert.equal(Number(importedProductRow.prix_vente), 0,
      'Le prix historique importé ne devient pas un prix de vente avant coût réel');
    assert.equal(Number(importedProductRow.prix_achat), 900.25);
    assert.equal(Number(importedProductRow.poids_par_unite), 2.5);
    assert.equal(importedProductRow.unite_mesure, 'pièce');
    assert.equal(importedProductRow.unite_poids, 'kg');

    const unsupportedResult = await apiMultipart('/import/upload', {
      sourceLogiciel: 'excel',
      typeEntite: 'factures',
    }, {
      filename: 'factures.csv',
      content: 'x,y\n1,2',
      contentType: 'text/csv',
    }, 400);
    assert.match(unsupportedResult.error, /pas encore pris en charge/i);

    const platformSubscriptions = await api('/saas-admin/abonnements');
    assert.ok(Array.isArray(platformSubscriptions),
      'Le rôle admin plateforme conserve l’accès SaaS via le contexte RLS privilégié');
    for(const path of ['/auth/me','/dashboard/global','/stock/receptions','/stock/alertes',
      '/stock/produits','/stock/rapports/valorisation','/depenses/list','/depenses/categories',
      '/comptabilite/plans','/comptabilite/comptes','/comptabilite/balance']) {
      await api(path);
    }
    const clientRecord=await api('/clients','POST',{
      nom:'Client recette',
      compteComptableId:999999,
    },201);
    const clientId=clientRecord.data.id;
    assert.match(clientRecord.data.numeroClient,/^CLI\d{5}(?:-\d+)?$/,
      'Un numéro client auxiliaire doit être attribué automatiquement');
    assert.equal(clientRecord.data.codeAuxiliaire.slice(0,3),'CLI');
    const goodsCollectiveAccount = await admin.query(
      `SELECT id FROM "${schema}".comptes_comptables WHERE entreprise_id = $1 AND numero = '4111'`,
      [signup.user.entrepriseId],
    );
    assert.equal(clientRecord.data.compteComptableId, Number(goodsCollectiveAccount.rows[0]?.id),
      'Les clients de biens doivent partager le compte collectif 4111');
    const supplierRecord = await api('/fournisseurs','POST',{
      raisonSociale:'Fournisseur recette',
      numeroFournisseur:'FOURNI_PAR_CLIENT',
    },201);
    assert.match(supplierRecord.data.numeroFournisseur,/^FOU\d{5,}$/,
      'Un numéro fournisseur auxiliaire doit être attribué automatiquement');
    assert.equal(supplierRecord.data.codeAuxiliaire,supplierRecord.data.numeroFournisseur,
      'Le code auxiliaire et le numéro fournisseur doivent identifier la même fiche');
    const secondSupplierRecord = await api('/fournisseurs','POST',{
      raisonSociale:'Second fournisseur recette',
    },201);
    assert.notEqual(supplierRecord.data.numeroFournisseur,secondSupplierRecord.data.numeroFournisseur,
      'Chaque fournisseur doit recevoir un numéro distinct');
    const [{ rows: salaryJournalRows }, { rows: salaryAccountRows }] = await Promise.all([
      admin.query(
        `SELECT id FROM "${schema}".journaux WHERE entreprise_id = $1 AND code = 'SA' LIMIT 1`,
        [signup.user.entrepriseId],
      ),
      admin.query(
        `SELECT id, numero FROM "${schema}".comptes_comptables
         WHERE entreprise_id = $1 AND numero IN ('421', '5121')`,
        [signup.user.entrepriseId],
      ),
    ]);
    const salaryJournal = salaryJournalRows[0];
    const salaryAccount = salaryAccountRows.find((account) => account.numero === '421');
    const bankAccount = salaryAccountRows.find((account) => account.numero === '5121');
    assert.ok(salaryJournal && salaryAccount && bankAccount,
      'Le journal de salaires et les comptes de personnel et banque doivent être initialisés');
    const manualSalaryEntry = await api('/comptabilite/ecritures','POST',{
      journalId:salaryJournal.id,
      dateEcriture:`${testYear}-11-06`,
      reference:'TEST-ECRITURE-MANUELLE',
      description:'Salaire comptable de recette',
      lignes:[
        {compteComptableId:salaryAccount.id,debit:'550000.00',credit:'0.00',libelle:'Salaire comptable'},
        {compteComptableId:bankAccount.id,debit:'0.00',credit:'550000.00',libelle:'Paiement salaire'},
      ],
    },201);
    assert.ok(manualSalaryEntry.id,'La création atomique doit retourner l’identifiant de l’écriture');
    assert.equal(manualSalaryEntry.valide, true,
      'Une écriture manuelle équilibrée doit être validée dès son enregistrement');
    assert.equal(manualSalaryEntry.totalDebit,550000);
    assert.equal(manualSalaryEntry.totalCredit,550000);
    const incompleteManualEntry = await api('/comptabilite/ecritures','POST',{
      journalId:salaryJournal.id,
      dateEcriture:`${testYear}-11-06`,
      reference:'TEST-ECRITURE-INCOMPLETE',
      description:'Écriture sans lignes',
    },400);
    assert.match(incompleteManualEntry.error, /liste|lignes/i,
      'Le logiciel ne doit pas enregistrer d’écriture vide en brouillon');
    const savedSalaryEntry = await admin.query(
      `SELECT valide, numero_ecriture FROM "${schema}".ecritures
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId,manualSalaryEntry.id],
    );
    assert.equal(savedSalaryEntry.rows[0]?.valide,true,
      'L’écriture manuelle équilibrée doit être validée');
    assert.ok(savedSalaryEntry.rows[0]?.numero_ecriture,
      'L’écriture manuelle doit recevoir son numéro séquentiel');
    const supplierStatement = await api('/fournisseurs/etat-compte','POST',{
      fournisseurId:supplierRecord.data.numeroFournisseur,
      dateDebut:`${testYear}-01-01`,
      dateFin:`${testYear}-12-31`,
    });
    assert.equal(supplierStatement.data.fournisseur.numeroFournisseur,supplierRecord.data.numeroFournisseur,
      'L’état de compte fournisseur doit résoudre la fiche par son numéro auxiliaire');
    const unscopedClients=await pool.query('SELECT id FROM clients');
    assert.equal(unscopedClients.rowCount,0,'Sans contexte tenant, RLS doit masquer toutes les lignes');
    const productRecord=await api('/produits','POST',{reference:'TEST-ERP',nom:'Produit recette',
      quantite:10,prixVente:0,prixAchat:900,poidsParUnite:2,unitePoids:'kg'},201);
    const productId=productRecord.data.id;
    const listedProducts=await api('/produits');
    assert.ok(listedProducts.data.some(product => product.id === productId),
      'Le produit créé doit apparaître immédiatement dans la liste de son entreprise');
    const productWithoutReference=await api('/produits','POST',{
      nom:'Produit sans référence recette',prixAchat:0,prixVente:0,
    },201);
    assert.equal(productWithoutReference.data.reference,null,
      'Une référence produit facultative ne doit pas bloquer sa création');
    const warehouseRecord = await api('/stock/entrepots','POST',{
      nom:'Entrepôt test temporaire',
    });
    const listedWarehouses = await api('/stock/entrepots');
    assert.ok(listedWarehouses.some(warehouse => warehouse.id === warehouseRecord.id),
      'La création d’un entrepôt doit le rendre immédiatement visible dans la liste');
    const secondCostProduct = await api('/produits','POST',{
      reference:'TEST-ERP-2',nom:'Produit léger recette',quantite:0,prixVente:0,
      prixAchat:3000,poidsParUnite:1,unitePoids:'kg',
    },201);
    assert.equal(Number(productRecord.data.prixVente),0,
      'Un nouveau produit sans réception ne doit pas avoir de prix de vente');
    await api('/clients/prix-produits/calculer','POST',{
      produitId:productId,margeBruteCible:30,
    },409);
    await api('/clients/prix-produits','POST',{
      produitId:productId,margeBruteCible:30,
    },409);
    const uncostedDraft=await api('/factures','POST',{
      clientId,items:[{produitId:productId,quantite:1,prixUnitaire:1000}],
    },201);
    await api(`/factures/${uncostedDraft.data.id}`,'PUT',{statut:'envoyee'},409);

    const purchaseOrder = await api('/commandes-achat','POST',{
      fournisseurId:supplierRecord.data.id,
      dateCommande:new Date().toISOString().slice(0,10),
      items:[
        {produitId:productId,description:'Produit recette',quantite:10,prixUnitaire:500},
        {produitId:secondCostProduct.data.id,description:'Produit léger recette',quantite:10,prixUnitaire:2000},
      ],
      coutsLogistiques:[{type:'transport',description:'Transport commun',montant:100}],
    },201);
    assert.equal(Number(purchaseOrder.data.totalTVA), 4518,
      'La commande calcule la TVA de l’entreprise sur les articles et frais logistiques comme la facture');
    await admin.query(`UPDATE "${schema}".entreprises SET taux_tva = 9 WHERE id = $1`, [signup.user.entrepriseId]);
    const editedPurchaseOrder = await api(`/commandes-achat/${purchaseOrder.data.id}`,'PUT',{
      fournisseurId:supplierRecord.data.id,
      dateCommande:new Date().toISOString().slice(0,10),
      notes:'Bon modifié avant réception',
      items:purchaseOrder.data.items.map(line=>({
        produitId:line.produitId,
        description:line.description,
        quantite:Number(line.quantite),
        prixUnitaire:Number(line.prixUnitaire),
        remise:Number(line.remise || 0),
      })),
      coutsLogistiques:[{type:'transport',description:'Transport commun',montant:100}],
    });
    assert.equal(Number(editedPurchaseOrder.data.totalTVA), 2259,
      'La modification de commande utilise le taux de TVA configuré, pas un taux fixe');
    await admin.query(`UPDATE "${schema}".entreprises SET taux_tva = 18 WHERE id = $1`, [signup.user.entrepriseId]);
    await api(`/commandes-achat/${purchaseOrder.data.id}/confirmer`,'PUT',{});
    const receivePart = (quantity) => api('/receptions','POST',{
      commandeId:purchaseOrder.data.id,
      dateReception:new Date().toISOString().slice(0,10),
      entrepotId:warehouseRecord.id,
      items:editedPurchaseOrder.data.items.map(line=>({
        commandeItemId:line.id,
        quantiteRecue:quantity,
        poidsParUnite:line.produitId === productId ? 3 : 1.5,
        unitePoids:'kg',
      })),
    });
    await admin.query(
      `UPDATE "${schema}".journaux SET type = ''
       WHERE entreprise_id = $1 AND code = 'AC'`,
      [signup.user.entrepriseId],
    );
    const firstReceipt = await receivePart(5);
    const repairedPurchaseJournal = await admin.query(
      `SELECT type FROM "${schema}".journaux
       WHERE entreprise_id = $1 AND code = 'AC'`,
      [signup.user.entrepriseId],
    );
    assert.equal(repairedPurchaseJournal.rows[0]?.type, 'achats',
      'Un journal des achats existant sans type doit être réparé avant de créer l’écriture de réception');
    assert.ok(firstReceipt.data?.receptionId,
      'La réception doit être créée même si le journal des achats était mal configuré');
    const recordedReceiptWeights = await admin.query(
      `SELECT id, poids_par_unite, unite_poids
       FROM "${schema}".produits
       WHERE entreprise_id = $1 AND id = ANY($2::int[])`,
      [signup.user.entrepriseId,[productId,secondCostProduct.data.id]],
    );
    const receiptWeightsByProductId = new Map(
      recordedReceiptWeights.rows.map(row => [Number(row.id), row]),
    );
    assert.equal(Number(receiptWeightsByProductId.get(productId)?.poids_par_unite),3,
      'Le poids saisi à la réception doit être enregistré sur le produit');
    assert.equal(receiptWeightsByProductId.get(productId)?.unite_poids,'kg');
    assert.equal(Number(receiptWeightsByProductId.get(secondCostProduct.data.id)?.poids_par_unite),1.5);
    await api(`/commandes-achat/${purchaseOrder.data.id}`,'PUT',{
      fournisseurId:supplierRecord.data.id,
      items:editedPurchaseOrder.data.items.map(line=>({
        produitId:line.produitId,
        description:line.description,
        quantite:Number(line.quantite),
        prixUnitaire:Number(line.prixUnitaire),
        remise:Number(line.remise || 0),
      })),
      coutsLogistiques:[{type:'transport',description:'Transport modifié',montant:100}],
    },409);
    await receivePart(5);
    const pendingStockTotals = await admin.query(
      `SELECT COUNT(*)::int AS row_count, SUM(valeur_estimee)::numeric AS amount
       FROM "${schema}".stock_pending WHERE entreprise_id = $1 AND statut = 'pending'`,
      [signup.user.entrepriseId],
    );
    assert.equal(pendingStockTotals.rows[0].row_count,4,
      'Chaque ligne produit de chaque réception doit être suivie comme stock non facturé');
    assert.equal(Number(pendingStockTotals.rows[0].amount),25000,
      'Le stock non facturé conserve le prix des articles, séparément des frais logistiques');
    const pendingLogisticsTotal = await admin.query(
      `SELECT COUNT(*)::int AS row_count, SUM(montant_estime)::numeric AS amount
       FROM "${schema}".logistique_pending WHERE entreprise_id = $1 AND statut = 'pending'`,
      [signup.user.entrepriseId],
    );
    assert.equal(pendingLogisticsTotal.rows[0].row_count,2,
      'Les frais logistiques doivent être suivis une fois par type et par réception partielle');
    assert.equal(Number(pendingLogisticsTotal.rows[0].amount),100,
      'Les frais logistiques prévisionnels sont répartis sans doublon entre les réceptions partielles');
    const warehouseStock = await admin.query(
      `SELECT quantite_presente FROM "${schema}".stock_par_entrepot
       WHERE entreprise_id = $1 AND produit_id = $2 AND entrepot_id = $3`,
      [signup.user.entrepriseId, productId, warehouseRecord.id],
    );
    assert.equal(Number(warehouseStock.rows[0]?.quantite_presente || 0),10,
      'La réception met aussi à jour la quantité dans l’entrepôt choisi');
    assert.ok(firstReceipt.data.receptionNumero,
      'Chaque réception issue d’une commande reçoit un numéro de bon');
    const receiptAccountingRows = await admin.query(
      `SELECT e.valide, cc.numero,
              SUM(le.debit)::numeric AS debit,
              SUM(le.credit)::numeric AS credit
       FROM "${schema}".ecritures e
       JOIN "${schema}".bons_reception br
         ON br.ecriture_stock_id = e.id AND br.entreprise_id = e.entreprise_id
       JOIN "${schema}".lignes_ecriture le ON le.ecriture_id = e.id
       JOIN "${schema}".comptes_comptables cc ON cc.id = le.compte_comptable_id
       WHERE e.entreprise_id = $1 AND br.id = $2
       GROUP BY e.valide, cc.numero`,
      [signup.user.entrepriseId, firstReceipt.data.receptionId],
    );
    assert.ok(receiptAccountingRows.rows.length > 0,
      'La réception doit créer une écriture comptable');
    assert.ok(receiptAccountingRows.rows.every((row) => row.valide),
      'Une réception validée doit immédiatement publier son écriture comptable');
    const receiptStockLine = receiptAccountingRows.rows.find((row) => row.numero.startsWith('31'));
    const receiptPendingLine = receiptAccountingRows.rows.find((row) => row.numero.startsWith('408'));
    assert.ok(receiptStockLine && receiptPendingLine,
      'La réception doit utiliser un compte de stock 31 et le compte temporaire 408');
    assert.equal(Number(receiptStockLine.debit), Number(receiptPendingLine.credit),
      'La réception doit débiter le stock et créditer le compte temporaire du même montant');
    const receiptAccountingBalance = await api(
      `/comptabilite/balance?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    assert.ok(receiptAccountingBalance.comptes.some((account) => account.numero === receiptStockLine.numero),
      'La balance doit afficher le compte de stock de la réception validée');
    assert.ok(receiptAccountingBalance.comptes.some((account) => account.numero === receiptPendingLine.numero),
      'La balance doit afficher le compte temporaire de la réception validée');
    const pendingReceipts = await api(
      `/achats/receptions-en-attente?fournisseurId=${supplierRecord.data.id}`,
    );
    assert.equal(pendingReceipts.data.length, 2,
      'Les réceptions de la commande doivent être proposées au rapprochement de facture');
    const stockPendingReport = await api('/stock/rapports/stock-non-facture');
    const logisticsPendingReport = await api('/stock/rapports/logistique-non-facturee');
    assert.equal(stockPendingReport.items.length, 4,
      'Le rapport doit exposer le stock non facturé des réceptions');
    assert.equal(logisticsPendingReport.items.length, 2,
      'Le rapport doit exposer les frais logistiques non facturés des réceptions');
    const varianceAccount = await admin.query(
      `INSERT INTO "${schema}".comptes_comptables
         (entreprise_id, numero, nom, type, categorie, actif)
       VALUES ($1, 'TEST-ECART-CHARGE', 'Compte test écart achat', 'charges', 'Charges', true)
       RETURNING id`,
      [signup.user.entrepriseId],
    );
    assert.ok(varianceAccount.rows[0]?.id,
      'Le plan comptable de test doit offrir un compte actif pour enregistrer les écarts');
    const availableVarianceAccounts = await api('/achats/comptes-ecarts');
    assert.ok(
      availableVarianceAccounts.accounts.some(account => Number(account.id) === Number(varianceAccount.rows[0].id)),
      'L’API achats doit rendre le compte de charge au pluriel disponible au rapprochement',
    );
    await api('/achats/factures-avec-rapprochement', 'POST', {
      fournisseurId: supplierRecord.data.id,
      numeroFactureFournisseur: 'FACT-FOURN-SANS-COMPTE-ECART',
      dateFacture: new Date().toISOString().slice(0, 10),
      receptionsIds: pendingReceipts.data.map(receipt => receipt.id),
      lignes: [
        { produitId: productId, quantite: 10, uniteSaisie: 'pièce', prixUnitaireReel: 501, description: 'Produit recette' },
        { produitId: secondCostProduct.data.id, quantite: 10, uniteSaisie: 'pièce', prixUnitaireReel: 2000, description: 'Produit léger recette' },
      ],
      coutsLogistiques: [{ type: 'transport', montantReel: 100, description: 'Transport commun' }],
    }, 400);
    const quantitiesBeforeInvoiceMatch = await admin.query(
      `SELECT id, quantite FROM "${schema}".produits
       WHERE entreprise_id = $1 AND id = ANY($2::int[])
       ORDER BY id`,
      [signup.user.entrepriseId, [productId, secondCostProduct.data.id]],
    );
    const matchedInvoice = await api('/achats/factures-avec-rapprochement', 'POST', {
      fournisseurId: supplierRecord.data.id,
      numeroFactureFournisseur: 'FACT-FOURN-TEST',
      dateFacture: new Date().toISOString().slice(0, 10),
      dateEcheance: '1999-01-01',
      receptionsIds: pendingReceipts.data.map(receipt => receipt.id),
      lignes: [
        { produitId: productId, quantite: 10, uniteSaisie: 'pièce', prixUnitaireReel: 500, description: 'Produit recette' },
        { produitId: secondCostProduct.data.id, quantite: 10, uniteSaisie: 'pièce', prixUnitaireReel: 2000, description: 'Produit léger recette' },
      ],
      coutsLogistiques: [
        { type: 'transport', montantReel: 100, description: 'Transport commun' },
      ],
    }, 201);
    assert.equal(matchedInvoice.data.receptionsRapprochees, 2,
      'La facture doit rapprocher toutes les réceptions sélectionnées');
    const matchedInvoiceAmounts = await admin.query(
      `SELECT total_ht, total_tva, total_ttc, date_facture, date_echeance
       FROM "${schema}".factures_achat
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, matchedInvoice.data.id],
    );
    const matchedAmounts = matchedInvoiceAmounts.rows[0];
    const companyTax = await admin.query(
      `SELECT taux_tva FROM "${schema}".entreprises WHERE id = $1`,
      [signup.user.entrepriseId],
    );
    const expectedVat = Math.round(Number(matchedAmounts.total_ht) * Number(companyTax.rows[0]?.taux_tva ?? 18)) / 100;
    assert.equal(Number(matchedAmounts.total_tva), expectedVat,
      'La TVA du rapprochement doit être calculée avec le taux configuré pour l’entreprise');
    assert.equal(Number(matchedAmounts.total_ttc), Number(matchedAmounts.total_ht) + expectedVat,
      'Le TTC doit être recalculé à partir du HT et de la TVA automatique');
    const supplierTerms = await admin.query(
      `SELECT delai_paiement FROM "${schema}".fournisseurs WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, supplierRecord.data.id],
    );
    const invoiceDateIso = matchedAmounts.date_facture instanceof Date
      ? matchedAmounts.date_facture.toISOString().slice(0, 10)
      : String(matchedAmounts.date_facture).slice(0, 10);
    const expectedDueDate = new Date(`${invoiceDateIso}T00:00:00.000Z`);
    expectedDueDate.setUTCDate(expectedDueDate.getUTCDate() + Number(supplierTerms.rows[0]?.delai_paiement ?? 30));
    const supplierDueDateIso = matchedAmounts.date_echeance instanceof Date
      ? matchedAmounts.date_echeance.toISOString().slice(0, 10)
      : String(matchedAmounts.date_echeance).slice(0, 10);
    assert.equal(supplierDueDateIso, expectedDueDate.toISOString().slice(0, 10),
      'La date d’échéance fournisseur doit suivre le délai enregistré, pas la date envoyée par le navigateur');
    const linkedAccountingEntry = await admin.query(
      `SELECT ecriture_comptable_id FROM "${schema}".factures_achat
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, matchedInvoice.data.id],
    );
    assert.ok(linkedAccountingEntry.rows[0]?.ecriture_comptable_id,
      'La facture rapprochée doit conserver le lien vers son écriture comptable');
    const stockPendingAfterMatch = await api('/stock/rapports/stock-non-facture');
    const logisticsPendingAfterMatch = await api('/stock/rapports/logistique-non-facturee');
    assert.equal(stockPendingAfterMatch.items.length, 0,
      'Le rapprochement doit solder les lignes de stock non facturées');
    assert.equal(logisticsPendingAfterMatch.items.length, 0,
      'Le rapprochement doit solder les frais logistiques non facturés');
    assert.equal(matchedInvoice.data.statut, 'validee',
      'Le rapprochement doit confirmer la facture et publier son écriture immédiatement');
    const supplierPurchaseReport = await api(`/fournisseurs/detail/achats?dateDebut=${invoiceDateIso}&dateFin=${invoiceDateIso}`);
    const reportedPurchase = supplierPurchaseReport.find(row => Number(row.id) === Number(matchedInvoice.data.id));
    assert.ok(reportedPurchase, 'La facture comptabilisée apparaît dans le rapport fournisseur');
    assert.equal(reportedPurchase.numero, matchedInvoice.data.numero_facture);
    assert.equal(reportedPurchase.fournisseur, supplierRecord.data.raisonSociale);
    assert.equal(Number(reportedPurchase.montant), Number(matchedAmounts.total_ht));
    const valuationReport = await api('/stock/rapports/valorisation');
    const valuedProduct = valuationReport.produits.find(product => Number(product.id) === Number(productId));
    const exactLayerValue = await admin.query(
      `SELECT SUM(cout_total) AS valeur FROM "${schema}".valorisations_stock
       WHERE entreprise_id = $1 AND produit_id = $2 AND quantite > 0`,
      [signup.user.entrepriseId, productId],
    );
    assert.ok(valuedProduct, 'Le produit réceptionné apparaît dans le rapport de stock');
    assert.equal(Number(valuedProduct.valeur_totale), Number(exactLayerValue.rows[0].valeur),
      'La valorisation CMP conserve les coûts exacts sans remultiplier le prix unitaire arrondi');
    const supplierPaymentsReport = await api(`/fournisseurs/detail/paiements?dateDebut=${invoiceDateIso}&dateFin=${invoiceDateIso}`);
    assert.ok(Array.isArray(supplierPaymentsReport), 'Le rapport des paiements est générable sur une période');
    const matchedInvoiceEntry = await admin.query(
      `SELECT fa.statut, e.valide,
              COUNT(DISTINCT e2.id)::int AS entries_for_invoice
       FROM "${schema}".factures_achat fa
       JOIN "${schema}".ecritures e ON e.id = fa.ecriture_comptable_id
       LEFT JOIN "${schema}".ecritures e2
         ON e2.entreprise_id = fa.entreprise_id AND e2.numero_piece = fa.numero_facture
        WHERE fa.entreprise_id = $1 AND fa.id = $2
        GROUP BY fa.statut, fa.ecriture_comptable_id, e.valide`,
      [signup.user.entrepriseId, matchedInvoice.data.id],
    );
    assert.equal(matchedInvoiceEntry.rows[0]?.statut, 'validee');
    assert.equal(matchedInvoiceEntry.rows[0]?.valide, true,
      'L’écriture fournisseur doit être validée dès le rapprochement');
    assert.equal(matchedInvoiceEntry.rows[0]?.entries_for_invoice, 1,
      'Le rapprochement ne doit créer qu’une seule écriture fournisseur');
    const supplierBalanceAfterMatch = await admin.query(
      `SELECT solde_du FROM "${schema}".fournisseurs
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, supplierRecord.data.id],
    );
    assert.equal(Number(supplierBalanceAfterMatch.rows[0]?.solde_du), Number(matchedAmounts.total_ttc),
      'Le rapprochement doit mettre à jour le compte auxiliaire fournisseur une seule fois');
    const quantitiesAfterInvoiceMatch = await admin.query(
      `SELECT id, quantite FROM "${schema}".produits
       WHERE entreprise_id = $1 AND id = ANY($2::int[])
       ORDER BY id`,
      [signup.user.entrepriseId, [productId, secondCostProduct.data.id]],
    );
    assert.deepEqual(
      quantitiesAfterInvoiceMatch.rows.map((row) => Number(row.quantite)),
      quantitiesBeforeInvoiceMatch.rows.map((row) => Number(row.quantite)),
      'Le rapprochement ne doit pas ajouter une seconde fois le stock déjà reçu',
    );
    const invoiceBalance = await api(
      `/comptabilite/balance?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    assert.ok(invoiceBalance.comptes.some((account) => account.numero.startsWith('401')),
      'La balance doit afficher le compte fournisseur dès le rapprochement');
    assert.ok(invoiceBalance.comptes.some((account) => account.numero.startsWith('445')),
      'La balance doit afficher la TVA déductible dès le rapprochement');
    const generalLedger = await api(
      `/comptabilite/grand-livre?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    assert.ok(generalLedger.comptes.some((account) => account.numero.startsWith('408')),
      'Le grand livre doit afficher le compte 408 après réception et rapprochement validés');
    const financialPosition = await api(
      `/comptabilite/bilan?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    assert.ok(financialPosition.actif.stocksCreances.some((account) => account.compte.startsWith('31')),
      'Le bilan doit reprendre le stock comptabilisé lors de la réception');
    const [bilanJournalResult, bilanAccountsResult] = await Promise.all([
      admin.query(
        `SELECT id FROM "${schema}".journaux WHERE entreprise_id = $1 AND code = 'AC' LIMIT 1`,
        [signup.user.entrepriseId],
      ),
      admin.query(
        `SELECT id, numero FROM "${schema}".comptes_comptables
         WHERE entreprise_id = $1 AND numero IN ('401', '610')`,
        [signup.user.entrepriseId],
      ),
    ]);
    const bilanJournal = bilanJournalResult.rows[0];
    const bilanPayableAccount = bilanAccountsResult.rows.find((account) => account.numero === '401');
    const bilanExpenseAccount = bilanAccountsResult.rows.find((account) => account.numero === '610');
    assert.ok(bilanJournal && bilanPayableAccount && bilanExpenseAccount,
      'Le test du bilan doit disposer du journal d’achats, du compte 401 et d’un compte de charge 610');
    const bilanBeforeExpense = await api(
      `/comptabilite/rapports/bilan?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    const incomeBeforeExpense = await api(
      `/comptabilite/rapports/resultat?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    await api('/comptabilite/ecritures', 'POST', {
      journalId: bilanJournal.id,
      dateEcriture: `${testYear}-11-07`,
      reference: 'TEST-BILAN-RESULTAT-CHARGE',
      description: 'Test du résultat net dans le bilan',
      lignes: [
        { compteComptableId: bilanExpenseAccount.id, debit: '5.00', credit: '0.00', libelle: 'Écart de transport test' },
        { compteComptableId: bilanPayableAccount.id, debit: '0.00', credit: '5.00', libelle: 'Dette fournisseur test' },
      ],
    }, 201);
    const bilanAfterExpense = await api(
      `/comptabilite/rapports/bilan?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    const incomeAfterExpense = await api(
      `/comptabilite/rapports/resultat?dateDebut=${testYear}-01-01&dateFin=${testYear}-12-31`,
    );
    assert.equal(Number((bilanAfterExpense.resultatNet - bilanBeforeExpense.resultatNet).toFixed(2)), -5,
      'Le bilan doit intégrer les charges de classe 6 dans le résultat de la période');
    assert.equal(Number((incomeAfterExpense.resultatNet - incomeBeforeExpense.resultatNet).toFixed(2)), -5,
      'Le compte de résultat doit exposer la même charge que le bilan');
    assert.equal(bilanAfterExpense.equilibre, true,
      `Le résultat net doit équilibrer le total actif et le total passif: ${JSON.stringify({
        actif: bilanAfterExpense.actif.total,
        passif: bilanAfterExpense.passif.total,
        resultat: bilanAfterExpense.resultatNet,
      })}`);
    const displayedExerciseResult = bilanAfterExpense.passif.capitaux.find((account) => account.isResultat);
    assert.ok(displayedExerciseResult,
      'Le résultat de période doit apparaître dans les capitaux propres du bilan');
    assert.equal(Boolean(displayedExerciseResult.isPerte), bilanAfterExpense.resultatNet < 0,
      'Le bilan doit distinguer correctement un bénéfice d’une perte');
    const receivedProduct = (await admin.query(
      `SELECT prix_achat, cout_moyen, prix_vente FROM "${schema}".produits WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId,productId],
    )).rows[0];
    const receivedSecondProduct = (await admin.query(
      `SELECT prix_achat, cout_moyen FROM "${schema}".produits WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId,secondCostProduct.data.id],
    )).rows[0];
    assert.equal(Number(receivedProduct.prix_achat),900,
      'Le coût standard conserve le devis initial du fournisseur');
    assert.ok(Math.abs(Number(receivedProduct.cout_moyen) - 506.67) < 0.02,
      'Le coût système inclut la part du transport répartie selon le poids, sans reprendre le devis standard');
    assert.ok(Math.abs(Number(receivedSecondProduct.cout_moyen) - 2003.33) < 0.02,
      'Le produit plus léger reçoit une part de transport proportionnelle à son poids, pas à sa valeur');
    const pricePreview = await api('/clients/prix-produits/calculer','POST',{
      produitId:productId,margeBruteCible:30,
    });
    assert.equal(Number(pricePreview.data.prixVenteCalcule),658.67,
      'Le prix de vente est calculé à partir du coût système reçu');
    const productPrice = await api('/clients/prix-produits','POST',{
      produitId:productId,margeBruteCible:30,
    },201);
    assert.equal(Number(productPrice.data.prixVenteCalcule),658.67);
    const invoice=await api('/factures','POST',{
      clientId,dateFacture:`${testYear}-01-16`,items:[{produitId:productId,quantite:2,prixUnitaire:658.67}],
    },201);
    const f=invoice.data;
    assert.equal(Number(f.totalHT),1317.34);
    assert.equal(Number(f.totalTTC),1554.46);
    const clientTerms = await admin.query(
      `SELECT delai_paiement FROM "${schema}".clients WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, clientId],
    );
    const expectedClientDueDate = new Date(`${testYear}-01-16T00:00:00.000Z`);
    expectedClientDueDate.setUTCDate(expectedClientDueDate.getUTCDate() + Number(clientTerms.rows[0]?.delai_paiement ?? 30));
    const actualClientDueDate = f.dateEcheance instanceof Date
      ? f.dateEcheance.toISOString().slice(0, 10)
      : String(f.dateEcheance).slice(0, 10);
    assert.equal(actualClientDueDate, expectedClientDueDate.toISOString().slice(0, 10),
      'La date d’échéance client doit suivre le délai enregistré sur la fiche client');
    const createdChartAccount = await api('/comptabilite/comptes', 'POST', {
      numero: 'TEST-PLAN-001',
      nom: 'Compte personnalisé de recette',
      type: 'actif',
    }, 201);
    assert.equal(createdChartAccount.numero, 'TEST-PLAN-001',
      'La création doit écrire dans le plan réellement utilisé par la comptabilité');
    await api('/comptabilite/comptes', 'POST', {
      numero: 'TEST-PLAN-001',
      nom: 'Doublon interdit',
      type: 'actif',
    }, 409);
    const renamedChartAccount = await api(`/comptabilite/comptes/${createdChartAccount.id}`, 'PUT', {
      numero: 'TEST-PLAN-001',
      nom: 'Compte personnalisé renommé',
      type: 'actif',
      compteParent: '',
    });
    assert.equal(renamedChartAccount.nom, 'Compte personnalisé renommé',
      'La modification doit fonctionner sur le même plan comptable');
    const accounts=await api('/comptabilite/comptes');
    const clientCollectiveAccount=accounts.find(account=>account.numero==='4111');
    assert.ok(clientCollectiveAccount,'Le compte collectif client 4111 doit être configuré');
    const clientMovements=await api(`/comptabilite/compte/${clientCollectiveAccount.id}/ecritures`);
    assert.ok(clientMovements.some(movement=>movement.reference===f.numeroFacture && Number(movement.debit)===1554.46),
      'La facture client doit débiter le compte collectif 4111');
    await api(`/factures/${f.id}/paiement`,'POST',{montant:1554.46,modePaiement:'especes'},201);
    const paidClientMovements=await api(`/comptabilite/compte/${clientCollectiveAccount.id}/ecritures`);
    assert.ok(paidClientMovements.some(movement=>Number(movement.credit)===1554.46),
      'Le règlement client doit créditer le compte collectif 4111');
    const clientStatement = await api('/clients/etat-compte','POST',{
      clientId:clientRecord.data.numeroClient,
      dateDebut:`${testYear}-01-01`,
      dateFin:`${testYear}-12-31`,
    });
    assert.equal(clientStatement.data.client.numeroClient,clientRecord.data.numeroClient,
      'L’état de compte client doit résoudre la fiche par son numéro auxiliaire');
    assert.equal(Number(clientStatement.data.totalFacture),1554.46,
      'L’état de compte doit inclure les opérations du client identifié');
    const paid=await api(`/factures/${f.id}`);
    assert.equal(Number(paid.data.soldeRestant),0);
    assert.equal(paid.data.statut,'payee');
    const another=await api('/factures','POST',{
      clientId,items:[{produitId:productId,quantite:1,prixUnitaire:658.67}],
    },201);
    // La série couvre toute la période demandée : l'endpoint ne plafonne
    // plus la fin à aujourd'hui (choix délibéré dans getDashboardPeriod :
    // plafonner excluait les écritures datées après le jour courant dans
    // le mois en cours et faussait les KPI). Pour ne compter que les mois
    // écoulés, on demande donc la période jusqu'à la fin du mois en cours.
    const finMoisEnCours = new Date(testYear, new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
    const monthlySales=await api(`/dashboard/ventes-mensuelles?dateDebut=${testYear}-01-01&dateFin=${finMoisEnCours}`);
    assert.equal(monthlySales.length,new Date().getMonth()+1,'Une entrée doit exister pour chaque mois écoulé');
    assert.equal(monthlySales.reduce((total,row)=>total+Number(row.ventes),0),84154.46,
      'La série mensuelle doit inclure les ventes valides et exclure le brouillon (janv. : ouverture de stock 82 600 + première facture 1 554,46)');
    assert.equal(Number(monthlySales[0].ventes),84154.46,
      'Les factures de janvier (ouverture de stock 82 600 + première facture 1 554,46) doivent rester comptées dans le bon mois');
    if(new Date().getMonth()>0) {
      assert.equal(Number(monthlySales.at(-1).ventes),0,'La facture brouillon ne doit pas apparaître dans les ventes');
    }
    const paymentCookie = requestCookieHeader(`/factures/${another.data.id}/paiement`);
    const paymentRequest={method:'POST',headers:{'Content-Type':'application/json',Cookie:paymentCookie},
      body:JSON.stringify({montant:Number(another.data.totalTTC),modePaiement:'especes'})};
    const paymentUrl=origin+`/api/factures/${another.data.id}/paiement`;
    const results=await Promise.all([0,1].map(()=>worker ?
      worker.dispatchFetch(paymentUrl,paymentRequest) : fetch(paymentUrl,paymentRequest)));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,400],'Deux paiements concurrents ne doivent pas dépasser le solde');
    await Promise.all(results.map(r=>r.arrayBuffer()));
    const serviceClientAccount = accounts.find(account => account.numero === '4112');
    assert.ok(serviceClientAccount, 'Le compte collectif client 4112 doit être configuré');
    const serviceClient = await api('/clients', 'POST', {
      nom: 'Client de prestations de recette',
      type: 'entreprise',
      compteClientNumero: '4112',
    }, 201);
    assert.equal(serviceClient.data.compteComptableId, serviceClientAccount.id,
      'La fiche d’un client de services doit conserver le compte collectif 4112');
    const serviceInvoice = await api('/factures', 'POST', {
      clientId: serviceClient.data.id,
      dateFacture: `${testYear}-01-20`,
      items: [{ description: 'Prestation de service de recette', quantite: 1, prixUnitaire: 1000 }],
    }, 201);
    await api(`/clients/${serviceClient.data.id}`, 'PUT', {
      compteClientNumero: '4111',
    }, 409);
    const serviceInvoiceMovements = await api(`/comptabilite/compte/${serviceClientAccount.id}/ecritures`);
    assert.ok(serviceInvoiceMovements.some(
      movement => movement.reference === serviceInvoice.data.numeroFacture && Number(movement.debit) === 1180
    ), 'La facture d’un client de services doit débiter le compte collectif 4112');
    await api(`/factures/${serviceInvoice.data.id}/paiement`, 'POST', {
      montant: 1180,
      modePaiement: 'especes',
    }, 201);
    const servicePaidMovements = await api(`/comptabilite/compte/${serviceClientAccount.id}/ecritures`);
    assert.ok(servicePaidMovements.some(movement => Number(movement.credit) === 1180),
      'Le règlement d’un client de services doit créditer le compte collectif 4112');
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
    const secondPassword=randomUUID()+'Bb8!';
    const recoveryOrder = await api('/commandes-achat', 'POST', {
      fournisseurId: supplierRecord.data.id,
      dateCommande: new Date().toISOString().slice(0, 10),
      items: [{ produitId: secondCostProduct.data.id, description: 'Produit reprise écriture', quantite: 2, prixUnitaire: 2000 }],
      coutsLogistiques: [{ type: 'transport', description: 'Transport reprise', montant: 10 }],
    }, 201);
    await api(`/commandes-achat/${recoveryOrder.data.id}/confirmer`, 'PUT', {});
    const recoveryReceipt = await api('/receptions', 'POST', {
      commandeId: recoveryOrder.data.id,
      dateReception: new Date().toISOString().slice(0, 10),
      entrepotId: warehouseRecord.id,
      items: recoveryOrder.data.items.map(line => ({
        commandeItemId: line.id,
        quantiteRecue: 2,
        poidsParUnite: 1.5,
        unitePoids: 'kg',
      })),
    });
    const recoveryPendingReceipts = await api(
      `/achats/receptions-en-attente?fournisseurId=${supplierRecord.data.id}`,
    );
    assert.equal(recoveryPendingReceipts.data.length, 1,
      'La réception de reprise doit être retrouvée dans la liste des réceptions à rapprocher');
    const recoveryReceiptId = Number(recoveryPendingReceipts.data[0].id);
    await admin.query(`DROP TABLE "${schema}".ecriture_sequences`);
    const incompleteInvoice = await api('/achats/factures-avec-rapprochement', 'POST', {
      fournisseurId: supplierRecord.data.id,
      numeroFactureFournisseur: 'FACT-FOURN-REPRISE-SEQUENCE',
      dateFacture: new Date().toISOString().slice(0, 10),
      receptionsIds: [recoveryReceiptId],
      lignes: [{
        produitId: secondCostProduct.data.id,
        quantite: 2,
        uniteSaisie: 'pièce',
        prixUnitaireReel: 2000,
        description: 'Produit reprise écriture',
      }],
      coutsLogistiques: [{ type: 'transport', montantReel: 10, description: 'Transport reprise' }],
    }, 201);
    assert.equal(incompleteInvoice.data.ecritureComptableId, null,
      'Une panne comptable ne doit pas prétendre avoir créé une écriture');
    assert.match(incompleteInvoice.message, /comptabilisation à reprendre/i);
    const invoicesAfterAccountingFailure = await api('/achats/factures?statut=brouillon');
    const visibleIncompleteInvoice = invoicesAfterAccountingFailure.data.find(
      invoice => Number(invoice.id) === Number(incompleteInvoice.data.id),
    );
    assert.ok(visibleIncompleteInvoice,
      'La facture doit rester visible en brouillon après l’échec comptable');
    assert.equal(visibleIncompleteInvoice.hasStockPending, true,
      'La facture visible doit proposer la reprise de comptabilisation');
    const receiptHistoryAfterMatch = await api('/stock/receptions');
    const preservedReceipt = receiptHistoryAfterMatch.find(
      receipt => Number(receipt.id) === recoveryReceiptId,
    );
    assert.ok(preservedReceipt,
      'La réception rapprochée doit rester dans l’historique, pas être supprimée');
    assert.equal(Number(preservedReceipt.facture_achat_id), Number(incompleteInvoice.data.id),
      'La réception doit conserver le lien vers la facture brouillon');
    const receiptsStillAwaitingInvoice = await api(
      `/achats/receptions-en-attente?fournisseurId=${supplierRecord.data.id}`,
    );
    assert.equal(receiptsStillAwaitingInvoice.data.length, 0,
      'Une réception rapprochée ne doit plus apparaître dans les réceptions en attente');
    const pendingLinesAfterAccountingFailure = await admin.query(
      `SELECT COUNT(*) FILTER (WHERE statut = 'invoiced')::int AS invoiced_count,
              COUNT(*) FILTER (WHERE facture_achat_id = $3)::int AS linked_count
       FROM "${schema}".stock_pending
       WHERE entreprise_id = $1 AND bon_reception_id = $2`,
      [signup.user.entrepriseId, recoveryReceiptId, incompleteInvoice.data.id],
    );
    assert.ok(pendingLinesAfterAccountingFailure.rows[0].invoiced_count > 0,
      'Les lignes de stock doivent être liées à la facture même si l’écriture est à reprendre');
    assert.ok(pendingLinesAfterAccountingFailure.rows[0].linked_count > 0,
      'Le lien de stock non facturé vers la facture doit être conservé');

    await admin.query(`
      CREATE TABLE "${schema}".ecriture_sequences (
        id SERIAL PRIMARY KEY,
        entreprise_id INTEGER NOT NULL REFERENCES "${schema}".entreprises(id),
        journal_id INTEGER NOT NULL REFERENCES "${schema}".journaux(id),
        exercice INTEGER NOT NULL,
        derniere_sequence INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE UNIQUE INDEX ecriture_sequences_scope_unique
        ON "${schema}".ecriture_sequences (entreprise_id, journal_id, exercice);
    `);
    await admin.query(`GRANT ALL PRIVILEGES ON TABLE "${schema}".ecriture_sequences TO ${quotedRole}`);
    await admin.query(`GRANT USAGE, SELECT ON SEQUENCE "${schema}".ecriture_sequences_id_seq TO ${quotedRole}`);
    const resumedInvoice = await api(
      `/achats/factures/${incompleteInvoice.data.id}/reprendre-comptabilisation`,
      'POST',
      { compteEcartId: varianceAccount.rows[0].id },
    );
    assert.ok(resumedInvoice.data.ecritureComptableId,
      'La facture déjà créée doit pouvoir reprendre sa comptabilisation après correction du schéma');
    assert.equal(resumedInvoice.data.statut, 'validee',
      'La reprise doit comptabiliser la facture sans seconde validation manuelle');
    const resumedInvoiceLink = await admin.query(
      `SELECT ecriture_comptable_id, statut FROM "${schema}".factures_achat
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, incompleteInvoice.data.id],
    );
    assert.equal(Number(resumedInvoiceLink.rows[0]?.ecriture_comptable_id), Number(resumedInvoice.data.ecritureComptableId));
    assert.equal(resumedInvoiceLink.rows[0]?.statut, 'validee');
    const supplierBalanceAfterRecovery = await admin.query(
      `SELECT solde_du FROM "${schema}".fournisseurs
       WHERE entreprise_id = $1 AND id = $2`,
      [signup.user.entrepriseId, supplierRecord.data.id],
    );
    assert.ok(Number(supplierBalanceAfterRecovery.rows[0]?.solde_du) > Number(supplierBalanceAfterMatch.rows[0]?.solde_du),
      'La reprise doit ajouter la dette fournisseur une seule fois');

    // Reproduce upgrading an existing database, not just a fresh Drizzle schema.
    const numberingClient = await admin.connect();
    try {
      await numberingClient.query('BEGIN');
      await numberingClient.query(`SET LOCAL search_path TO "${schema}"`);
      for (const [table, column] of [
        ['commandes_achat', 'numero_commande'], ['factures_achat', 'numero_facture'],
        ['bons_reception', 'numero'], ['produits', 'reference'],
        ['ecritures', 'numero_ecriture'],
      ]) {
        await numberingClient.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_unique" UNIQUE ("${column}")`);
      }
      for (const statement of PURCHASE_NUMBERING_STATEMENTS) await numberingClient.query(statement);
      // Reapplying the targeted upgrade must be harmless.
      for (const statement of PURCHASE_NUMBERING_STATEMENTS) await numberingClient.query(statement);
      await numberingClient.query('COMMIT');
    } catch (error) {
      await numberingClient.query('ROLLBACK');
      throw error;
    } finally {
      numberingClient.release();
    }
    await assert.rejects(
      admin.query(`INSERT INTO "${schema}".produits (entreprise_id, reference, nom) VALUES ($1, 'TEST-ERP', 'Doublon interdit')`,
        [signup.user.entrepriseId]),
      { code: '23505' },
      'Une référence produit doit rester unique dans la même entreprise',
    );

    const secondSignup=await api('/public/inscription','POST',{
      nomEntreprise:'Autre entreprise isolée',
      nomAdministrateur:'Second administrateur',
      email:'second@example.invalid',
      motDePasse:secondPassword,
      confirmationMotDePasse:secondPassword,
      pays:'Togo',
      planId:freeTrialPlan.id,
    },201);
    const secondLogin=await api('/auth-security/login','POST',{email:'second@example.invalid',password:secondPassword});
    assert.ok(secondLogin.session?.id);
    const secondClient=await api('/clients','POST',{
      nom:'Autre client',entrepriseId:signup.user.entrepriseId,userId:signup.user.id,
    },201);
    assert.notEqual(secondClient.data.numeroClient,clientRecord.data.numeroClient,
      'Chaque client doit recevoir un numéro auxiliaire unique');
    assert.notEqual(Number(secondClient.data.entrepriseId),Number(signup.user.entrepriseId),
      'La création doit ignorer le tenant fourni par le client');
    const tenantBClients=await api('/clients');
    assert.deepEqual(tenantBClients.data.map(client=>client.id),[secondClient.data.id],
      'La liste client ne doit retourner que les données du tenant connecté');
    const secondProduct=await api('/produits','POST',{
      reference:'TEST-ERP',nom:'Produit autre entreprise',quantite:1,
      prixVente:0,prixAchat:50,entrepriseId:signup.user.entrepriseId,
    },201);
    assert.notEqual(Number(secondProduct.data.entrepriseId),Number(signup.user.entrepriseId),
      'La création produit doit ignorer le tenant fourni par le client');
    await api(`/produits/${productId}`,'GET',null,404);
    await api(`/produits/${productId}`,'PUT',{nom:'Modification interdite'},404);
    const tenantBProducts=await api('/produits');
    assert.deepEqual(tenantBProducts.data.map(product=>product.id),[secondProduct.data.id],
      'La liste produit ne doit retourner que les données du tenant connecté');
    const secondSupplier = await api('/fournisseurs', 'POST', { raisonSociale: 'Fournisseur entreprise B' }, 201);
    const secondWarehouse = await api('/stock/entrepots', 'POST', { nom: 'Entrepôt entreprise B' });
    const secondOrder = await api('/commandes-achat', 'POST', {
      fournisseurId: secondSupplier.data.id,
      items: [{ produitId: secondProduct.data.id, description: 'Achat B', quantite: 1, prixUnitaire: 50 }],
    }, 201);
    // Numérotation cloisonnée à l'entreprise (27 nov. 2026) : le numéro
    // porte l'id entreprise (CMD-AAAA-{eid}-NNNN) — la 2e entreprise
    // repart donc à 0001, mais son numéro diffère de celui de la 1re.
    assert.match(secondOrder.data.numeroCommande, /^CMD-\d{4}-\d+-0001$/,
      'La première commande de la 2e entreprise repart à 0001 (séquence par entreprise)');
    assert.notEqual(secondOrder.data.numeroCommande, purchaseOrder.data.numeroCommande,
      'La numérotation cloisonnée porte l’id entreprise : les numéros diffèrent');
    await api(`/commandes-achat/${secondOrder.data.id}/confirmer`, 'PUT', {});
    await api('/receptions', 'POST', {
      commandeId: secondOrder.data.id, entrepotId: secondWarehouse.id,
      items: secondOrder.data.items.map(line => ({ commandeItemId: line.id, quantiteRecue: 1, poidsParUnite: 1, unitePoids: 'kg' })),
    });
    const secondPendingReceipts = await api('/achats/receptions-en-attente');
    const secondMatchedInvoice = await api('/achats/factures-avec-rapprochement', 'POST', {
      fournisseurId: secondSupplier.data.id, numeroFactureFournisseur: 'FACT-B',
      dateFacture: new Date().toISOString().slice(0, 10),
      receptionsIds: secondPendingReceipts.data.map(receipt => receipt.id),
      lignes: [{ produitId: secondProduct.data.id, quantite: 1, uniteSaisie: 'pièce', prixUnitaireReel: 50, description: 'Achat B' }],
      coutsLogistiques: [],
    }, 201);
    // Numérotation cloisonnée à l'entreprise (27 nov. 2026) : FACT-ACH
    // porte l'id entreprise — même séquence (0001), numéros distincts.
    assert.match(secondMatchedInvoice.data.numero_facture, /^FACT-ACH-\d{4}-\d+-000001$/);
    assert.notEqual(secondMatchedInvoice.data.numero_facture, matchedInvoice.data.numero_facture,
      'Le numéro de facture de la première entreprise ne bloque pas la facture d’une autre entreprise');
    await api('/factures','POST',{clientId:secondClient.data.id,items:[{description:'Service',quantite:1,prixUnitaire:500}]},201);
    const isolatedAssociationProjects=await api('/associations/projects');
    assert.deepEqual(isolatedAssociationProjects,[],'Les projets associatifs sont isolés par entreprise');
    await api(`/associations/projects/${associationProject.id}/report`,'GET',null,404);
    await api(`/factures/${f.id}`,'GET',null,404);
    const forged=await api(`/stock/produits?entrepriseId=${signup.user.entrepriseId}`);
    assert.deepEqual(forged.map(product=>product.id),[secondProduct.data.id],
      'Un paramètre entreprise falsifié ne doit retourner que les produits du tenant connecté');
    cookieJar = firstCookieJar;
    const automaticAccounts = await api('/comptabilite/comptes-automatiques');
    assert.equal(automaticAccounts.systemeComptable, 'SYSCOHADA',
      'SYSCOHADA reste le système par défaut avant activation du plan personnalisé');
    const companyAccounts = await api('/comptabilite/comptes');
    const customAccount = await api('/comptabilite/comptes', 'POST', {
      numero: 'CUSTOM-4111',
      nom: 'Créances clients - plan personnalisé',
      type: 'actif',
    }, 201);
    const roleMappings = {};
    for (const role of automaticAccounts.roles) {
      const standardAccount = companyAccounts.find((account) => account.numero === role.defaultNumber && account.actif);
      if (!standardAccount) {
        const created = await api('/comptabilite/comptes', 'POST', {
          numero: `MAP-${role.key.toUpperCase()}`,
          nom: `Compte de test - ${role.label}`,
          type: 'actif',
        }, 201);
        roleMappings[role.key] = created.id;
      } else {
        roleMappings[role.key] = standardAccount.id;
      }
    }
    roleMappings.customer = customAccount.id;
    const incompleteMappings = { ...roleMappings };
    delete incompleteMappings[automaticAccounts.roles[0].key];
    await api('/comptabilite/comptes-automatiques', 'PUT', { mappings: incompleteMappings }, 400);
    await api('/comptabilite/comptes-automatiques', 'PUT', {
      mappings: { ...roleMappings, customer: 99999999 },
    }, 400);
    const activatedCustomChart = await api('/comptabilite/comptes-automatiques', 'PUT', {
      mappings: roleMappings,
    });
    assert.equal(activatedCustomChart.systemeComptable, 'PERSONNALISE');
    const customServiceInvoice = await api('/factures', 'POST', {
      clientId,
      dateFacture: `${testYear}-01-17`,
      items: [{ description: 'Prestation avec plan personnalisé', quantite: 1, prixUnitaire: 500 }],
    }, 201);
    const customCustomerMovements = await api(`/comptabilite/compte/${customAccount.id}/ecritures`);
    assert.ok(customCustomerMovements.some((movement) => movement.reference === customServiceInvoice.data.numeroFacture),
      'Une écriture automatique doit débiter le compte client personnalisé associé');

    const accountantInvite = await api('/accountant-invitations/whatsapp-link', 'POST', {
      email: 'cabinet@example.invalid',
    }, 201);
    const accountantToken = new URL(accountantInvite.inviteUrl).searchParams.get('token');
    assert.match(accountantToken || '', /^[a-f0-9]{64}$/);
    const accountantInviteDetails = await api(
      `/public/accountant-invitations/${accountantToken}`,
    );
    assert.equal(accountantInviteDetails.email, 'cabinet@example.invalid');
    const accountantAcceptance = await api('/public/accountant-invitations/accept', 'POST', {
      token: accountantToken,
      username: 'cabinet-comptable',
      prenom: 'Compte',
      nom: 'Comptable',
      password: 'CabinetTestPassword2026!',
    }, 201);
    assert.equal(accountantAcceptance.email, 'cabinet@example.invalid');
    assert.ok(accountantAcceptance.session?.id, 'L’acceptation doit ouvrir une session sécurisée');
    assert.equal(Object.hasOwn(accountantAcceptance, 'accessToken'), false,
      'Les jetons restent dans des cookies HttpOnly');
    const accountantSession = await api('/auth-security/session');
    assert.equal(accountantSession.user.role, 'accountant');
    assert.equal(Number(accountantSession.user.entrepriseId), Number(signup.user.entrepriseId),
      'Le comptable reste lié à l’entreprise invitante');
    assert.equal(accountantSession.user.modulePermissions.comptabilite, 'read');
    assert.equal(accountantSession.user.modulePermissions.parametres, 'none');
    await api('/comptabilite/plans');
    await api('/clients', 'POST', { nom: 'Écriture interdite au comptable externe' }, 403);
    await api('/auth-security/logout', 'POST', { sessionId: accountantAcceptance.session.id });
    await api('/auth-security/session', 'GET', null, 401);
    cookieJar = new Map();
    const finalAdminLogin = await api('/auth-security/login', 'POST', {
      email: 'recette@example.invalid',
      password,
    });
    assert.ok(finalAdminLogin.session?.id);
    const closingYear = 1900;
    const closingTenant = Number(signup.user.entrepriseId);
    const { rows: closingJournals } = await adminSchemaPool.query(
      "SELECT id, code FROM journaux WHERE entreprise_id = $1 AND code IN ('OD','AN')",
      [closingTenant],
    );
    const closingJournal = closingJournals.find((journal) => journal.code === 'OD');
    assert.ok(closingJournal && closingJournals.some((journal) => journal.code === 'AN'));
    const { rows: [closingExpense] } = await adminSchemaPool.query(
      "SELECT id FROM comptes_comptables WHERE entreprise_id = $1 AND numero LIKE '6%' ORDER BY id LIMIT 1",
      [closingTenant],
    );
    assert.ok(closingExpense);
    const historicalEntryBody = {
      journalId: closingJournal.id,
      dateEcriture: '1900-06-15',
      reference: 'TEST-FISCAL-LOCK',
      description: 'Opération dans un exercice de test ancien',
      lignes: [
        { compteComptableId: closingExpense.id, debit: '100.00', credit: '0' },
        { compteComptableId: bankAccount.id, debit: '0', credit: '100.00' },
      ],
    };
    const historicalEntry = await api('/comptabilite/ecritures', 'POST', historicalEntryBody, 201);
    const firstClose = await api('/comptabilite/cloture-exercice', 'POST', { annee: closingYear });
    assert.equal(firstClose.details.revision, 1);
    assert.equal(firstClose.details.resultatNet, -100);
    await api('/comptabilite/cloture-exercice', 'POST', { annee: closingYear }, 409);
    const closedWrite = await api('/comptabilite/ecritures', 'POST', historicalEntryBody, 409);
    assert.match(closedWrite.error, /exercice comptable 1900 fermé/);
    const closedEdit = await api(`/comptabilite/ecritures/${historicalEntry.id}`, 'PUT', {
      dateEcriture: '1901-06-15', description: 'Tentative de sortir la date du verrou',
    }, 409);
    assert.match(closedEdit.error, /fermé/);
    await api(`/comptabilite/ecritures/${historicalEntry.id}`, 'DELETE', null, 409);
    await assert.rejects(
      queryAsTenant(closingTenant,
        'UPDATE lignes_ecriture SET debit = debit + 1 WHERE ecriture_id = $1',
        [historicalEntry.id]),
      /exercice comptable 1900 fermé/,
    );
    const hiddenHistory = await queryAsTenant(Number(secondSignup.user.entrepriseId),
      'SELECT id FROM clotures_exercices WHERE entreprise_id = $1', [closingTenant]);
    assert.equal(hiddenHistory.rows.length, 0, 'Une autre entreprise ne voit pas les clôtures');
    const { createEcritureComptable } = await import('../src/services/comptabiliteService.js');
    await assert.rejects(
      adminSchemaDb.transaction((executor) => createEcritureComptable({
        entrepriseId: closingTenant, journalCode: 'OD', journalNom: 'Opérations diverses',
        journalType: 'OD', dateEcriture: '1900-07-01', libelle: 'Écriture automatique interdite',
        numeroPiece: 'TEST-AUTO-CLOSED', executor,
        lignes: historicalEntryBody.lignes,
      })),
      /exercice comptable 1900 fermé/,
    );
    await api(`/comptabilite/cloture-exercice/${closingYear}/reouverture`, 'POST', { motif: 'court' }, 400);
    await adminSchemaPool.query(
      "UPDATE users SET module_permissions = module_permissions || '{\"comptabilite\":\"write\"}'::jsonb WHERE id = $1",
      [accountantSession.user.id],
    );
    await api('/auth-security/logout', 'POST', { sessionId: finalAdminLogin.session.id });
    cookieJar = new Map();
    const accountingLogin = await api('/auth-security/login', 'POST', {
      email: 'cabinet@example.invalid', password: 'CabinetTestPassword2026!',
    });
    const forbiddenReopen = await api(`/comptabilite/cloture-exercice/${closingYear}/reouverture`, 'POST', {
      motif: 'Correction demandée par un comptable non administrateur',
    }, 403);
    assert.match(forbiddenReopen.error, /administrateur/);
    await api('/auth-security/logout', 'POST', { sessionId: accountingLogin.session.id });
    cookieJar = new Map();
    const closingAdminLogin = await api('/auth-security/login', 'POST', {
      email: 'recette@example.invalid', password,
    });
    const reopened = await api(`/comptabilite/cloture-exercice/${closingYear}/reouverture`, 'POST', {
      motif: 'Correction autorisée pour la recette de clôture',
    });
    assert.equal(reopened.success, true);
    const historyAfterReopen = await api('/comptabilite/cloture-exercice/historique');
    assert.equal(historyAfterReopen[0].statut, 'reouvert');
    assert.ok(historyAfterReopen[0].ecritureContrepassationClotureId);
    assert.ok(historyAfterReopen[0].ecritureContrepassationOuvertureId);
    const { rows: reopenAudits } = await adminSchemaPool.query(
      "SELECT * FROM audit_logs WHERE entreprise_id = $1 AND action = 'REOUVERTURE_EXERCICE'",
      [closingTenant],
    );
    assert.equal(reopenAudits.length, 1);
    assert.equal(Number(reopenAudits[0].user_id), Number(signup.user.id));
    assert.match(reopenAudits[0].nouvelle_valeur, /Correction autorisée/);
    const prematureNextClose = await api('/comptabilite/cloture-exercice', 'POST', { annee: closingYear + 1 }, 409);
    assert.match(prematureNextClose.error, /Reclôturez d’abord l’exercice 1900/);
    await api('/comptabilite/ecritures', 'POST', {
      ...historicalEntryBody, reference: 'TEST-AFTER-REOPEN',
    }, 201);
    const secondClose = await api('/comptabilite/cloture-exercice', 'POST', { annee: closingYear });
    assert.equal(secondClose.details.revision, 2);
    assert.equal(secondClose.details.resultatNet, -200);
    assert.equal(secondClose.details.ecritureOuverture.totalDebit, 200);
    assert.equal(secondClose.details.ecritureOuverture.totalCredit, 200);
    await api('/comptabilite/ecritures', 'POST', historicalEntryBody, 409);
    await adminSchemaPool.query(BACKFILL_FISCAL_PERIOD_CLOSURES_SQL);
    const finalHistory = await api('/comptabilite/cloture-exercice/historique');
    assert.equal(finalHistory.length, 2, 'La reprise est idempotente et préserve les réouvertures');
    assert.equal(finalHistory[0].statut, 'ferme');
    await adminSchemaPool.query('DELETE FROM clotures_exercices WHERE id = $1', [finalHistory[0].id]);
    const migrationClient = await pool.connect();
    try {
      await migrationClient.query('BEGIN');
      await migrationClient.query("SELECT set_config('app.current_tenant', '', true)");
      const hiddenLegacyEntries = await migrationClient.query(
        "SELECT id FROM ecritures WHERE numero_piece = 'CLOTURE-1900-R2'",
      );
      assert.equal(hiddenLegacyEntries.rowCount, 0,
        'Sans contexte explicite, FORCE RLS cache bien les clôtures historiques au rôle de migration');
      const { rows: [migrationRole] } = await migrationClient.query(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
      );
      assert.deepEqual(migrationRole, { rolsuper: false, rolbypassrls: false });
      const recoveredClosures = await backfillFiscalPeriodClosures(migrationClient);
      assert.equal(recoveredClosures.rowCount, 1,
        'La migration doit reprendre une clôture historique avec FORCE RLS, sans être superutilisateur');
      await migrationClient.query('COMMIT');
      const { rows: [afterMigration] } = await migrationClient.query(
        "SELECT current_setting('app.current_tenant', true) AS tenant",
      );
      assert.notEqual(afterMigration.tenant, '*', 'L’accès global doit prendre fin avec la transaction');
    } catch (error) {
      await migrationClient.query('ROLLBACK');
      throw error;
    } finally {
      migrationClient.release();
    }
    const legacyHistory = await api('/comptabilite/cloture-exercice/historique');
    assert.equal(legacyHistory[0].revision, 2, 'Une clôture historique est reprise depuis ses écritures');
    assert.equal(legacyHistory[0].statut, 'ferme');
    assert.equal(legacyHistory[1].statut, 'reouvert');
    await api('/comptabilite/ecritures', 'POST', historicalEntryBody, 409);
    await api(`/comptabilite/ecritures/${historicalEntry.id}`, 'PUT', {
      dateEcriture: '1901-06-15',
    }, 409);
    await api(`/comptabilite/ecritures/${historicalEntry.id}`, 'DELETE', null, 409);
    await assert.rejects(
      queryAsTenant(closingTenant, 'UPDATE lignes_ecriture SET debit = debit + 1 WHERE ecriture_id = $1',
        [historicalEntry.id]),
      /exercice comptable 1900 fermé/,
    );
    const nextYearClose = await api('/comptabilite/cloture-exercice', 'POST', { annee: closingYear + 1 });
    assert.equal(nextYearClose.details.ecritureOuverture.totalDebit, 200);
    assert.equal(nextYearClose.details.ecritureOuverture.totalCredit, 200);
    const blockedEarlierReopening = await api(`/comptabilite/cloture-exercice/${closingYear}/reouverture`, 'POST', {
      motif: 'Tentative alors que l’exercice suivant est fermé',
    }, 409);
    assert.match(blockedEarlierReopening.error, /1901 fermé/);
    const { rows: [unchangedClosure] } = await adminSchemaPool.query(
      'SELECT statut, reouvert_le FROM clotures_exercices WHERE entreprise_id = $1 AND exercice = $2 AND revision = 2',
      [closingTenant, closingYear],
    );
    assert.equal(unchangedClosure.statut, 'ferme', 'Un échec de contrepassation ne réouvre pas partiellement l’exercice');
    assert.equal(unchangedClosure.reouvert_le, null);
    await api('/ia/chat','POST',{message:'ne pas envoyer'},404);
    await api('/auth-security/logout','POST',{sessionId:closingAdminLogin.session.id});
    await api('/auth-security/session','GET',null,401);

    const { generateToken } = await import('../src/auth.js');
    const expiredAccessToken = generateToken({
      id: signup.user.id,
      username: 'recette',
      email: 'recette@example.invalid',
      role: 'admin',
      entrepriseId: signup.user.entrepriseId,
      trialExpiresAt: Date.now() - 1000,
    });
    cookieJar = new Map();
    await api('/clients', 'GET', null, 401, {
      Authorization: `Bearer ${expiredAccessToken}`,
    });

    const pastDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await adminSchemaPool.query(
      `UPDATE abonnements
       SET created_at = $1, date_expiration = $2, remarques = 'Ancien abonnement de test'
       WHERE entreprise_id = $3`,
      [pastDate, pastDate, secondSignup.user.entrepriseId],
    );
    cookieJar = new Map();
    const nonTrialLogin = await api('/auth-security/login', 'POST', {
      email: 'second@example.invalid',
      password: secondPassword,
    });
    assert.ok(nonTrialLogin.session?.id, 'Un compte hors essai n’est pas bloqué par cette règle');
    await api('/auth-security/logout', 'POST', { sessionId: nonTrialLogin.session.id });

    const expiryTestLogin = await api('/auth-security/login', 'POST', {
      email: 'recette@example.invalid',
      password,
    });
    assert.ok(expiryTestLogin.session?.id, 'Un essai actif permet encore la connexion');
    await adminSchemaPool.query(
      `UPDATE abonnements
       SET created_at = $1, date_expiration = $2
       WHERE entreprise_id = $3`,
      [pastDate, pastDate, signup.user.entrepriseId],
    );
    const expiredRefresh = await api('/auth-security/refresh', 'POST', null, 401);
    assert.equal(expiredRefresh.code, 'TRIAL_EXPIRED');
    const expiredLogin = await api('/auth-security/login', 'POST', {
      email: 'recette@example.invalid',
      password,
    }, 403);
    assert.equal(expiredLogin.code, 'TRIAL_EXPIRED');

    console.log('Recette : connexion, identifiants auxiliaires clients/fournisseurs, états de compte par numéro, factures/paiements, écritures équilibrées, dépenses, isolation tenant et déconnexion vérifiés.');
  } finally {
    if(server) await new Promise(r=>server.close(r));
    if(worker) await worker.dispose();
    if(pool) await pool.end();
    if(adminSchemaPool) await adminSchemaPool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    if(roleCreated) {
      // Ordre imposé par Neon : DROP OWNED BY échoue en 42501 (l'unique
      // objet restant du rôle est son CONNECT sur la base, et la
      // révocation de l'appartenance ne suffit pas) — on révoque le
      // CONNECT sur la base, puis l'appartenance, puis le rôle. Le
      // schéma jetable (et tout ce que le rôle y possédait) est déjà
      // supprimé par DROP SCHEMA CASCADE ci-dessus. databaseName est
      // déclaré dans le try : on le recalcule ici depuis l'URL.
      const cleanupDbName = decodeURIComponent(new URL(adminConnectionString).pathname.slice(1));
      await admin.query(`REVOKE ALL ON DATABASE "${cleanupDbName}" FROM "${rlsRole}"`);
      await admin.query(`REVOKE "${rlsRole}" FROM CURRENT_USER`);
      await admin.query(`DROP ROLE "${rlsRole}"`);
    }
    await admin.end();
    if(adminConnectionString === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = adminConnectionString;
    if(previousTenantRls === undefined) delete process.env.TENANT_RLS_ENABLED;
    else process.env.TENANT_RLS_ENABLED = previousTenantRls;
  }
});
