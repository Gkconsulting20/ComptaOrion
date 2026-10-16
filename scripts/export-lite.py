#!/usr/bin/env python3
"""Export the existing Lite implementation without data or environment files."""
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "generated-artifacts" / "comptaorion-lite-source.zip"

BACKEND_APP = """import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import authSecurityRoutes from './routes/auth-security.js';
import clientsRoutes from './routes/clients.js';
import produitsRoutes from './routes/produits.js';
import facturesRoutes from './routes/factures.js';
import depensesRoutes from './routes/dépenses.js';
import { authMiddleware, entrepriseIsolation } from './auth.js';
import { createTenantMiddleware } from './utils/rlsPolicies.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';

const app = express();
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok', application: 'ComptaOrion Lite' }));
app.use('/api/auth', authRoutes);
app.use('/api/auth-security', authSecurityRoutes);
app.use('/api', authMiddleware, entrepriseIsolation, createTenantMiddleware(), idempotencyMiddleware);
app.use('/api/clients', clientsRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/depenses', depensesRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route non disponible dans Lite' }));
const dist = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
export default app;
"""

BACKEND_MAIN = """import 'dotenv/config';
import app from './app.js';
import { initializeTenantSetting } from './utils/rlsPolicies.js';

await initializeTenantSetting();
const port = process.env.PORT || (process.env.NODE_ENV === 'production' ? 5000 : 3000);
app.listen(port, '0.0.0.0', () => console.log(`ComptaOrion Lite démarré sur le port ${port}`));
"""

README = """# ComptaOrion Lite — projet indépendant

Cette copie provient du logiciel existant. Elle n'est reliée ni au serveur ni
à la base de données de l'ERP. L'ERP d'origine n'est pas modifié.

## Inclus
Interface Lite seule, ventes multi-articles, clients/dettes, paiements,
dépenses, stock, reçus WhatsApp, file hors connexion et anti-duplication.
Le serveur réutilise les services métier et le schéma existants pour préserver
les transactions. Le schéma conserve des tables ERP par compatibilité ; ce
n'est pas encore une réduction complète du modèle comptable.
Les interfaces ERP, routes IA, abonnement et administration ne sont pas exposées.
Pas de compte administrateur automatique ni de mot de passe par défaut.

## Import dans un nouveau projet
1. Importer ce ZIP dans un NOUVEAU projet Replit.
2. Créer une NOUVELLE base PostgreSQL vide, dédiée à Lite.
3. Dans les secrets DU NOUVEAU projet, configurer DATABASE_URL vers cette base,
   JWT_SECRET et JWT_REFRESH_SECRET avec de nouvelles valeurs aléatoires.
   Ne jamais réutiliser l'URL de base ou les secrets JWT de l'ERP.
4. Exécuter `npm run install:all`, puis `npm run db:push`.
   Cette commande ne doit viser que la nouvelle base vide ; examiner les
   propositions du moteur de migration et ne jamais forcer une suppression.
5. Exécuter `npm run dev` et créer le premier compte depuis Connexion/Inscription.
6. Pour la production : `npm run build` puis `npm start`.

La route racine ouvre Lite. `/lite` reste compatible.
Les envois WhatsApp sont manuels, via liens de partage ; aucun bot payant.
L'IA n'est pas montée sur ce serveur, même si une clé OpenAI est présente.
Les courriels nécessitent une configuration SendGrid propre au nouveau projet.

## Vérifications avant publication
Valider sur la nouvelle base : inscription, connexion, vente multi-articles,
stock, dette/paiement, dépense, reçu, coupure réseau et reprise sans doublon.
Le build et les tests de code ne remplacent pas ces essais d'intégration.
Seules les ventes et dépenses sont mises en file hors connexion.
Le panier ouvert n'est pas encore sauvegardé après fermeture de l'écran.
"""


def write(base, name, content):
    path = base / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def copy(base, name):
    dest = base / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / name, dest)


with tempfile.TemporaryDirectory(prefix="comptaorion-lite-export-") as tmp:
    base = Path(tmp)
    # Explicit allowlists: no environment, uploads, databases, Git or logs.
    for folder in ("backend/src", "backend/test"):
        shutil.copytree(ROOT / folder, base / folder)
    (base / "backend/src/routes/ia-assistant.js").unlink(missing_ok=True)
    for name in ("backend/package.json", "backend/package-lock.json",
                 "backend/drizzle.config.ts", "frontend/package.json",
                 "frontend/package-lock.json", "frontend/index.html",
                 "frontend/vite.config.js", "frontend/src/LiteApp.jsx",
                 "frontend/src/lite.css", "frontend/src/liteDb.js",
                 "frontend/src/liteDb.test.js", "frontend/src/api.js",
                 "frontend/src/pages/Login.jsx",
                 "frontend/public/manifest.webmanifest",
                 "frontend/public/logo-comptaorion.png", "start.sh"):
        copy(base, name)
    write(base, "backend/src/app.js", BACKEND_APP)
    write(base, "backend/src/main.js", BACKEND_MAIN)
    # Every generated asset belongs to Lite now, including the root CSS.
    config = (base / "frontend/vite.config.js").read_text()
    config = config.replace(
        "if (fileName.endsWith('.css')) return fileName.includes('LiteApp-');",
        "if (fileName.endsWith('.css')) return true;"
    ).replace(
        "['/lite', '/manifest.webmanifest'",
        "['/', '/lite', '/manifest.webmanifest'"
    )
    write(base, "frontend/vite.config.js", config)
    write(base, "backend/drizzle.config.ts", """import { defineConfig } from 'drizzle-kit';
if (!process.env.DATABASE_URL) throw new Error('Configurer la nouvelle base Lite dans DATABASE_URL.');
export default defineConfig({
  out: './drizzle',
  schema: './src/schema.js',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: { url: process.env.DATABASE_URL }
});
""")
    write(base, "frontend/src/main.jsx", """import React from 'react';
import { createRoot } from 'react-dom/client';
import LiteApp from './LiteApp.jsx';
createRoot(document.getElementById('root')).render(<LiteApp />);
""")
    index = (base / "frontend/index.html").read_text()
    write(base, "frontend/index.html", index.replace(
        "ComptaOrion - ERP Léger pour l'Afrique", "ComptaOrion Lite"))
    write(base, "package.json", json.dumps({
        "name": "comptaorion-lite", "version": "1.0.0", "private": True,
        "scripts": {
            "install:all": "npm ci --prefix frontend && npm ci --prefix backend",
            "dev": "bash start.sh",
            "build": "npm run build --prefix frontend",
            "start": "NODE_ENV=production node backend/src/main.js",
            "db:push": "npm run db:push --prefix backend",
            "test": "npm test --prefix frontend && npm test --prefix backend"
        }
    }, indent=2) + "\n")
    write(base, ".replit", """run = "npm run dev"
modules = ["nodejs-20"]

[[ports]]
localPort = 5000
externalPort = 80

[deployment]
build = ["sh", "-c", "npm run install:all && npm run build"]
run = ["npm", "start"]
deploymentTarget = "autoscale"
""")
    write(base, ".gitignore", "node_modules/\ndist/\n.env\n.env.*\n*.log\nbackend/uploads/\n")
    write(base, "README.md", README)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(base.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(base))

print(OUTPUT.relative_to(ROOT))
