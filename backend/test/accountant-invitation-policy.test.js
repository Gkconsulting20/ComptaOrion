import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccountantInvitationToken,
  defaultAccountantInvitationPermissions,
  getInvitationDisplayStatus,
  hashAccountantInvitationToken,
  invitationCountsTowardSeat,
  isInvitationPending,
  simulateAccountantInvitationFlow,
} from '../src/services/accountantInvitationPolicy.js';

test('creates a high-entropy invite token and stores only a deterministic hash', () => {
  const first = createAccountantInvitationToken();
  const second = createAccountantInvitationToken();

  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, first.tokenHash);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(hashAccountantInvitationToken(first.token), first.tokenHash);
  assert.equal(hashAccountantInvitationToken('invalid'), null);
});

test('new accountant invitations start with read-only access and no company settings', () => {
  const permissions = defaultAccountantInvitationPermissions();

  assert.equal(permissions.comptabilite, 'read');
  assert.equal(permissions.clients, 'read');
  assert.equal(permissions.audit, 'read');
  assert.equal(permissions.parametres, 'none');
  assert.ok(Object.values(permissions).every((level) => ['read', 'none'].includes(level)));
});

test('only active invitations within expiry are pending', () => {
  const now = new Date('2026-10-31T12:00:00.000Z');
  assert.equal(isInvitationPending({ status: 'pending', expiresAt: new Date('2026-11-01T12:00:00.000Z') }, now), true);
  assert.equal(isInvitationPending({ status: 'pending', expiresAt: new Date('2026-10-30T12:00:00.000Z') }, now), false);
  assert.equal(isInvitationPending({ status: 'revoked', expiresAt: new Date('2026-11-01T12:00:00.000Z') }, now), false);
  assert.equal(getInvitationDisplayStatus({
    status: 'pending',
    expiresAt: new Date('2026-10-30T12:00:00.000Z'),
  }, null, now), 'expired');
});

test('external accountant does not consume an ordinary subscription seat', () => {
  assert.equal(invitationCountsTowardSeat({ actif: true, isExternalAccountant: false }), true);
  assert.equal(invitationCountsTowardSeat({ actif: true, isExternalAccountant: true }), false);
  assert.equal(invitationCountsTowardSeat({ actif: false, isExternalAccountant: false }), false);
});

test('invitation simulation checks token, expiry and read-only defaults without side effects', () => {
  const simulation = simulateAccountantInvitationFlow(new Date('2026-10-31T12:00:00.000Z'));

  assert.equal(simulation.success, true);
  assert.equal(simulation.checks.length, 5);
  assert.ok(simulation.checks.every((check) => check.passed));
  assert.equal(simulation.checks.find((check) => check.id === 'no-side-effects').passed, true);
});
