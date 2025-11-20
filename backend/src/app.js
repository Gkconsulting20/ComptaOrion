import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ComptaOrion Backend is running' });
});

app.get('/api', (req, res) => {
  res.json({ 
    name: 'ComptaOrion API',
    version: '1.0.0',
    description: 'Backend API for ComptaOrion accounting application'
  });
});

export default app;
