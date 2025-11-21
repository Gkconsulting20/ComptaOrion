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
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion des clients</h2>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          Liste des clients
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouveau client'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Ajouter un client</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom complet / Raison sociale *</label>
                    <input type="text" placeholder="Nom du client" required />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select>
                      <option>Particulier</option>
                      <option>Entreprise</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" placeholder="email@exemple.com" />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input type="tel" placeholder="+225 XX XX XX XX" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Adresse</label>
                    <input type="text" placeholder="Adresse complète" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ville</label>
                    <input type="text" placeholder="Ville" />
                  </div>
                  <div className="form-group">
                    <label>Pays</label>
                    <input type="text" placeholder="Pays" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Catégorie client</label>
                    <select>
                      <option>Standard</option>
                      <option>VIP</option>
                      <option>Grossiste</option>
                      <option>Détaillant</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Limite de crédit (FCFA)</label>
                    <input type="number" placeholder="0" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Délai de paiement (jours)</label>
                    <input type="number" placeholder="30" />
                  </div>
                  <div className="form-group">
                    <label>Remise (%)</label>
                    <input type="number" placeholder="0" step="0.01" />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Solde dû</th>
                  <th>Catégorie</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="7" className="empty-row">Aucun client enregistré</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'parametres' && (
        <div className="tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Catégories de clients</h3>
              <p className="settings-description">Gérer les catégories pour classifier vos clients</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Standard</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>VIP</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Grossiste</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une catégorie</button>
            </div>

            <div className="settings-card">
              <h3>Conditions de paiement</h3>
              <p className="settings-description">Définir les délais de paiement standards</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Comptant (0 jours)</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Net 30 jours</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Net 60 jours</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une condition</button>
            </div>

            <div className="settings-card">
              <h3>Remises automatiques</h3>
              <p className="settings-description">Configurer les remises par catégorie</p>
              <div className="form-group">
                <label>Standard</label>
                <input type="number" placeholder="0" step="0.01" />
              </div>
              <div className="form-group">
                <label>VIP</label>
                <input type="number" placeholder="5" step="0.01" />
              </div>
              <div className="form-group">
                <label>Grossiste</label>
                <input type="number" placeholder="10" step="0.01" />
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Alertes et notifications</h3>
              <p className="settings-description">Configurer les alertes clients</p>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte dépassement limite de crédit</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte facture impayée (7 jours)</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Notification nouveau client</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Rappel paiement automatique</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FournisseursView() {
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion des fournisseurs</h2>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          Liste des fournisseurs
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouveau fournisseur'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Ajouter un fournisseur</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Raison sociale *</label>
                    <input type="text" placeholder="Nom du fournisseur" required />
                  </div>
                  <div className="form-group">
                    <label>N° fournisseur</label>
                    <input type="text" placeholder="Auto-généré" disabled />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contact principal</label>
                    <input type="text" placeholder="Nom du contact" />
                  </div>
                  <div className="form-group">
                    <label>Fonction</label>
                    <input type="text" placeholder="Poste" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" placeholder="email@fournisseur.com" />
                  </div>
                  <div className="form-group">
                    <label>Téléphone</label>
                    <input type="tel" placeholder="+225 XX XX XX XX" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Adresse</label>
                    <input type="text" placeholder="Adresse complète" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Catégorie</label>
                    <select>
                      <option>Matières premières</option>
                      <option>Services</option>
                      <option>Équipements</option>
                      <option>Consommables</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Délai de paiement (jours)</label>
                    <input type="number" placeholder="30" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Compte bancaire</label>
                    <input type="text" placeholder="Numéro de compte" />
                  </div>
                  <div className="form-group">
                    <label>Banque</label>
                    <input type="text" placeholder="Nom de la banque" />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>N° Fournisseur</th>
                  <th>Raison sociale</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Solde dû</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="7" className="empty-row">Aucun fournisseur enregistré</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'parametres' && (
        <div className="tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Catégories de fournisseurs</h3>
              <p className="settings-description">Classifier vos fournisseurs par type</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Matières premières</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Services</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Équipements</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une catégorie</button>
            </div>

            <div className="settings-card">
              <h3>Conditions de paiement</h3>
              <p className="settings-description">Délais de paiement fournisseurs</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Net 15 jours</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Net 30 jours</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Net 45 jours</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une condition</button>
            </div>

            <div className="settings-card">
              <h3>Modes de paiement</h3>
              <p className="settings-description">Moyens de paiement acceptés</p>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Virement bancaire</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Chèque</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Espèces</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Mobile Money</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Alertes paiements</h3>
              <p className="settings-description">Notifications pour les échéances</p>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte 7 jours avant échéance</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte 3 jours avant échéance</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte jour de l'échéance</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Alerte retard de paiement</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TresorerieView() {
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion de trésorerie</h2>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          Transactions
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="metrics-grid">
            <div className="metric-card-small success">
              <h4>Encaissements</h4>
              <p className="metric-value-small">0 FCFA</p>
              <small>Ce mois</small>
            </div>
            <div className="metric-card-small danger">
              <h4>Décaissements</h4>
              <p className="metric-value-small">0 FCFA</p>
              <small>Ce mois</small>
            </div>
            <div className="metric-card-small primary">
              <h4>Solde net</h4>
              <p className="metric-value-small">0 FCFA</p>
              <small>Disponible</small>
            </div>
          </div>

          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouvelle transaction'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Enregistrer une transaction</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Type de transaction *</label>
                    <select required>
                      <option>Encaissement</option>
                      <option>Décaissement</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Montant (FCFA) *</label>
                    <input type="number" placeholder="0" required />
                  </div>
                  <div className="form-group">
                    <label>Mode de paiement *</label>
                    <select required>
                      <option>Espèces</option>
                      <option>Chèque</option>
                      <option>Virement</option>
                      <option>Mobile Money</option>
                      <option>Carte bancaire</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Compte bancaire</label>
                    <select>
                      <option>Caisse principale</option>
                      <option>Banque Atlantique</option>
                      <option>Ecobank</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Catégorie</label>
                    <select>
                      <option>Vente</option>
                      <option>Achat</option>
                      <option>Frais généraux</option>
                      <option>Salaires</option>
                      <option>Impôts</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea rows="3" placeholder="Détails de la transaction"></textarea>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tiers (Client/Fournisseur)</label>
                    <input type="text" placeholder="Nom" />
                  </div>
                  <div className="form-group">
                    <label>N° pièce justificative</label>
                    <input type="text" placeholder="Facture, reçu..." />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Catégorie</th>
                  <th>Mode paiement</th>
                  <th>Montant</th>
                  <th>Solde</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="8" className="empty-row">Aucune transaction enregistrée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'parametres' && (
        <div className="tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Comptes bancaires</h3>
              <p className="settings-description">Gérer vos comptes bancaires et caisses</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>💰 Caisse principale</span>
                  <div className="settings-actions">
                    <span className="badge">0 FCFA</span>
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter un compte</button>
            </div>

            <div className="settings-card">
              <h3>Modes de paiement</h3>
              <p className="settings-description">Configurer les moyens de paiement</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Espèces</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Mobile Money</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Virement bancaire</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter un mode</button>
            </div>

            <div className="settings-card">
              <h3>Catégories de transactions</h3>
              <p className="settings-description">Organiser vos flux de trésorerie</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Ventes</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Achats</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Frais généraux</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une catégorie</button>
            </div>

            <div className="settings-card">
              <h3>Alertes de trésorerie</h3>
              <p className="settings-description">Surveillance des niveaux de trésorerie</p>
              <div className="form-group">
                <label>Seuil d'alerte minimum (FCFA)</label>
                <input type="number" placeholder="100000" />
              </div>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte trésorerie basse</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Rapport quotidien</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Rapport hebdomadaire</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StockView() {
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">Gestion de stock & inventaire</h2>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          Inventaire
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouvel article'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Ajouter un article</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom de l'article *</label>
                    <input type="text" placeholder="Désignation" required />
                  </div>
                  <div className="form-group">
                    <label>Référence / SKU</label>
                    <input type="text" placeholder="Code article" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Catégorie *</label>
                    <select required>
                      <option>Produits finis</option>
                      <option>Matières premières</option>
                      <option>Consommables</option>
                      <option>Services</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unité de mesure</label>
                    <select>
                      <option>Pièce</option>
                      <option>Kg</option>
                      <option>Litre</option>
                      <option>Mètre</option>
                      <option>Carton</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantité initiale</label>
                    <input type="number" placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Stock minimum</label>
                    <input type="number" placeholder="10" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Prix d'achat unitaire (FCFA)</label>
                    <input type="number" placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Prix de vente unitaire (FCFA)</label>
                    <input type="number" placeholder="0" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fournisseur principal</label>
                    <select>
                      <option>Sélectionner...</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Emplacement</label>
                    <input type="text" placeholder="Entrepôt A, Rayon 3..." />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea rows="3" placeholder="Description de l'article"></textarea>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Article</th>
                  <th>Catégorie</th>
                  <th>Quantité</th>
                  <th>Unité</th>
                  <th>Prix achat</th>
                  <th>Prix vente</th>
                  <th>Valeur stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="9" className="empty-row">Aucun article en stock</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'parametres' && (
        <div className="tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Catégories d'articles</h3>
              <p className="settings-description">Organiser vos produits par catégorie</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Produits finis</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Matières premières</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Consommables</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une catégorie</button>
            </div>

            <div className="settings-card">
              <h3>Unités de mesure</h3>
              <p className="settings-description">Définir les unités utilisées</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Pièce (pcs)</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Kilogramme (kg)</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Litre (L)</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter une unité</button>
            </div>

            <div className="settings-card">
              <h3>Emplacements de stockage</h3>
              <p className="settings-description">Gérer les zones de stockage</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>Entrepôt principal</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>Magasin de vente</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                    <button className="btn-icon">🗑️</button>
                  </div>
                </div>
              </div>
              <button className="btn-secondary btn-small">+ Ajouter un emplacement</button>
            </div>

            <div className="settings-card">
              <h3>Alertes de stock</h3>
              <p className="settings-description">Notifications pour la gestion du stock</p>
              <div className="form-group">
                <label>Seuil d'alerte global (%)</label>
                <input type="number" placeholder="20" />
              </div>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte stock faible</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Alerte rupture de stock</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Alerte stock excédentaire</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Rapport mensuel d'inventaire</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Méthode de valorisation</h3>
              <p className="settings-description">Choisir la méthode de calcul du stock</p>
              <div className="radio-group">
                <label>
                  <input type="radio" name="valuation" defaultChecked />
                  <span>FIFO (Premier entré, premier sorti)</span>
                </label>
                <label>
                  <input type="radio" name="valuation" />
                  <span>LIFO (Dernier entré, premier sorti)</span>
                </label>
                <label>
                  <input type="radio" name="valuation" />
                  <span>CUMP (Coût unitaire moyen pondéré)</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Code-barres et traçabilité</h3>
              <p className="settings-description">Configuration des codes articles</p>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" />
                  <span>Génération automatique SKU</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Support code-barres</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Numéros de série</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Numéros de lot</span>
                </label>
              </div>
              <div className="form-group">
                <label>Préfixe SKU</label>
                <input type="text" placeholder="ART-" />
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComptabiliteView({ subView }) {
  const [activeTab, setActiveTab] = useState('liste');

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
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          {subView === 'charte-comptes' ? 'Plan comptable' : subView === 'etats-financiers' ? 'Rapports' : 'Données'}
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="compta-content">
            {subView === 'etats-financiers' && (
              <div className="financial-statements">
                <div className="statement-card">
                  <h3>📊 Bilan</h3>
                  <p>Actifs et passifs de l'entreprise</p>
                  <div className="statement-summary">
                    <div className="summary-item">
                      <span>Actif total</span>
                      <strong>0 FCFA</strong>
                    </div>
                    <div className="summary-item">
                      <span>Passif total</span>
                      <strong>0 FCFA</strong>
                    </div>
                  </div>
                  <button className="btn-secondary btn-small">Voir le détail</button>
                </div>
                <div className="statement-card">
                  <h3>📈 Compte de résultat</h3>
                  <p>Revenus et charges de la période</p>
                  <div className="statement-summary">
                    <div className="summary-item">
                      <span>Produits</span>
                      <strong>0 FCFA</strong>
                    </div>
                    <div className="summary-item">
                      <span>Charges</span>
                      <strong>0 FCFA</strong>
                    </div>
                    <div className="summary-item highlight">
                      <span>Résultat net</span>
                      <strong>0 FCFA</strong>
                    </div>
                  </div>
                  <button className="btn-secondary btn-small">Voir le détail</button>
                </div>
                <div className="statement-card">
                  <h3>💰 Flux de trésorerie</h3>
                  <p>Mouvements de trésorerie</p>
                  <div className="statement-summary">
                    <div className="summary-item">
                      <span>Flux opérationnels</span>
                      <strong>0 FCFA</strong>
                    </div>
                    <div className="summary-item">
                      <span>Flux d'investissement</span>
                      <strong>0 FCFA</strong>
                    </div>
                    <div className="summary-item">
                      <span>Flux de financement</span>
                      <strong>0 FCFA</strong>
                    </div>
                  </div>
                  <button className="btn-secondary btn-small">Voir le détail</button>
                </div>
              </div>
            )}
            
            {subView === 'charte-comptes' && (
              <div className="data-table">
                <div className="content-header">
                  <button className="btn-primary">+ Nouveau compte</button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Nom du compte</th>
                      <th>Type</th>
                      <th>Catégorie</th>
                      <th>Solde débiteur</th>
                      <th>Solde créditeur</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>Actifs</td>
                      <td>Actif</td>
                      <td>Bilan</td>
                      <td>0 FCFA</td>
                      <td>-</td>
                      <td><button className="btn-icon">✏️</button></td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td>Passifs</td>
                      <td>Passif</td>
                      <td>Bilan</td>
                      <td>-</td>
                      <td>0 FCFA</td>
                      <td><button className="btn-icon">✏️</button></td>
                    </tr>
                    <tr>
                      <td>4</td>
                      <td>Produits</td>
                      <td>Produits</td>
                      <td>Résultat</td>
                      <td>-</td>
                      <td>0 FCFA</td>
                      <td><button className="btn-icon">✏️</button></td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td>Charges</td>
                      <td>Charges</td>
                      <td>Résultat</td>
                      <td>0 FCFA</td>
                      <td>-</td>
                      <td><button className="btn-icon">✏️</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {(subView === 'grand-livre' || subView === 'journal') && (
              <div className="data-table">
                <div className="content-header">
                  {subView === 'journal' && <button className="btn-primary">+ Nouvelle écriture</button>}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° pièce</th>
                      <th>Libellé</th>
                      <th>Compte</th>
                      <th>Débit</th>
                      <th>Crédit</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="7" className="empty-row">Aucune écriture comptable</td>
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
                        <th>Compte</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan="6" className="empty-row">Aucune transaction à réconcilier</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'parametres' && (
        <div className="tab-content">
          <div className="settings-grid">
            <div className="settings-card">
              <h3>Exercice comptable</h3>
              <p className="settings-description">Période de référence comptable</p>
              <div className="form-group">
                <label>Date de début</label>
                <input type="date" />
              </div>
              <div className="form-group">
                <label>Date de fin</label>
                <input type="date" />
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select>
                  <option>Ouvert</option>
                  <option>Clôturé</option>
                </select>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>TVA et taxes</h3>
              <p className="settings-description">Configuration des taux de TVA</p>
              <div className="settings-list">
                <div className="settings-item">
                  <span>TVA 18%</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
                <div className="settings-item">
                  <span>TVA 0% (Exonéré)</span>
                  <div className="settings-actions">
                    <button className="btn-icon">✏️</button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Taux TVA par défaut</label>
                <select>
                  <option>18%</option>
                  <option>0%</option>
                </select>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Devise et format</h3>
              <p className="settings-description">Paramètres monétaires</p>
              <div className="form-group">
                <label>Devise principale</label>
                <select>
                  <option>FCFA (XOF)</option>
                  <option>EUR (€)</option>
                  <option>USD ($)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Format d'affichage</label>
                <select>
                  <option>0 FCFA</option>
                  <option>0.00 FCFA</option>
                  <option>FCFA 0</option>
                </select>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Numérotation automatique</h3>
              <p className="settings-description">Format des numéros de pièces</p>
              <div className="form-group">
                <label>Préfixe écritures journal</label>
                <input type="text" placeholder="JNL-" />
              </div>
              <div className="form-group">
                <label>Préfixe factures</label>
                <input type="text" placeholder="FAC-" />
              </div>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Réinitialiser chaque année</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Plan comptable</h3>
              <p className="settings-description">Référentiel comptable utilisé</p>
              <div className="radio-group">
                <label>
                  <input type="radio" name="plan" defaultChecked />
                  <span>SYSCOHADA (Afrique de l'Ouest)</span>
                </label>
                <label>
                  <input type="radio" name="plan" />
                  <span>SYSCOA</span>
                </label>
                <label>
                  <input type="radio" name="plan" />
                  <span>Plan comptable général</span>
                </label>
                <label>
                  <input type="radio" name="plan" />
                  <span>Personnalisé</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>

            <div className="settings-card">
              <h3>Options de clôture</h3>
              <p className="settings-description">Paramètres de fin d'exercice</p>
              <div className="checkbox-group">
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Report à nouveau automatique</span>
                </label>
                <label>
                  <input type="checkbox" />
                  <span>Validation obligatoire des écritures</span>
                </label>
                <label>
                  <input type="checkbox" defaultChecked />
                  <span>Verrouillage après clôture</span>
                </label>
              </div>
              <button className="btn-primary btn-small">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
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
