// Route publique de démonstration — ComptaOrion.
// Étude : ~/workspace/demo-mode-design-2026-11-27.md (§4.2, §4.6).
//
// POST /api/public/demo — crée une entreprise démo jetable + utilisateur
// admin + seed métier, pose les cookies d'authentification et renvoie
// { user, entreprise, isDemo: true }. Réponse 200 (spécification).
// POST /api/public/demo/reset — authentifié, entreprise démo uniquement :
// supprime la démo actuelle et en crée une neuve.
//
// Garde anti-abus (R5) : 5 créations par adresse IP et par jour (compteur en
// mémoire de l'instance Worker — approximatif en multi-isolates, à durcir
// par un captcha si Cap le décide).
import express from 'express';
import { db } from '../db.js';
import { entreprises } from '../schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { generateToken, setAuthCookies, clearAuthCookies, authMiddleware } from '../auth.js';
import { createDemoEnterprise } from '../services/demoSeed.js';
import { deleteEnterpriseData } from '../services/trialLifecycle.js';

const router = express.Router();

const DEMO_MAX_PER_IP_PER_DAY = 5;
const demoCreationsByIp = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const key = `${ip}|${dayStart.toISOString().slice(0, 10)}`;
  for (const storedKey of [...demoCreationsByIp.keys()]) {
    if (storedKey !== key && storedKey < key) demoCreationsByIp.delete(storedKey);
  }
  const count = demoCreationsByIp.get(key) || 0;
  if (count >= DEMO_MAX_PER_IP_PER_DAY) return true;
  demoCreationsByIp.set(key, count + 1);
  return false;
}

function buildAuthPayload(user, entreprise) {
  return {
    user: {
      id: user.id,
      username: user.username,
      nom: user.nom,
      email: user.email,
      role: user.role,
      entrepriseId: user.entrepriseId,
    },
    entreprise: {
      id: entreprise.id,
      nom: entreprise.nom,
      email: entreprise.email,
      ville: entreprise.ville,
      pays: entreprise.pays,
      devise: entreprise.devise,
      systemeComptable: entreprise.systemeComptable,
      tauxTva: entreprise.tauxTva,
    },
    isDemo: true,
  };
}

router.post('/demo', async (req, res) => {
  try {
    const ip = req.headers['cf-connecting-ip'] || req.ip || 'unknown';
    if (isRateLimited(String(ip))) {
      return res.status(429).json({
        message: 'Trop de démonstrations créées depuis cette adresse aujourd’hui. Réessayez demain.',
      });
    }
    const { entreprise, user } = await createDemoEnterprise({
      ipAddress: String(ip),
      userAgent: req.headers['user-agent'] || null,
    });
    const token = generateToken(user);
    const refreshToken = generateToken(user, true);
    setAuthCookies(res, token, refreshToken);
    return res.status(200).json(buildAuthPayload(user, entreprise));
  } catch (error) {
    console.error('Création de démonstration échouée:', error);
    return res.status(500).json({
      message: 'La démonstration n’a pas pu être créée. Réessayez dans quelques instants.',
    });
  }
});

router.post('/demo/reset', authMiddleware, async (req, res) => {
  try {
    const entrepriseId = Number(req.user?.entrepriseId);
    if (!Number.isSafeInteger(entrepriseId)) return res.status(401).json({ message: 'Session invalide.' });
    const [entreprise] = await db.select().from(entreprises)
      .where(and(eq(entreprises.id, entrepriseId), eq(entreprises.isDemo, true)))
      .limit(1);
    if (!entreprise) {
      return res.status(403).json({ message: 'Cette action est réservée aux démonstrations.' });
    }
    const deleted = await deleteEnterpriseData(entreprise.id, {
      motif: 'demo_reset', supprimePar: `utilisateur:${req.user.id}`, journal: false,
    });
    if (!deleted.deleted) {
      return res.status(500).json({ message: 'La démonstration n’a pas pu être réinitialisée.' });
    }
    const { entreprise: freshEntreprise, user: freshUser } = await createDemoEnterprise({
      ipAddress: req.headers['cf-connecting-ip'] || req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || null,
    });
    const token = generateToken(freshUser);
    const refreshToken = generateToken(freshUser, true);
    setAuthCookies(res, token, refreshToken);
    return res.status(200).json(buildAuthPayload(freshUser, freshEntreprise));
  } catch (error) {
    console.error('Réinitialisation de démonstration échouée:', error);
    return res.status(500).json({
      message: 'La démonstration n’a pas pu être réinitialisée. Réessayez dans quelques instants.',
    });
  }
});

router.post('/demo/quit', authMiddleware, async (req, res) => {
  try {
    const entrepriseId = Number(req.user?.entrepriseId);
    if (Number.isSafeInteger(entrepriseId)) {
      const [entreprise] = await db.select().from(entreprises)
        .where(and(eq(entreprises.id, entrepriseId), eq(entreprises.isDemo, true)))
        .limit(1);
      if (entreprise) {
        await deleteEnterpriseData(entreprise.id, {
          motif: 'demo_quittee', supprimePar: `utilisateur:${req.user.id}`, journal: false,
        });
      }
    }
  } catch (error) {
    console.error('Suppression de démonstration à la sortie échouée:', error);
  }
  clearAuthCookies(res);
  return res.status(200).json({ ok: true });
});

export default router;
