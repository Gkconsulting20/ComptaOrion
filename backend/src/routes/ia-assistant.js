import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const { entrepriseId } = req;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    const systemPrompt = `Tu es un assistant intelligent pour ComptaOrion, un ERP africain.
Tu aides les utilisateurs avec:
- La comptabilité (SYSCOHADA, IFRS, PCG)
- La gestion des clients et fournisseurs
- La gestion des stocks et inventaires
- La trésorerie et les paiements
- Les immobilisations et amortissements
- Les ressources humaines et la paie

Réponds en français de manière claire, concise et professionnelle.
Si tu ne connais pas la réponse, dis-le honnêtement.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = completion.choices[0].message.content;

    res.json({
      success: true,
      message: assistantMessage,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Erreur IA Assistant:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la communication avec l\'assistant IA',
      details: error.message 
    });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const suggestions = [
      "Comment créer une facture client ?",
      "Explique-moi le système SYSCOHADA",
      "Comment gérer les immobilisations ?",
      "Quelle est la différence entre débit et crédit ?",
      "Comment faire un rapprochement bancaire ?",
      "Comment calculer l'amortissement linéaire ?"
    ];

    res.json({ success: true, suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
