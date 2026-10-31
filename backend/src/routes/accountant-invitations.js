import express from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db.js';
import {
  accountantInvitations,
  entreprises,
  sessions,
  users,
} from '../schema.js';
import { hashPassword, requireRole } from '../auth.js';
import emailService from '../services/emailService.js';
import {
  ACCOUNTANT_INVITATION_TTL_MS,
  createAccountantInvitationToken,
  defaultAccountantInvitationPermissions,
  getInvitationDisplayStatus,
  hashAccountantInvitationToken,
} from '../services/accountantInvitationPolicy.js';
import { logAudit } from '../utils/auditLogger.js';
import { withTenantTransaction } from '../utils/rlsPolicies.js';

export const companyAccountantInvitationRoutes = express.Router();
export const publicAccountantInvitationRoutes = express.Router();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function invitationBaseUrl(req) {
  const configuredUrl = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL;
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== 'https:' &&
        !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
      throw new Error('PUBLIC_APP_URL doit utiliser HTTPS en production.');
    }
    return parsed.origin;
  }

  if (process.env.NODE_ENV === 'production') return 'https://comptaorion.com';

  const host = String(req.get('host') || '').toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  if (/^[a-z0-9.-]+\.replit\.dev(?::\d+)?$/.test(host)) return `https://${host}`;
  if (/^[a-z0-9.-]+\.workers\.dev(?::\d+)?$/.test(host)) return `https://${host}`;
  if (/^(www\.)?comptaorion\.com(?::\d+)?$/.test(host)) return `https://${host}`;
  throw new Error('Configurez PUBLIC_APP_URL pour générer le lien d’invitation.');
}

function requestAudit(req) {
  return {
    entrepriseId: req.entrepriseId,
    userId: req.user.id,
    ipAddress: req.get('cf-connecting-ip') || req.ip || null,
    userAgent: req.get('user-agent') || null,
    required: true,
  };
}

async function latestInvitation(executor, entrepriseId) {
  const [invitation] = await executor.select().from(accountantInvitations)
    .where(eq(accountantInvitations.entrepriseId, entrepriseId))
    .orderBy(desc(accountantInvitations.createdAt))
    .limit(1);
  return invitation || null;
}

companyAccountantInvitationRoutes.use(requireRole('admin'));

companyAccountantInvitationRoutes.get('/', async (req, res) => {
  try {
    const invitation = await latestInvitation(db, req.entrepriseId);
    if (!invitation) return res.json({ status: 'none' });

    const [account] = invitation.acceptedUserId
      ? await db.select({
        id: users.id,
        actif: users.actif,
        email: users.email,
        prenom: users.prenom,
        nom: users.nom,
      }).from(users).where(and(
        eq(users.id, invitation.acceptedUserId),
        eq(users.entrepriseId, req.entrepriseId),
        eq(users.isExternalAccountant, true),
      )).limit(1)
      : [];

    return res.json({
      status: getInvitationDisplayStatus(invitation, account),
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      account: account ? {
        email: account.email,
        name: [account.prenom, account.nom].filter(Boolean).join(' ') || null,
      } : null,
    });
  } catch (error) {
    console.error('Erreur de lecture de l’invitation comptable:', error);
    return res.status(500).json({ error: 'Impossible de charger l’accès du cabinet comptable.' });
  }
});

