import test from 'node:test';
import assert from 'node:assert/strict';
import {
  moduleAllowsAction,
  moduleForApiPath,
  roleCanAccessModule,
  roleCanWriteModule,
  resolveModulePermissions,
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

test('les droits personnalisés s’appliquent séparément à chaque module et opération', () => {
  const permissions = resolveModulePermissions('employee', {
    comptabilite: 'read',
    clients: 'manage',
    fournisseurs: 'none',
  });

  assert.equal(moduleAllowsAction('employee', 'comptabilite', 'read', permissions), true);
  assert.equal(moduleAllowsAction('employee', 'comptabilite', 'create', permissions), false);
  assert.equal(moduleAllowsAction('employee', 'clients', 'delete', permissions), true);
  assert.equal(moduleAllowsAction('employee', 'fournisseurs', 'read', permissions), false);
  assert.equal(moduleAllowsAction('employee', 'integrations', 'read', { integrations: 'manage' }), false);
});

test('un accès de saisie ne permet pas la suppression', () => {
  const permissions = resolveModulePermissions('viewer', { stock: 'write' });
  assert.equal(moduleAllowsAction('viewer', 'stock', 'read', permissions), true);
  assert.equal(moduleAllowsAction('viewer', 'stock', 'create', permissions), true);
  assert.equal(moduleAllowsAction('viewer', 'stock', 'update', permissions), true);
  assert.equal(moduleAllowsAction('viewer', 'stock', 'delete', permissions), false);
});

test('les routes API sont classées dans leur module avant contrôle des droits', () => {
  assert.equal(moduleForApiPath('/api/factures/123'), 'clients');
  assert.equal(moduleForApiPath('/api/commandes-achat'), 'fournisseurs');
  assert.equal(moduleForApiPath('/api/user-management'), 'users');
  assert.equal(moduleForApiPath('/api/unknown-feature'), null);
});
