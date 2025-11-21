import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import produitsRoutes from './routes/produits.js';
import stockRoutes from './routes/stock.js';
import devisRoutes from './routes/devis.js';
import facturesRoutes from './routes/factures.js';
import parametresRoutes from './routes/parametres.js';
import fournisseursRoutes from './routes/fournisseurs.js';
import commandesAchatRoutes from './routes/commandes-achat.js';
import receptionsRoutes from './routes/receptions.js';
import achatsRoutes from './routes/achats.js';
import dashboardRoutes from './routes/dashboard.js';
import authSecurityRoutes from './routes/auth-security.js';
import dépensesRoutes from './routes/dépenses.js';
import immobilisationsRoutes from './routes/immobilisations.js';
import exportAssetsRoutes from './routes/export-assets.js';
import comptabiliteRoutes from './routes/comptabilite.js';
import tresorerieRoutes from './routes/tresorerie.js';
import auditLogsRoutes from './routes/audit-logs.js';
import paieRoutes from './routes/paie.js';
import { authMiddleware, entrepriseIsolation } from './auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes d'authentification (publiques - pas de middleware)
app.use('/api/auth', authRoutes);
app.use('/api/auth-security', authSecurityRoutes);

// Route de santé (publique)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComptaOrion serveur opérationnel' });
});

// Dashboard (publique - pas d'authentification requise)
app.use('/api/dashboard', dashboardRoutes);

// ===============================================
// MIDDLEWARE GLOBAL POUR TOUTES LES ROUTES PROTÉGÉES
// ===============================================
// Toutes les routes après ce point nécessitent une authentification
// et sont automatiquement filtrées par entreprise

// ✅ AUTHENTIFICATION ACTIVÉE - TOUTES LES ROUTES PROTÉGÉES
app.use('/api', authMiddleware, entrepriseIsolation);

// ===============================================
// ROUTES CRUD DES MODULES
// ===============================================

// Module Clients
app.use('/api/clients', clientsRoutes);

// Module Produits & Stock
app.use('/api/produits', produitsRoutes);
app.use('/api/stock', stockRoutes);

// Module Devis (Quotes)
app.use('/api/devis', devisRoutes);

// Module Factures (Invoices)
app.use('/api/factures', facturesRoutes);

// Module Paramètres & Configuration
app.use('/api/parametres', parametresRoutes);

// Dashboard

// Module Immobilisations
app.use('/api/immobilisations', immobilisationsRoutes);
app.use('/api/export-assets', exportAssetsRoutes);

// Module Dépenses
app.use('/api/depenses', dépensesRoutes);

// Module Comptabilité Générale
app.use('/api/comptabilite', comptabiliteRoutes);

// Module Trésorerie
app.use('/api/tresorerie', tresorerieRoutes);
app.use('/api/audit-logs', auditLogsRoutes);

// Module Paie & RH (MASQUÉ - structure créée mais non visible dans menu)
app.use('/api/paie', paieRoutes);

// Module Fournisseurs & Achats
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/commandes-achat', commandesAchatRoutes);
app.use('/api/receptions', receptionsRoutes);
app.use('/api/achats', achatsRoutes);

// ===============================================
// ROUTE INFO API
// ===============================================
app.get('/api', (req, res) => {
  res.json({ 
    nom: 'ComptaOrion API',
    version: '2.0.0',
    description: 'Solution de gestion d\'entreprise professionnelle',
    entrepriseId: req.entrepriseId,
    modules: [
      'Tableau de bord',
      'Gestion clients',
      'Gestion fournisseurs',
      'Gestion de trésorerie',
      'Gestion de stock',
      'Comptabilité complète',
      'Assistant IA'
    ]
  });
});

// ===============================================
// ROUTES STUBS (À IMPLÉMENTER)
// ===============================================

app.get('/api/stock', (req, res) => {
  res.json({ 
    message: 'Module stock & inventaire',
    data: []
  });
});

app.post('/api/stock', (req, res) => {
  res.json({ 
    message: 'Article créé avec succès',
    data: req.body
  });
});

app.get('/api/comptabilite/etats-financiers', (req, res) => {
  res.json({ 
    message: 'États financiers',
    bilan: { actif: 0, passif: 0 },
    resultat: { revenus: 0, charges: 0 },
    tresorerie: { entrees: 0, sorties: 0 }
  });
});

app.get('/api/comptabilite/grand-livre', (req, res) => {
  res.json({ 
    message: 'Grand livre',
    data: []
  });
});

app.get('/api/comptabilite/journal', (req, res) => {
  res.json({ 
    message: 'Écriture de journal',
    data: []
  });
});

app.post('/api/comptabilite/journal', (req, res) => {
  res.json({ 
    message: 'Écriture comptable enregistrée',
    data: req.body
  });
});

app.get('/api/comptabilite/reconciliation', (req, res) => {
  res.json({ 
    message: 'Réconciliation bancaire',
    data: []
  });
});

app.get('/api/comptabilite/charte-comptes', (req, res) => {
  res.json({ 
    message: 'Charte de comptes',
    comptes: [
      { numero: '1', nom: 'Actifs', type: 'Actif' },
      { numero: '2', nom: 'Passifs', type: 'Passif' },
      { numero: '3', nom: 'Capitaux propres', type: 'Capitaux' },
      { numero: '4', nom: 'Produits', type: 'Produits' },
      { numero: '5', nom: 'Charges', type: 'Charges' }
    ]
  });
});

app.post('/api/comptabilite/charte-comptes', (req, res) => {
  res.json({ 
    message: 'Compte créé avec succès',
    data: req.body
  });
});

app.get('/api/ia/chat', (req, res) => {
  res.json({ 
    message: 'Assistant IA disponible',
    status: 'ready'
  });
});

app.post('/api/ia/chat', (req, res) => {
  res.json({ 
    message: 'Message reçu',
    response: 'Assistant IA - à implémenter avec OpenAI'
  });
});

export default app;