companyAccountantInvitationRoutes.post('/', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Saisissez une adresse courriel valide.' });
  }
  if (!emailService.enabled) {
    return res.status(503).json({ error: 'L’envoi des invitations est indisponible. Contactez l’administrateur.' });
  }

  try {
    let baseUrl;
    try {
      baseUrl = invitationBaseUrl(req);
    } catch (configurationError) {
      return res.status(503).json({ error: configurationError.message });
    }

    const previous = await latestInvitation(db, req.entrepriseId);
    const now = new Date();
    const previousStatus = getInvitationDisplayStatus(previous, null, now);
    if (previousStatus === 'pending' || previousStatus === 'accepted' || previousStatus === 'disabled') {
      return res.status(409).json({
        error: 'Un accès comptable est déjà actif ou en attente. Révoquez-le avant d’en créer un autre.',
      });
    }

    const [existingUser] = await db.select({
      id: users.id,
      entrepriseId: users.entrepriseId,
      isExternalAccountant: users.isExternalAccountant,
      actif: users.actif,
    }).from(users).where(sql`LOWER(${users.email}) = ${email}`).limit(1);
    const canReinviteSamePerson = Boolean(existingUser?.isExternalAccountant) &&
      Number(existingUser.entrepriseId) === Number(req.entrepriseId) &&
      !existingUser.actif &&
      previous?.status === 'revoked';
    if (existingUser && !canReinviteSamePerson) {
      return res.status(409).json({
        error: 'Cette adresse est déjà utilisée. Cette première version utilise un compte distinct par entreprise.',
      });
    }

    const { token, tokenHash } = createAccountantInvitationToken();
    const expiresAt = new Date(now.getTime() + ACCOUNTANT_INVITATION_TTL_MS);
    if (previous?.status === 'pending') {
      await db.update(accountantInvitations).set({ status: 'expired' }).where(and(
        eq(accountantInvitations.tokenHash, previous.tokenHash),
        eq(accountantInvitations.entrepriseId, req.entrepriseId),
        eq(accountantInvitations.status, 'pending'),
      ));
    }

    const [invitation] = await db.insert(accountantInvitations).values({
      tokenHash,
      entrepriseId: req.entrepriseId,
      invitedByUserId: req.user.id,
      email,
      status: 'pending',
      expiresAt,
    }).returning();

    const [company] = await db.select({ nom: entreprises.nom }).from(entreprises)
      .where(eq(entreprises.id, req.entrepriseId)).limit(1);
    const inviteUrl = new URL('/invitation-comptable', baseUrl);
    inviteUrl.searchParams.set('token', token);
    const companyName = escapeHtml(company?.nom || 'votre entreprise');
    const invitationHtml = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#243447">
        <h2>Invitation comptable — ComptaOrion</h2>
        <p>L’entreprise <strong>${companyName}</strong> vous invite à consulter sa comptabilité dans ComptaOrion.</p>
        <p>Cette invitation est personnelle, valable 72 heures et limitée aux données de cette entreprise.</p>
        <p><a href="${escapeHtml(inviteUrl.toString())}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:#17324d;color:#fff;text-decoration:none">Accepter l’invitation</a></p>
        <p>À l’acceptation, vous choisirez vous-même votre mot de passe. Ne transférez pas ce lien.</p>
      </div>`;
    await logAudit({
      ...requestAudit(req),
      action: 'CREATE',
      table: 'accountant_invitations',
      description: `Création et tentative d’envoi d’une invitation comptable (${email})`,
      nouvelleValeur: { email, expiresAt, status: 'pending' },
    });
    const emailResult = await emailService.sendEmail({
      to: email,
      subject: `Invitation comptable de ${company?.nom || 'votre client'} sur ComptaOrion`,
      html: invitationHtml,
      entrepriseId: req.entrepriseId,
      userId: req.user.id,
      typeEmail: 'invitation_comptable',
    });

    if (!emailResult.success) {
      await db.update(accountantInvitations).set({ status: 'failed' }).where(and(
        eq(accountantInvitations.tokenHash, invitation.tokenHash),
        eq(accountantInvitations.entrepriseId, req.entrepriseId),
      ));
      await logAudit({
        ...requestAudit(req),
        action: 'UPDATE',
        table: 'accountant_invitations',
        description: `Échec d’envoi de l’invitation comptable (${email})`,
        ancienneValeur: { email, status: 'pending' },
        nouvelleValeur: { email, status: 'failed' },
      });
      return res.status(502).json({ error: 'Le courriel d’invitation n’a pas pu être envoyé.' });
    }

    return res.status(201).json({
      status: 'pending',
      email,
      expiresAt,
      message: 'Invitation envoyée. Le cabinet doit l’accepter dans les 72 heures.',
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Un accès comptable est déjà actif ou en attente pour cette entreprise.' });
    }
    console.error('Erreur d’envoi de l’invitation comptable:', error);
    return res.status(500).json({ error: 'Impossible d’envoyer l’invitation comptable.' });
  }
});

companyAccountantInvitationRoutes.delete('/', async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      const invitation = await latestInvitation(tx, req.entrepriseId);
      if (!invitation || !['pending', 'accepted'].includes(invitation.status)) return { missing: true };

      await tx.update(accountantInvitations).set({
        status: 'revoked',
        revokedAt: new Date(),
      }).where(and(
        eq(accountantInvitations.tokenHash, invitation.tokenHash),
        eq(accountantInvitations.entrepriseId, req.entrepriseId),
      ));

      if (invitation.acceptedUserId) {
        await tx.update(users).set({ actif: false, updatedAt: new Date() }).where(and(
          eq(users.id, invitation.acceptedUserId),
          eq(users.entrepriseId, req.entrepriseId),
          eq(users.isExternalAccountant, true),
        ));
        await tx.update(sessions).set({ logoutAt: new Date() }).where(and(
          eq(sessions.userId, invitation.acceptedUserId),
          eq(sessions.enterpriseId, req.entrepriseId),
          isNull(sessions.logoutAt),
        ));
      }

      await logAudit({
        ...requestAudit(req),
        executor: tx,
        action: 'UPDATE',
        table: 'accountant_invitations',
        description: `Révocation de l’accès du cabinet comptable (${invitation.email})`,
        ancienneValeur: { email: invitation.email, status: invitation.status },
        nouvelleValeur: { email: invitation.email, status: 'revoked' },
      });
      return { revoked: true, email: invitation.email };
    });

    if (result.missing) return res.status(404).json({ error: 'Aucune invitation active à révoquer.' });
    return res.json({ status: 'revoked', message: 'L’accès du cabinet a été révoqué.' });
  } catch (error) {
    console.error('Erreur de révocation de l’accès comptable:', error);
    return res.status(500).json({ error: 'Impossible de révoquer l’accès comptable.' });
  }
});

publicAccountantInvitationRoutes.get('/accountant-invitations/:token', async (req, res) => {
  const tokenHash = hashAccountantInvitationToken(req.params.token);
  if (!tokenHash) return res.status(404).json({ error: 'Invitation invalide ou expirée.' });

  try {
    const [invite] = await db.select({
      tokenHash: accountantInvitations.tokenHash,
      entrepriseId: accountantInvitations.entrepriseId,
      email: accountantInvitations.email,
      status: accountantInvitations.status,
      expiresAt: accountantInvitations.expiresAt,
    }).from(accountantInvitations).where(eq(accountantInvitations.tokenHash, tokenHash)).limit(1);
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invitation invalide, déjà utilisée ou révoquée.' });
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ error: 'Cette invitation a expiré. Demandez à l’entreprise de la renvoyer.' });
    }

    const result = await withTenantTransaction(invite.entrepriseId, async (tx) => {
      const [company] = await tx.select({ nom: entreprises.nom }).from(entreprises)
        .where(eq(entreprises.id, invite.entrepriseId)).limit(1);
      return { companyName: company?.nom || 'ComptaOrion' };
    });
    return res.json({
      email: invite.email,
      entreprise: result.companyName,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error('Erreur de vérification du lien comptable:', error);
    return res.status(500).json({ error: 'Impossible de vérifier cette invitation.' });
  }
});

publicAccountantInvitationRoutes.post('/accountant-invitations/accept', async (req, res) => {
  const tokenHash = hashAccountantInvitationToken(req.body?.token);
  const username = String(req.body?.username || '').trim();
  const nom = String(req.body?.nom || '').trim() || null;
  const prenom = String(req.body?.prenom || '').trim() || null;
  const password = String(req.body?.password || '');

  if (!tokenHash) return res.status(400).json({ error: 'Invitation invalide ou expirée.' });
  if (!username || username.length > 100) {
    return res.status(400).json({ error: 'Saisissez un nom d’utilisateur valide.' });
  }
  if (password.length < 12) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 12 caractères.' });
  }

  try {
    const [candidate] = await db.select({
      entrepriseId: accountantInvitations.entrepriseId,
    }).from(accountantInvitations).where(eq(accountantInvitations.tokenHash, tokenHash)).limit(1);
    if (!candidate) return res.status(404).json({ error: 'Invitation invalide ou expirée.' });

    const passwordHash = await hashPassword(password);
    const result = await withTenantTransaction(candidate.entrepriseId, async (tx) => {
      const [invite] = await tx.select().from(accountantInvitations)
        .where(and(
          eq(accountantInvitations.tokenHash, tokenHash),
          eq(accountantInvitations.entrepriseId, candidate.entrepriseId),
        ))
        .for('update')
        .limit(1);
      if (!invite || invite.status !== 'pending') return { invalid: true };
      if (invite.expiresAt.getTime() <= Date.now()) return { expired: true };

      const [existing] = await tx.select({
        id: users.id,
        entrepriseId: users.entrepriseId,
        isExternalAccountant: users.isExternalAccountant,
        actif: users.actif,
        role: users.role,
        modulePermissions: users.modulePermissions,
      }).from(users)
        .where(sql`LOWER(${users.email}) = ${invite.email}`)
        .limit(1);
      if (existing && (
        !existing.isExternalAccountant ||
        Number(existing.entrepriseId) !== Number(invite.entrepriseId) ||
        existing.actif
      )) return { emailUsed: true };

      const modulePermissions = defaultAccountantInvitationPermissions();
      const [user] = existing
        ? await tx.update(users).set({
          username,
          passwordHash,
          role: 'accountant',
          modulePermissions,
          actif: true,
          nom,
          prenom,
          updatedAt: new Date(),
        }).where(and(
          eq(users.id, existing.id),
          eq(users.entrepriseId, invite.entrepriseId),
          eq(users.isExternalAccountant, true),
          eq(users.actif, false),
        )).returning({
          id: users.id,
          email: users.email,
          username: users.username,
        })
        : await tx.insert(users).values({
          entrepriseId: invite.entrepriseId,
          username,
          email: invite.email,
          passwordHash,
          role: 'accountant',
          modulePermissions,
          isExternalAccountant: true,
          actif: true,
          nom,
          prenom,
        }).returning({
          id: users.id,
          email: users.email,
          username: users.username,
        });
      if (!user) return { emailUsed: true };
      if (existing) {
        await tx.update(sessions).set({ logoutAt: new Date() }).where(and(
          eq(sessions.userId, existing.id),
          eq(sessions.enterpriseId, invite.entrepriseId),
          isNull(sessions.logoutAt),
        ));
      }

      await tx.update(accountantInvitations).set({
        status: 'accepted',
        acceptedUserId: user.id,
        acceptedAt: new Date(),
      }).where(and(
        eq(accountantInvitations.tokenHash, tokenHash),
        eq(accountantInvitations.entrepriseId, invite.entrepriseId),
        eq(accountantInvitations.status, 'pending'),
      ));

      await logAudit({
        executor: tx,
        entrepriseId: invite.entrepriseId,
        userId: user.id,
        action: existing ? 'UPDATE' : 'CREATE',
        table: 'users',
        recordId: user.id,
        ancienneValeur: existing ? {
          role: existing.role,
          actif: existing.actif,
          modulePermissions: existing.modulePermissions,
        } : null,
        nouvelleValeur: {
          username: user.username,
          email: user.email,
          role: 'accountant',
          isExternalAccountant: true,
          modulePermissions,
        },
        description: `Acceptation de l’invitation du cabinet comptable (${user.email})`,
        ipAddress: req.get('cf-connecting-ip') || req.ip || null,
        userAgent: req.get('user-agent') || null,
        required: true,
      });
      return { user };
    });

    if (result.invalid) return res.status(404).json({ error: 'Invitation invalide ou déjà utilisée.' });
    if (result.expired) return res.status(410).json({ error: 'Cette invitation a expiré.' });
    if (result.emailUsed) return res.status(409).json({ error: 'Cette adresse courriel possède déjà un compte ComptaOrion.' });
    return res.status(201).json({
      message: 'Invitation acceptée. Connectez-vous avec votre adresse courriel et le mot de passe choisi.',
      email: result.user.email,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ce nom d’utilisateur ou cette adresse courriel est déjà utilisé.' });
    }
    console.error('Erreur d’acceptation de l’invitation comptable:', error);
    return res.status(500).json({ error: 'Impossible d’accepter cette invitation.' });
  }
});

