import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import app from '../src/app.js';
import { pool } from '../src/db.js';

test('contrat HTTP ERP sans session et retrait de Lite', async t => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  for (const path of ['/api/clients', '/api/factures', '/api/comptabilite/comptes', '/api/ia/chat']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 401, `API privée : ${path}`);
  }
  const retired = await fetch(`${origin}/lite`);
  assert.equal(retired.status, 410);
});

test('le serveur ne crée plus de compte à mot de passe prédéfini', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ensureAdminExists|passwordHash|bcrypt\.hash/);
});
