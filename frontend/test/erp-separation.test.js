import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('le point d’entrée charge uniquement l’ERP', async () => {
  const source = await read('../src/main.jsx');
  assert.match(source, /import\('\.\/App\.jsx'\)/);
  assert.doesNotMatch(source, /import\('\.\/LiteApp\.jsx'\)/);
  await assert.rejects(access(new URL('../src/LiteApp.jsx', import.meta.url)));
});

test('l’ERP ne réinstalle plus le service worker Lite', async () => {
  const html = await read('../index.html');
  const vite = await read('../vite.config.js');
  assert.doesNotMatch(html, /serviceWorker\.register|manifest\.webmanifest/);
  assert.doesNotMatch(vite, /liteServiceWorkerPlugin/);
  const worker = await read('../public/sw.js');
  assert.match(worker, /orion-lite-shell-/);
  assert.match(worker, /registration\.unregister/);
  assert.doesNotMatch(worker, /addEventListener\('fetch'/);
});

test('l’IA reste cachée sans activation explicite', async () => {
  const source = await read('../src/App.jsx');
  assert.match(source, /VITE_AI_ENABLED === 'true'/);
  assert.match(source, /case 'ia-assistant': return AI_ENABLED \?/);
});

test('les fonctions comptables centrales restent dans la navigation', async () => {
  const source = await read('../src/App.jsx');
  for (const moduleId of ['clients', 'fournisseurs', 'tresorerie', 'stock', 'comptabilite', 'associations']) {
    assert.match(source, new RegExp(`id: '${moduleId}'`));
  }
  assert.doesNotMatch(source, /id: 'paie'/);
});

test('les fonctions avancées sont filtrées selon les rôles', async () => {
  const source = await read('../src/App.jsx');
  assert.match(source, /requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(source, /id: 'integrations'.*requiresAdmin: true/);
  assert.match(source, /id: 'authentication'.*requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(source, /const isAdmin = user\?\.role === 'admin'/);
});

test('l’inscription publique utilise l’API du même domaine et bloque sans forfait actif', async () => {
  const source = await read('../src/pages/Inscription.jsx');
  assert.doesNotMatch(source, /localhost:3000|VITE_API_URL/);
  assert.match(source, /fetch\('\/api\/public\/plans'\)/);
  assert.match(source, /disabled=\{submitting \|\| !selectedPlan\}/);
  assert.match(source, /Aucun forfait actif n’est disponible/);
});

test('l’ancien écran Factures autonome est retiré, les factures restent dans Clients', async () => {
  const app = await read('../src/App.jsx');
  const clients = await read('../src/modules/ClientsModule.jsx');
  assert.doesNotMatch(app, /FacturesModule/);
  assert.match(clients, /FacturesClientTab/);
  await assert.rejects(access(new URL('../src/modules/FacturesModule.jsx', import.meta.url)));
});
