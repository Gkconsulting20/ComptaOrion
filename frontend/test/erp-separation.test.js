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
