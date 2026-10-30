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

export function roleCanAccessModule(role, moduleId) {
  const profile = getRoleProfile(role);
  return Boolean(profile && (profile.modules === '*' || profile.modules.includes(moduleId)));
}

export function roleCanWriteModule(role, moduleId) {
  const profile = getRoleProfile(role);
  return Boolean(profile && (profile.writeModules === '*' || profile.writeModules.includes(moduleId)));
}

export function moduleForApiPath(pathname) {
  const path = String(pathname || '').replace(/^\/api(?=\/|$)/, '');
  const match = API_MODULE_ROUTES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match?.[1] || null;
}
