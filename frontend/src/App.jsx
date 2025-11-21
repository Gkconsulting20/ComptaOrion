import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
    { id: 'depenses', icon: '💸', label: 'Dépenses' },
    { id: 'employes', icon: '👨‍💼', label: 'Employés' },
    { 
      id: 'comptabilite', 
      icon: '📚', 
      label: 'Comptabilité Générale',
      submenu: [
        { id: 'compta-parametres', label: 'Paramètre' },
        { id: 'grand-livre', label: 'Grand livre' },
        { id: 'journal', label: 'Écriture de journal' },
        { id: 'reconciliation', label: 'Réconciliation' },
        { id: 'etats-financiers', label: 'États financiers' },
        { id: 'rapport-journaux', label: 'Rapport de journaux' }
      ]
    },
    { id: 'immobilisations', icon: '🏗️', label: 'Immobilisations' },
    { id: 'parametres', icon: '⚙️', label: 'Paramètres' },
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
      case 'depenses':
        return <DependsView />;
      case 'employes':
        return <EmployesView />;
      case 'parametres':
        return <ParametresView />;
      case 'compta-parametres':
        return <ComptabiliteParametreView />;
      case 'etats-financiers':
      case 'grand-livre':
      case 'journal':
      case 'reconciliation':
      case 'rapport-journaux':
        return <ComptabiliteView subView={currentView} />;
      case 'immobilisations':
        return <ImmobilisationsView />;
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
                      className={`nav-item submenu-item ${currentView === subItem.id ? 'active' : ''}`}
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
  const [kpis, setKpis] = useState(null);
  const [ventesData, setVentesData] = useState([]);
  const [depensesData, setDepensesData] = useState([]);
  const [periode, setPeriode] = useState('mois');
  const [typeFiltre, setTypeFiltre] = useState('tous');
  const [moduleFiltre, setModuleFiltre] = useState('tous');
  const COLORS = ['#28a745', '#dc3545', '#0066cc', '#ffc107', '#6f42c1', '#17a2b8'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const kpisRes = await fetch('/api/dashboard/global');
        const kpisData = await kpisRes.json();
        setKpis(kpisData);

        const ventesRes = await fetch('/api/dashboard/ventes-mensuelles');
        setVentesData(await ventesRes.json());

        const depensesRes = await fetch('/api/dashboard/depenses-categories');
        setDepensesData(await depensesRes.json());
      } catch (err) {
        console.error('Erreur dashboard:', err);
      }
    };
    fetchDashboardData();
  }, []);

  if (!kpis) return <div className="view-container"><p>Chargement...</p></div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">📊 Tableau de Bord Global</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>Vue complète de l'entreprise avec KPIs avancés</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px'}}>
        <div>
          <label style={{fontSize: '12px', color: '#666', marginRight: '8px'}}>Période:</label>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="trimestre">Ce trimestre</option>
            <option value="an">Cette année</option>
          </select>
        </div>
        <div>
          <label style={{fontSize: '12px', color: '#666', marginRight: '8px'}}>Type:</label>
          <select value={typeFiltre} onChange={(e) => setTypeFiltre(e.target.value)} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
            <option value="tous">Tous les types</option>
            <option value="ventes">Ventes</option>
            <option value="achats">Achats</option>
            <option value="tresorerie">Trésorerie</option>
          </select>
        </div>
        <div>
          <label style={{fontSize: '12px', color: '#666', marginRight: '8px'}}>Module:</label>
          <select value={moduleFiltre} onChange={(e) => setModuleFiltre(e.target.value)} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
            <option value="tous">Tous les modules</option>
            <option value="clients">Clients</option>
            <option value="fournisseurs">Fournisseurs</option>
            <option value="stock">Stock</option>
            <option value="comptabilite">Comptabilité</option>
          </select>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '30px'}}>
        <div style={{padding: '20px', backgroundColor: '#d4edda', borderRadius: '8px', border: '1px solid #28a745'}}>
          <h4 style={{marginTop: 0}}>💰 Ventes du Mois</h4>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#28a745', marginBottom: '5px'}}>
            {parseFloat(kpis.ventesMois).toLocaleString('fr-FR')} XOF
          </p>
          <small style={{color: '#666'}}>Revenus générés</small>
        </div>

        <div style={{padding: '20px', backgroundColor: '#f8d7da', borderRadius: '8px', border: '1px solid #dc3545'}}>
          <h4 style={{marginTop: 0}}>💸 Dépenses du Mois</h4>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#dc3545', marginBottom: '5px'}}>
            {parseFloat(kpis.depensesMois).toLocaleString('fr-FR')} XOF
          </p>
          <small style={{color: '#666'}}>Charges engagées</small>
        </div>

        <div style={{padding: '20px', backgroundColor: '#cce5ff', borderRadius: '8px', border: '1px solid #0066cc'}}>
          <h4 style={{marginTop: 0}}>📊 Marge Brute</h4>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#0066cc', marginBottom: '5px'}}>
            {kpis.margeBrute}%
          </p>
          <small style={{color: '#666'}}>Rentabilité</small>
        </div>

        <div style={{padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107'}}>
          <h4 style={{marginTop: 0}}>💹 Cashflow</h4>
          <p style={{fontSize: '28px', fontWeight: 'bold', color: '#ffc107', marginBottom: '5px'}}>
            {parseFloat(kpis.cashflow).toLocaleString('fr-FR')} XOF
          </p>
          <small style={{color: '#666'}}>Flux nets</small>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', marginBottom: '30px'}}>
        <div style={{padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px'}}>
          <h4 style={{marginTop: 0}}>⏰ Délai Paiement Client</h4>
          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#0066cc'}}>~{kpis.delaiPaiementClient || 0} jours</p>
          <small style={{color: '#666'}}>Moyenne</small>
        </div>

        <div style={{padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px'}}>
          <h4 style={{marginTop: 0}}>⏰ Délai Paiement Fournisseur</h4>
          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#0066cc'}}>~{kpis.delaiPaiementFournisseur || 0} jours</p>
          <small style={{color: '#666'}}>Moyenne</small>
        </div>

        <div style={{padding: '15px', backgroundColor: '#ffe8e8', borderRadius: '8px'}}>
          <h4 style={{marginTop: 0}}>⚠️ Factures en Retard</h4>
          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#dc3545'}}>{kpis.facturesEnRetard?.nombre || 0}</p>
          <p style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>{parseFloat(kpis.facturesEnRetard?.montant || 0).toLocaleString('fr-FR')} XOF</p>
        </div>

        <div style={{padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px'}}>
          <h4 style={{marginTop: 0}}>📦 Stock Faible</h4>
          <p style={{fontSize: '24px', fontWeight: 'bold', color: '#ffc107'}}>{kpis.stockFaible?.nombre || 0} produits</p>
          <small style={{color: '#666'}}>Sous le minimum</small>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd'}}>
          <h3>📈 Ventes Mensuelles</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ventesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" />
              <YAxis />
              <Tooltip formatter={(value) => `${parseFloat(value).toLocaleString('fr-FR')} XOF`} />
              <Legend />
              <Line type="monotone" dataKey="ventes" stroke="#28a745" strokeWidth={2} dot={{fill: '#28a745', r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd'}}>
          <h3>📊 Répartition Dépenses</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={depensesData.slice(0, 5)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({total}) => `${total}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {depensesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${parseFloat(value).toLocaleString('fr-FR')} XOF`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd'}}>
        <h3>📊 Comparaison Ventes vs Dépenses</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={[
            {nom: 'Mois', Ventes: parseFloat(kpis.ventesMois), Dépenses: parseFloat(kpis.depensesMois), Bénéfice: parseFloat(kpis.cashflow)}
          ]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nom" />
            <YAxis />
            <Tooltip formatter={(value) => `${parseFloat(value).toLocaleString('fr-FR')} XOF`} />
            <Legend />
            <Bar dataKey="Ventes" fill="#28a745" />
            <Bar dataKey="Dépenses" fill="#dc3545" />
            <Bar dataKey="Bénéfice" fill="#0066cc" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{marginTop: '30px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px'}}>
        <h3 style={{marginTop: 0}}>📋 Alertes Importantes</h3>
        {kpis.facturesEnRetard?.nombre > 0 && (
          <div style={{padding: '10px', backgroundColor: '#ffe8e8', borderRadius: '4px', marginBottom: '10px'}}>
            ⚠️ <strong>{kpis.facturesEnRetard.nombre} facture(s) en retard</strong> pour un montant de {parseFloat(kpis.facturesEnRetard.montant).toLocaleString('fr-FR')} XOF
          </div>
        )}
        {kpis.stockFaible?.nombre > 0 && (
          <div style={{padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '10px'}}>
            📦 <strong>{kpis.stockFaible.nombre} produit(s) avec stock faible</strong>
          </div>
        )}
        {kpis.facturesEnRetard?.nombre === 0 && kpis.stockFaible?.nombre === 0 && (
          <div style={{padding: '10px', backgroundColor: '#d4edda', borderRadius: '4px'}}>
            ✅ Aucune alerte - Système opérationnel
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsView() {
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddClient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      if (response.ok) {
        setMessage('✅ Client ajouté avec succès');
        setShowForm(false);
        e.target.reset();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Erreur lors de l\'ajout');
      }
    } catch (error) {
      setMessage('❌ Erreur: ' + error.message);
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">👥 Clients & Ventes</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>
          Gestion complète des clients, devis, factures et suivi des paiements
        </p>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          👥 Clients
        </button>
        <button 
          className={`tab ${activeTab === 'devis' ? 'active' : ''}`}
          onClick={() => setActiveTab('devis')}
        >
          📋 Devis
        </button>
        <button 
          className={`tab ${activeTab === 'factures' ? 'active' : ''}`}
          onClick={() => setActiveTab('factures')}
        >
          📄 Factures
        </button>
        <button 
          className={`tab ${activeTab === 'paiements' ? 'active' : ''}`}
          onClick={() => setActiveTab('paiements')}
        >
          💰 Paiements
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          ⚙️ Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouveau client'}
            </button>
          </div>

          {message && <div style={{padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', color: message.includes('✅') ? '#155724' : '#721c24'}}>{message}</div>}
          {showForm && (
            <div className="form-card">
              <h3>Ajouter un client</h3>
              <form className="professional-form" onSubmit={handleAddClient}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom complet / Raison sociale *</label>
                    <input type="text" name="nom" placeholder="Nom du client" required />
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

      {activeTab === 'devis' && (
        <div className="tab-content"><div className="content-header"><button className="btn-primary">+ Nouveau devis</button></div><div className="metrics-grid" style={{marginBottom: '20px'}}><div className="metric-card"><div className="metric-icon">📋</div><div className="metric-info"><div className="metric-label">En attente</div><div className="metric-value">0</div></div></div><div className="metric-card"><div className="metric-icon">✅</div><div className="metric-info"><div className="metric-label">Acceptés</div><div className="metric-value">0</div></div></div><div className="metric-card"><div className="metric-icon">💰</div><div className="metric-info"><div className="metric-label">Total</div><div className="metric-value">0 FCFA</div></div></div></div><div className="data-table"><table><thead><tr><th>N° Devis</th><th>Client</th><th>Montant</th><th>Date expiration</th><th>Statut</th><th>Actions</th></tr></thead><tbody><tr><td colSpan="6" className="empty-row">Aucun devis</td></tr></tbody></table></div></div>
      )}

      {activeTab === 'factures' && (
        <div className="tab-content"><div className="content-header"><button className="btn-primary">+ Nouvelle facture</button></div><div className="metrics-grid" style={{marginBottom: '20px'}}><div className="metric-card"><div className="metric-icon">📄</div><div className="metric-info"><div className="metric-label">Brouillon</div><div className="metric-value">0</div></div></div><div className="metric-card"><div className="metric-icon">⏰</div><div className="metric-info"><div className="metric-label">Impayées</div><div className="metric-value">0</div></div></div><div className="metric-card"><div className="metric-icon">✅</div><div className="metric-info"><div className="metric-label">Payées</div><div className="metric-value">0</div></div></div></div><div className="data-table"><table><thead><tr><th>N° Facture</th><th>Client</th><th>Montant TTC</th><th>Payé</th><th>Solde</th><th>Statut</th><th>Actions</th></tr></thead><tbody><tr><td colSpan="7" className="empty-row">Aucune facture</td></tr></tbody></table></div></div>
      )}

      {activeTab === 'paiements' && (
        <div className="tab-content"><div className="content-header"><button className="btn-primary">+ Nouveau paiement</button></div><div className="metrics-grid" style={{marginBottom: '20px'}}><div className="metric-card"><div className="metric-icon">💳</div><div className="metric-info"><div className="metric-label">Ce mois</div><div className="metric-value">0 FCFA</div></div></div><div className="metric-card"><div className="metric-icon">⚠️</div><div className="metric-info"><div className="metric-label">Retards</div><div className="metric-value">0</div></div></div><div className="metric-card"><div className="metric-icon">💰</div><div className="metric-info"><div className="metric-label">Encours</div><div className="metric-value">0 FCFA</div></div></div></div><div className="data-table"><table><thead><tr><th>Date</th><th>N° Facture</th><th>Client</th><th>Montant</th><th>Mode</th><th>Actions</th></tr></thead><tbody><tr><td colSpan="6" className="empty-row">Aucun paiement</td></tr></tbody></table></div></div>
      )}
    </div>
  );
}

function FournisseursView() {
  const [activeTab, setActiveTab] = useState('liste');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddFournisseur = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const response = await fetch('/api/fournisseurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      if (response.ok) {
        setMessage('✅ Fournisseur ajouté avec succès');
        setShowForm(false);
        e.target.reset();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('❌ Erreur lors de l\'ajout');
      }
    } catch (error) {
      setMessage('❌ Erreur: ' + error.message);
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">🏭 Fournisseurs & Achats</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>
          Gestion complète des achats : fournisseurs, commandes, réceptions, factures et paiements
        </p>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'liste' ? 'active' : ''}`}
          onClick={() => setActiveTab('liste')}
        >
          📋 Fournisseurs
        </button>
        <button 
          className={`tab ${activeTab === 'commandes' ? 'active' : ''}`}
          onClick={() => setActiveTab('commandes')}
        >
          🛒 Bons de commande
        </button>
        <button 
          className={`tab ${activeTab === 'receptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('receptions')}
        >
          📦 Réceptions
        </button>
        <button 
          className={`tab ${activeTab === 'factures' ? 'active' : ''}`}
          onClick={() => setActiveTab('factures')}
        >
          📄 Factures
        </button>
        <button 
          className={`tab ${activeTab === 'paiements' ? 'active' : ''}`}
          onClick={() => setActiveTab('paiements')}
        >
          💰 Paiements
        </button>
        <button 
          className={`tab ${activeTab === 'parametres' ? 'active' : ''}`}
          onClick={() => setActiveTab('parametres')}
        >
          ⚙️ Paramètres
        </button>
      </div>

      {activeTab === 'liste' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouveau fournisseur'}
            </button>
          </div>

          {message && <div style={{padding: '10px', marginBottom: '15px', borderRadius: '4px', backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da', color: message.includes('✅') ? '#155724' : '#721c24'}}>{message}</div>}
          {showForm && (
            <div className="form-card">
              <h3>Ajouter un fournisseur</h3>
              <form className="professional-form" onSubmit={handleAddFournisseur}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Raison sociale *</label>
                    <input type="text" name="raisonSociale" placeholder="Nom du fournisseur" required />
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

      {activeTab === 'commandes' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouvelle commande'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Créer un bon de commande</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>N° Commande *</label>
                    <input type="text" placeholder="CMD-2025-0001 (auto)" disabled />
                  </div>
                  <div className="form-group">
                    <label>Fournisseur *</label>
                    <select required>
                      <option value="">Sélectionner un fournisseur</option>
                      <option>Fournisseur A</option>
                      <option>Fournisseur B</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date commande *</label>
                    <input type="date" required />
                  </div>
                  <div className="form-group">
                    <label>Date livraison prévue</label>
                    <input type="date" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Articles commandés</label>
                    <div className="data-table" style={{marginTop: '10px'}}>
                      <table>
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                            <th>Remise %</th>
                            <th>Total</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan="6" className="empty-row">
                              <button type="button" className="btn-secondary btn-small">+ Ajouter un article</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mode de livraison</label>
                    <select>
                      <option>Franco de port</option>
                      <option>Retrait en magasin</option>
                      <option>Livraison express</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Conditions de livraison</label>
                    <input type="text" placeholder="Ex: Livraison en 2 fois" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Notes / Remarques</label>
                    <textarea rows="3" placeholder="Informations complémentaires"></textarea>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Créer le bon de commande
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="metrics-grid" style={{marginBottom: '20px'}}>
            <div className="metric-card">
              <div className="metric-icon">📝</div>
              <div className="metric-info">
                <div className="metric-label">Brouillon</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">✅</div>
              <div className="metric-info">
                <div className="metric-label">Confirmées</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div className="metric-info">
                <div className="metric-label">En livraison</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-info">
                <div className="metric-label">Total commandes</div>
                <div className="metric-value">0 FCFA</div>
              </div>
            </div>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>N° Commande</th>
                  <th>Date</th>
                  <th>Fournisseur</th>
                  <th>Montant HT</th>
                  <th>Montant TTC</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="7" className="empty-row">Aucune commande enregistrée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'receptions' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouvelle réception'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Enregistrer une réception de marchandises</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Bon de commande *</label>
                    <select required>
                      <option value="">Sélectionner une commande</option>
                      <option>CMD-2025-0001 - Fournisseur A</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date réception *</label>
                    <input type="date" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>N° Bon de livraison</label>
                    <input type="text" placeholder="Numéro du BL fournisseur" />
                  </div>
                  <div className="form-group">
                    <label>Transporteur</label>
                    <input type="text" placeholder="Nom du transporteur" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Articles reçus</label>
                    <div className="data-table" style={{marginTop: '10px'}}>
                      <table>
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Qté commandée</th>
                            <th>Qté déjà reçue</th>
                            <th>Qté à recevoir</th>
                            <th>État</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan="5" className="empty-row">Sélectionnez une commande</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Remarques / État de la marchandise</label>
                    <textarea rows="3" placeholder="Commentaires sur la réception, dommages éventuels..."></textarea>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Valider la réception
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date réception</th>
                  <th>N° Commande</th>
                  <th>Fournisseur</th>
                  <th>N° BL</th>
                  <th>Articles reçus</th>
                  <th>Statut stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="7" className="empty-row">Aucune réception enregistrée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'factures' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouvelle facture'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Créer une facture fournisseur</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>N° Facture interne</label>
                    <input type="text" placeholder="FACT-ACH-2025-0001 (auto)" disabled />
                  </div>
                  <div className="form-group">
                    <label>N° Facture fournisseur *</label>
                    <input type="text" placeholder="Numéro facture du fournisseur" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fournisseur *</label>
                    <select required>
                      <option value="">Sélectionner un fournisseur</option>
                      <option>Fournisseur A</option>
                      <option>Fournisseur B</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Bon de commande (optionnel)</label>
                    <select>
                      <option value="">Aucun</option>
                      <option>CMD-2025-0001</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date facture *</label>
                    <input type="date" required />
                  </div>
                  <div className="form-group">
                    <label>Date échéance *</label>
                    <input type="date" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Articles / Services</label>
                    <div className="data-table" style={{marginTop: '10px'}}>
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                            <th>TVA %</th>
                            <th>Total HT</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan="6" className="empty-row">
                              <button type="button" className="btn-secondary btn-small">+ Ajouter une ligne</button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Total HT (FCFA)</label>
                    <input type="number" placeholder="0" disabled />
                  </div>
                  <div className="form-group">
                    <label>Total TVA (FCFA)</label>
                    <input type="number" placeholder="0" disabled />
                  </div>
                  <div className="form-group">
                    <label>Total TTC (FCFA)</label>
                    <input type="number" placeholder="0" disabled />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea rows="2" placeholder="Remarques ou conditions"></textarea>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer la facture
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="metrics-grid" style={{marginBottom: '20px'}}>
            <div className="metric-card">
              <div className="metric-icon">📄</div>
              <div className="metric-info">
                <div className="metric-label">Brouillon</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">⏰</div>
              <div className="metric-info">
                <div className="metric-label">À payer</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">✅</div>
              <div className="metric-info">
                <div className="metric-label">Payées</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">💵</div>
              <div className="metric-info">
                <div className="metric-label">Total dettes</div>
                <div className="metric-value">0 FCFA</div>
              </div>
            </div>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Date</th>
                  <th>Fournisseur</th>
                  <th>Montant TTC</th>
                  <th>Montant payé</th>
                  <th>Solde restant</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="9" className="empty-row">Aucune facture enregistrée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'paiements' && (
        <div className="tab-content">
          <div className="content-header">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Annuler' : '+ Nouveau paiement'}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <h3>Enregistrer un paiement fournisseur</h3>
              <form className="professional-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Facture à payer *</label>
                    <select required>
                      <option value="">Sélectionner une facture</option>
                      <option>FACT-ACH-2025-0001 - Fournisseur A (50 000 FCFA)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Montant à payer (FCFA) *</label>
                    <input type="number" placeholder="Montant" required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date paiement *</label>
                    <input type="date" required />
                  </div>
                  <div className="form-group">
                    <label>Mode de paiement *</label>
                    <select required>
                      <option>Virement bancaire</option>
                      <option>Chèque</option>
                      <option>Espèces</option>
                      <option>Mobile Money</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Compte bancaire *</label>
                    <select required>
                      <option>Compte principal</option>
                      <option>Banque Atlantique</option>
                      <option>Caisse</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Référence paiement</label>
                    <input type="text" placeholder="N° chèque, virement..." />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group full-width">
                    <label>Notes</label>
                    <textarea rows="2" placeholder="Remarques"></textarea>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary">
                    Enregistrer le paiement
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="metrics-grid" style={{marginBottom: '20px'}}>
            <div className="metric-card">
              <div className="metric-icon">💳</div>
              <div className="metric-info">
                <div className="metric-label">Paiements ce mois</div>
                <div className="metric-value">0 FCFA</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">⏰</div>
              <div className="metric-info">
                <div className="metric-label">Échéances &lt; 7 jours</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">⚠️</div>
              <div className="metric-info">
                <div className="metric-label">Retards de paiement</div>
                <div className="metric-value">0</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">💰</div>
              <div className="metric-info">
                <div className="metric-label">Total à régler</div>
                <div className="metric-value">0 FCFA</div>
              </div>
            </div>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>N° Facture</th>
                  <th>Fournisseur</th>
                  <th>Montant payé</th>
                  <th>Mode paiement</th>
                  <th>Référence</th>
                  <th>Compte</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="8" className="empty-row">Aucun paiement enregistré</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TresorerieView() {
  const [comptes, setComptes] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [encaissements, setEncaissements] = useState([]);
  const [decaissements, setDecaissements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [previsions, setPrevisions] = useState(null);
  const [activeTab, setActiveTab] = useState('suivi');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Comptes avec solde initial + solde actuel
        const comptesRes = await fetch('/api/tresorerie/comptes/1');
        setComptes(await comptesRes.json());

        // Mouvements
        const mouvementsRes = await fetch('/api/tresorerie/mouvements/1');
        setMouvements(await mouvementsRes.json());

        // Encaissements
        const encaisRes = await fetch('/api/tresorerie/encaissements/1');
        const encaisData = await encaisRes.json();
        setEncaissements(encaisData.encaissements || []);

        // Décaissements
        const decaisRes = await fetch('/api/tresorerie/decaissements/1');
        const decaisData = await decaisRes.json();
        setDecaissements(decaisData.decaissements || []);

        // Catégories
        const catRes = await fetch('/api/tresorerie/categories/1');
        setCategories(await catRes.json());

        // Prévisions
        const prevRes = await fetch('/api/tresorerie/previsions/1');
        setPrevisions(await prevRes.json());
      } catch (err) {
        console.error('Erreur trésorerie:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">💳 Trésorerie</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>Suivi des soldes, mouvements et prévisions</p>
      </div>

      <div className="tabs" style={{marginTop: '20px'}}>
        <button 
          className={`tab ${activeTab === 'suivi' ? 'active' : ''}`}
          onClick={() => setActiveTab('suivi')}
        >
          📊 Suivi des Soldes
        </button>
        <button 
          className={`tab ${activeTab === 'mouvements' ? 'active' : ''}`}
          onClick={() => setActiveTab('mouvements')}
        >
          📋 Mouvements
        </button>
        <button 
          className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          🏷️ Catégories
        </button>
        <button 
          className={`tab ${activeTab === 'previsions' ? 'active' : ''}`}
          onClick={() => setActiveTab('previsions')}
        >
          🔮 Prévisions
        </button>
      </div>

      {activeTab === 'suivi' && (
        <div className="tab-content">
          <h3>💰 Suivi Banque</h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '30px'}}>
            {comptes.filter(c => c.type === 'banque').map(compte => (
              <div key={compte.id} style={{padding: '20px', backgroundColor: '#e8f4f8', borderRadius: '8px', border: '2px solid #0066cc'}}>
                <h4 style={{marginTop: 0, marginBottom: '8px'}}>{compte.nomCompte}</h4>
                <p style={{color: '#666', fontSize: '12px', marginBottom: '10px'}}>N°: {compte.numeroCompte || '-'} | {compte.banque || 'Banque'}</p>
                <div style={{marginBottom: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px'}}>
                  <small style={{color: '#666'}}>Solde initial</small>
                  <p style={{margin: '3px 0', fontSize: '14px', fontWeight: 'bold'}}>{parseFloat(compte.soldeInitial).toLocaleString('fr-FR')} XOF</p>
                </div>
                <div style={{marginBottom: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px'}}>
                  <small style={{color: '#666'}}>Solde actuel</small>
                  <p style={{margin: '3px 0', fontSize: '18px', fontWeight: 'bold', color: compte.soldeActuel >= 0 ? '#28a745' : '#dc3545'}}>
                    {parseFloat(compte.soldeActuel).toLocaleString('fr-FR')} XOF
                  </p>
                </div>
              </div>
            ))}
          </div>

          <h3>🏪 Suivi Caisse</h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginBottom: '30px'}}>
            {comptes.filter(c => c.type === 'caisse').map(compte => (
              <div key={compte.id} style={{padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107'}}>
                <h4 style={{marginTop: 0, marginBottom: '8px'}}>{compte.nomCompte}</h4>
                <div style={{marginBottom: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px'}}>
                  <small style={{color: '#666'}}>Solde initial</small>
                  <p style={{margin: '3px 0', fontSize: '14px', fontWeight: 'bold'}}>{parseFloat(compte.soldeInitial).toLocaleString('fr-FR')} XOF</p>
                </div>
                <div style={{marginBottom: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px'}}>
                  <small style={{color: '#666'}}>Solde actuel</small>
                  <p style={{margin: '3px 0', fontSize: '18px', fontWeight: 'bold', color: compte.soldeActuel >= 0 ? '#28a745' : '#dc3545'}}>
                    {parseFloat(compte.soldeActuel).toLocaleString('fr-FR')} XOF
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mouvements' && (
        <div className="tab-content">
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px'}}>
            <div style={{padding: '20px', backgroundColor: '#d4edda', borderRadius: '8px', border: '1px solid #28a745'}}>
              <h3 style={{marginTop: 0, marginBottom: '15px'}}>📥 Encaissements</h3>
              <p style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745', marginBottom: '10px'}}>
                +{encaissements.reduce((sum, e) => sum + parseFloat(e.montant || 0), 0).toLocaleString('fr-FR')} XOF
              </p>
              <small style={{color: '#666'}}>{encaissements.length} transactions</small>
            </div>
            <div style={{padding: '20px', backgroundColor: '#f8d7da', borderRadius: '8px', border: '1px solid #dc3545'}}>
              <h3 style={{marginTop: 0, marginBottom: '15px'}}>📤 Décaissements</h3>
              <p style={{fontSize: '24px', fontWeight: 'bold', color: '#dc3545', marginBottom: '10px'}}>
                -{decaissements.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0).toLocaleString('fr-FR')} XOF
              </p>
              <small style={{color: '#666'}}>{decaissements.length} transactions</small>
            </div>
          </div>

          <h3>Historique des Mouvements</h3>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
                <th style={{padding: '12px', textAlign: 'left'}}>Date</th>
                <th style={{padding: '12px', textAlign: 'left'}}>Type</th>
                <th style={{padding: '12px', textAlign: 'left'}}>Description</th>
                <th style={{padding: '12px', textAlign: 'left'}}>Catégorie</th>
                <th style={{padding: '12px', textAlign: 'left'}}>Tiers</th>
                <th style={{padding: '12px', textAlign: 'right'}}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.length > 0 ? (
                mouvements.map(mv => (
                  <tr key={mv.id} style={{borderBottom: '1px solid #dee2e6'}}>
                    <td style={{padding: '12px'}}>{new Date(mv.dateTransaction).toLocaleDateString('fr-FR')}</td>
                    <td style={{padding: '12px'}}>
                      <span style={{padding: '4px 8px', borderRadius: '4px', backgroundColor: mv.type === 'encaissement' ? '#d4edda' : '#f8d7da', fontSize: '12px', fontWeight: 'bold'}}>
                        {mv.type === 'encaissement' ? '📥' : '📤'}
                      </span>
                    </td>
                    <td style={{padding: '12px'}}>{mv.description || '-'}</td>
                    <td style={{padding: '12px'}}>{mv.categorie || '-'}</td>
                    <td style={{padding: '12px'}}>{mv.tiersNom || '-'}</td>
                    <td style={{padding: '12px', textAlign: 'right', fontWeight: 'bold', color: mv.type === 'encaissement' ? '#28a745' : '#dc3545'}}>
                      {mv.type === 'encaissement' ? '+' : '-'} {parseFloat(mv.montant).toLocaleString('fr-FR')} XOF
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#999'}}>Aucun mouvement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="tab-content">
          <h3>🏷️ Catégories de Flux de Trésorerie</h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
            {categories.map(cat => (
              <div key={cat.id} style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid', borderColor: cat.color, textAlign: 'center'}}>
                <span style={{fontSize: '32px'}}>{cat.icon}</span>
                <h4 style={{marginTop: '10px', marginBottom: '0', color: cat.color}}>{cat.nom}</h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'previsions' && previsions && (
        <div className="tab-content">
          <h3>🔮 Prévisions de Trésorerie</h3>
          
          <div style={{marginBottom: '30px'}}>
            <h4>📊 Flux Futurs Prévus</h4>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px'}}>
              <div style={{padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px'}}>
                <small style={{color: '#666'}}>Cette semaine</small>
                <p style={{fontSize: '20px', fontWeight: 'bold', color: '#0066cc', marginTop: '5px'}}>
                  {previsions.fluxFuturs.semaine.toLocaleString('fr-FR')} XOF
                </p>
              </div>
              <div style={{padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px'}}>
                <small style={{color: '#666'}}>Ce mois</small>
                <p style={{fontSize: '20px', fontWeight: 'bold', color: '#0066cc', marginTop: '5px'}}>
                  {previsions.fluxFuturs.mois.toLocaleString('fr-FR')} XOF
                </p>
              </div>
              <div style={{padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px'}}>
                <small style={{color: '#666'}}>Ce trimestre</small>
                <p style={{fontSize: '20px', fontWeight: 'bold', color: '#0066cc', marginTop: '5px'}}>
                  {previsions.fluxFuturs.trimestre.toLocaleString('fr-FR')} XOF
                </p>
              </div>
            </div>
          </div>

          <div style={{marginBottom: '30px'}}>
            <h4>💰 Factures Clients à Venir</h4>
            <div style={{padding: '15px', backgroundColor: '#d4edda', borderRadius: '8px', marginBottom: '15px'}}>
              <p style={{margin: 0}}><strong>{previsions.facturesAVenir.count}</strong> factures | Total: <strong>{previsions.facturesAVenir.total.toLocaleString('fr-FR')} XOF</strong></p>
            </div>
            {previsions.facturesAVenir.items.length > 0 && (
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                <thead>
                  <tr style={{backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6'}}>
                    <th style={{padding: '8px', textAlign: 'left'}}>Facture</th>
                    <th style={{padding: '8px', textAlign: 'left'}}>Client</th>
                    <th style={{padding: '8px', textAlign: 'right'}}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {previsions.facturesAVenir.items.map((f, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #dee2e6'}}>
                      <td style={{padding: '8px'}}>{f.numero || '-'}</td>
                      <td style={{padding: '8px'}}>{f.clientNom || '-'}</td>
                      <td style={{padding: '8px', textAlign: 'right'}}>{parseFloat(f.montantTTC).toLocaleString('fr-FR')} XOF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h4>🏭 Échéances Fournisseur</h4>
            <div style={{padding: '15px', backgroundColor: '#f8d7da', borderRadius: '8px', marginBottom: '15px'}}>
              <p style={{margin: 0}}><strong>{previsions.echancesFournisseur.count}</strong> factures | Total: <strong>{previsions.echancesFournisseur.total.toLocaleString('fr-FR')} XOF</strong></p>
            </div>
            {previsions.echancesFournisseur.items.length > 0 && (
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                <thead>
                  <tr style={{backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6'}}>
                    <th style={{padding: '8px', textAlign: 'left'}}>Facture</th>
                    <th style={{padding: '8px', textAlign: 'left'}}>Fournisseur</th>
                    <th style={{padding: '8px', textAlign: 'right'}}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {previsions.echancesFournisseur.items.map((a, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #dee2e6'}}>
                      <td style={{padding: '8px'}}>{a.numero || '-'}</td>
                      <td style={{padding: '8px'}}>{a.fournisseurNom || '-'}</td>
                      <td style={{padding: '8px', textAlign: 'right'}}>{parseFloat(a.montantTTC).toLocaleString('fr-FR')} XOF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StockView() {
  const [message, setMessage] = useState("");
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
    'rapport-journaux': 'Rapport de journaux',
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

function ParametresView() {
  const [activeTab, setActiveTab] = useState('general');
  const [auditLogs, setAuditLogs] = useState([]);

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/parametres/audit-logs?entrepriseId=1&limit=50');
      const data = await response.json();
      setAuditLogs(data);
    } catch (error) {
      console.error('Erreur chargement audit logs:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">⚙️ Paramètres Entreprise</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>Configuration générale et paramètres comptables</p>
      </div>

      {/* Onglets */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb'}}>
        <button 
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
          style={{padding: '10px 15px', cursor: 'pointer', borderBottom: activeTab === 'general' ? '2px solid #3b82f6' : 'none'}}
        >
          ⚙️ Paramètres généraux
        </button>
        <button 
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
          style={{padding: '10px 15px', cursor: 'pointer', borderBottom: activeTab === 'audit' ? '2px solid #3b82f6' : 'none'}}
        >
          📋 Audit Log
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Entreprise</h3>
            <div className="settings-list">
              <div className="settings-item"><span>Raison sociale</span><span>Mon Entreprise</span></div>
              <div className="settings-item"><span>Année fiscale</span><span>2025</span></div>
              <div className="settings-item"><span>Système comptable</span><span>SYSCOHADA</span></div>
              <div className="settings-item"><span>Devise par défaut</span><span>XOF (FCFA)</span></div>
              <div className="settings-item"><span>Pays</span><span>Côte d'Ivoire</span></div>
            </div>
            <button className="btn-primary btn-small">Modifier</button>
          </div>
          <div className="settings-card">
            <h3>Numérotation automatique</h3>
            <div className="settings-list">
              <div className="settings-item"><span>Devis</span><span>DEV-2025-0001</span></div>
              <div className="settings-item"><span>Factures</span><span>FACT-2025-0001</span></div>
              <div className="settings-item"><span>Commandes achat</span><span>CMD-2025-0001</span></div>
              <div className="settings-item"><span>Factures fournisseurs</span><span>FACT-ACH-2025-0001</span></div>
            </div>
          </div>
          <div className="settings-card">
            <h3>TVA et Fiscalité</h3>
            <div className="settings-list">
              <div className="settings-item"><span>Taux TVA standard</span><span>18%</span></div>
              <div className="settings-item"><span>Taux TVA réduit</span><span>10%</span></div>
              <div className="settings-item"><span>Régime d'imposition</span><span>Normal</span></div>
            </div>
            <button className="btn-secondary btn-small">Modifier</button>
          </div>
          <div className="settings-card">
            <h3>Comptes bancaires</h3>
            <div className="settings-list">
              <div className="settings-item"><span>Caisse principale</span><span>0 FCFA</span></div>
            </div>
            <button className="btn-secondary btn-small">+ Ajouter un compte</button>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
          <h3 style={{marginTop: 0}}>📋 Historique des Opérations</h3>
          <p style={{fontSize: '12px', color: '#6c757d', marginBottom: '15px'}}>Audit complet de toutes les actions effectuées dans le système</p>
          
          {auditLogs.length === 0 ? (
            <p style={{textAlign: 'center', color: '#6c757d', padding: '20px'}}>Aucune opération enregistrée</p>
          ) : (
            <div className="data-table">
              <table style={{width: '100%', fontSize: '13px'}}>
                <thead>
                  <tr style={{backgroundColor: '#f8f9fa'}}>
                    <th>Date</th>
                    <th>Utilisateur</th>
                    <th>Action</th>
                    <th>Tableau</th>
                    <th>Description</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.slice(0, 20).map((log, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #e5e7eb'}}>
                      <td>{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                      <td>{log.userId || '-'}</td>
                      <td><span style={{backgroundColor: log.action === 'CREATE' ? '#d1fae5' : log.action === 'UPDATE' ? '#dbeafe' : '#fee2e2', padding: '4px 8px', borderRadius: '4px', fontSize: '11px'}}>{log.action}</span></td>
                      <td>{log.table}</td>
                      <td style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{log.description || '-'}</td>
                      <td style={{fontSize: '11px'}}>{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DependsView() {
  const [depenses, setDepenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    montant: '',
    categorie: 'transport',
    date: new Date().toISOString().split('T')[0],
    justificatif: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepenses = async () => {
      try {
        const res = await fetch('/api/depenses');
        if (res.ok) {
          const data = await res.json();
          setDepenses(data);
        }
      } catch (err) {
        console.error('Erreur chargement dépenses:', err);
      }
    };
    fetchDepenses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/depenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const newDepense = await res.json();
        setDepenses([...depenses, newDepense]);
        setFormData({ description: '', montant: '', categorie: 'transport', date: new Date().toISOString().split('T')[0], justificatif: '' });
        setShowForm(false);
      }
    } catch (err) {
      console.error('Erreur création dépense:', err);
    }
    setLoading(false);
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">💸 Dépenses & Notes de Frais</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{marginTop: '0'}}>
          {showForm ? 'Annuler' : '➕ Nouvelle dépense'}
        </button>
      </div>

      {showForm && (
        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px'}}>
          <h3>Enregistrer une dépense</h3>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: '15px'}}>
              <label>Description</label>
              <input 
                type="text" 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Ex: Carburant, Repas client..."
                required
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
            </div>
            <div style={{marginBottom: '15px'}}>
              <label>Montant (XOF)</label>
              <input 
                type="number" 
                value={formData.montant}
                onChange={(e) => setFormData({...formData, montant: e.target.value})}
                placeholder="0.00"
                required
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
            </div>
            <div style={{marginBottom: '15px'}}>
              <label>Catégorie</label>
              <select 
                value={formData.categorie}
                onChange={(e) => setFormData({...formData, categorie: e.target.value})}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              >
                <option value="transport">Transport</option>
                <option value="repas">Repas</option>
                <option value="fournitures">Fournitures</option>
                <option value="autres">Autres</option>
              </select>
            </div>
            <div style={{marginBottom: '15px'}}>
              <label>Date</label>
              <input 
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '20px'}}>
        <thead>
          <tr style={{backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
            <th style={{padding: '12px', textAlign: 'left'}}>Date</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Description</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Catégorie</th>
            <th style={{padding: '12px', textAlign: 'right'}}>Montant</th>
            <th style={{padding: '12px', textAlign: 'center'}}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {depenses.length > 0 ? (
            depenses.map(dep => (
              <tr key={dep.id} style={{borderBottom: '1px solid #dee2e6'}}>
                <td style={{padding: '12px'}}>{new Date(dep.date).toLocaleDateString('fr-FR')}</td>
                <td style={{padding: '12px'}}>{dep.description}</td>
                <td style={{padding: '12px'}}>{dep.categorie}</td>
                <td style={{padding: '12px', textAlign: 'right'}}>{dep.montant} XOF</td>
                <td style={{padding: '12px', textAlign: 'center'}}>
                  <span style={{padding: '4px 8px', borderRadius: '4px', backgroundColor: '#e7f3ff', color: '#0066cc', fontSize: '12px'}}>
                    {dep.statut || 'En attente'}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" style={{padding: '20px', textAlign: 'center', color: '#999'}}>Aucune dépense enregistrée</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmployesView() {
  const [employes, setEmployes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    poste: '',
    dateEmbauche: new Date().toISOString().split('T')[0],
    salaire: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEmployes = async () => {
      try {
        const res = await fetch('/api/employes');
        if (res.ok) {
          const data = await res.json();
          setEmployes(data);
        }
      } catch (err) {
        console.error('Erreur chargement employés:', err);
      }
    };
    fetchEmployes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/employes/${editingId}` : '/api/employes';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const data = await res.json();
        if (editingId) {
          setEmployes(employes.map(e => e.id === editingId ? data : e));
        } else {
          setEmployes([...employes, data]);
        }
        setFormData({ nom: '', prenom: '', email: '', poste: '', dateEmbauche: new Date().toISOString().split('T')[0], salaire: '' });
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Confirmer la suppression?')) {
      try {
        const res = await fetch(`/api/employes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setEmployes(employes.filter(e => e.id !== id));
        }
      } catch (err) {
        console.error('Erreur suppression:', err);
      }
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">👨‍💼 Ressources Humaines</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{marginTop: '0'}}>
          {showForm ? 'Annuler' : '➕ Nouvel employé'}
        </button>
      </div>

      {showForm && (
        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px'}}>
          <h3>{editingId ? 'Modifier employé' : 'Ajouter employé'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
              <div>
                <label>Nom</label>
                <input 
                  type="text" 
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div>
                <label>Prénom</label>
                <input 
                  type="text" 
                  value={formData.prenom}
                  onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
              <div>
                <label>Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div>
                <label>Poste</label>
                <input 
                  type="text" 
                  value={formData.poste}
                  onChange={(e) => setFormData({...formData, poste: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
              <div>
                <label>Date d'embauche</label>
                <input 
                  type="date"
                  value={formData.dateEmbauche}
                  onChange={(e) => setFormData({...formData, dateEmbauche: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div>
                <label>Salaire (XOF)</label>
                <input 
                  type="number" 
                  value={formData.salaire}
                  onChange={(e) => setFormData({...formData, salaire: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : editingId ? 'Modifier' : 'Ajouter'}
            </button>
          </form>
        </div>
      )}

      <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '20px'}}>
        <thead>
          <tr style={{backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
            <th style={{padding: '12px', textAlign: 'left'}}>Nom</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Email</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Poste</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Embauche</th>
            <th style={{padding: '12px', textAlign: 'right'}}>Salaire</th>
            <th style={{padding: '12px', textAlign: 'center'}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employes.length > 0 ? (
            employes.map(emp => (
              <tr key={emp.id} style={{borderBottom: '1px solid #dee2e6'}}>
                <td style={{padding: '12px'}}>{emp.prenom} {emp.nom}</td>
                <td style={{padding: '12px'}}>{emp.email}</td>
                <td style={{padding: '12px'}}>{emp.poste}</td>
                <td style={{padding: '12px'}}>{new Date(emp.dateEmbauche).toLocaleDateString('fr-FR')}</td>
                <td style={{padding: '12px', textAlign: 'right'}}>{emp.salaire} XOF</td>
                <td style={{padding: '12px', textAlign: 'center'}}>
                  <button onClick={() => { setFormData(emp); setEditingId(emp.id); setShowForm(true); }} style={{marginRight: '8px', cursor: 'pointer', background: 'none', border: 'none', color: '#0066cc'}}>✏️</button>
                  <button onClick={() => handleDelete(emp.id)} style={{cursor: 'pointer', background: 'none', border: 'none', color: '#dc3545'}}>🗑️</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#999'}}>Aucun employé</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ImmobilisationsView() {
  const [immobilisations, setImmobilisations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    valeurAcquisition: '',
    dateAcquisition: new Date().toISOString().split('T')[0],
    dureeVie: '',
    typeAmortissement: 'lineaire',
    categorie: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchImmobilisations = async () => {
      try {
        const res = await fetch('/api/immobilisations');
        if (res.ok) {
          const data = await res.json();
          setImmobilisations(data);
        }
      } catch (err) {
        console.error('Erreur chargement immobilisations:', err);
      }
    };
    fetchImmobilisations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/immobilisations/${editingId}` : '/api/immobilisations';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const data = await res.json();
        if (editingId) {
          setImmobilisations(immobilisations.map(i => i.id === editingId ? data : i));
        } else {
          setImmobilisations([...immobilisations, data]);
        }
        setFormData({ nom: '', description: '', valeurAcquisition: '', dateAcquisition: new Date().toISOString().split('T')[0], dureeVie: '', typeAmortissement: 'lineaire', categorie: '' });
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Confirmer la suppression?')) {
      try {
        const res = await fetch(`/api/immobilisations/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setImmobilisations(immobilisations.filter(i => i.id !== id));
        }
      } catch (err) {
        console.error('Erreur suppression:', err);
      }
    }
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">🏗️ Immobilisations</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); }} style={{marginTop: '0'}}>
          {showForm ? 'Annuler' : '➕ Nouvelle immobilisation'}
        </button>
      </div>

      {showForm && (
        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '20px'}}>
          <h3>{editingId ? 'Modifier' : 'Ajouter immobilisation'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom: '15px'}}>
              <label>Nom de l'immobilisation</label>
              <input 
                type="text" 
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                placeholder="Ex: Véhicule, Ordinateur..."
                required
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
              />
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
              <div>
                <label>Valeur d'acquisition (XOF)</label>
                <input 
                  type="number" 
                  value={formData.valeurAcquisition}
                  onChange={(e) => setFormData({...formData, valeurAcquisition: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div>
                <label>Date d'acquisition</label>
                <input 
                  type="date"
                  value={formData.dateAcquisition}
                  onChange={(e) => setFormData({...formData, dateAcquisition: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
              <div>
                <label>Durée de vie (années)</label>
                <input 
                  type="number" 
                  value={formData.dureeVie}
                  onChange={(e) => setFormData({...formData, dureeVie: e.target.value})}
                  required
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                />
              </div>
              <div>
                <label>Type d'amortissement</label>
                <select 
                  value={formData.typeAmortissement}
                  onChange={(e) => setFormData({...formData, typeAmortissement: e.target.value})}
                  style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}
                >
                  <option value="lineaire">Linéaire</option>
                  <option value="degressif">Dégressif</option>
                </select>
              </div>
            </div>
            <div style={{marginBottom: '15px'}}>
              <label>Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px'}}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enregistrement...' : editingId ? 'Modifier' : 'Ajouter'}
            </button>
          </form>
        </div>
      )}

      <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '20px'}}>
        <thead>
          <tr style={{backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6'}}>
            <th style={{padding: '12px', textAlign: 'left'}}>Nom</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Valeur</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Date Acquisition</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Durée (ans)</th>
            <th style={{padding: '12px', textAlign: 'left'}}>Amortissement</th>
            <th style={{padding: '12px', textAlign: 'center'}}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {immobilisations.length > 0 ? (
            immobilisations.map(imm => (
              <tr key={imm.id} style={{borderBottom: '1px solid #dee2e6'}}>
                <td style={{padding: '12px'}}>{imm.nom}</td>
                <td style={{padding: '12px'}}>{imm.valeurAcquisition} XOF</td>
                <td style={{padding: '12px'}}>{new Date(imm.dateAcquisition).toLocaleDateString('fr-FR')}</td>
                <td style={{padding: '12px'}}>{imm.dureeVie}</td>
                <td style={{padding: '12px'}}>{imm.typeAmortissement}</td>
                <td style={{padding: '12px', textAlign: 'center'}}>
                  <button onClick={() => { setFormData(imm); setEditingId(imm.id); setShowForm(true); }} style={{marginRight: '8px', cursor: 'pointer', background: 'none', border: 'none', color: '#0066cc'}}>✏️</button>
                  <button onClick={() => handleDelete(imm.id)} style={{cursor: 'pointer', background: 'none', border: 'none', color: '#dc3545'}}>🗑️</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" style={{padding: '20px', textAlign: 'center', color: '#999'}}>Aucune immobilisation</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ComptabiliteParametreView() {
  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">⚙️ Paramètres Comptabilité</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>Configuration des paramètres comptables généraux</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px'}}>
        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
          <h3>📊 Exercice comptable</h3>
          <div style={{marginTop: '15px'}}>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Début exercice</label>
              <input type="date" style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}} />
            </div>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Fin exercice</label>
              <input type="date" style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}} />
            </div>
            <button className="btn-primary" style={{width: '100%'}}>Enregistrer</button>
          </div>
        </div>

        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
          <h3>📚 Plan comptable</h3>
          <div style={{marginTop: '15px'}}>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Système comptable</label>
              <select style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}>
                <option>SYSCOHADA (Afrique de l'Ouest)</option>
                <option>IFRS (International)</option>
                <option>PCG (France)</option>
              </select>
            </div>
            <button className="btn-primary" style={{width: '100%'}}>Enregistrer</button>
          </div>
        </div>

        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
          <h3>💱 Devise et TVA</h3>
          <div style={{marginTop: '15px'}}>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Devise principale</label>
              <select style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}}>
                <option>XOF (FCFA)</option>
                <option>EUR (€)</option>
                <option>USD ($)</option>
              </select>
            </div>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Taux TVA par défaut (%)</label>
              <input type="number" defaultValue="18" style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}} />
            </div>
            <button className="btn-primary" style={{width: '100%'}}>Enregistrer</button>
          </div>
        </div>

        <div style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
          <h3>🔢 Numérotation</h3>
          <div style={{marginTop: '15px'}}>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Préfixe écritures journal</label>
              <input type="text" placeholder="JNL-" style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}} />
            </div>
            <div style={{marginBottom: '15px'}}>
              <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Préfixe factures</label>
              <input type="text" placeholder="FAC-" style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd'}} />
            </div>
            <button className="btn-primary" style={{width: '100%'}}>Enregistrer</button>
          </div>
        </div>
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
