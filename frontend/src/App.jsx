import React, { useState } from 'react';
import './app.css';
import { DashboardView } from './Dashboard.jsx';

const MODULES = [
  { id: 'dashboard', label: '📊 Tableau de Bord', icon: '📊' },
  { id: 'clients', label: '👥 Clients', icon: '👥', api: '/api/clients' },
  { id: 'devis', label: '📄 Devis', icon: '📄', api: '/api/devis' },
  { id: 'factures', label: '💵 Factures Ventes', icon: '💵', api: '/api/factures' },
  { id: 'fournisseurs', label: '🏭 Fournisseurs', icon: '🏭', api: '/api/fournisseurs' },
  { id: 'commandes', label: '📦 Commandes Achat', icon: '📦', api: '/api/commandes-achat' },
  { id: 'receptions', label: '📥 Réceptions', icon: '📥', api: '/api/receptions' },
  { id: 'achats', label: '🧾 Factures Achat', icon: '🧾', api: '/api/achats' },
  { id: 'tresorerie', label: '💰 Trésorerie', icon: '💰', api: '/api/tresorerie' },
  { id: 'stock', label: '📦 Stock & Inventaire', icon: '📦', api: '/api/produits' },
  { id: 'depenses', label: '💸 Dépenses', icon: '💸', api: '/api/depenses' },
  { id: 'comptabilite', label: '📖 Comptabilité', icon: '📖', api: '/api/comptabilite' },
  { id: 'immobilisations', label: '🏗️ Immobilisations', icon: '🏗️', api: '/api/immobilisations' },
  { id: 'employes', label: '👤 Employés', icon: '👤', api: '/api/employes' },
  { id: 'avances', label: '💼 Avances Salaire', icon: '💼', api: '/api/employes/avances' },
  { id: 'absences', label: '🗓️ Absences', icon: '🗓️', api: '/api/employes/absences' },
  { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️', api: '/api/parametres' }
];

function ModuleView({ moduleId, api }) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const module = MODULES.find(m => m.id === moduleId);

  React.useEffect(() => {
    if (api) {
      fetch(`${api}?entrepriseId=1`)
        .then(r => r.json())
        .then(d => setData(Array.isArray(d) ? d : d?.data || []))
        .catch(() => setData([]))
        .finally(() => setLoading(false));
    }
  }, [api]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">{module?.icon} {module?.label}</h2>
      </div>
      {loading ? (
        <p>Chargement des données...</p>
      ) : (
        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px'}}>
          <p>Données disponibles: {data.length} éléments</p>
          {data.length === 0 ? (
            <p style={{color: '#999'}}>Aucune donnée pour le moment</p>
          ) : (
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <tbody>
                {data.slice(0, 10).map((item, i) => (
                  <tr key={i} style={{borderBottom: '1px solid #ddd', padding: '10px'}}>
                    <td style={{padding: '8px'}}>{JSON.stringify(item).substring(0, 100)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  React.useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch('/api/health');
      setBackendStatus(res.ok ? 'connected' : 'disconnected');
    } catch {
      setBackendStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const currentModule = MODULES.find(m => m.id === currentView);

  return (
    <div className="app">
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="logo">
          <h1>🌟 ComptaOrion</h1>
        </div>
        <nav className="nav-menu">
          {MODULES.map(module => (
            <div
              key={module.id}
              className={`nav-item ${currentView === module.id ? 'active' : ''}`}
              onClick={() => setCurrentView(module.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderLeft: currentView === module.id ? '4px solid #3b82f6' : '4px solid transparent',
                backgroundColor: currentView === module.id ? '#e3f2fd' : 'transparent',
                marginBottom: '4px',
                borderRadius: '4px'
              }}
            >
              {module.icon} {module.label}
            </div>
          ))}
        </nav>
        <div className="status-bar" style={{padding: '12px 16px', marginTop: '20px', borderTop: '1px solid #ddd'}}>
          <span className={`status-indicator ${backendStatus === 'connected' ? 'connected' : 'disconnected'}`} style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: backendStatus === 'connected' ? '#10b981' : '#ef4444',
            marginRight: '8px'
          }}></span>
          <span style={{fontSize: '12px', color: '#6c757d'}}>
            {backendStatus === 'connected' ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
      </div>

      <main className="main-content">
        <div className="topbar" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #ddd', backgroundColor: '#fff'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer'
            }}>
              ☰
            </button>
            <h2 style={{margin: 0, fontSize: '20px', color: '#1f2937'}}>
              {currentModule?.icon} {currentModule?.label}
            </h2>
          </div>
          <div className="user-menu" style={{fontSize: '14px', color: '#6c757d'}}>
            <span>Admin</span>
          </div>
        </div>
        <div className="content" style={{padding: '20px', overflowY: 'auto', flex: 1}}>
          {currentView === 'dashboard' ? (
            <DashboardView />
          ) : (
            <ModuleView moduleId={currentView} api={currentModule?.api} />
          )}
        </div>
      </main>
    </div>
  );
}
