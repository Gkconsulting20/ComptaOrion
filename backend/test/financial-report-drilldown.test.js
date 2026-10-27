import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('le détail financier est paginé, limité à l’entreprise et aux écritures validées', async () => {
  const routes = await read('../src/routes/comptabilite.js');
  const start = routes.indexOf("router.get('/rapports/drill-down'");
  const end = routes.indexOf("router.get('/rapport-journaux'", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const route = routes.slice(start, end);
  assert.match(route, /const entrepriseId = req\.entrepriseId/);
  assert.match(route, /e\.valide = true/);
  assert.match(route, /le\.entreprise_id = \$\{entrepriseId\}/);
  assert.match(route, /cc\.entreprise_id = \$\{entrepriseId\}/);
  assert.match(route, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.match(route, /Math\.min\(requestedLimit, 200\)/);
});

test('les états et la balance exposent des montants ouvrant leur détail', async () => {
  const frontend = await read('../../frontend/src/modules/ModuleComptabilite.jsx');
  const routes = await read('../src/routes/comptabilite.js');

  assert.match(frontend, /const renderDrillableAmount =/);
  assert.match(frontend, /\/comptabilite\/rapports\/drill-down/);
  assert.match(frontend, /renderDrillableAmount\(c\.solde, \[c\]/);
  assert.match(frontend, /renderDrillableAmount\(val, \[row\]/);
  assert.match(frontend, /if \(query\.dateDebut\) params\.dateDebut = query\.dateDebut/);
  assert.match(frontend, /if \(query\.dateFin\) params\.dateFin = query\.dateFin/);
  assert.match(frontend, /drillModal\.pagination\.page/);
  assert.match(routes, /router\.get\('\/rapports\/bilan'/);
  assert.match(routes, /router\.get\('\/rapports\/resultat'/);
});
