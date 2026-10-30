import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users } from '../schema.js';
import { moduleAllowsAction, moduleForApiPath } from '../../../shared/access-policy.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function tenantAccessControl(req, res, next) {
  try {
    const userId = Number(req.user?.id);
    const entrepriseId = Number(req.entrepriseId);
    if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(entrepriseId)) {
      return res.status(401).json({ error: 'Session ou entreprise invalide.' });
    }

    // Recharger le rôle depuis la base rend les changements d’accès et les
    // désactivations effectifs dès la prochaine requête, sans attendre le JWT.
    const [currentUser] = await db.select({
      role: users.role,
      actif: users.actif,
      modulePermissions: users.modulePermissions,
    }).from(users).where(and(
      eq(users.id, userId),
      eq(users.entrepriseId, entrepriseId),
    )).limit(1);

    if (!currentUser?.actif) {
      return res.status(401).json({ error: 'Compte désactivé ou introuvable.' });
    }

    req.user.role = currentUser.role;
    const pathname = req.originalUrl?.split('?')[0] || req.path;
    const moduleId = moduleForApiPath(pathname);

    // Refuser par défaut les nouveaux endpoints non classés pour les rôles
    // autres qu’administrateur : ils doivent recevoir une règle explicite.
    if (!moduleId && currentUser.role === 'admin') {
      return next();
    }
    if (!moduleId || !moduleAllowsAction(currentUser.role, moduleId, 'read', currentUser.modulePermissions)) {
      return res.status(403).json({ error: 'Votre compte ne dispose pas d’un accès à ce module.' });
    }

    const action = READ_METHODS.has(req.method)
      ? 'read'
      : req.method === 'POST' ? 'create'
        : req.method === 'DELETE' ? 'delete'
          : req.method === 'PUT' || req.method === 'PATCH' ? 'update'
            : 'unknown';
    if (!moduleAllowsAction(currentUser.role, moduleId, action, currentUser.modulePermissions)) {
      return res.status(403).json({ error: 'Votre niveau d’accès ne permet pas cette opération dans ce module.' });
    }

    next();
  } catch (error) {
    console.error('Erreur de contrôle des accès utilisateur:', error);
    res.status(503).json({ error: 'Impossible de vérifier vos autorisations pour le moment.' });
  }
}
