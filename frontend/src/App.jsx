import React, { lazy, Suspense, useState, useEffect } from 'react';
import './app.css';
import api from './api';
import OrionIcon from './components/OrionIcon';
import OrionLogo from './components/OrionLogo';

const loadNamed = (loader, exportName) => lazy(() =>
  loader().then(module => ({ default: module[exportName] }))
);

const ClientsModule = loadNamed(() => import('./modules/ClientsModule'), 'ClientsModule');
const GestionFournisseurs = loadNamed(() => import('./modules/GestionFournisseurs'), 'GestionFournisseurs');
const TresorerieModule = loadNamed(() => import('./modules/TresorerieModule'), 'TresorerieModule');
const StockInventaire = loadNamed(() => import('./modules/StockInventaire'), 'StockInventaire');
const ModuleComptabilite = loadNamed(() => import('./modules/ModuleComptabilite'), 'ModuleComptabilite');
const ParametresModule = loadNamed(() => import('./modules/ParametresModule'), 'ParametresModule');
const AuthenticationModule = loadNamed(() => import('./modules/AuthenticationModule'), 'AuthenticationModule');
const SaaSAdminModule = loadNamed(() => import('./modules/SaaSAdminModule'), 'SaaSAdminModule');
const IAAssistantModule = loadNamed(() => import('./modules/IAAssistantModule'), 'IAAssistantModule');
const ImpotsModule = loadNamed(() => import('./modules/ImpotsModule'), 'ImpotsModule');
const IntegrationsModule = lazy(() => import('./modules/IntegrationsModule'));
const Login = loadNamed(() => import('./pages/Login'), 'Login');
const Inscription = loadNamed(() => import('./pages/Inscription'), 'Inscription');
const CommercialPortal = loadNamed(() => import('./pages/CommercialPortal'), 'CommercialPortal');
const ProspectDemo = loadNamed(() => import('./pages/ProspectDemo'), 'ProspectDemo');
const DashboardView = loadNamed(() => import('./Dashboard'), 'DashboardView');
const AssociationAccountingModule = loadNamed(
  () => import('./modules/AssociationAccountingModule'),
  'AssociationAccountingModule'
);

function LazyModuleFallback() {
  return (
    <div role="status" aria-live="polite" style={{ padding: '24px', color: '#64748b' }}>
      Chargement du module…
    </div>
  );
}

// L'assistant reste dans le code pour une activation future, mais il est
// désactivé par défaut afin qu'aucun appel IA payant ne puisse être déclenché.
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';

const ALL_MODULES = [
  { id: 'dashboard', label: 'Tableau de Bord', requiresSuperAdmin: false },
  { id: 'saas-admin', label: 'Admin SaaS', requiresSuperAdmin: true, requiresAdmin: true },
  { id: 'clients', label: 'Clients', requiresSuperAdmin: false },
  { id: 'fournisseurs', label: 'Fournisseurs', requiresSuperAdmin: false },
  { id: 'tresorerie', label: 'Trésorerie', requiresSuperAdmin: false },
  { id: 'stock', label: 'Stock', requiresSuperAdmin: false },
  { id: 'comptabilite', label: 'Comptabilité', requiresSuperAdmin: false },
  { id: 'associations', label: 'Comptabilité associations', requiresAssociationAccess: true },
  { id: 'impots', label: 'Impôts (en préparation)', requiresSuperAdmin: false },
  { id: 'integrations', label: 'Intégrations', requiresSuperAdmin: false, requiresAdmin: true },
  ...(AI_ENABLED
    ? [{ id: 'ia-assistant', label: 'Assistant IA', requiresSuperAdmin: false }]
    : []),
  { id: 'authentication', label: 'Authentification & sécurité', requiresSuperAdmin: true, requiresAdmin: true },
  { id: 'parametres', label: 'Paramètres', requiresSuperAdmin: false }
];

