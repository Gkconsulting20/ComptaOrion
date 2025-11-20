import { useState, useEffect } from 'react';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [comptaSubmenu, setComptaSubmenu] = useState(false);

  useEffect(() => {
    const checkBackend = () => {
      fetch('/api/health')
        .then(res => {
          if (!res.ok) throw new Error('Erreur de connexion backend');
          return res.json();
        })
        .then(data => {
          setBackendStatus(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Erreur de connexion backend:', err);
          setTimeout(checkBackend, 2000);
        });
    };
    
    setTimeout(checkBackend, 1000);
  }, []);

  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Tableau de bord' },
    { id: 'clients', icon: '👥', label: 'Clients' },
    { id: 'fournisseurs', icon: '🏭', label: 'Fournisseurs' },
    { id: 'tresorerie', icon: '💳', label: 'Trésorerie' },
    { id: 'stock', icon: '📦', label: 'Stock & Inventaire' },
    { 
      id: 'comptabilite', 
      icon: '📚', 
      label: 'Comptabilité',
      submenu: [
        { id: 'etats-financiers', label: 'États financiers' },
        { id: 'grand-livre', label: 'Grand livre' },
        { id: 'journal', label: 'Écriture de journal' },
        { id: 'reconciliation', label: 'Réconciliation' },
        { id: 'charte-comptes', label: 'Charte de comptes' }
      ]
    },
    { id: 'ia', icon: '🤖', label: 'Assistant IA' }
  ];

  const renderContent = () => {
    switch(currentView) {
      case 'dashboard':
        return <DashboardView backendStatus={backendStatus} loading={loading} />;
      case 'clients':
        return <ClientsView />;
      case 'fournisseurs':
        return <FournisseursView />;
      case 'tresorerie':
        return <TresorerieView />;
      case 'stock':
        return <StockView />;
      case 'etats-financiers':
      case 'grand-livre':
      case 'journal':
      case 'reconciliation':
      case 'charte-comptes':
        return <ComptabiliteView subView={currentView} />;
      case 'ia':
        return <IAView />;
      default:
        return <DashboardView backendStatus={backendStatus} loading={loading} />;
    }
  };

  return (
    <div className="app-container">
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h1>ComptaOrion</h1>
          <p className="tagline">Gestion d'entreprise professionnelle</p>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <div key={item.id}>
              <button
                className={`nav-item ${currentView === item.id || (item.submenu && item.submenu.some(sub => sub.id === currentView)) ? 'active' : ''}`}
                onClick={() => {
                  if (item.submenu) {
                    setComptaSubmenu(!comptaSubmenu);
                  } else {
                    setCurrentView(item.id);
                    setComptaSubmenu(false);
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.submenu && <span className="submenu-arrow">{comptaSubmenu ? '▼' : '▶'}</span>}
              </button>
              {item.submenu && comptaSubmenu && (
                <div className="submenu">
                  {item.submenu.map(subItem => (
                    <button
                      key={subItem.id}
                      className={`submenu-item ${currentView === subItem.id ? 'active' : ''}`}
                      onClick={() => setCurrentView(subItem.id)}
                    >
                      {subItem.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="main-content">
        <header className="top-bar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <div className="top-bar-right">
            <span className="status-indicator">
              {loading ? '⏳' : backendStatus ? '✓' : '✗'}
            </span>
          </div>
        </header>
        
        <main className="content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function DashboardView({ backendStatus, loading }) {
  return (
    <div className="view-container">
      <h2 className="view-title">Tableau de bord</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Trésorerie</h3>
            <p className="metric-value">0 FCFA</p>
            <span className="metric-label">Solde disponible</span>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Revenus</h3>
            <p className="metric-value">0 FCFA</p>
            <span className="metric-label">Ce mois</span>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">💸</div>
          <div className="metric-content">
            <h3>Dépenses</h3>
            <p className="metric-value">0 FCFA</p>
            <span className="metric-label">Ce mois</span>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <h3>Bénéfice</h3>
            <p className="metric-value">0 FCFA</p>
            <span className="metric-label">Ce mois</span>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Activités récentes</h3>
        <div className="empty-state">
          <p>Aucune activité récente</p>
          <small>Les transactions apparaîtront ici</small>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>État du système</h3>
        {loading ? (
          <p className="status-loading">Vérification de la connexion...</p>
        ) : backendStatus ? (
          <div className="status-success">
            <span className="status-dot"></span>
            <span>Système opérationnel</span>
          </div>
        ) : (
          <div className="status-error">
            <span className="status-dot"></span>
            <span>Connexion au serveur échouée</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion des clients</h2>
        <button className="btn-primary">+ Nouveau client</button>
      </div>
      
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Solde</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" className="empty-row">Aucun client enregistré</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FournisseursView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion des fournisseurs</h2>
        <button className="btn-primary">+ Nouveau fournisseur</button>
      </div>
      
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Solde dû</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" className="empty-row">Aucun fournisseur enregistré</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TresorerieView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion de trésorerie</h2>
        <button className="btn-primary">+ Nouvelle transaction</button>
      </div>
      
      <div className="metrics-grid">
        <div className="metric-card-small">
          <h4>Encaissements</h4>
          <p className="metric-value-small">0 FCFA</p>
        </div>
        <div className="metric-card-small">
          <h4>Décaissements</h4>
          <p className="metric-value-small">0 FCFA</p>
        </div>
        <div className="metric-card-small">
          <h4>Solde net</h4>
          <p className="metric-value-small">0 FCFA</p>
        </div>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th>Montant</th>
              <th>Solde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" className="empty-row">Aucune transaction enregistrée</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion de stock & inventaire</h2>
        <button className="btn-primary">+ Nouvel article</button>
      </div>
      
      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Catégorie</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Valeur totale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="5" className="empty-row">Aucun article en stock</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComptabiliteView({ subView }) {
  const titles = {
    'etats-financiers': 'États financiers',
    'grand-livre': 'Grand livre',
    'journal': 'Écriture de journal',
    'reconciliation': 'Réconciliation bancaire',
    'charte-comptes': 'Charte de comptes'
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">{titles[subView]}</h2>
        {subView === 'journal' && <button className="btn-primary">+ Nouvelle écriture</button>}
        {subView === 'charte-comptes' && <button className="btn-primary">+ Nouveau compte</button>}
      </div>
      
      <div className="compta-content">
        {subView === 'etats-financiers' && (
          <div className="financial-statements">
            <div className="statement-card">
              <h3>Bilan</h3>
              <p>Actifs et passifs de l'entreprise</p>
            </div>
            <div className="statement-card">
              <h3>Compte de résultat</h3>
              <p>Revenus et charges</p>
            </div>
            <div className="statement-card">
              <h3>Flux de trésorerie</h3>
              <p>Mouvements de trésorerie</p>
            </div>
          </div>
        )}
        
        {subView === 'charte-comptes' && (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Numéro</th>
                  <th>Nom du compte</th>
                  <th>Type</th>
                  <th>Solde</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="4" className="empty-row">Aucun compte configuré</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(subView === 'grand-livre' || subView === 'journal') && (
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Description</th>
                  <th>Débit</th>
                  <th>Crédit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="5" className="empty-row">Aucune écriture comptable</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {subView === 'reconciliation' && (
          <div className="reconciliation-view">
            <p className="info-message">Réconciliez vos comptes bancaires avec votre comptabilité</p>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Transaction</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="4" className="empty-row">Aucune transaction à réconcilier</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IAView() {
  return (
    <div className="view-container">
      <h2 className="view-title">Assistant IA</h2>
      
      <div className="ia-container">
        <div className="ia-welcome">
          <div className="ia-icon">🤖</div>
          <h3>Assistant intelligent ComptaOrion</h3>
          <p>Posez vos questions sur la gestion de votre entreprise</p>
        </div>
        
        <div className="ia-chat">
          <div className="chat-messages">
            <div className="message-placeholder">
              La conversation apparaîtra ici
            </div>
          </div>
          
          <div className="chat-input">
            <input type="text" placeholder="Posez une question..." />
            <button className="btn-primary">Envoyer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
