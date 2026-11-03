import express from 'express';
import { db } from '../db.js';
import { users, entreprises, sessions, auditConnexions } from '../schema.js';
import { and, eq, gt, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import {
  generateToken,
  generateRefreshToken,
  comparePassword,
  verifyRefreshToken,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  authMiddleware,
} from '../auth.js';

const router = express.Router();

/**
 * POST /auth/register
 * Ancien parcours désactivé : la création publique passe par l’essai SaaS.
 */
router.post('/register', async (req, res) => {
  return res.status(410).json({
    error: 'Cette ancienne inscription est désactivée. Utilisez /inscription pour créer un essai gratuit de 30 jours.',
  });
});

/**
 * POST /auth/login
 * Connexion d'un utilisateur
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Trouver l'utilisateur
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si l'utilisateur est actif
    if (!user.actif) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Comparer le mot de passe
    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour la dernière connexion
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Récupérer les infos de l'entreprise
    const [entreprise] = await db
      .select()
      .from(entreprises)
      .where(eq(entreprises.id, user.entrepriseId));

    // Générer les tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.get('user-agent');
    const [session] = await db.insert(sessions).values({
      userId: user.id,
      enterpriseId: user.entrepriseId,
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      refreshTokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      ipAddress,
      userAgent,
      expiresAt
    }).returning();
    await db.insert(auditConnexions).values({
      userId: user.id,
      enterpriseId: user.entrepriseId,
      type: 'login',
      ipAddress,
      userAgent,
      statut: 'success'
    });
    setAuthCookies(res, token, refreshToken, '/api/auth');

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        entrepriseId: user.entrepriseId,
      },
      entreprise,
      session: { id: session.id, expiresAt },
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

/**
 * POST /auth/refresh
 * Rafraîchir le token d'accès
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = readCookie(req, REFRESH_TOKEN_COOKIE);

    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(400).json({ error: 'Refresh token requis' });
    }

    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }

    // Récupérer l'utilisateur
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id));

    if (!user || !user.actif) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Utilisateur introuvable ou inactif' });
    }

    const oldHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [session] = await db.select().from(sessions).where(and(
      eq(sessions.userId, user.id),
      eq(sessions.enterpriseId, user.entrepriseId),
      eq(sessions.refreshTokenHash, oldHash),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.logoutAt)
    )).limit(1);
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Session invalide ou expirée' });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await db.update(sessions).set({
      tokenHash: crypto.createHash('sha256').update(newToken).digest('hex'),
      refreshTokenHash: crypto.createHash('sha256').update(newRefreshToken).digest('hex')
    }).where(eq(sessions.id, session.id));
    setAuthCookies(res, newToken, newRefreshToken, '/api/auth');

    res.json({
      message: 'Session rafraîchie',
    });
  } catch (error) {
    console.error('Erreur lors du refresh:', error);
    res.status(500).json({ error: 'Erreur serveur lors du refresh' });
  }
});

/**
 * GET /auth/me
 * Récupérer les infos de l'utilisateur connecté
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Récupérer l'utilisateur
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Récupérer l'entreprise
    const [entreprise] = await db
      .select()
      .from(entreprises)
      .where(eq(entreprises.id, user.entrepriseId));

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        entrepriseId: user.entrepriseId,
      },
      entreprise,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