const NAVIGATION_GROUPS = [
  { title: 'Pilotage', moduleIds: ['dashboard'] },
  { title: 'Tiers', moduleIds: ['clients', 'fournisseurs'] },
  { title: 'Opérations', moduleIds: ['tresorerie', 'stock'] },
  { title: 'Comptabilité', moduleIds: ['comptabilite', 'associations', 'impots'] },
  { title: 'Configuration', moduleIds: ['integrations', 'parametres'] },
  { title: 'Administration', moduleIds: ['saas-admin', 'authentication'] },
  { title: 'Outils', moduleIds: ['ia-assistant'] }
];

function NavigationToggleIcon({ open }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {open ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
    </svg>
  );
}

function LogoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>;
}


export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' || window.innerWidth > 680
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [entreprise, setEntreprise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInscription, setShowInscription] = useState(false);
  const [showCommercialPortal, setShowCommercialPortal] = useState(false);
  const [showProspectDemo, setShowProspectDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      const urlPath = window.location.pathname;
      if (urlPath === '/inscription' || urlPath.startsWith('/inscription')) {
        setShowInscription(true);
        setLoading(false);
        return;
      }
      if (urlPath === '/commercial' || urlPath.startsWith('/commercial')) {
        setShowCommercialPortal(true);
        setLoading(false);
        return;
      }
      if (urlPath === '/demo' || urlPath.startsWith('/demo/')) {
        setShowProspectDemo(true);
        setLoading(false);
        return;
      }

      try {
        let response = await fetch('/api/auth-security/session', { credentials: 'include' });
        if (response.status === 401) {
          const refreshResponse = await fetch('/api/auth-security/refresh', {
            method: 'POST',
            credentials: 'include'
          });
          if (refreshResponse.ok) {
            response = await fetch('/api/auth-security/session', { credentials: 'include' });
          }
        }
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            setIsAuthenticated(true);
            setUser(data.user);
            setEntreprise(data.entreprise || null);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('entrepriseId', data.user.entrepriseId);
            if (data.entreprise) localStorage.setItem('entreprise', JSON.stringify(data.entreprise));
          }
        } else {
          ['user', 'entreprise', 'entrepriseId', 'sessionId'].forEach(key => localStorage.removeItem(key));
        }
      } catch (error) {
        console.error('Impossible de vérifier la session:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = (userData, entrepriseData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setEntreprise(entrepriseData || null);
  };

  // Filtrer les modules selon les permissions
  // Super Admin = entrepriseId === 1 (ComptaOrion lui-même)
  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = isAdmin && Number(user?.entrepriseId) === 1;
  const associationAccess = ['admin', 'accountant', 'manager'].includes(user?.role);
  const MODULES = ALL_MODULES.filter(m =>
    (!m.requiresSuperAdmin || isSuperAdmin) &&
    (!m.requiresAdmin || isAdmin) &&
    (!m.requiresAssociationAccess || associationAccess)
  );
  const activeModule = MODULES.find(module => module.id === currentView);
  const visibleModuleGroups = NAVIGATION_GROUPS
    .map(group => ({
      title: group.title,
      modules: group.moduleIds.map(id => MODULES.find(module => module.id === id)).filter(Boolean)
    }))
    .filter(group => group.modules.length > 0);
  const groupedModuleIds = new Set(NAVIGATION_GROUPS.flatMap(group => group.moduleIds));
  const ungroupedModules = MODULES.filter(module => !groupedModuleIds.has(module.id));
  if (ungroupedModules.length > 0) {
    visibleModuleGroups.push({ title: 'Autres', modules: ungroupedModules });
  }

  const handleModuleSelect = (moduleId) => {
    setCurrentView(moduleId);
    if (window.innerWidth <= 680) setSidebarOpen(false);
  };

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('sessionId');
    
    try {
      await api.post('/auth-security/logout', { sessionId: sessionId ? parseInt(sessionId) : null });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    ['user', 'entreprise', 'entrepriseId', 'sessionId'].forEach(key => localStorage.removeItem(key));
    setIsAuthenticated(false);
    setUser(null);
    setEntreprise(null);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
            <OrionLogo variant="full" className="loading-brand-logo" />
          </div>
          <h2>ComptaOrion</h2>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (showInscription) {
    return <Suspense fallback={<LazyModuleFallback />}><Inscription /></Suspense>;
  }

  if (showCommercialPortal) {
    return <Suspense fallback={<LazyModuleFallback />}><CommercialPortal /></Suspense>;
  }

  if (showProspectDemo) {
    return <Suspense fallback={<LazyModuleFallback />}><ProspectDemo /></Suspense>;
  }

  if (!isAuthenticated) {
    return <Suspense fallback={<LazyModuleFallback />}><Login onLoginSuccess={handleLogin} /></Suspense>;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView entrepriseName={entreprise?.nom} />;
      case 'saas-admin': return <SaaSAdminModule />;
      case 'clients': return <ClientsModule />;
      case 'fournisseurs': return <GestionFournisseurs />;
      case 'tresorerie': return <TresorerieModule />;
      case 'stock': return <StockInventaire />;
      case 'comptabilite': return <ModuleComptabilite />;
      case 'associations': return <AssociationAccountingModule />;
      case 'impots': return <ImpotsModule />;
      case 'integrations': return <IntegrationsModule />;
      case 'ia-assistant': return AI_ENABLED ? <IAAssistantModule /> : <DashboardView entrepriseName={entreprise?.nom} />;
      case 'authentication': return <AuthenticationModule />;
      case 'parametres': return <ParametresModule />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="app">
      {sidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 680 && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="app-navigation"
        className={`app-sidebar ${sidebarOpen ? 'is-open' : 'is-closed'}`}
        aria-label="Navigation principale"
      >
        <div className="app-sidebar-brand">
          <OrionLogo
            variant={sidebarOpen ? 'full' : 'symbol'}
            className="app-brand-logo"
          />
          {sidebarOpen && (
            <div className="app-sidebar-brand-copy">
              <span>Gestion financière</span>
            </div>
          )}
        </div>

        <nav className="app-sidebar-nav" aria-label="Modules">
          {visibleModuleGroups.map(group => (
            <section className="app-nav-group" key={group.title} aria-label={group.title}>
              {sidebarOpen && <h2 className="app-nav-group-title">{group.title}</h2>}
              {group.modules.map(module => (
                <button
                  type="button"
                  key={module.id}
                  className={`app-nav-item ${currentView === module.id ? 'is-active' : ''}`}
                  onClick={() => handleModuleSelect(module.id)}
                  aria-current={currentView === module.id ? 'page' : undefined}
                  aria-label={module.label}
                  title={module.label}
                >
                  <span className="app-nav-icon"><OrionIcon name={module.id} /></span>
                  {sidebarOpen && <span className="app-nav-label">{module.label}</span>}
                </button>
              ))}
            </section>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="app-sidebar-foot">
            {entreprise?.nom ? `${entreprise.nom} · Espace de gestion` : 'Espace de gestion'}
          </div>
        )}
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-heading">
            <button
              type="button"
              className="app-menu-toggle"
              onClick={() => setSidebarOpen(open => !open)}
              aria-label={sidebarOpen ? 'Réduire la navigation' : 'Ouvrir la navigation'}
              aria-expanded={sidebarOpen}
              aria-controls="app-navigation"
            >
              <NavigationToggleIcon open={sidebarOpen} />
            </button>
            <div className="app-page-heading">
              <h1>{activeModule?.label || 'Tableau de bord'}</h1>
              <span className="app-company-chip" title={`Entreprise : ${entreprise?.nom || 'ComptaOrion ERP'}`}>
                <i className="app-company-mark" aria-hidden="true" />
                {entreprise?.nom || 'ComptaOrion ERP'}
              </span>
            </div>
          </div>

          <div className="app-topbar-actions">
            <div className="app-user-chip" title={user?.nom || user?.username || 'Utilisateur'}>
              <span className="app-user-avatar" aria-hidden="true">
                {(user?.nom || user?.username || 'U').trim().charAt(0).toUpperCase()}
              </span>
              <span className="app-user-name">{user?.nom || user?.username || 'Utilisateur'}</span>
            </div>
            <button type="button" className="app-logout-button" onClick={handleLogout}>
              <LogoutIcon />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="app-content-scroll">
          <div className={`app-view-container${currentView === 'dashboard' ? ' is-dashboard-view' : ''}`}>
            <Suspense fallback={<LazyModuleFallback />}>
              {renderView()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
