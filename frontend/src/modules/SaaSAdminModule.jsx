import React, { useState, useEffect } from 'react';
import api from '../api';

export function SaaSAdminModule() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [commerciaux, setCommerciaux] = useState([]);
  const [clients, setClients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // commercial, client, plan, vente, abonnements
  const [formData, setFormData] = useState({});

  const [entreprises, setEntreprises] = useState([]);
  const [filtreSource, setFiltreSource] = useState('all'); // Fix: Hook déplacé de renderVentes

  const TABS = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'clients', label: '🏢 Clients SaaS' },
    { id: 'commerciaux', label: '👔 Commerciaux' },
    { id: 'plans', label: '💳 Plans Tarifaires' },
    { id: 'abonnements', label: '📋 Abonnements' },
    { id: 'ventes', label: '💰 Ventes' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const data = await api.get('/saas-admin/dashboard');
        setDashboardStats(data);
      } else if (activeTab === 'commerciaux') {
        const data = await api.get('/saas-admin/commerciaux');
        setCommerciaux(data);
      } else if (activeTab === 'clients') {
        const data = await api.get('/saas-admin/clients');
        setClients(data);
      } else if (activeTab === 'plans') {
        const data = await api.get('/saas-admin/plans');
        setPlans(data);
      } else if (activeTab === 'abonnements') {
        const data = await api.get('/saas-admin/abonnements');
        setAbonnements(data);
      } else if (activeTab === 'ventes') {
        const data = await api.get('/saas-admin/ventes');
        setVentes(data);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntreprises = async () => {
    try {
      const data = await api.get('/entreprises');
      setEntreprises(data?.data || []);
    } catch (error) {
      console.error('Erreur chargement entreprises:', error);
    }
  };

  const openModal = async (type, data = {}) => {
    setModalType(type);
    setFormData(data);
    setShowModal(true);
    
    if (type === 'abonnements') {
      await loadEntreprises();
      // Charger aussi les plans si pas déjà chargés
      if (plans.length === 0) {
        try {
          const data = await api.get('/saas-admin/plans');
          setPlans(data);
        } catch (error) {
          console.error('Erreur chargement plans:', error);
        }
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        // Update
        await api.put(`/saas-admin/${modalType}/${formData.id}`, formData);
      } else {
        // Create
        const result = await api.post(`/saas-admin/${modalType}`, formData);
        
        if (modalType === 'abonnements' && result.message) {
          alert(result.message);
        }
      }
      closeModal();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Voulez-vous vraiment supprimer cet élément?')) return;
    try {
      await api.delete(`/saas-admin/${type}/${id}`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const renderDashboard = () => {
    if (!dashboardStats) return <p>Chargement...</p>;

    const stats = dashboardStats.stats;
    const derniersClients = dashboardStats.derniersClients || [];

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Vue d'ensemble</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#667eea', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Total Clients</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{stats.total_clients || 0}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{stats.clients_actifs || 0} actifs • {stats.clients_trial || 0} en trial</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>MRR (Revenu Mensuel)</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(stats.mrr_total || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{stats.total_abonnements || 0} abonnements actifs</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#f39c12', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>CA Total</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{parseFloat(stats.ca_total || 0).toLocaleString()} XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Toutes ventes confondues</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>Commerciaux</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>{stats.total_commerciaux || 0}</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{parseFloat(stats.commissions_total || 0).toLocaleString()} XOF de commissions</div>
          </div>
        </div>

        <h4 style={{ marginTop: '30px', marginBottom: '15px' }}>Derniers clients inscrits</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Entreprise</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Commercial</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date inscription</th>
            </tr>
          </thead>
          <tbody>
            {derniersClients.map(client => (
              <tr key={client.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{client.entrepriseNom}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: client.statut === 'actif' ? '#d4edda' : '#fff3cd',
                    color: client.statut === 'actif' ? '#155724' : '#856404'
                  }}>
                    {client.statut}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{client.commercial || 'Non assigné'}</td>
                <td style={{ padding: '12px' }}>{new Date(client.dateInscription).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderCommerciaux = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Gestion des Commerciaux</h3>
        <button
          onClick={() => openModal('commerciaux')}
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
          + Ajouter un commercial
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Nom</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Région</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Commission</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Objectif mensuel</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Lien Parrainage</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {commerciaux.map(com => (
            <tr key={com.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '12px' }}>{com.nom} {com.prenom}</td>
              <td style={{ padding: '12px' }}>{com.email}</td>
              <td style={{ padding: '12px' }}>{com.region}</td>
              <td style={{ padding: '12px' }}>{com.commission}%</td>
              <td style={{ padding: '12px' }}>{parseFloat(com.objectifMensuel || 0).toLocaleString()} XOF</td>
              <td style={{ padding: '12px' }}>
                <button
                  onClick={() => {
                    const baseUrl = window.location.origin;
                    const lien = `${baseUrl}/inscription?ref=${com.id}`;
                    navigator.clipboard.writeText(lien);
                    alert(`Lien copié !\n\n${lien}`);
                  }}
                  style={{ padding: '6px 12px', backgroundColor: '#9b59b6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  Copier le lien
                </button>
              </td>
              <td style={{ padding: '12px' }}>
                <button
                  onClick={() => openModal('commerciaux', com)}
                  style={{ marginRight: '10px', padding: '6px 12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete('commerciaux', com.id)}
                  style={{ padding: '6px 12px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderClients = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Clients SaaS</h3>
        <button
          onClick={() => openModal('clients')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>+</span>
          Ajouter Client
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Entreprise</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Plan</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Commercial</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Date inscription</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(client => (
            <tr key={client.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '12px' }}>{client.entrepriseNom}</td>
              <td style={{ padding: '12px' }}>{client.entrepriseEmail}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: client.statut === 'actif' ? '#d4edda' : client.statut === 'trial' ? '#fff3cd' : '#f8d7da',
                  color: client.statut === 'actif' ? '#155724' : client.statut === 'trial' ? '#856404' : '#721c24'
                }}>
                  {client.statut}
                </span>
              </td>
              <td style={{ padding: '12px' }}>{client.abonnement?.planNom || 'Aucun'}</td>
              <td style={{ padding: '12px' }}>{client.commercial || 'Non assigné'}</td>
              <td style={{ padding: '12px' }}>{new Date(client.dateInscription).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPlans = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Plans Tarifaires</h3>
        <button
          onClick={() => openModal('plans')}
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
          + Créer un plan
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {plans.map(plan => (
          <div key={plan.id} style={{
            padding: '25px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '2px solid #e0e0e0'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{plan.nom}</h4>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea', margin: '15px 0' }}>
              {parseFloat(plan.prix).toLocaleString()} {plan.devise}
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#7f8c8d' }}>/{plan.periode}</span>
            </div>
            <div style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '15px' }}>
              <div>👥 {plan.limiteUtilisateurs} utilisateurs</div>
              <div>🏢 {plan.limiteEntreprises} entreprise(s)</div>
              <div>💾 {plan.stockageGb} Go de stockage</div>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => openModal('plans', plan)}
                style={{ flex: 1, padding: '8px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Modifier
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAbonnements = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Abonnements Actifs</h3>
        <button
          onClick={() => openModal('abonnements', { dateDebut: new Date().toISOString().split('T')[0], dureeEnMois: 1 })}
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
          + Nouvel Abonnement
        </button>
      </div>
      
      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
          💡 <strong>Automatisation activée :</strong> Lorsque vous créez un abonnement payant pour un client SaaS, 
          une vente sera automatiquement enregistrée dans l'onglet "Ventes" avec le commercial assigné.
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Entreprise</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Plan</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Montant/mois</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Date Début</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Date Expiration</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {abonnements.map(abo => (
            <tr key={abo.id} style={{ borderBottom: '1px solid #dee2e6' }}>
              <td style={{ padding: '12px' }}>{abo.entreprise}</td>
              <td style={{ padding: '12px' }}>{abo.plan}</td>
              <td style={{ padding: '12px' }}>{parseFloat(abo.montantMensuel).toLocaleString()} XOF</td>
              <td style={{ padding: '12px' }}>{new Date(abo.dateDebut).toLocaleDateString('fr-FR')}</td>
              <td style={{ padding: '12px' }}>{new Date(abo.dateExpiration).toLocaleDateString('fr-FR')}</td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: abo.statut === 'actif' ? '#d4edda' : '#f8d7da',
                  color: abo.statut === 'actif' ? '#155724' : '#721c24'
                }}>
                  {abo.statut}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderVentes = () => {
    const ventesFiltrees = ventes.filter(v => {
      if (filtreSource === 'all') return true;
      return v.source === filtreSource;
    });

    const statsVentes = {
      total: ventes.length,
      commercial: ventes.filter(v => v.source === 'commercial').length,
      web: ventes.filter(v => v.source === 'web').length,
      montantCommercial: ventes.filter(v => v.source === 'commercial').reduce((sum, v) => sum + parseFloat(v.montantVente || 0), 0),
      montantWeb: ventes.filter(v => v.source === 'web').reduce((sum, v) => sum + parseFloat(v.montantVente || 0), 0)
    };

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Historique des Ventes</h3>
        
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
          <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '10px' }}>
            ✨ <strong>Système hybride :</strong> Les ventes proviennent soit des commerciaux (B2B) soit des inscriptions en ligne (self-service).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '15px' }}>
            <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Ventes Commerciaux</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>{statsVentes.commercial}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>{statsVentes.montantCommercial.toLocaleString()} XOF</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Ventes Web</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#388e3c' }}>{statsVentes.web}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>{statsVentes.montantWeb.toLocaleString()} XOF</div>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#fff3e0', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Ventes</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f57c00' }}>{statsVentes.total}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>{(statsVentes.montantCommercial + statsVentes.montantWeb).toLocaleString()} XOF</div>
            </div>
          </div>
          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setFiltreSource('all')}
              style={{
                padding: '8px 16px',
                backgroundColor: filtreSource === 'all' ? '#667eea' : '#f0f0f0',
                color: filtreSource === 'all' ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Toutes ({statsVentes.total})
            </button>
            <button
              onClick={() => setFiltreSource('commercial')}
              style={{
                padding: '8px 16px',
                backgroundColor: filtreSource === 'commercial' ? '#1976d2' : '#f0f0f0',
                color: filtreSource === 'commercial' ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Commerciaux ({statsVentes.commercial})
            </button>
            <button
              onClick={() => setFiltreSource('web')}
              style={{
                padding: '8px 16px',
                backgroundColor: filtreSource === 'web' ? '#388e3c' : '#f0f0f0',
                color: filtreSource === 'web' ? 'white' : '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Web ({statsVentes.web})
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Source</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Commercial</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Client</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Montant</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Commission</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {ventesFiltrees.map(vente => (
              <tr key={vente.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ padding: '12px' }}>{new Date(vente.dateVente).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    backgroundColor: vente.source === 'web' ? '#e8f5e9' : '#e3f2fd',
                    color: vente.source === 'web' ? '#2e7d32' : '#1565c0'
                  }}>
                    {vente.source === 'web' ? '🌐 Web' : '👔 Commercial'}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>{vente.source === 'web' ? '—' : vente.commercial}</td>
                <td style={{ padding: '12px' }}>{vente.client}</td>
                <td style={{ padding: '12px' }}>{parseFloat(vente.montantVente).toLocaleString()} XOF</td>
                <td style={{ padding: '12px' }}>
                  {vente.source === 'web' ? (
                    <span style={{ color: '#999', fontSize: '12px' }}>—</span>
                  ) : (
                    `${parseFloat(vente.commission).toLocaleString()} XOF`
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: vente.statut === 'confirmée' ? '#d4edda' : '#f8d7da',
                    color: vente.statut === 'confirmée' ? '#155724' : '#721c24'
                  }}>
                    {vente.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderModal = () => {
    if (!showModal) return null;

    return (
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
          borderRadius: '12px',
          padding: '30px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}>
          <h3 style={{ marginTop: 0 }}>
            {formData.id ? 'Modifier' : 'Ajouter'} {
              modalType === 'commerciaux' ? 'Commercial' : 
              modalType === 'plans' ? 'Plan' : 
              modalType === 'abonnements' ? 'Abonnement' :
              'Vente'
            }
          </h3>
          
          <form onSubmit={handleSubmit}>
            {modalType === 'commerciaux' && (
              <>
                <input
                  type="text"
                  placeholder="Nom *"
                  value={formData.nom || ''}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Prénom *"
                  value={formData.prenom || ''}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Téléphone"
                  value={formData.telephone || ''}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="text"
                  placeholder="Région"
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Commission (%)"
                  value={formData.commission || ''}
                  onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Objectif mensuel (XOF)"
                  value={formData.objectifMensuel || ''}
                  onChange={(e) => setFormData({ ...formData, objectifMensuel: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                    Mot de passe Espace Commercial
                  </label>
                  <input
                    type="password"
                    placeholder={formData.id ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe *"}
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!formData.id}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
                    Ce mot de passe permet au commercial d'acceder a son espace personnel sur /commercial
                  </p>
                </div>
              </>
            )}

            {modalType === 'plans' && (
              <>
                <input
                  type="text"
                  placeholder="Nom du plan *"
                  value={formData.nom || ''}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Prix *"
                  value={formData.prix || ''}
                  onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <select
                  value={formData.periode || 'mensuel'}
                  onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="mensuel">Mensuel</option>
                  <option value="annuel">Annuel</option>
                </select>
                <input
                  type="number"
                  placeholder="Limite utilisateurs"
                  value={formData.limiteUtilisateurs || ''}
                  onChange={(e) => setFormData({ ...formData, limiteUtilisateurs: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Stockage (Go)"
                  value={formData.stockageGb || ''}
                  onChange={(e) => setFormData({ ...formData, stockageGb: e.target.value })}
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </>
            )}

            {modalType === 'abonnements' && (
              <>
                <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <div style={{ fontSize: '13px', color: '#1565c0', marginBottom: '5px' }}>
                    ✨ <strong>Automatisation activée</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: '#424242' }}>
                    Une vente sera automatiquement créée pour le commercial assigné au client.
                  </div>
                </div>

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Entreprise Cliente *
                </label>
                <select
                  value={formData.entrepriseId || ''}
                  onChange={(e) => setFormData({ ...formData, entrepriseId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Sélectionnez une entreprise</option>
                  {entreprises.map(e => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Plan Tarifaire *
                </label>
                <select
                  value={formData.planId || ''}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Sélectionnez un plan</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} - {parseFloat(p.prix).toLocaleString()} {p.devise}/{p.periode}</option>
                  ))}
                </select>

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Date de Début *
                </label>
                <input
                  type="date"
                  value={formData.dateDebut || ''}
                  onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                />

                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                  Durée (en mois) *
                </label>
                <select
                  value={formData.dureeEnMois || 1}
                  onChange={(e) => setFormData({ ...formData, dureeEnMois: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="1">1 mois</option>
                  <option value="3">3 mois</option>
                  <option value="6">6 mois</option>
                  <option value="12">12 mois (1 an)</option>
                  <option value="24">24 mois (2 ans)</option>
                </select>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="submit"
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
                {formData.id ? 'Mettre à jour' : 'Créer'}
              </button>
              <button
                type="button"
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
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>🎯 Administration SaaS - Commercialisation ComptaOrion</h2>

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
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'commerciaux' && renderCommerciaux()}
            {activeTab === 'clients' && renderClients()}
            {activeTab === 'plans' && renderPlans()}
            {activeTab === 'abonnements' && renderAbonnements()}
            {activeTab === 'ventes' && renderVentes()}
          </>
        )}
      </div>

      {renderModal()}
    </div>
  );
}
