export const ROLE_ACCESS_PROFILES = {
  admin: {
    label: 'Administrateur',
    description: 'Accès complet à l’entreprise et gestion des utilisateurs.',
    modules: '*',
    writeModules: '*',
  },
  manager: {
    label: 'Gestionnaire',
    description: 'Accès aux opérations courantes, sans administration ni intégrations.',
    modules: [
      'dashboard', 'clients', 'fournisseurs', 'tresorerie', 'stock',
      'comptabilite', 'associations', 'impots', 'depenses', 'audit', 'documents',
    ],
    writeModules: [
      'clients', 'fournisseurs', 'tresorerie', 'stock', 'comptabilite',
      'associations', 'impots', 'depenses', 'documents',
    ],
  },
  accountant: {
    label: 'Comptable',
    description: 'Accès à la comptabilité, aux dépenses, à la trésorerie et aux taxes.',
    modules: [
      'dashboard', 'clients', 'fournisseurs', 'tresorerie', 'stock',
      'comptabilite', 'associations', 'impots', 'depenses', 'audit',
    ],
    writeModules: ['tresorerie', 'comptabilite', 'associations', 'impots', 'depenses'],
  },
  employee: {
    label: 'Employé',
    description: 'Accès aux clients, aux ventes et au stock.',
    modules: ['dashboard', 'clients', 'stock', 'documents'],
    writeModules: ['clients', 'stock', 'documents'],
  },
  viewer: {
    label: 'Lecture seule',
    description: 'Consultation des modules métier, sans création ni modification.',
    modules: [
      'dashboard', 'clients', 'fournisseurs', 'tresorerie', 'stock',
      'comptabilite', 'associations', 'impots', 'depenses', 'audit',
    ],
    writeModules: [],
  },
};

export const USER_MANAGEABLE_MODULES = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'clients', label: 'Clients, ventes et factures' },
  { id: 'fournisseurs', label: 'Fournisseurs et achats' },
  { id: 'tresorerie', label: 'Trésorerie' },
  { id: 'stock', label: 'Produits et stock' },
  { id: 'comptabilite', label: 'Comptabilité générale' },
  { id: 'associations', label: 'Comptabilité associations' },
  { id: 'impots', label: 'Impôts et taxes' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'audit', label: 'Piste d’audit' },
  { id: 'documents', label: 'Documents et fichiers' },
  { id: 'parametres', label: 'Paramètres de l’entreprise' },
];

export const MODULE_PERMISSION_LEVELS = [
  { value: 'none', label: 'Aucun accès' },
  { value: 'read', label: 'Lecture seule' },
  { value: 'write', label: 'Saisie et modification' },
  { value: 'manage', label: 'Gestion complète' },
];

const VALID_PERMISSION_LEVELS = new Set(MODULE_PERMISSION_LEVELS.map(({ value }) => value));

const API_MODULE_ROUTES = [
  ['/dashboard', 'dashboard'],
  ['/clients', 'clients'],
  ['/devis', 'clients'],
  ['/factures', 'clients'],
  ['/bons-livraison', 'clients'],
  ['/fournisseurs', 'fournisseurs'],
  ['/commandes-achat', 'fournisseurs'],
  ['/receptions', 'fournisseurs'],
  ['/achats', 'fournisseurs'],
  ['/tresorerie', 'tresorerie'],
  ['/stock', 'stock'],
  ['/produits', 'stock'],
  ['/comptabilite', 'comptabilite'],
  ['/ecritures-recurrentes', 'comptabilite'],
  ['/immobilisations', 'comptabilite'],
  ['/export-assets', 'comptabilite'],
  ['/import', 'comptabilite'],
  ['/associations', 'associations'],
  ['/impots', 'impots'],
  ['/depenses', 'depenses'],
  ['/audit-logs', 'audit'],
  ['/upload', 'documents'],
  ['/parametres', 'parametres'],
  ['/devises', 'parametres'],
  ['/integrations', 'integrations'],
  ['/paie', 'paie'],
  ['/ia', 'ia'],
  ['/user-management', 'users'],
];

export function getRoleProfile(role) {
  return ROLE_ACCESS_PROFILES[role] || null;
}

export function defaultModuleAccessLevel(role, moduleId) {
  const profile = getRoleProfile(role);
  if (!profile) return 'none';
  if (profile.modules === '*') return 'manage';
  if (!profile.modules.includes(moduleId)) return 'none';
  return profile.writeModules === '*' || profile.writeModules.includes(moduleId) ? 'write' : 'read';
}

export function resolveModulePermissions(role, overrides = {}) {
  const safeOverrides = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    ? overrides
    : {};
  return Object.fromEntries(USER_MANAGEABLE_MODULES.map(({ id }) => {
    // Un administrateur d’entreprise garde les droits complets; les accès
    // limités s’attribuent aux autres profils.
    if (role === 'admin') return [id, 'manage'];
    const override = safeOverrides[id];
    return [id, VALID_PERMISSION_LEVELS.has(override) ? override : defaultModuleAccessLevel(role, id)];
  }));
}

export function moduleAccessLevel(role, moduleId, overrides = {}) {
  if (role === 'admin') return 'manage';
  if (USER_MANAGEABLE_MODULES.some(({ id }) => id === moduleId)) {
    const override = overrides && typeof overrides === 'object' ? overrides[moduleId] : undefined;
    if (VALID_PERMISSION_LEVELS.has(override)) return override;
  }
  return defaultModuleAccessLevel(role, moduleId);
}

export function moduleAllowsAction(role, moduleId, action, overrides = {}) {
  const level = moduleAccessLevel(role, moduleId, overrides);
  if (action === 'read') return level !== 'none';
  if (action === 'create' || action === 'update') return level === 'write' || level === 'manage';
  if (action === 'delete') return level === 'manage';
  return false;
}

export function roleCanAccessModule(role, moduleId, overrides = {}) {
  return moduleAllowsAction(role, moduleId, 'read', overrides);
}

export function roleCanWriteModule(role, moduleId, overrides = {}) {
  return moduleAllowsAction(role, moduleId, 'create', overrides) ||
    moduleAllowsAction(role, moduleId, 'update', overrides);
}

export function moduleForApiPath(pathname) {
  const path = String(pathname || '').replace(/^\/api(?=\/|$)/, '');
  const match = API_MODULE_ROUTES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match?.[1] || null;
}
