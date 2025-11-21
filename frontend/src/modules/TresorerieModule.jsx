import React, { useState, useEffect } from 'react';
import api from '../api';

export function TresorerieModule() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [previsions, setPrevisions] = useState(null);
  const [periodePrevision, setPeriodePrevision] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});
  const [comptesComptables, setComptesComptables] = useState([]);
  const [editingCompte, setEditingCompte] = useState(null);
  
  const ENTREPRISE_ID = parseInt(localStorage.getItem('entrepriseId')) || 1;

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'comptes', label: 'Comptes Bancaires', icon: '🏦' },
    { id: 'transactions', label: 'Transactions', icon: '💸' },
    { id: 'previsions', label: 'Prévisions', icon: '📈' },
    { id: 'rapprochement', label: 'Rapprochement', icon: '✅' },
    { id: 'parametres', label: 'Paramètres', icon: '⚙️' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'previsions' && previsions === null) {
      loadPrevisions();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'previsions') {
      loadPrevisions();
    }
  }, [periodePrevision]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        await loadDashboard();
      } else if (activeTab === 'comptes') {
        await loadComptes();
      } else if (activeTab === 'transactions') {
        await loadTransactions();
      } else if (activeTab === 'previsions') {
        await loadPrevisions();
      } else if (activeTab === 'rapprochement') {
        await loadTransactions();
      } else if (activeTab === 'parametres') {
        await loadComptes();
        await loadComptesComptables();
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setError(null);
      const data = await api.get('/tresorerie/comptes');
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
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement du dashboard');
    }
  };

  const loadComptes = async () => {
    try {
      setError(null);
      const data = await api.get('/tresorerie/comptes');
      setComptes(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des comptes');
    }
  };

  const loadTransactions = async () => {
    try {
      setError(null);
      const data = await api.get('/tresorerie/mouvements');
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des transactions');
    }
  };

  const loadPrevisions = async () => {
    try {
      setError(null);
      const data = await api.get(`/tresorerie/previsions?periode=${periodePrevision}`);
      setPrevisions(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des prévisions');
      setPrevisions(null);
    }
  };

  const loadComptesComptables = async () => {
    try {
      const data = await api.get('/tresorerie/comptes-comptables');
      setComptesComptables(data);
    } catch (err) {
      console.error('Erreur chargement comptes comptables:', err);
    }
  };

  const handleCreateCompte = async () => {
    try {
      await api.post('/tresorerie/comptes/create', formData);
      closeModal();
      loadComptes();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    }
  };

  const handleUpdateCompte = async () => {
    try {
      await api.put(`/tresorerie/comptes/${editingCompte.id}`, formData);
      closeModal();
      setEditingCompte(null);
      loadComptes();
    } catch (err) {
      setError(err.message || 'Erreur lors de la modification du compte');
    }
  };

  const handleDeleteCompte = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte ?')) return;
    
    try {
      await api.delete(`/tresorerie/comptes/${id}`);
      loadComptes();
    } catch (err) {
      setError(err.message || 'Erreur lors de la suppression du compte');
    }
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

  const renderPrevisions = () => {
    if (error) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px', border: '1px solid #e74c3c' }}>
          <p style={{ margin: 0, color: '#e74c3c', fontWeight: 'bold' }}>❌ {error}</p>
        </div>
      );
    }

    if (!previsions) return <p>Chargement des prévisions...</p>;

    const variation = previsions.variation || 0;
    const variationColor = variation >= 0 ? '#27ae60' : '#e74c3c';

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Prévisions de Trésorerie</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setPeriodePrevision(7)}
              style={{
                padding: '8px 16px',
                backgroundColor: periodePrevision === 7 ? '#667eea' : '#e0e0e0',
                color: periodePrevision === 7 ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              7 jours
            </button>
            <button
              onClick={() => setPeriodePrevision(30)}
              style={{
                padding: '8px 16px',
                backgroundColor: periodePrevision === 30 ? '#667eea' : '#e0e0e0',
                color: periodePrevision === 30 ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              30 jours
            </button>
            <button
              onClick={() => setPeriodePrevision(90)}
              style={{
                padding: '8px 16px',
                backgroundColor: periodePrevision === 90 ? '#667eea' : '#e0e0e0',
                color: periodePrevision === 90 ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              90 jours
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#667eea', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Actuel</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(previsions.soldeActuel || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Tous comptes confondus</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Créances à Recevoir</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>+{parseFloat(previsions.creances?.total || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{previsions.creances?.count || 0} facture(s) client</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Dettes à Payer</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>-{parseFloat(previsions.dettes?.total || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{previsions.dettes?.count || 0} facture(s) fournisseur</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: variationColor, color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Prévu</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(previsions.soldePrevu || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {variation >= 0 ? '↗' : '↘'} {Math.abs(variation).toLocaleString()} XOF
            </div>
          </div>
        </div>

        <h4 style={{ marginTop: '30px', marginBottom: '15px' }}>Projection par Semaine ({periodePrevision} jours)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Période</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Encaissements Prévus</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Décaissements Prévus</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde Prévu</th>
            </tr>
          </thead>
          <tbody>
            {previsions.projection?.map((proj, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{proj.periode}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#27ae60' }}>
                  +{parseFloat(proj.encaissements || 0).toLocaleString()} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#e74c3c' }}>
                  -{parseFloat(proj.decaissements || 0).toLocaleString()} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(proj.soldePrevu) >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(proj.soldePrevu || 0).toLocaleString()} XOF
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ marginBottom: '15px' }}>📥 Factures Clients en Attente</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>N° Facture</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {previsions.creances?.factures?.slice(0, 5).map((facture) => (
                  <tr key={facture.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>{facture.numero || `#${facture.id}`}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                      {parseFloat(facture.montant || 0).toLocaleString()} XOF
                    </td>
                  </tr>
                ))}
                {(!previsions.creances?.factures || previsions.creances.factures.length === 0) && (
                  <tr>
                    <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucune facture en attente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h4 style={{ marginBottom: '15px' }}>📤 Factures Fournisseurs à Payer</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>N° Facture</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {previsions.dettes?.factures?.slice(0, 5).map((facture) => (
                  <tr key={facture.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px' }}>{facture.numero || `#${facture.id}`}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#e74c3c' }}>
                      {parseFloat(facture.montant || 0).toLocaleString()} XOF
                    </td>
                  </tr>
                ))}
                {(!previsions.dettes?.factures || previsions.dettes.factures.length === 0) && (
                  <tr>
                    <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      Aucune facture à payer
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderParametres = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Gestion des Comptes Bancaires</h3>
        <button
          onClick={() => {
            setEditingCompte(null);
            setFormData({ nomCompte: '', numeroCompte: '', banque: '', soldeInitial: '0', type: 'banque', compteComptableId: '', actif: true });
            setShowModal(true);
          }}
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

      {error && (
        <div style={{ padding: '12px', marginBottom: '20px', backgroundColor: '#ffebee', color: '#e74c3c', borderRadius: '6px', border: '1px solid #e74c3c' }}>
          ❌ {error}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Nom du Compte</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>N° Compte</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Banque</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Compte Comptable</th>
            <th style={{ padding: '12px', textAlign: 'right' }}>Solde Initial</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {comptes.map(compte => {
            const compteComptable = comptesComptables.find(c => c.id === compte.compteComptableId);
            return (
              <tr key={compte.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{compte.nomCompte}</td>
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
                    {compte.type}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {compteComptable ? `${compteComptable.numero} - ${compteComptable.nom}` : '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  {parseFloat(compte.soldeInitial || 0).toLocaleString()} XOF
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
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => {
                      setEditingCompte(compte);
                      setFormData({
                        nomCompte: compte.nomCompte,
                        numeroCompte: compte.numeroCompte || '',
                        banque: compte.banque || '',
                        type: compte.type,
                        compteComptableId: compte.compteComptableId || '',
                        actif: compte.actif
                      });
                      setShowModal(true);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      marginRight: '8px'
                    }}
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDeleteCompte(compte.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Supprimer
                  </button>
                </td>
              </tr>
            );
          })}
          {comptes.length === 0 && (
            <tr>
              <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Aucun compte bancaire créé. Cliquez sur "+ Nouveau Compte" pour commencer.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingCompte ? '✏️ Modifier le compte' : '➕ Nouveau compte'}
            </h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom du compte *</label>
              <input
                type="text"
                value={formData.nomCompte || ''}
                onChange={(e) => setFormData({ ...formData, nomCompte: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ex: Compte Principal BGFI"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Numéro de compte</label>
              <input
                type="text"
                value={formData.numeroCompte || ''}
                onChange={(e) => setFormData({ ...formData, numeroCompte: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ex: CI01234567890123456789"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Banque</label>
              <input
                type="text"
                value={formData.banque || ''}
                onChange={(e) => setFormData({ ...formData, banque: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="Ex: BGFI Bank"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Type *</label>
              <select
                value={formData.type || 'banque'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="banque">Banque</option>
                <option value="caisse">Caisse</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Compte comptable (Classe 5)</label>
              <select
                value={formData.compteComptableId || ''}
                onChange={(e) => setFormData({ ...formData, compteComptableId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- Sélectionner un compte comptable --</option>
                {comptesComptables.map(compte => (
                  <option key={compte.id} value={compte.id}>
                    {compte.numero} - {compte.nom}
                  </option>
                ))}
              </select>
            </div>

            {!editingCompte && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Solde initial</label>
                <input
                  type="number"
                  value={formData.soldeInitial || '0'}
                  onChange={(e) => setFormData({ ...formData, soldeInitial: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  step="0.01"
                />
              </div>
            )}

            {editingCompte && (
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Compte actif</span>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  if (editingCompte) {
                    handleUpdateCompte();
                  } else {
                    handleCreateCompte();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {editingCompte ? '💾 Enregistrer' : '➕ Créer'}
              </button>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
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
        {activeTab === 'previsions' && renderPrevisions()}
        {activeTab === 'rapprochement' && renderRapprochement()}
        {activeTab === 'parametres' && renderParametres()}
      </div>
    </div>
  );
}
