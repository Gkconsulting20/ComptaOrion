import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import produitsRoutes from './routes/produits.js';
import devisRoutes from './routes/devis.js';
import facturesRoutes from './routes/factures.js';
import { authMiddleware, entrepriseIsolation } from './auth.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes d'authentification (publiques - pas de middleware)
app.use('/api/auth', authRoutes);

// Route de santé (publique)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComptaOrion serveur opérationnel' });
});

// ===============================================
// MIDDLEWARE GLOBAL POUR TOUTES LES ROUTES PROTÉGÉES
// ===============================================
// Toutes les routes après ce point nécessitent une authentification
// et sont automatiquement filtrées par entreprise
app.use('/api', authMiddleware, entrepriseIsolation);

// ===============================================
// ROUTES CRUD DES MODULES
// ===============================================

// Module Clients
app.use('/api/clients', clientsRoutes);

// Module Produits & Stock
app.use('/api/produits', produitsRoutes);

// Module Devis (Quotes)
app.use('/api/devis', devisRoutes);

// Module Factures (Invoices)
app.use('/api/factures', facturesRoutes);

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

app.get('/api/fournisseurs', (req, res) => {
  res.json({ 
    message: 'Module fournisseurs',
    data: []
  });
});

app.post('/api/fournisseurs', (req, res) => {
  res.json({ 
    message: 'Fournisseur créé avec succès',
    data: req.body
  });
});

app.get('/api/tresorerie', (req, res) => {
  res.json({ 
    message: 'Module trésorerie',
    solde: 0,
    encaissements: 0,
    decaissements: 0,
    transactions: []
  });
});

app.post('/api/tresorerie/transaction', (req, res) => {
  res.json({ 
    message: 'Transaction enregistrée',
    data: req.body
  });
});

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
