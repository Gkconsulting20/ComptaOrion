import { createHash, randomBytes } from 'node:crypto';
import { USER_MANAGEABLE_MODULES } from '../../../shared/access-policy.js';

export const ACCOUNTANT_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export function createAccountantInvitationToken() {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashAccountantInvitationToken(token) };
}

export function hashAccountantInvitationToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return createHash('sha256').update(token).digest('hex');
}

export function defaultAccountantInvitationPermissions() {
  return Object.fromEntries(USER_MANAGEABLE_MODULES.map(({ id }) => [
    id,
    id === 'parametres' ? 'none' : 'read',
  ]));
}

export function isInvitationPending(invitation, now = new Date()) {
  return invitation?.status === 'pending' &&
    invitation.expiresAt instanceof Date &&
    invitation.expiresAt.getTime() > now.getTime();
}

export function isInvitationAccepted(invitation) {
  return invitation?.status === 'accepted' &&
    invitation.acceptedUserId !== null &&
    invitation.acceptedUserId !== undefined &&
    Number.isSafeInteger(Number(invitation.acceptedUserId));
}

export function getInvitationDisplayStatus(invitation, user, now = new Date()) {
  if (!invitation) return 'none';
  if (invitation.status === 'revoked') return 'revoked';
  if (invitation.status === 'failed') return 'failed';
  if (isInvitationPending(invitation, now)) return 'pending';
  if (isInvitationAccepted(invitation)) return user?.actif ? 'accepted' : 'disabled';
  if (invitation.status === 'pending' && invitation.expiresAt instanceof Date &&
      invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  return invitation.status;
}

export function invitationCountsTowardSeat(user) {
  return Boolean(user?.actif) && !Boolean(user?.isExternalAccountant);
}
