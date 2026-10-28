import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('le logger conserve les anciennes et nouvelles valeurs avec le bon tenant et exécuteur', async () => {
  const logger = await read('../src/utils/auditLogger.js');
  assert.match(logger, /oldValues = null/);
  assert.match(logger, /newValues = null/);
  assert.match(logger, /executor = db/);
  assert.match(logger, /required = false/);
  assert.match(logger, /tableName: table/);
  assert.match(logger, /if \(required\) throw error/);
  assert.match(logger, /entrepriseId: req\.entrepriseId/);
  assert.doesNotMatch(logger, /userId = 1/);
});

test('les écritures comptables sont modifiées et supprimées dans le tenant courant avec audit atomique', async () => {
  const routes = await read('../src/routes/comptabilite.js');
  const creation = routes.slice(
    routes.indexOf("router.post('/ecritures'"),
    routes.indexOf("router.get('/ecritures'")
  );
  const validation = routes.slice(
    routes.indexOf("router.post('/ecritures/:id/valider'"),
    routes.indexOf('// LIGNES D\'ÉCRITURES')
  );
  const lineCreation = routes.slice(
    routes.indexOf("router.post('/lignes'"),
    routes.indexOf("router.get('/lignes/:ecritureId'")
  );
  const update = routes.slice(
    routes.indexOf("router.put('/ecritures/:id'"),
    routes.indexOf("router.delete('/ecritures/:id'")
  );
  const deletion = routes.slice(routes.indexOf("router.delete('/ecritures/:id'"));

  assert.match(creation, /db\.transaction/);
  assert.match(creation, /action: 'CREATE'/);
  assert.match(creation, /required: true/);
  assert.match(validation, /eq\(ecritures\.entrepriseId, Number\(entrepriseId\)\)/);
  assert.match(validation, /action: 'UPDATE'/);
  assert.match(validation, /required: true/);
  assert.match(lineCreation, /action: 'CREATE'/);
  assert.match(lineCreation, /executor: tx/);
  assert.match(lineCreation, /required: true/);

  assert.match(update, /db\.transaction/);
  assert.match(update, /eq\(ecritures\.entrepriseId, Number\(entrepriseId\)\)/);
  assert.match(update, /action: 'UPDATE'/);
  assert.match(update, /executor: tx/);
  assert.match(update, /required: true/);

  assert.match(deletion, /db\.transaction/);
  assert.match(deletion, /eq\(ecritures\.entrepriseId, Number\(entrepriseId\)\)/);
  assert.match(deletion, /action: 'DELETE'/);
  assert.match(deletion, /ancienneValeur: \{ ecriture, lignes \}/);
  assert.match(deletion, /executor: tx/);
  assert.match(deletion, /required: true/);
  assert.doesNotMatch(deletion, /req\.body\.userId/);
});

test('les opérations principales sur les factures enregistrent leur trace', async () => {
  const routes = await read('../src/routes/factures.js');
  const create = routes.slice(routes.indexOf("router.post('/',"), routes.indexOf("router.post('/:id/paiement'"));
  const payment = routes.slice(routes.indexOf("router.post('/:id/paiement'"), routes.indexOf("router.put('/:id'"));
  const update = routes.slice(routes.indexOf("router.put('/:id'"), routes.indexOf("router.delete('/:id'"));
  const deletion = routes.slice(routes.indexOf("router.delete('/:id'"));

  assert.match(create, /action: 'CREATE'/);
  assert.match(create, /table: 'factures'/);
  assert.match(create, /ancienneValeur|nouvelleValeur/);
  assert.match(create, /executor: tx/);
  assert.match(create, /required: true/);

  assert.match(payment, /table: 'paiements'/);
  assert.match(payment, /table: 'factures'/);
  assert.match(payment, /executor: tx/);
  assert.match(payment, /required: true/);

  assert.match(update, /action: 'UPDATE'/);
  assert.match(update, /table: 'factures'/);
  assert.match(deletion, /db\.transaction/);
  assert.match(deletion, /action: 'DELETE'/);
  assert.match(deletion, /ancienneValeur: \{ facture: existingFacture, items \}/);
  assert.match(deletion, /executor: tx/);
  assert.match(deletion, /required: true/);
});

