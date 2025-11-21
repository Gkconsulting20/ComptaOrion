import React, { useState, useEffect } from 'react';
import api from '../api';

export function TresorerieModule() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'comptes', label: 'Comptes Bancaires', icon: '🏦' },
    { id: 'transactions', label: 'Transactions', icon: '💸' },
    { id: 'rapprochement', label: 'Rapprochement', icon: '✅' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        await loadDashboard();
      } else if (activeTab === 'comptes') {
        await loadComptes();
      } else if (activeTab === 'transactions') {
        await loadTransactions();
      } else if (activeTab === 'rapprochement') {
        await loadTransactions();
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const data = await api.get('/tresorerie/comptes/1');
    const soldeTotal = data.reduce((sum, c) => sum + parseFloat(c.soldeActuel || 0), 0);
    const soldeBanques = data.filter(c => c.type === 'banque').reduce((sum, c) => sum + parseFloat(c.soldeActuel || 0), 0);
    const soldeCaisses = data.filter(c => c.type === 'caisse').reduce((sum, c) => sum + parseFloat(c.soldeActuel || 0), 0);
    
    setDashboardStats({
      solde_total: soldeTotal,
      nb_comptes_actifs: data.filter(c => c.actif).length,
      solde_banques: soldeBanques,
      solde_caisses: soldeCaisses
    });
    setComptes(data);
  };

  const loadComptes = async () => {
    const data = await api.get('/tresorerie/comptes/1');
    setComptes(data);
  };

  const loadTransactions = async () => {
    const data = await api.get('/tresorerie/mouvements/1');
    setTransactions(data);
  };

  const openModal = (type, data = {}) => {
    setModalType(type);
    setFormData(data);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({});
  };

  const renderDashboard = () => {
    if (!dashboardStats) return <p>Chargement...</p>;

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Vue d'ensemble Trésorerie</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#667eea', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Total</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_total || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{dashboardStats.nb_comptes_actifs || 0} comptes actifs</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Banques</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_banques || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Comptes bancaires</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#f39c12', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Caisses</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_caisses || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Liquidités</div>
          </div>
        </div>

        <h4 style={{ marginTop: '30px', marginBottom: '15px' }}>Comptes Actifs</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Nom du Compte</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Banque</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde</th>
            </tr>
          </thead>
          <tbody>
            {comptes.filter(c => c.actif).map(compte => (
              <tr key={compte.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{compte.nomCompte}</td>
                <td style={{ padding: '12px' }}>{compte.banque || '-'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: compte.type === 'banque' ? '#e3f2fd' : '#fff3e0',
                    color: compte.type === 'banque' ? '#1976d2' : '#f57c00',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {compte.type || 'banque'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(compte.soldeActuel) >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(compte.soldeActuel || 0).toLocaleString()} XOF
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderComptes = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Gestion des Comptes Bancaires</h3>
        <button
          onClick={() => openModal('compte')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + Nouveau Compte
        </button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Nom</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>N° Compte</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Banque</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde Initial</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde Actuel</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {comptes.map(compte => (
              <tr key={compte.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{compte.nomCompte}</td>
                <td style={{ padding: '12px' }}>{compte.numeroCompte || '-'}</td>
                <td style={{ padding: '12px' }}>{compte.banque || '-'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: compte.type === 'banque' ? '#e3f2fd' : compte.type === 'caisse' ? '#fff3e0' : '#e8f5e9',
                    color: compte.type === 'banque' ? '#1976d2' : compte.type === 'caisse' ? '#f57c00' : '#388e3c',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {compte.type || 'banque'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(compte.soldeInitial || 0).toLocaleString()} XOF</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(compte.soldeActuel) >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(compte.soldeActuel || 0).toLocaleString()} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: compte.actif ? '#e8f5e9' : '#ffebee',
                    color: compte.actif ? '#388e3c' : '#d32f2f',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {compte.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderTransactions = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Historique des Transactions</h3>
        <button
          onClick={() => openModal('transaction')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + Nouvelle Transaction
        </button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Catégorie</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{new Date(transaction.dateTransaction).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: transaction.type === 'encaissement' ? '#e8f5e9' : '#ffebee',
                    color: transaction.type === 'encaissement' ? '#388e3c' : '#d32f2f',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {transaction.type === 'encaissement' ? '⬇ Encaissement' : '⬆ Décaissement'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{transaction.description || '-'}</td>
                <td style={{ padding: '12px' }}>{transaction.categorie || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: transaction.type === 'encaissement' ? '#27ae60' : '#e74c3c' }}>
                  {transaction.type === 'encaissement' ? '+' : '-'}{parseFloat(transaction.montant || 0).toLocaleString()} XOF
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  Aucune transaction enregistrée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderRapprochement = () => {
    const transactionsNonRapprochees = transactions.filter(t => !t.rapproche);
    
    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Rapprochement Bancaire</h3>
        
        <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ffb74d' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#f57c00' }}>
            📋 {transactionsNonRapprochees.length} transaction(s) en attente de rapprochement
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {transactionsNonRapprochees.map(transaction => (
              <tr key={transaction.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{new Date(transaction.dateTransaction).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: transaction.type === 'encaissement' ? '#e8f5e9' : '#ffebee',
                    color: transaction.type === 'encaissement' ? '#388e3c' : '#d32f2f',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {transaction.type}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{transaction.description || '-'}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  {parseFloat(transaction.montant || 0).toLocaleString()} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✓ Rapprocher
                  </button>
                </td>
              </tr>
            ))}
            {transactionsNonRapprochees.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#27ae60', fontWeight: 'bold' }}>
                  ✅ Toutes les transactions sont rapprochées
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>💰 Module Trésorerie</h2>

      <div style={{ borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #667eea' : '3px solid transparent',
                backgroundColor: activeTab === tab.id ? '#f8f9fa' : 'transparent',
                color: activeTab === tab.id ? '#667eea' : '#6c757d',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.3s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'comptes' && renderComptes()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'rapprochement' && renderRapprochement()}
      </div>
    </div>
  );
}
