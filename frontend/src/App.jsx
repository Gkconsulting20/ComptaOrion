import React, { lazy, Suspense, useState, useEffect } from 'react';
import './app.css';
import api from './api';

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
  { id: 'dashboard', label: 'Tableau de Bord', icon: '📊', requiresSuperAdmin: false },
  { id: 'saas-admin', label: 'Admin SaaS', icon: '🎯', requiresSuperAdmin: true, requiresAdmin: true },
  { id: 'clients', label: 'Clients', icon: '👥', requiresSuperAdmin: false },
  { id: 'fournisseurs', label: 'Fournisseurs', icon: '🏭', requiresSuperAdmin: false },
  { id: 'tresorerie', label: 'Trésorerie', icon: '💰', requiresSuperAdmin: false },
  { id: 'stock', label: 'Stock', icon: '📦', requiresSuperAdmin: false },
  { id: 'comptabilite', label: 'Comptabilité', icon: '📖', requiresSuperAdmin: false },
  { id: 'associations', label: 'Comptabilité associations', icon: '🤝', requiresAssociationAccess: true },
  { id: 'impots', label: 'Impôts (en préparation)', icon: '🏛️', requiresSuperAdmin: false },
  { id: 'integrations', label: 'Intégrations', icon: '🔗', requiresSuperAdmin: false, requiresAdmin: true },
  ...(AI_ENABLED
    ? [{ id: 'ia-assistant', label: 'Assistant IA', icon: '🤖', requiresSuperAdmin: false }]
    : []),
  { id: 'authentication', label: 'Authentification & sécurité', icon: '🔐', requiresSuperAdmin: true, requiresAdmin: true },
  { id: 'parametres', label: 'Paramètres', icon: '⚙️', requiresSuperAdmin: false }
];


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
          <img 
            src="/logo-comptaorion.png" 
            alt="ComptaOrion" 
            style={{ width: '120px', height: '120px', marginBottom: '15px' }}
          />
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

  if (!isAuthenticated) {
    return <Suspense fallback={<LazyModuleFallback />}><Login onLoginSuccess={handleLogin} /></Suspense>;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'saas-admin': return <SaaSAdminModule />;
      case 'clients': return <ClientsModule />;
      case 'fournisseurs': return <GestionFournisseurs />;
      case 'tresorerie': return <TresorerieModule />;
      case 'stock': return <StockInventaire />;
      case 'comptabilite': return <ModuleComptabilite />;
      case 'associations': return <AssociationAccountingModule />;
      case 'impots': return <ImpotsModule />;
      case 'integrations': return <IntegrationsModule />;
      case 'ia-assistant': return AI_ENABLED ? <IAAssistantModule /> : <DashboardView />;
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
          aria-label="Fermer le menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="app-navigation"
        className={`app-sidebar ${sidebarOpen ? 'is-open' : 'is-closed'}`}
        aria-label="Navigation principale"
      >
        <div className="app-sidebar-brand">
          <img src="/logo-comptaorion.png" alt="" />
          {sidebarOpen && (
            <div className="app-sidebar-brand-copy">
              <strong>ComptaOrion</strong>
              <span>Gestion financière</span>
            </div>
          )}
        </div>

        <nav className="app-sidebar-nav">
          {MODULES.map(module => (
            <button
              type="button"
              key={module.id}
              className={`app-nav-item ${currentView === module.id ? 'is-active' : ''}`}
              onClick={() => handleModuleSelect(module.id)}
              aria-current={currentView === module.id ? 'page' : undefined}
              title={`${module.icon} ${module.label}`}
            >
              <span className="app-nav-icon" aria-hidden="true">{module.icon}</span>
              {sidebarOpen && <span className="app-nav-label">{module.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-heading">
            <button
              type="button"
              className="app-menu-toggle"
              onClick={() => setSidebarOpen(open => !open)}
              aria-label={sidebarOpen ? 'Réduire le menu' : 'Ouvrir le menu'}
              aria-expanded={sidebarOpen}
              aria-controls="app-navigation"
            >
              <span className="app-menu-glyph" aria-hidden="true">☰</span>
              <span>Menu</span>
            </button>
            <div className="app-page-heading">
              <h1>{activeModule?.label || 'Tableau de bord'}</h1>
              <p>{entreprise?.nom || 'ComptaOrion ERP'}</p>
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
              <span aria-hidden="true">↪</span>
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="app-content-scroll">
          <div className="app-view-container">
            <Suspense fallback={<LazyModuleFallback />}>
              {renderView()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
