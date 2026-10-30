import express from 'express';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db.js';
import { abonnements, plansAbonnement, sessions, users } from '../schema.js';
import { requireRole, hashPassword } from '../auth.js';
import { logAudit } from '../utils/auditLogger.js';
import {
  MODULE_PERMISSION_LEVELS,
  ROLE_ACCESS_PROFILES,
  USER_MANAGEABLE_MODULES,
  resolveModulePermissions,
} from '../../../shared/access-policy.js';

const router = express.Router();
const VALID_ROLES = new Set(Object.keys(ROLE_ACCESS_PROFILES));
const VALID_PERMISSION_LEVELS = new Set(MODULE_PERMISSION_LEVELS.map(({ value }) => value));
const VALID_PERMISSION_MODULES = new Set(USER_MANAGEABLE_MODULES.map(({ id }) => id));
const DEFAULT_USER_LIMIT = 3;

const safeUserFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  nom: users.nom,
  prenom: users.prenom,
  role: users.role,
  modulePermissions: users.modulePermissions,
  actif: users.actif,
  lastLogin: users.lastLogin,
  createdAt: users.createdAt,
};

function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
    modulePermissions: resolveModulePermissions(user.role, user.modulePermissions),
    actif: user.actif,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

function normalizeModulePermissions(role, modulePermissions) {
  if (modulePermissions !== undefined &&
      (!modulePermissions || typeof modulePermissions !== 'object' || Array.isArray(modulePermissions))) {
    throw new Error('INVALID_MODULE_PERMISSIONS');
  }
  for (const [moduleId, level] of Object.entries(modulePermissions || {})) {
    if (!VALID_PERMISSION_MODULES.has(moduleId) || !VALID_PERMISSION_LEVELS.has(level)) {
      throw new Error('INVALID_MODULE_PERMISSIONS');
    }
  }
  return resolveModulePermissions(role, modulePermissions);
}

async function getUserLimit(executor, entrepriseId) {
  const [plan] = await executor.select({
    limit: plansAbonnement.limiteUtilisateurs,
  }).from(abonnements)
    .innerJoin(plansAbonnement, eq(abonnements.planId, plansAbonnement.id))
    .where(and(
      eq(abonnements.entrepriseId, entrepriseId),
      eq(abonnements.statut, 'actif'),
    ))
    .limit(1);
  const limit = Number(plan?.limit);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : DEFAULT_USER_LIMIT;
}

async function getActiveUserCount(executor, entrepriseId) {
  const [result] = await executor.select({ value: count() }).from(users).where(and(
    eq(users.entrepriseId, entrepriseId),
    eq(users.actif, true),
  ));
  return Number(result?.value || 0);
}

async function syncSubscriptionUserCount(executor, entrepriseId, activeUserCount) {
  await executor.update(abonnements).set({
    nombreUtilisateurs: activeUserCount,
    updatedAt: new Date(),
  }).where(and(
    eq(abonnements.entrepriseId, entrepriseId),
    eq(abonnements.statut, 'actif'),
  ));
}

function auditRequest(req) {
  return {
    entrepriseId: req.entrepriseId,
    userId: req.user.id,
    ipAddress: req.get('cf-connecting-ip') || req.ip || null,
    userAgent: req.get('user-agent') || null,
    required: true,
  };
}

router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const [usersInCompany, activeUsers, userLimit] = await Promise.all([
      db.select(safeUserFields).from(users)
        .where(eq(users.entrepriseId, req.entrepriseId))
        .orderBy(desc(users.createdAt)),
      getActiveUserCount(db, req.entrepriseId),
      getUserLimit(db, req.entrepriseId),
    ]);

    res.json({
      users: usersInCompany.map(toSafeUser),
      activeUsers,
      userLimit,
      roles: Object.entries(ROLE_ACCESS_PROFILES).map(([value, profile]) => ({
        value,
        label: profile.label,
        description: profile.description,
      })),
      modules: USER_MANAGEABLE_MODULES,
      permissionLevels: MODULE_PERMISSION_LEVELS,
    });
  } catch (error) {
    console.error('Erreur de chargement des utilisateurs entreprise:', error);
    res.status(500).json({ error: 'Impossible de charger les utilisateurs.' });
  }
});

