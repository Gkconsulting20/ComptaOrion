import React, { useState, useEffect } from 'react';
import './app.css';
import { ClientsModule } from './modules/ClientsModule';
import { GestionFournisseurs } from './modules/GestionFournisseurs';
import { TresorerieModule } from './modules/TresorerieModule';
import { StockInventaire } from './modules/StockInventaire';
import { ModuleComptabilite } from './modules/ModuleComptabilite';
import { DepensesModule } from './modules/DepensesModule';
import { ParametresModule } from './modules/ParametresModule';
import { AuthenticationModule } from './modules/AuthenticationModule';
import { SaaSAdminModule } from './modules/SaaSAdminModule';
import { IAAssistantModule } from './modules/IAAssistantModule';
import { ImpotsModule } from './modules/ImpotsModule';
import IntegrationsModule from './modules/IntegrationsModule';
import { Login } from './pages/Login';
import { Inscription } from './pages/Inscription';
import { CommercialPortal } from './pages/CommercialPortal';
import { DashboardView } from './Dashboard';
import { AssociationAccountingModule } from './modules/AssociationAccountingModule';
import api from './api';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    return <Inscription />;
  }

  if (showCommercialPortal) {
    return <CommercialPortal />;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLogin} />;
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
    <div className="app" style={{display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5'}}>
      <div style={{
        width: sidebarOpen ? '280px' : '60px',
        backgroundColor: '#2c3e50',
        color: 'white',
        padding: '20px',
        transition: 'width 0.3s',
        overflowY: 'auto',
        boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          gap: '10px'
        }}>
          <img 
            src="/logo-comptaorion.png" 
            alt="ComptaOrion" 
            style={{
              width: sidebarOpen ? '50px' : '40px',
              height: sidebarOpen ? '50px' : '40px',
              transition: 'all 0.3s',
              objectFit: 'contain'
            }}
          />
          {sidebarOpen && (
            <h2 style={{margin: 0, fontSize: '20px'}}>
              ComptaOrion
            </h2>
          )}
        </div>
        <nav>
          {MODULES.map(m => (
            <div
              key={m.id}
              onClick={() => setCurrentView(m.id)}
              style={{
                padding: '12px 10px',
                cursor: 'pointer',
                backgroundColor: currentView === m.id ? '#3498db' : 'transparent',
                borderRadius: '6px',
                marginBottom: '4px',
                transition: 'all 0.2s',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontSize: sidebarOpen ? '14px' : '18px',
                textAlign: sidebarOpen ? 'left' : 'center',
              }}
              onMouseEnter={(e) => {
                if (currentView !== m.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(52, 152, 219, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentView !== m.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              title={`${m.icon} ${m.label}`}
            >
              {sidebarOpen ? `${m.icon} ${m.label}` : m.icon}
            </div>
          ))}
        </nav>
      </div>

      <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <div style={{
          padding: '20px 30px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#2c3e50',
              padding: '5px 10px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              ☰
            </button>
            <h1 style={{margin: 0, fontSize: '24px', color: '#2c3e50', fontWeight: '600'}}>
              {entreprise?.nom || 'ComptaOrion ERP'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{fontSize: '12px', color: '#7f8c8d', fontWeight: '500'}}>
              👤 {user?.nom || user?.username || 'Utilisateur'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#c0392b'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#e74c3c'}
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
        
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '30px',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '8px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            minHeight: 'calc(100vh - 200px)'
          }}>
            {renderView()}
          </div>
        </div>
      </div>
    </div>
  );
}
