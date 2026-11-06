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

test('la démo commerciale présente les modules essentiels sans paie ni IA', async () => {
  const demo = await read('../src/pages/ProspectDemo.jsx');
  for (const moduleId of ['clients', 'fournisseurs', 'tresorerie', 'stock', 'comptabilite', 'associations', 'impots', 'integrations', 'security', 'settings']) {
    assert.match(demo, new RegExp(`id: '${moduleId}'`));
  }
  assert.match(demo, /Factures clients/);
  assert.match(demo, /Opérations comptables/);
  assert.match(demo, /Comptabilité des associations/);
  assert.doesNotMatch(demo, /\bPaie(?:\s*&\s*RH)?\b|Assistant IA|IAAssistant/);
});

test('les fonctions avancées sont filtrées selon les rôles', async () => {
  const source = await read('../src/App.jsx');
  assert.match(source, /requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(source, /id: 'integrations'.*requiresAdmin: true/);
  assert.match(source, /id: 'authentication'.*requiresSuperAdmin: true, requiresAdmin: true/);
  assert.match(source, /const isAdmin = user\?\.role === 'admin'/);
});

test('l’inscription publique propose uniquement l’essai gratuit et demande un mot de passe', async () => {
  const source = await read('../src/pages/Inscription.jsx');
  const login = await read('../src/pages/Login.jsx');
  assert.doesNotMatch(source, /localhost:3000|VITE_API_URL/);
  assert.match(source, /fetch\('\/api\/public\/plans'\)/);
  assert.match(source, /disabled=\{submitting \|\| !selectedPlan\}/);
  assert.match(source, /Aucun forfait actif n’est disponible/);
  assert.match(source, /name="motDePasse"/);
  assert.match(source, /name="confirmationMotDePasse"/);
  assert.match(source, /Les 30 jours commencent à la création de votre organisation/);
  assert.doesNotMatch(source, /methodePaiement|Procéder au Paiement/);
  assert.match(login, /window\.location\.assign\('\/inscription'\)/);
  assert.doesNotMatch(login, /fetch\('\/api\/auth\/register'/);
});

test('l’ancien écran Factures autonome est retiré, les factures restent dans Clients', async () => {
  const app = await read('../src/App.jsx');
  const clients = await read('../src/modules/ClientsModule.jsx');
  assert.doesNotMatch(app, /FacturesModule/);
  assert.match(clients, /FacturesClientTab/);
  await assert.rejects(access(new URL('../src/modules/FacturesModule.jsx', import.meta.url)));
});

test('la fiche client accepte un nom saisi et propose les comptes collectifs biens/services', async () => {
  const clients = await read('../src/modules/ClientsModule.jsx');
  assert.match(clients, /id="client-name"[\s\S]*?value=\{clientData\.nom \|\| ''\}[\s\S]*?const nom = event\.target\.value;[\s\S]*?setClientData\(\(current\) => \(\{ \.\.\.current, nom \}\)\)/);
  assert.match(clients, /compteClientNumero: '4111'/);
  assert.match(clients, /Ventes de biens — 4111/);
  assert.match(clients, /Prestations de services — 4112/);
});

test('le rapprochement charge les comptes via l’API achats dédiée', async () => {
  const suppliers = await read('../src/modules/GestionFournisseurs.jsx');
  assert.match(suppliers, /api\.get\('\/achats\/comptes-ecarts'\)/);
  assert.doesNotMatch(suppliers, /api\.get\('\/comptabilite\/comptes'\)/);
  assert.match(suppliers, /if \(hasVariance && !factureForm\.compteEcartId\)/);
  assert.match(suppliers, /compteEcartId: factureForm\.compteEcartId \? Number\(factureForm\.compteEcartId\) : null/);
  assert.match(suppliers, /if \(!numeroFactureFournisseur\)/);
  assert.match(suppliers, /disabled=\{submitting\}/);
  assert.match(suppliers, /value=\{factureForm\.numeroFactureFournisseur\}/);
  assert.match(suppliers, /htmlFor="supplier-invoice-number"/);
  assert.match(suppliers, /numeroFactureFournisseur: value/);
  assert.doesNotMatch(suppliers, /numeroFactureInputRef/);
  assert.doesNotMatch(suppliers, /position: 'sticky',\s*bottom: 0/);
  assert.match(suppliers, /role="combobox"/);
  assert.match(suppliers, /role="option"/);
  assert.match(suppliers, /compteEcartId: String\(account\.id\)/);
  assert.match(suppliers, /value=\{compteEcartSearch\}/);
  assert.match(suppliers, /aria-expanded=\{Boolean\(normalizedAccountQuery\)\}/);
  assert.doesNotMatch(suppliers, /compteEcartPickerOpen/);
});

test('la réception d’une commande accepte le poids des produits', async () => {
  const stock = await read('../src/modules/StockInventaire.jsx');
  assert.match(stock, /Poids par unité/);
  assert.match(stock, /Unité du poids/);
  assert.match(stock, /poidsParUnite: isMassUnit/);
  assert.match(stock, /unitePoids: line\.unitePoids \|\| 'kg'/);
  assert.match(stock, /poidsManquant/);
});
