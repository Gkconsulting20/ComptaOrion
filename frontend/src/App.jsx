import React, { useState, useEffect } from 'react';
import './app.css';
import { ClientsModule } from './modules/ClientsModule';
import { GestionFournisseurs } from './modules/GestionFournisseurs';
import { TresorerieModule } from './modules/TresorerieModule';
import { StockInventaire } from './modules/StockInventaire';
import { ModuleComptabilite } from './modules/ModuleComptabilite';
import { DepensesModule } from './modules/DepensesModule';
import { ParametresModule } from './modules/ParametresModule';
import { Login } from './pages/Login';
import api from './api';

const MODULES = [
  { id: 'dashboard', label: '📊 Tableau de Bord', icon: '📊' },
  { id: 'clients', label: '👥 Clients', icon: '👥' },
  { id: 'fournisseurs', label: '🏭 Fournisseurs', icon: '🏭' },
  { id: 'tresorerie', label: '💰 Trésorerie', icon: '💰' },
  { id: 'stock', label: '📦 Stock', icon: '📦' },
  { id: 'comptabilite', label: '📖 Comptabilité', icon: '📖' },
  { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' }
];

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/global')
      .then(d => setData(d || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>📊 Tableau de Bord</h2>
      <div style={{
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: '15px',
        marginTop: '20px'
      }}>
        <div style={{
          padding: '20px', 
          backgroundColor: '#e3f2fd', 
          borderRadius: '8px', 
          border: '1px solid #90caf9',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px', fontWeight: '600'}}>
            VENTES DU MOIS
          </p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1976d2'}}>
            {parseFloat(data?.ventesMois || 0).toLocaleString()} FCFA
          </h3>
        </div>
        <div style={{
          padding: '20px', 
          backgroundColor: '#ffebee', 
          borderRadius: '8px', 
          border: '1px solid #ef5350',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px', fontWeight: '600'}}>
            DÉPENSES DU MOIS
          </p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#d32f2f'}}>
            {parseFloat(data?.depensesMois || 0).toLocaleString()} FCFA
          </h3>
        </div>
        <div style={{
          padding: '20px', 
          backgroundColor: '#e8f5e9', 
          borderRadius: '8px', 
          border: '1px solid #81c784',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px', fontWeight: '600'}}>
            CASHFLOW
          </p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#388e3c'}}>
            {parseFloat(data?.cashflow || 0).toLocaleString()} FCFA
          </h3>
        </div>
        <div style={{
          padding: '20px', 
          backgroundColor: '#fff3e0', 
          borderRadius: '8px', 
          border: '1px solid #ffb74d',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px', fontWeight: '600'}}>
            MARGE BRUTE
          </p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#f57c00'}}>
            {parseFloat(data?.margeBrute || 0).toFixed(1)}%
          </h3>
        </div>
      </div>

      <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Factures en Retard</h4>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#e74c3c', margin: 0 }}>
            {data?.facturesEnRetard?.nombre || 0}
          </p>
          <p style={{ color: '#666', fontSize: '14px', margin: '5px 0 0 0' }}>
            Montant: {parseFloat(data?.facturesEnRetard?.montant || 0).toLocaleString()} FCFA
          </p>
        </div>
        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Stock Faible</h4>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12', margin: 0 }}>
            {data?.stockFaible?.nombre || 0}
          </p>
          <p style={{ color: '#666', fontSize: '14px', margin: '5px 0 0 0' }}>
            Produits sous le seuil minimum
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
    }
    
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    
    try {
      await fetch('/api/auth-security/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
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
          <h2>🌟 ComptaOrion</h2>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <ClientsModule />;
      case 'fournisseurs': return <GestionFournisseurs />;
      case 'tresorerie': return <TresorerieModule />;
      case 'stock': return <StockInventaire />;
      case 'comptabilite': return <ModuleComptabilite />;
      case 'parametres': return <ParametresModule />;
      default: return <Dashboard />;
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
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{margin: 0, fontSize: sidebarOpen ? '20px' : '0', transition: 'font-size 0.3s'}}>
            🌟 {sidebarOpen && 'ComptaOrion'}
          </h2>
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
              title={m.label}
            >
              {sidebarOpen ? m.label : m.icon}
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
              ComptaOrion ERP
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
