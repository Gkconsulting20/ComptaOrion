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
  const [devisList, setDevisList] = useState([]);
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [devisData, setDevisData] = useState({
    clientId: '',
    dateDevis: new Date().toISOString().split('T')[0],
    dateValidite: '',
    items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }],
    tauxTVA: 18,
    notesInternes: '',
    conditionsPaiement: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [devisRes, clientsRes, produitsRes] = await Promise.all([
        api.get('/devis'),
        api.get('/clients'),
        api.get('/produits')
      ]);
      setDevisList(devisRes.data || []);
      setClients(clientsRes.data || []);
      setProduits(produitsRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let totalHT = 0;
    devisData.items.forEach(item => {
      const montantLigne = item.quantite * item.prixUnitaire;
      const montantRemise = montantLigne * (item.remise / 100);
      totalHT += montantLigne - montantRemise;
    });
    const montantTVA = totalHT * (devisData.tauxTVA / 100);
    const totalTTC = totalHT + montantTVA;
    return { totalHT, montantTVA, totalTTC };
  };

  const handleSubmitDevis = async () => {
    try {
      const totals = calculateTotals();
      const finalData = {
        ...devisData,
        ...totals,
      };
      await api.post('/devis', finalData);
      setShowWizard(false);
      setWizardStep(1);
      resetDevisForm();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleConvertToFacture = async (devis) => {
    if (!confirm('Convertir ce devis en facture ?')) return;
    try {
      await api.post(`/devis/${devis.id}/transformer-facture`);
      alert('Devis converti en facture avec succès!');
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addItem = () => {
    setDevisData({
      ...devisData,
      items: [...devisData.items, { description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }]
    });
  };

  const removeItem = (index) => {
    const newItems = devisData.items.filter((_, i) => i !== index);
    setDevisData({ ...devisData, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...devisData.items];
    newItems[index][field] = value;
    setDevisData({ ...devisData, items: newItems });
  };

  const resetDevisForm = () => {
    setDevisData({
      clientId: '',
      dateDevis: new Date().toISOString().split('T')[0],
      dateValidite: '',
      items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }],
      tauxTVA: 18,
      notesInternes: '',
      conditionsPaiement: '',
    });
  };

  const columns = [
    { key: 'numeroDevis', label: 'N° Devis' },
    { 
      key: 'client', 
      label: 'Client',
      render: (val, row) => row.client?.nom || '-'
    },
    { key: 'dateDevis', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { key: 'totalTTC', label: 'Montant TTC', render: (val) => `${val || 0} FCFA` },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = {
          brouillon: '#95a5a6',
          envoye: '#3498db',
          accepte: '#27ae60',
          refuse: '#e74c3c',
          converti: '#9b59b6'
        };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px',
          fontWeight: '600'
        }}>{val}</span>;
      }
    },
  ];

  const totals = calculateTotals();

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>📝 Liste des Devis</h3>
        <Button onClick={() => { resetDevisForm(); setShowWizard(true); setWizardStep(1); }}>
          + Nouveau Devis
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={devisList.map(d => ({ ...d.devis, client: d.client }))} 
        onEdit={(devis) => handleConvertToFacture(devis)}
        actions={true}
      />

      {/* WIZARD DE CRÉATION DE DEVIS */}
      <Modal
        isOpen={showWizard}
        onClose={() => { setShowWizard(false); setWizardStep(1); resetDevisForm(); }}
        title={`Création de Devis - Étape ${wizardStep} sur 3`}
        size="xlarge"
      >
        {/* ÉTAPE 1: INFORMATIONS CLIENT */}
        {wizardStep === 1 && (
          <div>
            <h4>📋 Informations Client</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '20px' }}>
              <FormField
                label="Client"
                type="select"
                value={devisData.clientId}
                onChange={(e) => setDevisData({ ...devisData, clientId: e.target.value })}
                options={clients.map(c => ({ value: c.id, label: c.nom }))}
                required
              />
              <FormField
                label="Date Devis"
                type="date"
                value={devisData.dateDevis}
                onChange={(e) => setDevisData({ ...devisData, dateDevis: e.target.value })}
                required
              />
              <FormField
                label="Date de Validité"
                type="date"
                value={devisData.dateValidite}
                onChange={(e) => setDevisData({ ...devisData, dateValidite: e.target.value })}
              />
              <FormField
                label="Conditions de Paiement"
                value={devisData.conditionsPaiement}
                onChange={(e) => setDevisData({ ...devisData, conditionsPaiement: e.target.value })}
                placeholder="Ex: 30 jours net"
              />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => { setShowWizard(false); setWizardStep(1); }}>
                Annuler
              </Button>
              <Button onClick={() => setWizardStep(2)} disabled={!devisData.clientId}>
                Suivant &gt;
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE 2: ARTICLES/SERVICES + RÉDUCTIONS + TVA */}
        {wizardStep === 2 && (
          <div>
            <h4>📦 Articles et Services</h4>
            <div style={{ marginTop: '20px' }}>
              {devisData.items.map((item, index) => (
                <div key={index} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', 
                  gap: '10px', 
                  marginBottom: '10px',
                  alignItems: 'end',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px'
                }}>
                  <FormField
                    label="Description"
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    required
                  />
                  <FormField
                    label="Quantité"
                    type="number"
                    value={item.quantite}
                    onChange={(e) => updateItem(index, 'quantite', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <FormField
                    label="Prix Unitaire"
                    type="number"
                    value={item.prixUnitaire}
                    onChange={(e) => updateItem(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <FormField
                    label="Remise %"
                    type="number"
                    value={item.remise}
                    onChange={(e) => updateItem(index, 'remise', parseFloat(e.target.value) || 0)}
                  />
                  <FormField
                    label="Type"
                    type="select"
                    value={item.type}
                    onChange={(e) => updateItem(index, 'type', e.target.value)}
                    options={[
                      { value: 'produit', label: 'Produit' },
                      { value: 'service', label: 'Service' },
                    ]}
                  />
                  <Button 
                    type="button" 
                    variant="danger" 
                    size="small"
                    onClick={() => removeItem(index)}
                    disabled={devisData.items.length === 1}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="small" onClick={addItem}>
                + Ajouter une ligne
              </Button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <FormField
                label="Taux TVA (%)"
                type="number"
                value={devisData.tauxTVA}
                onChange={(e) => setDevisData({ ...devisData, tauxTVA: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <Button type="button" variant="secondary" onClick={() => setWizardStep(1)}>
                &lt; Précédent
              </Button>
              <Button onClick={() => setWizardStep(3)}>
                Suivant &gt;
              </Button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3: RÉCAPITULATIF + NOTES */}
        {wizardStep === 3 && (
          <div>
            <h4>✅ Récapitulatif</h4>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>Total HT:</strong>
                <span>{totals.totalHT.toFixed(2)} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>TVA ({devisData.tauxTVA}%):</strong>
                <span>{totals.montantTVA.toFixed(2)} FCFA</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '18px', 
                fontWeight: 'bold', 
                paddingTop: '10px', 
                borderTop: '2px solid #dee2e6' 
              }}>
                <strong>Total TTC:</strong>
                <span>{totals.totalTTC.toFixed(2)} FCFA</span>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <FormField
                label="Notes Internes"
                type="textarea"
                value={devisData.notesInternes}
                onChange={(e) => setDevisData({ ...devisData, notesInternes: e.target.value })}
                placeholder="Notes visibles uniquement en interne..."
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <Button type="button" variant="secondary" onClick={() => setWizardStep(2)}>
                &lt; Précédent
              </Button>
              <Button variant="success" onClick={handleSubmitDevis}>
                ✓ Créer le Devis
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ==========================================
// ONGLET 3: FACTURES
// ==========================================
function FacturesTab() {
  const [facturesList, setFacturesList] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('toutes');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [facturesRes, clientsRes] = await Promise.all([
        api.get('/factures'),
        api.get('/clients')
      ]);
      setFacturesList(facturesRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFacture = async (facture) => {
    if (!confirm(`Annuler la facture ${facture.numeroFacture} ?`)) return;
    try {
      await api.put(`/factures/${facture.id}`, { statut: 'annulee' });
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const columns = [
    { key: 'numeroFacture', label: 'N° Facture' },
    { 
      key: 'client', 
      label: 'Client',
      render: (val, row) => row.client?.nom || '-'
    },
    { key: 'dateFacture', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { key: 'dateEcheance', label: 'Échéance', render: (val) => val?.split('T')[0] || '-' },
    { key: 'totalTTC', label: 'Montant TTC', render: (val) => `${val || 0} FCFA` },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = {
          brouillon: '#95a5a6',
          envoyee: '#3498db',
          payee: '#27ae60',
          partiellement_payee: '#f39c12',
          en_retard: '#e74c3c',
          annulee: '#7f8c8d'
        };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px',
          fontWeight: '600'
        }}>{val?.replace(/_/g, ' ')}</span>;
      }
    },
  ];

  const filteredFactures = filterStatut === 'toutes' 
    ? facturesList 
    : facturesList.filter(f => f.facture?.statut === filterStatut);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>💰 Liste des Factures</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value="toutes">Toutes</option>
            <option value="brouillon">Brouillon</option>
            <option value="envoyee">Envoyée</option>
            <option value="payee">Payée</option>
            <option value="partiellement_payee">Partiellement payée</option>
            <option value="en_retard">En retard</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>
      </div>

      <Table 
        columns={columns} 
        data={filteredFactures.map(f => ({ ...f.facture, client: f.client }))} 
        actions={true}
        customActions={(facture) => (
          <div style={{ display: 'flex', gap: '5px' }}>
            {facture.statut !== 'annulee' && facture.statut !== 'payee' && (
              <Button size="small" variant="danger" onClick={() => handleCancelFacture(facture)}>
                ❌ Annuler
              </Button>
            )}
          </div>
        )}
      />

    </div>
  );
}

// ==========================================
// ONGLET 4: PAIEMENTS
// ==========================================
function PaiementsTab() {
  const [paiementsList, setPaiementsList] = useState([]);
  const [facturesList, setFacturesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [paymentData, setPaymentData] = useState({
    factureId: '',
    montant: 0,
    modePaiement: 'mobile_money',
    datePaiement: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    numeroCarte: '',
    nomTitulaire: '',
    operateurMobileMoney: 'orange_money',
    numeroTelephone: '',
    banque: '',
    numeroCompte: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const facturesRes = await api.get('/factures');
      setFacturesList(facturesRes.data || []);
      setPaiementsList([]);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/factures/${paymentData.factureId}/paiement`, paymentData);
      setShowPaymentModal(false);
      setSelectedFacture(null);
      resetPaymentForm();
      loadData();
      alert('Paiement enregistré avec succès!');
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetPaymentForm = () => {
    setPaymentData({
      factureId: '',
      montant: 0,
      modePaiement: 'mobile_money',
      datePaiement: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
      numeroCarte: '',
      nomTitulaire: '',
      operateurMobileMoney: 'orange_money',
      numeroTelephone: '',
      banque: '',
      numeroCompte: '',
    });
  };

  const handleOpenPaymentModal = (facture) => {
    setSelectedFacture(facture);
    setPaymentData({ 
      ...paymentData, 
      factureId: facture.id, 
      montant: facture.totalTTC 
    });
    setShowPaymentModal(true);
  };

  const columns = [
    { 
      key: 'facture', 
      label: 'N° Facture',
      render: (val) => val?.numeroFacture || '-'
    },
    { key: 'datePaiement', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { key: 'montant', label: 'Montant', render: (val) => `${val || 0} FCFA` },
    { 
      key: 'modePaiement', 
      label: 'Mode',
      render: (val) => {
        const labels = {
          mobile_money: '📱 Mobile Money',
          carte_bancaire: '💳 Carte',
          virement: '🏦 Virement',
          especes: '💵 Espèces',
        };
        return labels[val] || val;
      }
    },
    { key: 'reference', label: 'Référence' },
  ];

  const facturesImpayees = facturesList
    .filter(f => f.facture?.statut !== 'payee' && f.facture?.statut !== 'annulee')
    .map(f => ({ ...f.facture, client: f.client }));

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>💳 Enregistrement des Paiements</h3>
        <Button onClick={() => setShowPaymentModal(true)}>
          + Nouveau Paiement
        </Button>
      </div>

      {facturesImpayees.length > 0 && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#fff3cd', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #ffc107'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Factures en attente de paiement</h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {facturesImpayees.slice(0, 5).map(f => (
              <div key={f.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'white',
                borderRadius: '4px'
              }}>
                <span>
                  <strong>{f.numeroFacture}</strong> - {f.client?.nom} - {f.totalTTC} FCFA
                </span>
                <Button size="small" variant="success" onClick={() => handleOpenPaymentModal(f)}>
                  💰 Enregistrer Paiement
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Table 
        columns={columns} 
        data={paiementsList} 
        actions={false}
      />

      {/* MODAL ENREGISTREMENT PAIEMENT */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); resetPaymentForm(); }}
        title="Enregistrer un Paiement"
        size="large"
      >
        <form onSubmit={handleSubmitPayment}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            {!selectedFacture && (
              <FormField
                label="Facture"
                type="select"
                value={paymentData.factureId}
                onChange={(e) => {
                  const facture = facturesImpayees.find(f => f.id === e.target.value);
                  setPaymentData({ 
                    ...paymentData, 
                    factureId: e.target.value,
                    montant: facture?.totalTTC || 0
                  });
                }}
                options={facturesImpayees.map(f => ({ 
                  value: f.id, 
                  label: `${f.numeroFacture} - ${f.client?.nom} (${f.totalTTC} FCFA)` 
                }))}
                required
              />
            )}

            <FormField
              label="Mode de Paiement"
              type="select"
              value={paymentData.modePaiement}
              onChange={(e) => setPaymentData({ ...paymentData, modePaiement: e.target.value })}
              options={[
                { value: 'mobile_money', label: '📱 Mobile Money' },
                { value: 'carte_bancaire', label: '💳 Carte Bancaire' },
                { value: 'virement', label: '🏦 Virement Bancaire' },
                { value: 'especes', label: '💵 Espèces' },
              ]}
              required
            />

            {/* CHAMPS MOBILE MONEY */}
            {paymentData.modePaiement === 'mobile_money' && (
              <>
                <FormField
                  label="Opérateur"
                  type="select"
                  value={paymentData.operateurMobileMoney}
                  onChange={(e) => setPaymentData({ ...paymentData, operateurMobileMoney: e.target.value })}
                  options={[
                    { value: 'orange_money', label: 'Orange Money' },
                    { value: 'mtn_money', label: 'MTN Mobile Money' },
                    { value: 'moov_money', label: 'Moov Money' },
                    { value: 'wave', label: 'Wave' },
                  ]}
                />
                <FormField
                  label="Numéro de Téléphone"
                  value={paymentData.numeroTelephone}
                  onChange={(e) => setPaymentData({ ...paymentData, numeroTelephone: e.target.value })}
                  placeholder="+225 XX XX XX XX XX"
                />
              </>
            )}

            {/* CHAMPS CARTE BANCAIRE */}
            {paymentData.modePaiement === 'carte_bancaire' && (
              <>
                <FormField
                  label="Numéro de Carte (4 derniers chiffres)"
                  value={paymentData.numeroCarte}
                  onChange={(e) => setPaymentData({ ...paymentData, numeroCarte: e.target.value })}
                  placeholder="XXXX XXXX XXXX 1234"
                  maxLength="4"
                />
                <FormField
                  label="Nom du Titulaire"
                  value={paymentData.nomTitulaire}
                  onChange={(e) => setPaymentData({ ...paymentData, nomTitulaire: e.target.value })}
                />
              </>
            )}

            {/* CHAMPS VIREMENT */}
            {paymentData.modePaiement === 'virement' && (
              <>
                <FormField
                  label="Banque"
                  value={paymentData.banque}
                  onChange={(e) => setPaymentData({ ...paymentData, banque: e.target.value })}
                />
                <FormField
                  label="Numéro de Compte"
                  value={paymentData.numeroCompte}
                  onChange={(e) => setPaymentData({ ...paymentData, numeroCompte: e.target.value })}
                />
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <FormField
                label="Montant"
                type="number"
                value={paymentData.montant}
                onChange={(e) => setPaymentData({ ...paymentData, montant: parseFloat(e.target.value) })}
                required
              />
              <FormField
                label="Date de Paiement"
                type="date"
                value={paymentData.datePaiement}
                onChange={(e) => setPaymentData({ ...paymentData, datePaiement: e.target.value })}
                required
              />
            </div>

            <FormField
              label="Référence"
              value={paymentData.reference}
              onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
              placeholder="Numéro de transaction, référence bancaire..."
            />

            <FormField
              label="Notes"
              type="textarea"
              value={paymentData.notes}
              onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              placeholder="Notes additionnelles..."
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowPaymentModal(false); resetPaymentForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              💰 Enregistrer le Paiement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ==========================================
// ONGLET 5: RELANCES AUTOMATIQUES
// ==========================================
function RelancesTab() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>🔔 Relances Automatiques</h3>
      </div>

      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚧</div>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>Fonctionnalité à venir</h3>
        <p style={{ color: '#999', fontSize: '16px' }}>
          Les relances automatiques par email et SMS seront disponibles prochainement.
        </p>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '15px' }}>
          Cette fonctionnalité permettra:
        </p>
        <ul style={{ 
          color: '#999', 
          fontSize: '14px', 
          textAlign: 'left', 
          maxWidth: '600px', 
          margin: '10px auto',
          lineHeight: '1.8'
        }}>
          <li>Configuration des délais de relance (J+7, J+14, J+21)</li>
          <li>Envoi automatique d'emails et SMS</li>
          <li>Modèles personnalisables</li>
          <li>Historique des relances envoyées</li>
        </ul>
      </div>
    </div>
  );
}
