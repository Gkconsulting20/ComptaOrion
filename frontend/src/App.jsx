import React, { useState, useEffect } from 'react';
import './app.css';

const MODULES = [
  { id: 'dashboard', label: '📊 Tableau de Bord' },
  { id: 'clients', label: '👥 Clients' },
  { id: 'factures', label: '💵 Factures Ventes' },
  { id: 'fournisseurs', label: '🏭 Fournisseurs' },
  { id: 'commandes', label: '📦 Commandes Achat' },
  { id: 'tresorerie', label: '💰 Trésorerie' },
  { id: 'stock', label: '📦 Stock' },
  { id: 'comptabilite', label: '📖 Comptabilité' },
  { id: 'depenses', label: '💸 Dépenses' },
  { id: 'employes', label: '👤 Employés' },
  { id: 'parametres', label: '⚙️ Paramètres' }
];

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/global?entrepriseId=1')
      .then(r => r.json())
      .then(d => setData(d || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>📊 Tableau de Bord</h2>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
        <div style={{padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9'}}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px'}}>VENTES DU MOIS</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1976d2'}}>{data?.ventesMois || '0'} FCFA</h3>
        </div>
        <div style={{padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px', border: '1px solid #ef5350'}}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px'}}>DÉPENSES DU MOIS</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#d32f2f'}}>{data?.depensesMois || '0'} FCFA</h3>
        </div>
        <div style={{padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #81c784'}}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px'}}>CASHFLOW</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#388e3c'}}>{data?.cashflow || '0'} FCFA</h3>
        </div>
        <div style={{padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffb74d'}}>
          <p style={{color: '#666', margin: '0 0 5px 0', fontSize: '12px'}}>MARGE BRUTE</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#f57c00'}}>{data?.margeBrute || '0'}%</h3>
        </div>
      </div>
    </div>
  );
}

function ListModule({ title, api }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${api}?entrepriseId=1`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : d?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <h2>{title}</h2>
      {loading ? (
        <p>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{color: '#999'}}>Aucune donnée disponible</p>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '20px'}}>
          <thead>
            <tr style={{backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd'}}>
              <th style={{padding: '10px', textAlign: 'left'}}>ID</th>
              <th style={{padding: '10px', textAlign: 'left'}}>Données</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 10).map((item, i) => (
              <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding: '10px'}}>{item.id || i+1}</td>
                <td style={{padding: '10px', fontSize: '12px', color: '#666'}}>
                  {Object.entries(item).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'clients': return <ListModule title="👥 Clients" api="/api/clients" />;
      case 'factures': return <ListModule title="💵 Factures Ventes" api="/api/factures" />;
      case 'fournisseurs': return <ListModule title="🏭 Fournisseurs" api="/api/fournisseurs" />;
      case 'commandes': return <ListModule title="📦 Commandes Achat" api="/api/commandes-achat" />;
      case 'tresorerie': return <ListModule title="💰 Trésorerie" api="/api/tresorerie" />;
      case 'stock': return <ListModule title="📦 Stock" api="/api/produits" />;
      case 'comptabilite': return <ListModule title="📖 Comptabilité" api="/api/comptabilite" />;
      case 'depenses': return <ListModule title="💸 Dépenses" api="/api/depenses" />;
      case 'employes': return <ListModule title="👤 Employés" api="/api/employes" />;
      case 'parametres': return <ListModule title="⚙️ Paramètres" api="/api/parametres" />;
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
        boxShadow: '0 0 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{margin: '0 0 20px 0', fontSize: '18px'}}>🌟 {sidebarOpen ? 'ComptaOrion' : ''}</h2>
        <nav>
          {MODULES.map(m => (
            <div
              key={m.id}
              onClick={() => setCurrentView(m.id)}
              style={{
                padding: '12px 10px',
                cursor: 'pointer',
                backgroundColor: currentView === m.id ? '#3498db' : 'transparent',
                borderRadius: '4px',
                marginBottom: '4px',
                transition: 'background 0.2s',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontSize: sidebarOpen ? '14px' : '18px'
              }}
              title={m.label}
            >
              {sidebarOpen ? m.label : m.label.split(' ')[0]}
            </div>
          ))}
        </nav>
      </div>

      <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <div style={{
          padding: '20px',
          backgroundColor: 'white',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer'
          }}>☰</button>
          <h1 style={{margin: 0, fontSize: '24px', color: '#2c3e50'}}>ComptaOrion</h1>
          <span style={{fontSize: '12px', color: '#999'}}>Admin</span>
        </div>
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            {renderView()}
          </div>
        </div>
      </div>
    </div>
  );
}