test('les nouveaux forfaits ont une limite par défaut de trois utilisateurs', async () => {
  const schema = await read('../src/schema.js');
  const route = await read('../src/routes/saas-admin.js');
  const frontend = await read('../../frontend/src/modules/SaaSAdminModule.jsx');

  assert.match(schema, /limiteUtilisateurs: integer\('limite_utilisateurs'\)\.default\(3\)/);
  assert.match(route, /\?\s*3\s*:/);
  assert.match(frontend, /\{\s*limiteUtilisateurs:\s*3/);
});

test('les modules financiers modifiés journalisent les changements dans la transaction', async () => {
  const modules = [
    '../src/routes/association-accounting.js',
    '../src/routes/dépenses.js',
    '../src/routes/tresorerie.js',
    '../src/routes/achats.js',
    '../src/routes/produits.js',
    '../src/routes/devis.js',
    '../src/routes/commandes-achat.js',
    '../src/routes/bons-livraison.js',
    '../src/routes/receptions.js',
    '../src/routes/ecritures-recurrentes.js',
    '../src/routes/devises.js',
    '../src/routes/immobilisations.js',
    '../src/routes/impots.js',
    '../src/routes/upload.js'
  ];

  for (const modulePath of modules) {
    const source = await read(modulePath);
    assert.match(source, /logAudit/, `${modulePath} doit enregistrer un audit`);
    assert.match(source, /executor:\s*tx/, `${modulePath} doit écrire l’audit dans la transaction`);
    assert.match(source, /required:\s*true/, `${modulePath} ne doit pas ignorer une erreur d’audit`);
  }
});

test('les réceptions et actifs utilisent le tenant et l’auteur de la session', async () => {
  const reception = await read('../src/routes/receptions.js');
  const assets = await read('../src/routes/immobilisations.js');

  assert.match(reception, /eq\(commandesAchat\.entrepriseId, req\.entrepriseId\)/);
  assert.match(reception, /userId:\s*req\.user\.id/);
  assert.doesNotMatch(reception, /req\.body\.userId/);

  assert.match(assets, /entrepriseId:\s*req\.entrepriseId/);
  assert.match(assets, /extractAuditInfo\(req\)/);
  assert.doesNotMatch(assets, /const \{[^}]*userId[^}]*\}\s*=\s*req\.body/);
  assert.doesNotMatch(assets, /const \{[^}]*entrepriseId[^}]*\}\s*=\s*req\.body/);
});

test('les anciennes routes de consultation d’audit restent isolées par entreprise', async () => {
  const routes = await read('../src/routes/parametres.js');
  const listing = routes.slice(
    routes.indexOf("router.get('/audit-logs'"),
    routes.indexOf("router.get('/audit-logs/:id'")
  );
  const detail = routes.slice(
    routes.indexOf("router.get('/audit-logs/:id'"),
    routes.indexOf("router.get('/audit-stats'")
  );
  const stats = routes.slice(routes.indexOf("router.get('/audit-stats'"));

  assert.match(listing, /eq\(auditLogs\.entrepriseId, req\.entrepriseId\)/);
  assert.match(listing, /Math\.min/);
  assert.doesNotMatch(listing, /parseInt\(entrepriseId\)/);
  assert.match(detail, /eq\(auditLogs\.entrepriseId, req\.entrepriseId\)/);
  assert.match(detail, /404/);
  assert.match(stats, /eq\(auditLogs\.entrepriseId, req\.entrepriseId\)/);
  assert.doesNotMatch(stats, /parseInt\(entrepriseId\)/);
});
