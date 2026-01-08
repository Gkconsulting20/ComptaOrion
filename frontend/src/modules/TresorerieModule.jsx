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
  const [rapprochements, setRapprochements] = useState([]);
  const [rapprochementActif, setRapprochementActif] = useState(null);
  const [showRapprochementModal, setShowRapprochementModal] = useState(false);
  const [transactionDateDebut, setTransactionDateDebut] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [transactionDateFin, setTransactionDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [transactionsFiltered, setTransactionsFiltered] = useState([]);
  const [rapprochementPreview, setRapprochementPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  
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
        await loadRapprochements();
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

  const loadRapprochements = async () => {
    try {
      setError(null);
      const data = await api.get('/tresorerie/rapprochements');
      setRapprochements(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des rapprochements');
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
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_total || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{dashboardStats.nb_comptes_actifs || 0} comptes actifs</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Banques</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_banques || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Comptes bancaires</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#f39c12', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Caisses</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(dashboardStats.solde_caisses || 0).toLocaleString('fr-FR')} XOF</div>
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
                  {parseFloat(compte.soldeActuel || 0).toLocaleString('fr-FR')} XOF
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
                <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(compte.soldeInitial || 0).toLocaleString('fr-FR')} XOF</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(compte.soldeActuel) >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(compte.soldeActuel || 0).toLocaleString('fr-FR')} XOF
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

  const loadTransactionsFiltered = async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await api.get(`/tresorerie/mouvements?dateDebut=${transactionDateDebut}&dateFin=${transactionDateFin}`);
      setTransactionsFiltered(data);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  };

  const renderTransactions = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
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

      <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: '#666' }}>Du:</label>
            <input
              type="date"
              value={transactionDateDebut}
              onChange={(e) => setTransactionDateDebut(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: '#666' }}>Au:</label>
            <input
              type="date"
              value={transactionDateFin}
              onChange={(e) => setTransactionDateFin(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
            />
          </div>
          <button 
            onClick={loadTransactionsFiltered}
            disabled={loading}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Chargement...' : 'Générer'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : transactionsFiltered.length > 0 ? (
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
            {transactionsFiltered.map(transaction => (
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
                  {transaction.type === 'encaissement' ? '+' : '-'}{parseFloat(transaction.montant || 0).toLocaleString('fr-FR')} XOF
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ color: '#7f8c8d', margin: 0 }}>Sélectionnez une période et cliquez sur "Générer" pour afficher les transactions</p>
        </div>
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
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(previsions.soldeActuel || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Tous comptes confondus</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Créances à Recevoir</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>+{parseFloat(previsions.creances?.total || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{previsions.creances?.count || 0} facture(s) client</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Dettes à Payer</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>-{parseFloat(previsions.dettes?.total || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{previsions.dettes?.count || 0} facture(s) fournisseur</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: variationColor, color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Solde Prévu</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(previsions.soldePrevu || 0).toLocaleString('fr-FR')} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {variation >= 0 ? '↗' : '↘'} {Math.abs(variation).toLocaleString('fr-FR')} XOF
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
                  +{parseFloat(proj.encaissements || 0).toLocaleString('fr-FR')} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: '#e74c3c' }}>
                  -{parseFloat(proj.decaissements || 0).toLocaleString('fr-FR')} XOF
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(proj.soldePrevu) >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(proj.soldePrevu || 0).toLocaleString('fr-FR')} XOF
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
                      {parseFloat(facture.montant || 0).toLocaleString('fr-FR')} XOF
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
                      {parseFloat(facture.montant || 0).toLocaleString('fr-FR')} XOF
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
                  {parseFloat(compte.soldeInitial || 0).toLocaleString('fr-FR')} XOF
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

  const handlePreviewRapprochement = async () => {
    if (!formData.compteBancaireId || !formData.dateDebut || !formData.dateFin) {
      alert('Veuillez sélectionner un compte et les dates de la période');
      return;
    }
    setLoadingPreview(true);
    try {
      const data = await api.get(`/tresorerie/rapprochements/preview?compteBancaireId=${formData.compteBancaireId}&dateDebut=${formData.dateDebut}&dateFin=${formData.dateFin}`);
      setRapprochementPreview(data);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreerRapprochement = async () => {
    try {
      const data = await api.post('/tresorerie/rapprochements', formData);
      setShowRapprochementModal(false);
      setFormData({});
      setRapprochementPreview(null);
      await loadRapprochements();
      setRapprochementActif(data.rapprochement.id);
    } catch (err) {
      alert('Erreur lors de la création du rapprochement: ' + err.message);
    }
  };

  const handleToggletransactionRapprochee = async (rapprochementId, transactionId, rapproche) => {
    try {
      await api.put(`/tresorerie/rapprochements/${rapprochementId}/transactions/${transactionId}`, { rapproche: !rapproche });
      const data = await api.get(`/tresorerie/rapprochements/${rapprochementId}`);
      setRapprochementActif(data);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleValiderRapprochement = async (rapprochementId) => {
    try {
      await api.put(`/tresorerie/rapprochements/${rapprochementId}/valider`);
      await loadRapprochements();
      setRapprochementActif(null);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const handleToggleSelection = (transactionId) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleSelectAll = (transactionIds) => {
    setSelectedTransactions(prev => {
      const allSelected = transactionIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !transactionIds.includes(id));
      } else {
        return [...new Set([...prev, ...transactionIds])];
      }
    });
  };

  const handleRapprocherSelection = async (rapprochementId, rapprocher = true) => {
    if (selectedTransactions.length === 0) {
      alert('Veuillez sélectionner au moins une transaction');
      return;
    }
    try {
      for (const transactionId of selectedTransactions) {
        await api.put(`/tresorerie/rapprochements/${rapprochementId}/transactions/${transactionId}`, { rapproche: rapprocher });
      }
      const data = await api.get(`/tresorerie/rapprochements/${rapprochementId}`);
      setRapprochementActif(data);
      setSelectedTransactions([]);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };

  const renderRapprochement = () => {
    if (rapprochementActif) {
      const { rapprochement, transactions: transactionsRapprochement } = rapprochementActif;
      const transactionsRapprochees = transactionsRapprochement.filter(t => t.rapproche);
      const transactionsNonRapprochees = transactionsRapprochement.filter(t => !t.rapproche);
      const totalRapproche = transactionsRapprochees.reduce((sum, t) => {
        return sum + (t.type === 'encaissement' ? parseFloat(t.montant) : -parseFloat(t.montant));
      }, 0);

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Rapprochement - {rapprochement.nomCompte || rapprochement.banque}</h3>
            <button
              onClick={() => setRapprochementActif(null)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              ← Retour
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#1976d2', marginBottom: '5px' }}>Solde Relevé</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
                {parseFloat(rapprochement.soldeReleve || 0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#f3e5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#7b1fa2', marginBottom: '5px' }}>Solde Comptable</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7b1fa2' }}>
                {parseFloat(rapprochement.soldeComptable || 0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: parseFloat(rapprochement.ecart) === 0 ? '#e8f5e9' : '#fff3e0', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: parseFloat(rapprochement.ecart) === 0 ? '#388e3c' : '#f57c00', marginBottom: '5px' }}>Écart</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: parseFloat(rapprochement.ecart) === 0 ? '#388e3c' : '#f57c00' }}>
                {parseFloat(rapprochement.ecart || 0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fce4ec', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#c2185b', marginBottom: '5px' }}>Statut</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#c2185b' }}>
                {rapprochement.statut === 'valide' ? '✓ Validé' : '⏳ En cours'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '30px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Transactions à rapprocher ({transactionsNonRapprochees.length})</h4>
            {transactionsNonRapprochees.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {selectedTransactions.filter(id => transactionsNonRapprochees.some(t => t.id === id)).length} sélectionnée(s)
                </span>
                <button
                  onClick={() => handleRapprocherSelection(rapprochement.id, true)}
                  disabled={selectedTransactions.filter(id => transactionsNonRapprochees.some(t => t.id === id)).length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedTransactions.filter(id => transactionsNonRapprochees.some(t => t.id === id)).length > 0 ? '#27ae60' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedTransactions.filter(id => transactionsNonRapprochees.some(t => t.id === id)).length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ✓ Rapprocher la sélection
                </button>
              </div>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>
                  <input 
                    type="checkbox"
                    checked={transactionsNonRapprochees.length > 0 && transactionsNonRapprochees.every(t => selectedTransactions.includes(t.id))}
                    onChange={() => handleSelectAll(transactionsNonRapprochees.map(t => t.id))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    title="Tout sélectionner"
                  />
                </th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactionsNonRapprochees.map(t => (
                <tr 
                  key={t.id} 
                  style={{ 
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: selectedTransactions.includes(t.id) ? '#e3f2fd' : 'transparent',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleToggleSelection(t.id)}
                >
                  <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={selectedTransactions.includes(t.id)}
                      onChange={() => handleToggleSelection(t.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{new Date(t.dateTransaction).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: t.type === 'encaissement' ? '#e8f5e9' : '#ffebee',
                      color: t.type === 'encaissement' ? '#388e3c' : '#d32f2f',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{t.description || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {t.type === 'encaissement' ? '+' : '-'}{parseFloat(t.montant || 0).toLocaleString('fr-FR')} FCFA
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

          <div style={{ marginTop: '30px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Transactions rapprochées ({transactionsRapprochees.length})</h4>
            {transactionsRapprochees.length > 0 && rapprochement.statut !== 'valide' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#666' }}>
                  {selectedTransactions.filter(id => transactionsRapprochees.some(t => t.id === id)).length} sélectionnée(s)
                </span>
                <button
                  onClick={() => handleRapprocherSelection(rapprochement.id, false)}
                  disabled={selectedTransactions.filter(id => transactionsRapprochees.some(t => t.id === id)).length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedTransactions.filter(id => transactionsRapprochees.some(t => t.id === id)).length > 0 ? '#e74c3c' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedTransactions.filter(id => transactionsRapprochees.some(t => t.id === id)).length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ✗ Annuler la sélection
                </button>
              </div>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ backgroundColor: '#e8f5e9', borderBottom: '2px solid #388e3c' }}>
                {rapprochement.statut !== 'valide' && (
                  <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}>
                    <input 
                      type="checkbox"
                      checked={transactionsRapprochees.length > 0 && transactionsRapprochees.every(t => selectedTransactions.includes(t.id))}
                      onChange={() => handleSelectAll(transactionsRapprochees.map(t => t.id))}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      title="Tout sélectionner"
                    />
                  </th>
                )}
                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactionsRapprochees.map(t => (
                <tr 
                  key={t.id} 
                  style={{ 
                    borderBottom: '1px solid #dee2e6', 
                    backgroundColor: selectedTransactions.includes(t.id) ? '#ffebee' : '#f1f8f4',
                    cursor: rapprochement.statut !== 'valide' ? 'pointer' : 'default'
                  }}
                  onClick={() => rapprochement.statut !== 'valide' && handleToggleSelection(t.id)}
                >
                  {rapprochement.statut !== 'valide' && (
                    <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={selectedTransactions.includes(t.id)}
                        onChange={() => handleToggleSelection(t.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ padding: '12px' }}>{new Date(t.dateTransaction).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: t.type === 'encaissement' ? '#c8e6c9' : '#ffcdd2',
                      color: t.type === 'encaissement' ? '#2e7d32' : '#c62828',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {t.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{t.description || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {t.type === 'encaissement' ? '+' : '-'}{parseFloat(t.montant || 0).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rapprochement.statut !== 'valide' && (
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => handleValiderRapprochement(rapprochement.id)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ✓ Valider le rapprochement
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Rapprochements Bancaires</h3>
          <button
            onClick={() => {
              loadComptes();
              setShowRapprochementModal(true);
              setRapprochementPreview(null);
              setLoadingPreview(false);
              setFormData({
                dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                dateFin: new Date().toISOString().split('T')[0]
              });
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            ➕ Nouveau Rapprochement
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Compte</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Période</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde Relevé</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde Comptable</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Écart</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rapprochements.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{new Date(r.dateRapprochement).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{r.nomCompte}</td>
                <td style={{ padding: '12px' }}>
                  {new Date(r.dateDebut).toLocaleDateString('fr-FR')} - {new Date(r.dateFin).toLocaleDateString('fr-FR')}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(r.soldeReleve || 0).toLocaleString('fr-FR')} FCFA</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{parseFloat(r.soldeComptable || 0).toLocaleString('fr-FR')} FCFA</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(r.ecart) === 0 ? '#27ae60' : '#e74c3c' }}>
                  {parseFloat(r.ecart || 0).toLocaleString('fr-FR')} FCFA
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: r.statut === 'valide' ? '#e8f5e9' : '#fff3e0',
                    color: r.statut === 'valide' ? '#388e3c' : '#f57c00',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {r.statut === 'valide' ? '✓ Validé' : '⏳ En cours'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={async () => {
                      const data = await api.get(`/tresorerie/rapprochements/${r.id}`);
                      setRapprochementActif(data);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    👁️ Voir
                  </button>
                </td>
              </tr>
            ))}
            {rapprochements.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#95a5a6' }}>
                  Aucun rapprochement créé. Cliquez sur "Nouveau Rapprochement" pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {showRapprochementModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h3 style={{ marginBottom: '20px' }}>Nouveau Rapprochement Bancaire</h3>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Compte Bancaire</label>
                <select
                  value={formData.compteBancaireId || ''}
                  onChange={(e) => { setFormData({ ...formData, compteBancaireId: e.target.value }); setRapprochementPreview(null); }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">Sélectionner un compte</option>
                  {comptes.filter(c => c.actif).map(c => (
                    <option key={c.id} value={c.id}>{c.nomCompte} - {c.banque}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date Début</label>
                <input
                  type="date"
                  value={formData.dateDebut || ''}
                  onChange={(e) => { setFormData({ ...formData, dateDebut: e.target.value }); setRapprochementPreview(null); }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date Fin</label>
                <input
                  type="date"
                  value={formData.dateFin || ''}
                  onChange={(e) => { setFormData({ ...formData, dateFin: e.target.value }); setRapprochementPreview(null); }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <button
                  onClick={handlePreviewRapprochement}
                  disabled={loadingPreview || !formData.compteBancaireId || !formData.dateDebut || !formData.dateFin}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: loadingPreview ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                    opacity: (!formData.compteBancaireId || !formData.dateDebut || !formData.dateFin) ? 0.6 : 1
                  }}
                >
                  {loadingPreview ? '⏳ Chargement...' : '🔍 Afficher les opérations de la période'}
                </button>
              </div>

              {rapprochementPreview && (
                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong>Solde comptable calculé:</strong>
                    <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                      {Math.round(parseFloat(rapprochementPreview.soldeComptable || 0)).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>{rapprochementPreview.transactionsCount || 0} opération(s) sur la période</strong>
                  </div>
                  {rapprochementPreview.transactions && rapprochementPreview.transactions.length > 0 ? (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#e9ecef' }}>
                            <th style={{ padding: '6px', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '6px', textAlign: 'left' }}>Libellé</th>
                            <th style={{ padding: '6px', textAlign: 'right' }}>Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rapprochementPreview.transactions.map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                              <td style={{ padding: '6px' }}>{t.dateTransaction ? new Date(t.dateTransaction).toLocaleDateString('fr-FR') : '-'}</td>
                              <td style={{ padding: '6px' }}>{t.libelle || t.description || '-'}</td>
                              <td style={{ padding: '6px', textAlign: 'right', color: t.type === 'encaissement' ? '#27ae60' : '#e74c3c' }}>
                                {t.type === 'encaissement' ? '+' : '-'}{Math.round(parseFloat(t.montant || 0)).toLocaleString('fr-FR')} FCFA
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#95a5a6', fontStyle: 'italic', margin: 0 }}>Aucune opération sur cette période</p>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Solde Relevé Bancaire</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.soldeReleve || ''}
                  onChange={(e) => setFormData({ ...formData, soldeReleve: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                  placeholder="Montant selon le relevé bancaire"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notes (optionnel)</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    minHeight: '80px'
                  }}
                  placeholder="Notes ou remarques..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleCreerRapprochement}
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
                  ✓ Créer
                </button>
                <button
                  onClick={() => {
                    setShowRapprochementModal(false);
                    setFormData({});
                    setRapprochementPreview(null);
                  }}
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
                  ✗ Annuler
                </button>
              </div>
            </div>
          </div>
        )}
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
