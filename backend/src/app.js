import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComptaOrion serveur opérationnel' });
});

// Information API
app.get('/api', (req, res) => {
  res.json({ 
    nom: 'ComptaOrion API',
    version: '1.0.0',
    description: 'ERP léger optimisé pour l\'Afrique',
    fonctionnalites: [
      'Gestion clients',
      'Facturation',
      'Gestion de stock',
      'Comptabilité',
      'Assistant IA'
    ]
  });
});

// Endpoints modules ERP (à développer)
app.get('/api/clients', (req, res) => {
  res.json({ message: 'Module clients - en développement' });
});

app.get('/api/factures', (req, res) => {
  res.json({ message: 'Module facturation - en développement' });
});

app.get('/api/stock', (req, res) => {
  res.json({ message: 'Module stock - en développement' });
});

app.get('/api/comptabilite', (req, res) => {
  res.json({ message: 'Module comptabilité - en développement' });
});

export default app;
