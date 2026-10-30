import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('les modules avancés et les APIs globales sont réservés à l’administrateur concerné', async () => {
  const app = await read('../src/app.js');
  const auth = await read('../src/auth.js');
  const securityRoutes = await read('../src/routes/auth-security.js');
  const frontend = await read('../../frontend/src/App.jsx');

  assert.match(frontend, /id: 'saas-admin'.*requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(frontend, /id: 'integrations'.*requiresAdmin: true/);
  assert.match(frontend, /id: 'authentication'.*requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(frontend, /const isSuperAdmin = isAdmin && Number\(user\?\.entrepriseId\) === 1/);
  assert.match(app, /app\.use\('\/api\/integrations', requireRole\('admin'\), integrationsRoutes\)/);
  assert.match(auth, /req\.user\.role !== 'admin' \|\| Number\(req\.user\.entrepriseId\) !== 1/);
  assert.match(securityRoutes, /router\.get\('\/permissions', authMiddleware, saasAdminOnly/);
  assert.match(securityRoutes, /router\.put\('\/permissions\/:permissionId', authMiddleware, saasAdminOnly/);
});

test('le module fiscal crée des brouillons sans prétendre déposer ou payer', async () => {
  const routes = await read('../src/routes/impots.js');
  const frontend = await read('../../frontend/src/modules/ImpotsModule.jsx');
  const app = await read('../../frontend/src/App.jsx');
  const demo = await read('../../frontend/src/pages/ProspectDemo.jsx');

  assert.match(routes, /router\.post\('\/parametres\/tester-connexion', \(_req, res\) => res\.status\(501\)/);
  assert.match(routes, /router\.post\('\/declarations\/:id\/payer', \(_req, res\) => res\.status\(501\)/);
  assert.match(routes, /router\.post\('\/declarations\/tva', async \(req, res\) =>/);
  assert.match(routes, /statut: 'brouillon'/);
  assert.match(routes, /Aucun dépôt ni paiement n’a été effectué/);
  assert.match(routes, /cc\.numero LIKE '443%'/);
  assert.match(routes, /cc\.numero NOT LIKE '4434%'/);
  assert.match(routes, /cc\.numero LIKE '445%'/);
  assert.match(routes, /e\.valide = true/);
  assert.match(routes, /router\.post\('\/declarations\/:id\/depot-manuel', async \(req, res\) =>/);
  assert.match(routes, /pg_advisory_xact_lock\(hashtext\(\$\{lockKey\}\)\)/);
  assert.match(frontend, /Calculs fiscaux disponibles — aucun envoi ni paiement automatique/);
  assert.match(frontend, /ne calcule pas le bénéfice imposable ni l’impôt dû/);
  assert.match(app, /id: 'impots', label: 'Impôts'/);
  assert.doesNotMatch(app, /Impôts \(en préparation\)/i);
  assert.doesNotMatch(frontend, /en préparation|préparation de brouillons|préparation disponible/i);
  assert.match(demo, /SUIVI FISCAL/);
  assert.doesNotMatch(demo, /PRÉPARATION FISCALE/i);
  assert.doesNotMatch(frontend, /testerConnexion|declarerTVA/);
});

