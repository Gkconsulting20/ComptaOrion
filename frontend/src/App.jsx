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
import api from './api';

const ALL_MODULES = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: '📊', requiresSuperAdmin: false },
  { id: 'saas-admin', label: 'Admin SaaS', icon: '🎯', requiresSuperAdmin: true },
  { id: 'clients', label: 'Clients', icon: '👥', requiresSuperAdmin: false },
  { id: 'fournisseurs', label: 'Fournisseurs', icon: '🏭', requiresSuperAdmin: false },
  { id: 'tresorerie', label: 'Trésorerie', icon: '💰', requiresSuperAdmin: false },
  { id: 'stock', label: 'Stock', icon: '📦', requiresSuperAdmin: false },
  { id: 'comptabilite', label: 'Comptabilité', icon: '📖', requiresSuperAdmin: false },
  { id: 'impots', label: 'Impôts', icon: '🏛️', requiresSuperAdmin: false },
  { id: 'integrations', label: 'Intégrations', icon: '🔗', requiresSuperAdmin: false },
  { id: 'ia-assistant', label: 'Assistant IA', icon: '🤖', requiresSuperAdmin: false },
  { id: 'authentication', label: 'Authentification', icon: '🔐', requiresSuperAdmin: false },
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
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedEntreprise = localStorage.getItem('entreprise');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
      if (storedEntreprise) {
        setEntreprise(JSON.parse(storedEntreprise));
      }
    }
    
    const urlPath = window.location.pathname;
    if (urlPath === '/inscription' || urlPath.startsWith('/inscription')) {
      setShowInscription(true);
    } else if (urlPath === '/commercial' || urlPath.startsWith('/commercial')) {
      setShowCommercialPortal(true);
    }
    
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  // Filtrer les modules selon les permissions
  // Super Admin = entrepriseId === 1 (ComptaOrion lui-même)
  const isSuperAdmin = user?.entrepriseId === 1;
  const MODULES = ALL_MODULES.filter(m => !m.requiresSuperAdmin || isSuperAdmin);

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId');
    
    try {
      await fetch('/api/auth-security/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId: sessionId ? parseInt(sessionId) : null })
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    localStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
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
      case 'impots': return <ImpotsModule />;
      case 'integrations': return <IntegrationsModule />;
      case 'ia-assistant': return <IAAssistantModule />;
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