router.post('/', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const nom = String(req.body?.nom || '').trim() || null;
  const prenom = String(req.body?.prenom || '').trim() || null;
  const role = String(req.body?.role || 'employee');

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Nom d’utilisateur, courriel et mot de passe sont obligatoires.' });
  }
  if (username.length > 100 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Le nom d’utilisateur ou le courriel n’est pas valide.' });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: 'Le mot de passe initial doit contenir au moins 12 caractères.' });
  }
  if (!VALID_ROLES.has(role)) {
    return res.status(400).json({ error: 'Rôle utilisateur invalide.' });
  }
  let modulePermissions;
  try {
    modulePermissions = normalizeModulePermissions(role, req.body?.modulePermissions);
  } catch {
    return res.status(400).json({ error: 'Les droits par module transmis ne sont pas valides.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await db.transaction(async (tx) => {
      const activeUsers = await getActiveUserCount(tx, req.entrepriseId);
      const userLimit = await getUserLimit(tx, req.entrepriseId);
      if (activeUsers >= userLimit) {
        const limitError = new Error('USER_LIMIT_REACHED');
        limitError.code = 'USER_LIMIT_REACHED';
        throw limitError;
      }

      const [created] = await tx.insert(users).values({
        entrepriseId: req.entrepriseId,
        username,
        email,
        passwordHash,
        nom,
        prenom,
        role,
        modulePermissions,
        actif: true,
      }).returning(safeUserFields);

      await syncSubscriptionUserCount(tx, req.entrepriseId, activeUsers + 1);
      await logAudit({
        ...auditRequest(req),
        executor: tx,
        action: 'CREATE',
        table: 'users',
        recordId: created.id,
        nouvelleValeur: {
          username: created.username,
          email: created.email,
          nom: created.nom,
          prenom: created.prenom,
          role: created.role,
          modulePermissions,
          actif: created.actif,
        },
        description: `Création du compte utilisateur ${created.email}`,
      });
      return { created, activeUsers: activeUsers + 1, userLimit };
    });

    res.status(201).json({
      user: toSafeUser(result.created),
      activeUsers: result.activeUsers,
      userLimit: result.userLimit,
      message: 'Utilisateur créé. Transmettez son mot de passe initial par un canal privé.',
    });
  } catch (error) {
    if (error.code === 'USER_LIMIT_REACHED') {
      return res.status(409).json({ error: 'La limite d’utilisateurs de votre forfait est atteinte.' });
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce nom d’utilisateur ou ce courriel est déjà utilisé.' });
    }
    console.error('Erreur de création utilisateur:', error);
    res.status(500).json({ error: 'Impossible de créer cet utilisateur.' });
  }
});

