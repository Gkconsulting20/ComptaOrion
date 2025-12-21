import React, { useState, useEffect } from 'react';

const API_BASE = '';

export function CommercialPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [commercial, setCommercial] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('commercialToken');
    const storedCommercial = localStorage.getItem('commercial');
    if (token && storedCommercial) {
      setIsAuthenticated(true);
      setCommercial(JSON.parse(storedCommercial));
      loadDashboard(token);
    } else {
      setLoading(false);
    }
  }, []);

  const loadDashboard = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/api/commercial/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Session expirée');
      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      console.error(err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/commercial/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }
      
      localStorage.setItem('commercialToken', data.token);
      localStorage.setItem('commercial', JSON.stringify(data.commercial));
      setIsAuthenticated(true);
      setCommercial(data.commercial);
      loadDashboard(data.token);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('commercialToken');
    localStorage.removeItem('commercial');
    setIsAuthenticated(false);
    setCommercial(null);
    setDashboard(null);
  };

  const copyLink = () => {
    const baseUrl = window.location.origin;
    const lien = `${baseUrl}/inscription?ref=${commercial.id}`;
    navigator.clipboard.writeText(lien);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)', padding: '30px', color: 'white', textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Espace Commercial</h1>
            <p style={{ margin: 0, opacity: 0.9 }}>ComptaOrion</p>
          </div>
          
          <form onSubmit={handleLogin} style={{ padding: '30px' }}>
            {error && (
              <div style={{ backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '6px', padding: '12px', marginBottom: '20px', color: '#c33' }}>
                {error}
              </div>
            )}
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>Email</label>
              <input
                type="email"
                value={loginData.email}
                onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                required
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' }}
                placeholder="votre@email.com"
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333' }}>Mot de passe</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
                style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' }}
                placeholder="Votre mot de passe"
              />
            </div>
            
            <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const baseUrl = window.location.origin;
  const lienParrainage = `${baseUrl}/inscription?ref=${commercial.id}`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)', color: 'white', padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Espace Commercial</h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>Bienvenue, {commercial.prenom} {commercial.nom}</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Deconnexion
        </button>
      </div>

      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '25px', marginBottom: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ margin: '0 0 15px 0', color: '#9b59b6' }}>Votre Lien de Parrainage</h2>
          <p style={{ color: '#666', marginBottom: '15px' }}>Partagez ce lien avec vos prospects. Chaque inscription via ce lien vous sera automatiquement attribuee.</p>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={lienParrainage}
              readOnly
              style={{ flex: 1, minWidth: '300px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f9f9f9', fontSize: '14px' }}
            />
            <button onClick={copyLink} style={{ padding: '12px 24px', backgroundColor: copied ? '#27ae60' : '#9b59b6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'background-color 0.2s' }}>
              {copied ? 'Copie !' : 'Copier le lien'}
            </button>
          </div>
          
          <p style={{ marginTop: '15px', fontSize: '14px', color: '#888' }}>
            Taux de commission : <strong style={{ color: '#9b59b6' }}>{commercial.commission}%</strong>
          </p>
        </div>

        {dashboard && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #9b59b6' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Total Clients</h3>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#333' }}>{dashboard.stats?.total_clients || 0}</p>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #27ae60' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Clients Actifs</h3>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#27ae60' }}>{dashboard.stats?.clients_actifs || 0}</p>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #3498db' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>CA Total</h3>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#3498db' }}>{parseFloat(dashboard.stats?.ca_total || 0).toLocaleString()} XOF</p>
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: '4px solid #e67e22' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Commissions Totales</h3>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#e67e22' }}>{parseFloat(dashboard.stats?.commissions_totales || 0).toLocaleString()} XOF</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '25px' }}>
              <div style={{ backgroundColor: '#f0f4ff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>CA ce mois</h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#667eea' }}>{parseFloat(dashboard.stats?.ca_mois || 0).toLocaleString()} XOF</p>
              </div>
              <div style={{ backgroundColor: '#fff4e6', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Commissions ce mois</h3>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#e67e22' }}>{parseFloat(dashboard.stats?.commissions_mois || 0).toLocaleString()} XOF</p>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '25px', marginBottom: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Mes Clients ({dashboard.clients?.length || 0})</h2>
              {dashboard.clients?.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Entreprise</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Date inscription</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.clients.map(client => (
                      <tr key={client.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px' }}>{client.entrepriseNom}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', backgroundColor: client.statut === 'actif' ? '#d4edda' : '#fff3cd', color: client.statut === 'actif' ? '#155724' : '#856404' }}>
                            {client.statut}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{new Date(client.dateInscription).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#666', textAlign: 'center', padding: '30px' }}>Aucun client pour le moment. Partagez votre lien de parrainage !</p>
              )}
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Mes Ventes ({dashboard.ventes?.length || 0})</h2>
              {dashboard.ventes?.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Client</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Commission</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.ventes.map(vente => (
                      <tr key={vente.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px' }}>{vente.clientNom}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(vente.montantVente).toLocaleString()} XOF</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#e67e22', fontWeight: 'bold' }}>{parseFloat(vente.commission).toLocaleString()} XOF</td>
                        <td style={{ padding: '12px' }}>{new Date(vente.dateVente).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', backgroundColor: '#d4edda', color: '#155724' }}>
                            {vente.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#666', textAlign: 'center', padding: '30px' }}>Aucune vente pour le moment.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
