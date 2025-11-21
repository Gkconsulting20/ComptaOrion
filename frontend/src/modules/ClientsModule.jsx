import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function ClientsModule() {
  const [activeTab, setActiveTab] = useState('clients');

  const tabs = [
    { id: 'clients', label: '📋 Clients', icon: '👥' },
    { id: 'devis', label: '📝 Devis', icon: '📝' },
    { id: 'factures', label: '💰 Factures', icon: '💵' },
    { id: 'paiements', label: '💳 Paiements', icon: '💳' },
    { id: 'relances', label: '🔔 Relances', icon: '🔔' },
  ];

  return (
    <div>
      <h2>👥 Module Clients Complet</h2>
      
      <div style={{ borderBottom: '2px solid #e0e0e0', marginBottom: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: activeTab === tab.id ? '#3498db' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#333',
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                fontWeight: activeTab === tab.id ? '600' : '400',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = '#ecf0f1';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'clients' && <ClientsTab />}
      {activeTab === 'devis' && <DevisTab />}
      {activeTab === 'factures' && <FacturesTab />}
      {activeTab === 'paiements' && <PaiementsTab />}
      {activeTab === 'relances' && <RelancesTab />}
    </div>
  );
}

// ==========================================
// ONGLET 1: CLIENTS (CRUD)
// ==========================================
function ClientsTab() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: 'Côte d\'Ivoire',
    type: 'entreprise',
    categorieClient: 'standard',
    limiteCredit: 0,
    delaiPaiement: 30,
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await api.get('/clients');
      setClients(data.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, formData);
      } else {
        await api.post('/clients', formData);
      }
      setShowModal(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({ ...client });
    setShowModal(true);
  };

  const handleDelete = async (client) => {
    if (!confirm(`Supprimer le client ${client.nom} ?`)) return;
    try {
      await api.delete(`/clients/${client.id}`);
      loadClients();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      email: '',
      telephone: '',
      adresse: '',
      ville: '',
      pays: 'Côte d\'Ivoire',
      type: 'entreprise',
      categorieClient: 'standard',
      limiteCredit: 0,
      delaiPaiement: 30,
    });
  };

  const columns = [
    { key: 'numeroClient', label: 'N° Client' },
    { key: 'nom', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'ville', label: 'Ville' },
    { key: 'type', label: 'Type' },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Liste des Clients</h3>
        <Button onClick={() => { resetForm(); setEditingClient(null); setShowModal(true); }}>
          + Nouveau Client
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={clients} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingClient(null); resetForm(); }}
        title={editingClient ? 'Modifier Client' : 'Nouveau Client'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <FormField
              label="Nom"
              name="nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <FormField
              label="Téléphone"
              name="telephone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            />
            <FormField
              label="Type"
              name="type"
              type="select"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'entreprise', label: 'Entreprise' },
                { value: 'particulier', label: 'Particulier' },
              ]}
            />
            <FormField
              label="Adresse"
              name="adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
            />
            <FormField
              label="Ville"
              name="ville"
              value={formData.ville}
              onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
            />
            <FormField
              label="Pays"
              name="pays"
              value={formData.pays}
              onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
            />
            <FormField
              label="Catégorie"
              name="categorieClient"
              type="select"
              value={formData.categorieClient}
              onChange={(e) => setFormData({ ...formData, categorieClient: e.target.value })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'premium', label: 'Premium' },
                { value: 'vip', label: 'VIP' },
              ]}
            />
            <FormField
              label="Limite de crédit (FCFA)"
              name="limiteCredit"
              type="number"
              value={formData.limiteCredit}
              onChange={(e) => setFormData({ ...formData, limiteCredit: parseFloat(e.target.value) })}
            />
            <FormField
              label="Délai de paiement (jours)"
              name="delaiPaiement"
              type="number"
              value={formData.delaiPaiement}
              onChange={(e) => setFormData({ ...formData, delaiPaiement: parseInt(e.target.value) })}
            />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingClient ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ==========================================
// ONGLET 2: DEVIS
// ==========================================
function DevisTab() {
  return (
    <div>
      <h3>📝 Gestion des Devis</h3>
      <p style={{ color: '#666' }}>Implémentation en cours...</p>
    </div>
  );
}

// ==========================================
// ONGLET 3: FACTURES
// ==========================================
function FacturesTab() {
  return (
    <div>
      <h3>💰 Gestion des Factures</h3>
      <p style={{ color: '#666' }}>Implémentation en cours...</p>
    </div>
  );
}

// ==========================================
// ONGLET 4: PAIEMENTS
// ==========================================
function PaiementsTab() {
  return (
    <div>
      <h3>💳 Enregistrement des Paiements</h3>
      <p style={{ color: '#666' }}>Implémentation en cours...</p>
    </div>
  );
}

// ==========================================
// ONGLET 5: RELANCES AUTOMATIQUES
// ==========================================
function RelancesTab() {
  return (
    <div>
      <h3>🔔 Relances Automatiques</h3>
      <p style={{ color: '#666' }}>Implémentation en cours...</p>
    </div>
  );
}
