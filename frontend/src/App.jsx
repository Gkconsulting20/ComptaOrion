import { useState, useEffect } from 'react';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');

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
    { id: 'factures', icon: '📄', label: 'Factures' },
    { id: 'stock', icon: '📦', label: 'Stock' },
    { id: 'comptabilite', icon: '💰', label: 'Comptabilité' },
    { id: 'ia', icon: '🤖', label: 'Assistant IA' }
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>ComptaOrion</h1>
          <p>ERP Léger pour l'Afrique</p>
        </div>
      </header>
      
      <nav className="mobile-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => setCurrentView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        <div className="status-card">
          <h2>État du système</h2>
          {loading ? (
            <p>Vérification de la connexion...</p>
          ) : backendStatus ? (
            <div className="status-ok">
              <p>✓ Serveur: Connecté</p>
              <p className="status-detail">Prêt pour l'utilisation</p>
            </div>
          ) : (
            <div className="status-error">
              <p>✗ Connexion au serveur échouée</p>
              <p className="status-detail">Tentative de reconnexion...</p>
            </div>
          )}
        </div>

        <div className="welcome-card">
          <h2>Bienvenue sur ComptaOrion</h2>
          <p>Votre ERP complet et léger, optimisé pour l'Afrique</p>
          <div className="features">
            <div className="feature">
              <span className="feature-icon">📱</span>
              <h3>Mobile First</h3>
              <p>Utilisable partout, même hors ligne</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🤖</span>
              <h3>IA Intégrée</h3>
              <p>Assistant intelligent pour vous aider</p>
            </div>
            <div className="feature">
              <span className="feature-icon">⚡</span>
              <h3>Rapide & Léger</h3>
              <p>Optimisé pour connexions limitées</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
