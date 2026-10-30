import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moduleForApiPath,
  roleCanAccessModule,
  roleCanWriteModule,
} from '../../shared/access-policy.js';

test('les profils de rôle limitent les modules métier côté serveur', () => {
  assert.equal(roleCanAccessModule('admin', 'users'), true);
  assert.equal(roleCanAccessModule('employee', 'clients'), true);
  assert.equal(roleCanAccessModule('employee', 'comptabilite'), false);
  assert.equal(roleCanAccessModule('accountant', 'comptabilite'), true);
  assert.equal(roleCanAccessModule('manager', 'integrations'), false);
});

test('le rôle lecture seule ne peut modifier aucun module', () => {
  assert.equal(roleCanAccessModule('viewer', 'comptabilite'), true);
  assert.equal(roleCanWriteModule('viewer', 'comptabilite'), false);
  assert.equal(roleCanWriteModule('employee', 'clients'), true);
});

test('les routes API sont classées dans leur module avant contrôle des droits', () => {
  assert.equal(moduleForApiPath('/api/factures/123'), 'clients');
  assert.equal(moduleForApiPath('/api/commandes-achat'), 'fournisseurs');
  assert.equal(moduleForApiPath('/api/user-management'), 'users');
  assert.equal(moduleForApiPath('/api/unknown-feature'), null);
});
