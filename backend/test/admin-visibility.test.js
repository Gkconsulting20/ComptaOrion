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

test('les actions fiscales simulées ne peuvent pas créer de fausses déclarations', async () => {
  const routes = await read('../src/routes/impots.js');
  const frontend = await read('../../frontend/src/modules/ImpotsModule.jsx');

  assert.match(routes, /router\.post\('\/parametres\/tester-connexion', \(_req, res\) => res\.status\(501\)/);
  assert.match(routes, /router\.post\('\/declarations\/tva', \(_req, res\) => res\.status\(501\)/);
  assert.match(routes, /router\.post\('\/declarations\/:id\/payer', \(_req, res\) => res\.status\(501\)/);
  assert.match(frontend, /Module en préparation — les télédéclarations ne sont pas opérationnelles/);
  assert.match(frontend, /Le calcul de l’Impôt sur les Sociétés n’est pas disponible/);
  assert.doesNotMatch(frontend, /testerConnexion|declarerTVA/);
});

