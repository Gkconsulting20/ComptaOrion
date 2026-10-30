import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// Clés secrètes OBLIGATOIRES - Pas de fallback pour sécurité maximale
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error('❌ ERREUR FATALE: JWT_SECRET et JWT_REFRESH_SECRET doivent être définis.');
  console.error('❌ Définir ces variables d\'environnement avant de démarrer le serveur.');
  console.error('❌ Exemple: JWT_SECRET=votre_secret_super_securise');
  process.exit(1); // Arrêter le serveur si les secrets ne sont pas configurés
}

const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';
export const ACCESS_TOKEN_COOKIE = 'comptaorion_access';
export const REFRESH_TOKEN_COOKIE = 'comptaorion_refresh';

function cookieFlags(path, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const prefix = `${name}=`;
  const part = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return null;
  }
}

export function setAuthCookies(res, accessToken, refreshToken, refreshPath = '/api/auth-security') {
  res.append('Set-Cookie', [
    `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(accessToken)}; ${cookieFlags('/', 86400)}`,
    `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refreshToken)}; ${cookieFlags(refreshPath, 604800)}`
  ]);
}

export function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', [
    `${ACCESS_TOKEN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`,
    `${REFRESH_TOKEN_COOKIE}=; Path=/api/auth-security; Max-Age=0; HttpOnly; SameSite=Strict${secure}`,
    `${REFRESH_TOKEN_COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Strict${secure}`
  ]);
}

/**
 * Génère un token JWT pour un utilisateur
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    entrepriseId: user.entrepriseId,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Génère un refresh token
 */
export function generateRefreshToken(user) {
  const payload = {
    id: user.id,
    entrepriseId: user.entrepriseId,
    jti: randomUUID(),
  };
  
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

/**
 * Vérifie un token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie un refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Hash un mot de passe
 */
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare un mot de passe avec son hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware d'authentification
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : readCookie(req, ACCESS_TOKEN_COOKIE);

  if (!token) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }

  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
  
  // Ajouter les infos utilisateur à la requête
  req.user = decoded;
  next();
}

/**
 * Middleware pour vérifier les permissions (RBAC)
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }
    
    next();
  };
}

/**
 * Middleware pour isoler les données par entreprise (Row Level Security)
 */
export function entrepriseIsolation(req, res, next) {
  const tenantId = Number(req.user?.entrepriseId);
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
    return res.status(401).json({ error: 'Entreprise non identifiée' });
  }

  // Le tenant vient uniquement du jeton signé. Normaliser l'ID évite les
  // comparaisons ambiguës entre nombres et chaînes dans les filtres Drizzle.
  req.entrepriseId = tenantId;
  req.userId = req.user.id;

  // Certains anciens handlers lisent encore les champs de tenant dans les
  // entrées. Les remplacer aussi dans les objets imbriqués évite qu'un payload
  // de lot transporte l'identifiant d'une autre entreprise.
  const overwriteTenantFields = (value, setRootTenant = false) => {
    if (!value || typeof value !== 'object') return;
    const visited = new WeakSet();
    const stack = [value];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== 'object' || visited.has(current)) continue;
      visited.add(current);
      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) continue;
      if (setRootTenant || Object.hasOwn(current, 'entrepriseId')) {
        current.entrepriseId = tenantId;
      }
      stack.push(...Object.values(current));
    }
  };

  if (req.query && typeof req.query === 'object') {
    overwriteTenantFields(req.query, true);
  }
  if (req.body && typeof req.body === 'object') {
    const bodyIsObject = !Array.isArray(req.body);
    if (bodyIsObject) req.body.userId = req.userId;
    overwriteTenantFields(req.body, bodyIsObject);
  }
  if (req.params && typeof req.params === 'object') {
    if (Object.hasOwn(req.params, 'entrepriseId')) req.params.entrepriseId = tenantId;
    if (Object.hasOwn(req.params, 'userId')) req.params.userId = req.userId;
  }
  next();
}

/**
 * Middleware pour routes SaaS Admin - nécessite role admin et bypass entrepriseIsolation
 */
export function saasAdminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  
  // Les données SaaS sont globales : seul l'administrateur de la plateforme
  // (entreprise ComptaOrion) peut les consulter ou les modifier.
  if (req.user.role !== 'admin' || Number(req.user.entrepriseId) !== 1) {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur principal de ComptaOrion.' });
  }
  
  next();
}
