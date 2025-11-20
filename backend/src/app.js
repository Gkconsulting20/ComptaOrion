import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComptaOrion serveur opérationnel' });
});

app.get('/api', (req, res) => {
  res.json({ 
    nom: 'ComptaOrion API',
    version: '2.0.0',
    description: 'Solution de gestion d\'entreprise professionnelle',
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

app.get('/api/clients', (req, res) => {
  res.json({ 
    message: 'Module clients',
    data: []
  });
});

app.post('/api/clients', (req, res) => {
  res.json({ 
    message: 'Client créé avec succès',
    data: req.body
  });
});

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