router.put('/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
  }

  const requestedRole = req.body?.role;
  const requestedActive = req.body?.actif;
  if (requestedRole !== undefined && !VALID_ROLES.has(requestedRole)) {
    return res.status(400).json({ error: 'Rôle utilisateur invalide.' });
  }
  if (requestedActive !== undefined && typeof requestedActive !== 'boolean') {
    return res.status(400).json({ error: 'Le statut actif doit être vrai ou faux.' });
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select(safeUserFields).from(users).where(and(
        eq(users.id, userId),
        eq(users.entrepriseId, req.entrepriseId),
      )).limit(1);
      if (!current) return { missing: true };

      const nextRole = requestedRole ?? current.role;
      const nextActive = requestedActive ?? current.actif;
      if (Number(current.id) === Number(req.user.id) && (nextRole !== 'admin' || !nextActive)) {
        return { selfLockout: true };
      }

      if (!current.actif && nextActive) {
        const activeUsers = await getActiveUserCount(tx, req.entrepriseId);
        const userLimit = await getUserLimit(tx, req.entrepriseId);
        if (activeUsers >= userLimit) return { limitReached: true };
      }

      if (current.actif && current.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
        const [adminCountRow] = await tx.select({ value: count() }).from(users).where(and(
          eq(users.entrepriseId, req.entrepriseId),
          eq(users.role, 'admin'),
          eq(users.actif, true),
        ));
        if (Number(adminCountRow?.value || 0) <= 1) return { lastAdmin: true };
      }

      const patch = {
        role: nextRole,
        actif: nextActive,
        updatedAt: new Date(),
      };
      let nextModulePermissions;
      try {
        nextModulePermissions = req.body?.modulePermissions !== undefined
          ? normalizeModulePermissions(nextRole, req.body.modulePermissions)
          : nextRole !== current.role
            ? normalizeModulePermissions(nextRole)
            : resolveModulePermissions(current.role, current.modulePermissions);
      } catch {
        return { invalidModulePermissions: true };
      }
      patch.modulePermissions = nextModulePermissions;
      if (req.body?.nom !== undefined) {
        patch.nom = String(req.body.nom || '').trim() || null;
        if (patch.nom?.length > 100) return { invalidName: true };
      }
      if (req.body?.prenom !== undefined) {
        patch.prenom = String(req.body.prenom || '').trim() || null;
        if (patch.prenom?.length > 100) return { invalidName: true };
      }
      if (req.body?.email !== undefined) {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return { invalidEmail: true };
        }
        patch.email = email;
      }
      if (req.body?.username !== undefined) {
        const username = String(req.body.username || '').trim();
        if (!username || username.length > 100) return { invalidUsername: true };
        patch.username = username;
      }

      const [saved] = await tx.update(users).set(patch).where(and(
        eq(users.id, userId),
        eq(users.entrepriseId, req.entrepriseId),
      )).returning(safeUserFields);

      const permissionsChanged = JSON.stringify(resolveModulePermissions(current.role, current.modulePermissions)) !==
        JSON.stringify(nextModulePermissions);
      if (current.role !== nextRole || current.actif !== nextActive || permissionsChanged) {
        await tx.update(sessions).set({ logoutAt: new Date() }).where(and(
          eq(sessions.userId, userId),
          eq(sessions.enterpriseId, req.entrepriseId),
          isNull(sessions.logoutAt),
        ));
      }

      const activeUsers = await getActiveUserCount(tx, req.entrepriseId);
      await syncSubscriptionUserCount(tx, req.entrepriseId, activeUsers);
      await logAudit({
        ...auditRequest(req),
        executor: tx,
        action: 'UPDATE',
        table: 'users',
        recordId: saved.id,
        ancienneValeur: {
          username: current.username,
          email: current.email,
          nom: current.nom,
          prenom: current.prenom,
          role: current.role,
          modulePermissions: resolveModulePermissions(current.role, current.modulePermissions),
          actif: current.actif,
        },
        nouvelleValeur: {
          username: saved.username,
          email: saved.email,
          nom: saved.nom,
          prenom: saved.prenom,
          role: saved.role,
          modulePermissions: nextModulePermissions,
          actif: saved.actif,
        },
        description: `Modification des accès de ${saved.email}`,
      });
      return { user: saved, activeUsers };
    });

    if (updated.missing) return res.status(404).json({ error: 'Utilisateur introuvable dans votre entreprise.' });
    if (updated.selfLockout) return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle administrateur.' });
    if (updated.lastAdmin) return res.status(409).json({ error: 'L’entreprise doit conserver au moins un administrateur actif.' });
    if (updated.limitReached) return res.status(409).json({ error: 'La limite d’utilisateurs de votre forfait est atteinte.' });
    if (updated.invalidModulePermissions) return res.status(400).json({ error: 'Les droits par module transmis ne sont pas valides.' });
    if (updated.invalidEmail) return res.status(400).json({ error: 'Adresse courriel invalide.' });
    if (updated.invalidUsername) return res.status(400).json({ error: 'Nom d’utilisateur invalide.' });
    if (updated.invalidName) return res.status(400).json({ error: 'Le prénom ou le nom dépasse 100 caractères.' });

    res.json({ user: toSafeUser(updated.user), activeUsers: updated.activeUsers });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce nom d’utilisateur ou ce courriel est déjà utilisé.' });
    }
    console.error('Erreur de modification utilisateur:', error);
    res.status(500).json({ error: 'Impossible de modifier cet utilisateur.' });
  }
});

export default router;
