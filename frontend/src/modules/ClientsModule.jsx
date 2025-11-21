import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { DetailsModal } from '../components/DetailsModal';
import api from '../api';

// Helper pour afficher correctement les statuts de factures
const getStatutFactureDisplay = (statut, montantPaye, montantTTC) => {
  const styles = {
    brouillon: { bg: '#e9ecef', color: '#495057', label: '📝 Brouillon' },
    envoyee: { bg: '#fff3cd', color: '#856404', label: '📤 Envoyée' },
    payee: { bg: '#d4edda', color: '#155724', label: '✅ Payée' },
    annulee: { bg: '#f8d7da', color: '#721c24', label: '❌ Annulée' },
    retard: { bg: '#f8d7da', color: '#721c24', label: '⏰ En retard' }
  };

  // Si envoyée et partiellement payée, afficher "Partiellement payée"
  if (statut === 'envoyee' && parseFloat(montantPaye || 0) > 0) {
    return { ...styles.envoyee, label: '💰 Partiellement payée' };
  }

  return styles[statut] || { bg: '#e9ecef', color: '#495057', label: statut };
};

export function ClientsModule() {
  const [activeTab, setActiveTab] = useState('parametres');

  const tabs = [
    { id: 'devis', label: '📝 Devis', icon: '📝' },
    { id: 'factures', label: '💵 Factures Client', icon: '💵' },
    { id: 'bons-livraison', label: '📦 Bons de Livraison', icon: '📦' },
    { id: 'paiements', label: '💳 Paiements', icon: '💳' },
    { id: 'etats-compte', label: '📋 États de Compte', icon: '📋' },
    { id: 'relances', label: '🔔 Relances', icon: '🔔' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' },
    { id: 'parametres', label: '⚙️ Paramètres Client', icon: '⚙️' },
  ];

  return (
    <div>
      <h2>👥 Module Clients</h2>
      
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

      {activeTab === 'devis' && <DevisTab />}
      {activeTab === 'factures' && <FacturesClientTab />}
      {activeTab === 'bons-livraison' && <BonsLivraisonTab />}
      {activeTab === 'paiements' && <PaiementsTab />}
      {activeTab === 'etats-compte' && <EtatsCompteTab />}
      {activeTab === 'relances' && <RelancesTab />}
      {activeTab === 'rapports' && <RapportsTab />}
      {activeTab === 'parametres' && <ParametresTab />}
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDevis, setSelectedDevis] = useState(null);
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
    if (!confirm(`Convertir le devis ${devis.numeroDevis} en facture ?`)) return;
    try {
      if (devis.statut !== 'accepte') {
        await api.put(`/devis/${devis.id}`, { statut: 'accepte' });
      }
      await api.post(`/devis/${devis.id}/transformer-facture`);
      alert('✅ Devis converti en facture avec succès!');
      loadData();
    } catch (error) {
      alert('Erreur lors de la conversion: ' + error.message);
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
        onRowClick={(devis) => { setSelectedDevis(devis); setShowDetailsModal(true); }}
        actions={true}
        customActions={(devis) => (
          <div style={{ display: 'flex', gap: '5px' }}>
            <Button 
              size="small" 
              variant="success" 
              onClick={() => handleConvertToFacture(devis)}
              disabled={devis.statut === 'converti'}
            >
              {devis.statut === 'converti' ? '✓ Converti' : '📄 Convertir en Facture'}
            </Button>
            {devis.statut !== 'converti' && (
              <Button size="small" variant="danger" onClick={() => handleDeleteDevis(devis)}>
                ❌
              </Button>
            )}
          </div>
        )}
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

      {/* MODAL DE DÉTAILS DEVIS */}
      {selectedDevis && (
        <DetailsModal
          isOpen={showDetailsModal}
          onClose={() => { setShowDetailsModal(false); setSelectedDevis(null); }}
          title={`Détails du Devis ${selectedDevis.numeroDevis || ''}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'N° Devis', value: selectedDevis.numeroDevis },
                { label: 'Client', value: selectedDevis.client?.nom || '-' },
                { label: 'Date', value: selectedDevis.dateDevis?.split('T')[0] },
                { label: 'Validité', value: selectedDevis.dateValidite?.split('T')[0] || '-' },
                { label: 'Statut', value: selectedDevis.statut }
              ]
            },
            {
              title: 'Totaux',
              fields: [
                { label: 'Total HT', value: `${selectedDevis.totalHT || 0} FCFA` },
                { label: 'TVA', value: `${selectedDevis.montantTVA || 0} FCFA` },
                { label: 'Total TTC', value: `${selectedDevis.totalTTC || 0} FCFA` }
              ]
            }
          ]}
          tables={selectedDevis.items ? [{
            title: 'Articles / Services',
            columns: [
              { key: 'description', label: 'Description' },
              { key: 'quantite', label: 'Qté', align: 'center' },
              { key: 'prixUnitaire', label: 'P.U.', align: 'right', render: (val) => `${val || 0} FCFA` },
              { key: 'remise', label: 'Remise', align: 'right', render: (val) => `${val || 0}%` },
              { key: 'total', label: 'Total', align: 'right', render: (val, row) => {
                const montant = row.quantite * row.prixUnitaire;
                const remise = montant * (row.remise / 100);
                return `${(montant - remise).toFixed(2)} FCFA`;
              }}
            ],
            data: selectedDevis.items
          }] : []}
          actions={selectedDevis.statut !== 'converti' ? [
            {
              label: '📄 Convertir en Facture',
              variant: 'success',
              onClick: () => {
                setShowDetailsModal(false);
                handleConvertToFacture(selectedDevis);
              }
            }
          ] : []}
        />
      )}
    </div>
  );
}

// ==========================================
// ONGLET 4: PAIEMENTS
// ==========================================
// ==========================================
// ONGLET 3: BONS DE LIVRAISON
// ==========================================
function BonsLivraisonTab() {
  const [bonsList, setBonsList] = useState([]);
  const [facturesList, setFacturesList] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedFacture, setSelectedFacture] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bonsRes, facturesRes, clientsRes] = await Promise.all([
        api.get('/bons-livraison'),
        api.get('/factures'),
        api.get('/clients')
      ]);

      setBonsList(bonsRes.data || bonsRes || []);
      setFacturesList((facturesRes.data || []).map(f => ({
        ...f.facture,
        client: f.client
      })));
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenererDepuisFacture = async () => {
    if (!selectedFacture) {
      alert('Veuillez sélectionner une facture');
      return;
    }

    try {
      await api.post(`/bons-livraison/generer-depuis-facture/${selectedFacture.id}`);
      alert('✅ Bon de livraison généré avec succès!');
      setShowModal(false);
      setSelectedFacture(null);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const columns = [
    { key: 'numeroBL', label: 'N° BL' },
    { 
      key: 'client', 
      label: 'Client',
      render: (val) => val?.nom || '-'
    },
    { 
      key: 'dateLivraison', 
      label: 'Date de livraison', 
      render: (val) => val?.split('T')[0] || '-' 
    },
    { 
      key: 'items', 
      label: 'Articles',
      render: (val) => (val || []).length + ' article(s)'
    },
    { key: 'notes', label: 'Notes', render: (val) => val || '-' },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>📦 Bons de Livraison</h3>
        <Button 
          onClick={() => {
            setModalType('generer');
            setShowModal(true);
          }}
        >
          + Générer depuis Facture
        </Button>
      </div>

      <Table
        columns={columns}
        data={bonsList}
        renderActions={(bon) => (
          <div>
            <Button size="small" variant="info">
              👁️ Détails
            </Button>
          </div>
        )}
      />

      {showModal && modalType === 'generer' && (
        <Modal onClose={() => { setShowModal(false); setSelectedFacture(null); }}>
          <h3>📦 Générer un Bon de Livraison</h3>
          <p>Sélectionnez une facture pour générer automatiquement un bon de livraison:</p>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Facture *
            </label>
            <select
              value={selectedFacture?.id || ''}
              onChange={(e) => {
                const facture = facturesList.find(f => f.id === parseInt(e.target.value));
                setSelectedFacture(facture);
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">-- Sélectionner une facture --</option>
              {facturesList
                .filter(f => f.statut === 'validee' || f.statut === 'en_attente')
                .map(facture => (
                  <option key={facture.id} value={facture.id}>
                    {facture.numeroFacture} - {facture.client?.nom} - {parseFloat(facture.totalTTC || 0).toLocaleString()} FCFA
                  </option>
                ))}
            </select>
          </div>

          {selectedFacture && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#e8f5e9', 
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                ✅ Facture sélectionnée: {selectedFacture.numeroFacture}
              </p>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                Client: {selectedFacture.client?.nom} | Montant: {parseFloat(selectedFacture.totalTTC || 0).toLocaleString()} FCFA
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button onClick={handleGenererDepuisFacture} disabled={!selectedFacture}>
              ✅ Générer le Bon
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => { 
                setShowModal(false); 
                setSelectedFacture(null); 
              }}
            >
              ❌ Annuler
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ==========================================
// ONGLET 4: FACTURES CLIENT
// ==========================================
function FacturesClientTab() {
  const [facturesList, setFacturesList] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('toutes');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [factureData, setFactureData] = useState({
    clientId: '',
    dateFacture: new Date().toISOString().split('T')[0],
    dateEcheance: '',
    items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }],
    tauxTVA: 18,
    notesInternes: '',
    conditionsPaiement: '',
    statut: 'brouillon',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [facturesRes, clientsRes] = await Promise.all([
        api.get('/factures'),
        api.get('/clients')
      ]);
      const normalized = (facturesRes.data || []).map(f => ({
        ...f.facture,
        client: f.client
      }));
      setFacturesList(normalized);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnulerFacture = async (id) => {
    if (!confirm('Voulez-vous vraiment annuler cette facture?')) return;
    try {
      await api.put(`/factures/${id}`, { statut: 'annulee' });
      alert('Facture annulée');
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleNewFacture = () => {
    setFactureData({
      clientId: '',
      dateFacture: new Date().toISOString().split('T')[0],
      dateEcheance: '',
      items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }],
      tauxTVA: 18,
      notesInternes: '',
      conditionsPaiement: '',
      statut: 'brouillon',
    });
    setWizardStep(1);
    setShowWizard(true);
  };

  const handleSubmitFacture = async () => {
    try {
      const totalHT = factureData.items.reduce((sum, item) => {
        const montantHT = item.quantite * item.prixUnitaire * (1 - item.remise / 100);
        return sum + montantHT;
      }, 0);
      const montantTVA = totalHT * (factureData.tauxTVA / 100);
      const totalTTC = totalHT + montantTVA;

      await api.post('/factures', {
        ...factureData,
        totalHT,
        montantTVA,
        totalTTC,
        items: factureData.items,
      });

      alert('Facture créée avec succès!');
      setShowWizard(false);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addItem = () => {
    setFactureData({
      ...factureData,
      items: [...factureData.items, { description: '', quantite: 1, prixUnitaire: 0, remise: 0, type: 'produit' }]
    });
  };

  const removeItem = (index) => {
    setFactureData({
      ...factureData,
      items: factureData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...factureData.items];
    newItems[index][field] = value;
    setFactureData({ ...factureData, items: newItems });
  };

  const filteredFactures = filterStatut === 'toutes'
    ? facturesList
    : facturesList.filter(f => f.statut === filterStatut);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>💵 Factures Client</h3>
        <Button variant="primary" onClick={handleNewFacture}>
          ➕ Nouvelle Facture
        </Button>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {['toutes', 'brouillon', 'envoyee', 'payee', 'en_retard', 'annulee'].map(statut => (
          <Button
            key={statut}
            size="small"
            variant={filterStatut === statut ? 'primary' : 'secondary'}
            onClick={() => setFilterStatut(statut)}
          >
            {statut.charAt(0).toUpperCase() + statut.slice(1).replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Table
        columns={[
          { key: 'numeroFacture', label: 'N° Facture' },
          { key: 'client', label: 'Client', render: (_, row) => row.client?.nom || 'N/A' },
          { key: 'dateFacture', label: 'Date', render: (val) => new Date(val).toLocaleDateString() },
          { key: 'totalTTC', label: 'Montant TTC', render: (val) => `${parseFloat(val).toLocaleString()} FCFA` },
          { key: 'statut', label: 'Statut', render: (_, row) => {
            const display = getStatutFactureDisplay(row.statut, row.montantPaye, row.totalTTC);
            return (
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                backgroundColor: display.bg,
                color: display.color,
                fontWeight: '500'
              }}>
                {display.label}
              </span>
            );
          }},
        ]}
        data={filteredFactures}
        actions={true}
        customActions={(facture) => (
          <div style={{ display: 'flex', gap: '5px' }}>
            {facture.statut === 'brouillon' && (
              <Button size="small" variant="danger" onClick={() => handleAnnulerFacture(facture.id)}>
                ❌ Annuler
              </Button>
            )}
          </div>
        )}
      />

      {/* WIZARD CRÉATION FACTURE */}
      <Modal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        title="➕ Nouvelle Facture Client"
        size="large"
      >
        {wizardStep === 1 && (
          <div>
            <h4>Étape 1: Informations Client</h4>
            <FormField
              label="Client *"
              type="select"
              value={factureData.clientId}
              onChange={(e) => setFactureData({ ...factureData, clientId: parseInt(e.target.value) })}
              options={[
                { value: '', label: '-- Sélectionner un client --' },
                ...clients.map(c => ({ value: c.id, label: c.nom }))
              ]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <FormField
                label="Date Facture"
                type="date"
                value={factureData.dateFacture}
                onChange={(e) => setFactureData({ ...factureData, dateFacture: e.target.value })}
              />
              <FormField
                label="Date Échéance"
                type="date"
                value={factureData.dateEcheance}
                onChange={(e) => setFactureData({ ...factureData, dateEcheance: e.target.value })}
              />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => setWizardStep(2)} disabled={!factureData.clientId}>
                Suivant &gt;
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div>
            <h4>Étape 2: Articles</h4>
            {factureData.items.map((item, index) => (
              <div key={index} style={{ 
                padding: '15px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px', 
                marginBottom: '10px' 
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 2 }}>
                    <FormField
                      label="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Description de l'article..."
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FormField
                      label="Quantité"
                      type="number"
                      value={item.quantite}
                      onChange={(e) => updateItem(index, 'quantite', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FormField
                      label="Prix Unitaire"
                      type="number"
                      value={item.prixUnitaire}
                      onChange={(e) => updateItem(index, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FormField
                      label="Remise (%)"
                      type="number"
                      value={item.remise}
                      onChange={(e) => updateItem(index, 'remise', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {factureData.items.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="small"
                      onClick={() => removeItem(index)}
                      style={{ marginTop: '27px' }}
                    >
                      🗑️
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addItem} style={{ marginTop: '10px' }}>
              ➕ Ajouter un article
            </Button>

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

        {wizardStep === 3 && (
          <div>
            <h4>Étape 3: Récapitulatif</h4>
            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ marginBottom: '15px' }}>
                <strong>Client:</strong> {clients.find(c => c.id === factureData.clientId)?.nom}
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>Total HT:</strong> {factureData.items.reduce((sum, item) => 
                  sum + item.quantite * item.prixUnitaire * (1 - item.remise / 100), 0
                ).toLocaleString()} FCFA
              </div>
              <div style={{ marginBottom: '15px' }}>
                <strong>TVA ({factureData.tauxTVA}%):</strong> {(
                  factureData.items.reduce((sum, item) => 
                    sum + item.quantite * item.prixUnitaire * (1 - item.remise / 100), 0
                  ) * factureData.tauxTVA / 100
                ).toLocaleString()} FCFA
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                <strong>Total TTC:</strong> {(
                  factureData.items.reduce((sum, item) => 
                    sum + item.quantite * item.prixUnitaire * (1 - item.remise / 100), 0
                  ) * (1 + factureData.tauxTVA / 100)
                ).toLocaleString()} FCFA
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <FormField
                label="Conditions de Paiement"
                type="textarea"
                value={factureData.conditionsPaiement}
                onChange={(e) => setFactureData({ ...factureData, conditionsPaiement: e.target.value })}
                placeholder="Paiement à 30 jours..."
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
              <Button type="button" variant="secondary" onClick={() => setWizardStep(2)}>
                &lt; Précédent
              </Button>
              <Button variant="success" onClick={handleSubmitFacture}>
                ✓ Créer la Facture
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ONGLET: RAPPORTS CLIENT
// ==========================================
function RapportsTab() {
  const [rapportData, setRapportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRapports();
  }, []);

  const loadRapports = async () => {
    try {
      // Pour l'instant, affichage placeholder
      setRapportData({
        topClients: [],
        retardsPaiement: [],
        chiffreAffaire: 0
      });
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h3>📊 Rapports Client</h3>
      
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '2px dashed #dee2e6',
        marginTop: '20px'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>📊</div>
        <h3 style={{ color: '#666', marginBottom: '10px' }}>Rapports en développement</h3>
        <p style={{ color: '#999', fontSize: '16px' }}>
          Les rapports clients seront disponibles prochainement.
        </p>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '15px' }}>
          Fonctionnalités prévues:
        </p>
        <ul style={{ 
          color: '#999', 
          fontSize: '14px', 
          textAlign: 'left', 
          maxWidth: '600px', 
          margin: '10px auto',
          lineHeight: '1.8'
        }}>
          <li>Chiffre d'affaires par client</li>
          <li>Clients avec retards de paiement</li>
          <li>Top 10 clients (CA)</li>
          <li>Historique des transactions par client</li>
          <li>Analyse des échéances</li>
        </ul>
      </div>
    </div>
  );
}

function PaiementsTab() {
  const [paiementsList, setPaiementsList] = useState([]);
  const [facturesList, setFacturesList] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
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
      const [facturesRes, clientsRes] = await Promise.all([
        api.get('/factures'),
        api.get('/clients')
      ]);
      setFacturesList(facturesRes.data || []);
      setClients(clientsRes.data || []);
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
    setSelectedClientId('');
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
              <>
                <FormField
                  label="1️⃣ Sélectionner le Client"
                  type="select"
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setPaymentData({ ...paymentData, factureId: '', montant: 0 });
                  }}
                  options={[
                    { value: '', label: '-- Choisir un client --' },
                    ...clients.map(c => ({ 
                      value: c.id, 
                      label: c.nom 
                    }))
                  ]}
                  required
                />
                
                {selectedClientId && (
                  <FormField
                    label="2️⃣ Sélectionner la Facture à Payer"
                    type="select"
                    value={paymentData.factureId}
                    onChange={(e) => {
                      const facture = facturesImpayees
                        .filter(f => f.client?.id == selectedClientId)
                        .find(f => f.id === e.target.value);
                      setPaymentData({ 
                        ...paymentData, 
                        factureId: e.target.value,
                        montant: facture?.totalTTC || 0
                      });
                    }}
                    options={facturesImpayees
                      .filter(f => f.client?.id == selectedClientId)
                      .sort((a, b) => new Date(a.dateFacture) - new Date(b.dateFacture))
                      .map(f => ({ 
                        value: f.id, 
                        label: `${f.numeroFacture} - ${new Date(f.dateFacture).toLocaleDateString('fr-FR')} - ${f.totalTTC} FCFA` 
                      }))}
                    required
                  />
                )}
              </>
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

// ==========================================
// ONGLET 6: PARAMETRES COMPTABLES
// ==========================================

// ==========================================
// ONGLET 6: PARAMETRES CLIENT (CRUD COMPLET)
// ==========================================
function ParametresTab() {
  const [subTab, setSubTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [comptesComptables, setComptesComptables] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [codesComptables, setCodesComptables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [clientData, setClientData] = useState({
    nom: '',
    email: '',
    telephone: '',
    type: 'particulier',
    categorieClient: 'standard',
    adresse: '',
    ville: '',
    pays: 'Sénégal',
    compteComptableId: null,
    delaiPaiement: 30,
    limiteCredit: 0,
    echeancesPersonnalisees: [],
    modesPaiementPreferes: [],
  });
  const [taxeData, setTaxeData] = useState({ nom: '', taux: 0, codeComptable: '' });
  const [codeComptableData, setCodeComptableData] = useState({ code: '', libelle: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsRes, comptesRes] = await Promise.all([
        api.get('/clients'),
        api.get('/comptabilite/comptes')
      ]);
      setClients(clientsRes.data || []);
      setComptesComptables(comptesRes.data || []);
      setTaxes([
        { id: 1, nom: 'TVA 18%', taux: 18, codeComptable: '4431' },
        { id: 2, nom: 'TVA 9%', taux: 9, codeComptable: '4432' },
        { id: 3, nom: 'Exonéré', taux: 0, codeComptable: '-' }
      ]);
      setCodesComptables([
        { id: 1, code: '411', libelle: 'Clients' },
        { id: 2, code: '4111', libelle: 'Clients - Ventes de biens' },
        { id: 3, code: '4112', libelle: 'Clients - Prestations de services' },
        { id: 4, code: '4431', libelle: 'TVA collectée' }
      ]);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewClient = () => {
    setClientData({
      nom: '',
      email: '',
      telephone: '',
      type: 'particulier',
      categorieClient: 'standard',
      adresse: '',
      ville: '',
      pays: 'Sénégal',
      compteComptableId: null,
      delaiPaiement: 30,
      limiteCredit: 0,
      echeancesPersonnalisees: [],
      modesPaiementPreferes: [],
    });
    setIsEditing(false);
    setModalType('client');
    setShowModal(true);
  };

  const handleNewTaxe = () => {
    setTaxeData({ nom: '', taux: 0, codeComptable: '' });
    setIsEditing(false);
    setModalType('taxe');
    setShowModal(true);
  };

  const handleNewCodeComptable = () => {
    setCodeComptableData({ code: '', libelle: '' });
    setIsEditing(false);
    setModalType('codeComptable');
    setShowModal(true);
  };

  const handleEditClient = (client) => {
    setClientData({
      ...client,
      echeancesPersonnalisees: client.echeancesPersonnalisees || [],
      modesPaiementPreferes: client.modesPaiementPreferes || [],
    });
    setIsEditing(true);
    setModalType('client');
    setShowModal(true);
  };

  const handleEditTaxe = (taxe) => {
    setTaxeData(taxe);
    setIsEditing(true);
    setModalType('taxe');
    setShowModal(true);
  };

  const handleEditCodeComptable = (code) => {
    setCodeComptableData(code);
    setIsEditing(true);
    setModalType('codeComptable');
    setShowModal(true);
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client?')) return;
    try {
      await api.delete(`/clients/${clientId}`);
      loadData();
      alert('Client supprimé avec succès!');
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      if (modalType === 'client') {
        if (isEditing) {
          await api.put(`/clients/${clientData.id}`, clientData);
          alert('Client modifié avec succès!');
        } else {
          await api.post('/clients', clientData);
          alert('Client créé avec succès!');
        }
      } else if (modalType === 'taxe' || modalType === 'codeComptable') {
        alert('Configuration enregistrée (démo)');
      }
      loadData();
      setShowModal(false);
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addEcheance = () => {
    setClientData({
      ...clientData,
      echeancesPersonnalisees: [...clientData.echeancesPersonnalisees, { jours: 30, pourcentage: 100 }]
    });
  };

  const removeEcheance = (index) => {
    setClientData({
      ...clientData,
      echeancesPersonnalisees: clientData.echeancesPersonnalisees.filter((_, i) => i !== index)
    });
  };

  const updateEcheance = (index, field, value) => {
    const newEcheances = [...clientData.echeancesPersonnalisees];
    newEcheances[index][field] = value;
    setClientData({ ...clientData, echeancesPersonnalisees: newEcheances });
  };

  const toggleModePaiement = (mode) => {
    const modesPaiement = clientData.modesPaiementPreferes || [];
    if (modesPaiement.includes(mode)) {
      setClientData({
        ...clientData,
        modesPaiementPreferes: modesPaiement.filter(m => m !== mode)
      });
    } else {
      setClientData({
        ...clientData,
        modesPaiementPreferes: [...modesPaiement, mode]
      });
    }
  };

  const columns = [
    { key: 'numeroClient', label: 'N° Client' },
    { key: 'nom', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'type', label: 'Type' },
    { 
      key: 'compteComptableId', 
      label: 'Compte Comptable',
      render: (val) => {
        if (!val) return <span style={{ color: '#e74c3c', fontStyle: 'italic' }}>Non configuré</span>;
        const compte = comptesComptables.find(c => c.id === val);
        return compte ? `${compte.numero} - ${compte.nom}` : 'N/A';
      }
    },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h3>⚙️ Paramètres</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
        {['clients', 'taxes', 'codesComptables'].map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: subTab === tab ? '#3498db' : 'transparent',
              color: subTab === tab ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              fontWeight: subTab === tab ? 'bold' : 'normal',
              fontSize: '13px'
            }}
          >
            {tab === 'clients' ? '👥 Clients' :
             tab === 'taxes' ? '💰 Taxes' : '📋 Codes Comptables'}
          </button>
        ))}
      </div>

      {subTab === 'clients' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>👥 Gestion Clients</h4>
            <Button variant="primary" onClick={handleNewClient}>
              ➕ Nouveau Client
            </Button>
          </div>

          <div style={{ 
            padding: '15px', 
            backgroundColor: '#d1ecf1', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #bee5eb'
          }}>
            <p style={{ margin: 0, color: '#0c5460', fontSize: '14px' }}>
              💡 <strong>Configuration complète des clients:</strong> Créez et configurez vos clients avec toutes leurs spécificités (compte comptable, échéances, modes de paiement).
            </p>
          </div>

          <Table 
            columns={columns} 
            data={clients}
            onRowClick={(client) => { setSelectedClient(client); setShowClientDetails(true); }}
            actions={true}
            customActions={(client) => (
              <div style={{ display: 'flex', gap: '5px' }}>
                <Button size="small" variant="info" onClick={() => handleEditClient(client)}>
                  ✏️ Modifier
                </Button>
                <Button size="small" variant="danger" onClick={() => handleDeleteClient(client.id)}>
                  🗑️
                </Button>
              </div>
            )}
          />
        </div>
      )}

      {subTab === 'taxes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>💰 Configuration des Taxes</h4>
            <Button onClick={handleNewTaxe}>+ Nouvelle Taxe</Button>
          </div>
          <Table
            columns={[
              { key: 'nom', label: 'Nom' },
              { key: 'taux', label: 'Taux (%)', render: (val) => `${val}%` },
              { key: 'codeComptable', label: 'Code Comptable' }
            ]}
            data={taxes}
            onEdit={handleEditTaxe}
            actions={true}
          />
        </div>
      )}

      {subTab === 'codesComptables' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>📋 Codes Comptables</h4>
            <Button onClick={handleNewCodeComptable}>+ Nouveau Code</Button>
          </div>
          <Table
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'libelle', label: 'Libellé' }
            ]}
            data={codesComptables}
            onEdit={handleEditCodeComptable}
            actions={true}
          />
        </div>
      )}

      {/* MODAL CRUD */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalType === 'client' ? (isEditing ? `✏️ Modifier Client - ${clientData.nom}` : '➕ Nouveau Client') :
          modalType === 'taxe' ? (isEditing ? 'Modifier Taxe' : 'Nouvelle Taxe') :
          modalType === 'codeComptable' ? (isEditing ? 'Modifier Code' : 'Nouveau Code Comptable') : ''
        }
        size="large"
      >
        {modalType === 'client' && (
        <>
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* SECTION 1: INFORMATIONS GÉNÉRALES */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginTop: 0 }}>📋 Informations Générales</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <FormField
                label="Nom *"
                value={clientData.nom}
                onChange={(e) => setClientData({ ...clientData, nom: e.target.value })}
                placeholder="Nom du client"
              />
              <FormField
                label="Email *"
                type="email"
                value={clientData.email}
                onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                placeholder="email@exemple.com"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <FormField
                label="Téléphone"
                value={clientData.telephone}
                onChange={(e) => setClientData({ ...clientData, telephone: e.target.value })}
                placeholder="+221 77 123 45 67"
              />
              <FormField
                label="Type"
                type="select"
                value={clientData.type}
                onChange={(e) => setClientData({ ...clientData, type: e.target.value })}
                options={[
                  { value: 'particulier', label: 'Particulier' },
                  { value: 'entreprise', label: 'Entreprise' },
                  { value: 'administration', label: 'Administration' },
                ]}
              />
              <FormField
                label="Catégorie"
                type="select"
                value={clientData.categorie}
                onChange={(e) => setClientData({ ...clientData, categorieClient: e.target.value })}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'vip', label: 'VIP' },
                ]}
              />
            </div>

            <div style={{ marginTop: '15px' }}>
              <FormField
                label="Adresse"
                value={clientData.adresse}
                onChange={(e) => setClientData({ ...clientData, adresse: e.target.value })}
                placeholder="Rue, quartier..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <FormField
                label="Ville"
                value={clientData.ville}
                onChange={(e) => setClientData({ ...clientData, ville: e.target.value })}
                placeholder="Dakar"
              />
              <FormField
                label="Pays"
                value={clientData.pays}
                onChange={(e) => setClientData({ ...clientData, pays: e.target.value })}
                placeholder="Sénégal"
              />
            </div>
          </div>

          {/* SECTION 2: CONFIGURATION COMPTABLE */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginTop: 0 }}>💰 Configuration Comptable</h4>
            
            <FormField
              label="Compte Comptable (SYSCOHADA/IFRS/PCG)"
              type="select"
              value={clientData.compteComptableId || ''}
              onChange={(e) => setClientData({ ...clientData, compteComptableId: parseInt(e.target.value) || null })}
              options={[
                { value: '', label: '-- Sélectionner un compte --' },
                ...comptesComptables
                  .filter(c => c.actif)
                  .map(c => ({
                    value: c.id,
                    label: `${c.numero} - ${c.nom} (${c.type})`
                  }))
              ]}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <FormField
                label="Délai de Paiement (jours)"
                type="number"
                value={clientData.delaiPaiement}
                onChange={(e) => setClientData({ ...clientData, delaiPaiement: parseInt(e.target.value) || 30 })}
              />
              <FormField
                label="Limite de Crédit (FCFA)"
                type="number"
                value={clientData.limiteCredit}
                onChange={(e) => setClientData({ ...clientData, limiteCredit: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div style={{ 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '8px',
              marginTop: '15px',
              border: '1px solid #ffc107'
            }}>
              <div style={{ fontSize: '12px', color: '#856404' }}>
                💡 <strong>Conseil:</strong> Pour les clients, utilisez généralement un compte de classe 4 (Comptes de tiers): 411 - Clients, 4111 - Clients ordinaires, 4117 - Créances douteuses
              </div>
            </div>
          </div>

          {/* SECTION 3: ÉCHÉANCES PERSONNALISÉES */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#fff3e0', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ marginTop: 0 }}>📅 Échéances Personnalisées</h4>
              <Button size="small" variant="primary" onClick={addEcheance}>
                ➕ Ajouter une échéance
              </Button>
            </div>

            {clientData.echeancesPersonnalisees.length === 0 ? (
              <div style={{ 
                padding: '20px', 
                textAlign: 'center',
                backgroundColor: '#fff',
                borderRadius: '8px',
                border: '2px dashed #dee2e6'
              }}>
                <p style={{ color: '#999', margin: 0 }}>
                  Aucune échéance personnalisée. Cliquez sur "Ajouter une échéance" pour créer des échéances de paiement spécifiques.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: '15px' }}>
                {clientData.echeancesPersonnalisees.map((echeance, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '10px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6'
                  }}>
                    <div style={{ flex: 1 }}>
                      <FormField
                        label="Jours"
                        type="number"
                        value={echeance.jours}
                        onChange={(e) => updateEcheance(index, 'jours', parseInt(e.target.value) || 0)}
                        placeholder="30"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FormField
                        label="Pourcentage (%)"
                        type="number"
                        value={echeance.pourcentage}
                        onChange={(e) => updateEcheance(index, 'pourcentage', parseInt(e.target.value) || 0)}
                        placeholder="100"
                      />
                    </div>
                    <Button 
                      size="small" 
                      variant="danger" 
                      onClick={() => removeEcheance(index)}
                      style={{ marginTop: '20px' }}
                    >
                      🗑️
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: MODES DE PAIEMENT PRÉFÉRÉS */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginTop: 0 }}>💳 Modes de Paiement Préférés</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { value: 'mobile_money', label: '📱 Mobile Money', icon: '📱' },
                { value: 'carte_bancaire', label: '💳 Carte Bancaire', icon: '💳' },
                { value: 'virement', label: '🏦 Virement Bancaire', icon: '🏦' },
                { value: 'especes', label: '💵 Espèces', icon: '💵' },
                { value: 'cheque', label: '📝 Chèque', icon: '📝' },
                { value: 'credit', label: '📊 Crédit', icon: '📊' },
              ].map(mode => (
                <label 
                  key={mode.value}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '10px',
                    backgroundColor: (clientData.modesPaiementPreferes || []).includes(mode.value) ? '#4CAF50' : '#fff',
                    color: (clientData.modesPaiementPreferes || []).includes(mode.value) ? '#fff' : '#000',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: '2px solid #dee2e6',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={(clientData.modesPaiementPreferes || []).includes(mode.value)}
                    onChange={() => toggleModePaiement(mode.value)}
                    style={{ marginRight: '10px' }}
                  />
                  <span>{mode.icon} {mode.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button variant="success" onClick={handleSubmit}>
              💾 {isEditing ? 'Modifier' : 'Créer'} le Client
            </Button>
          </div>
        </>
        )}

        {modalType === 'taxe' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <FormField label="Nom de la Taxe" name="nom" value={taxeData.nom}
                onChange={(e) => setTaxeData({...taxeData, nom: e.target.value})} required
                placeholder="Ex: TVA 18%" />
              <FormField label="Taux (%)" name="taux" type="number" value={taxeData.taux}
                onChange={(e) => setTaxeData({...taxeData, taux: parseFloat(e.target.value)})} required
                placeholder="Ex: 18" />
              <FormField label="Code Comptable" name="codeComptable" value={taxeData.codeComptable}
                onChange={(e) => setTaxeData({...taxeData, codeComptable: e.target.value})}
                placeholder="Ex: 4431" />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button type="button" variant="success" onClick={handleSubmit}>{isEditing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        )}

        {modalType === 'codeComptable' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
              <FormField label="Code" name="code" value={codeComptableData.code}
                onChange={(e) => setCodeComptableData({...codeComptableData, code: e.target.value})} required
                placeholder="Ex: 411" />
              <FormField label="Libellé" name="libelle" value={codeComptableData.libelle}
                onChange={(e) => setCodeComptableData({...codeComptableData, libelle: e.target.value})} required
                placeholder="Ex: Clients" />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button type="button" variant="success" onClick={handleSubmit}>{isEditing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DE DÉTAILS CLIENT */}
      {selectedClient && (
        <DetailsModal
          isOpen={showClientDetails}
          onClose={() => { setShowClientDetails(false); setSelectedClient(null); }}
          title={`Détails Client - ${selectedClient.nom}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'N° Client', value: selectedClient.numeroClient },
                { label: 'Nom', value: selectedClient.nom },
                { label: 'Email', value: selectedClient.email || '-' },
                { label: 'Téléphone', value: selectedClient.telephone || '-' },
                { label: 'Type', value: selectedClient.type }
              ]
            },
            {
              title: 'Adresse',
              fields: [
                { label: 'Adresse', value: selectedClient.adresse || '-' },
                { label: 'Ville', value: selectedClient.ville || '-' },
                { label: 'Pays', value: selectedClient.pays || '-' }
              ]
            },
            {
              title: 'Paramètres Commerciaux',
              fields: [
                { label: 'Compte Comptable', value: (() => {
                  const compte = comptesComptables.find(c => c.id === selectedClient.compteComptableId);
                  return compte ? `${compte.numero} - ${compte.nom}` : 'Non configuré';
                })() },
                { label: 'Délai Paiement', value: `${selectedClient.delaiPaiement || 30} jours` },
                { label: 'Limite Crédit', value: `${selectedClient.limiteCredit || 0} FCFA` },
                { label: 'Catégorie', value: selectedClient.categorieClient || 'Standard' }
              ]
            }
          ]}
          actions={[
            {
              label: '✏️ Modifier',
              variant: 'info',
              onClick: () => {
                setShowClientDetails(false);
                handleEditClient(selectedClient);
              }
            }
          ]}
        />
      )}
    </div>
  );
}

function EtatsCompteTab() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });
  const [etatCompte, setEtatCompte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data || []);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    }
  };

  const genererEtatCompte = async () => {
    if (!selectedClientId) {
      alert('Veuillez sélectionner un client');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/clients/etat-compte', {
        clientId: selectedClientId,
        dateDebut: periode.dateDebut,
        dateFin: periode.dateFin
      });
      setEtatCompte(res.data);
    } catch (error) {
      alert('Erreur lors de la génération: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const envoyerParEmail = async () => {
    if (!etatCompte) return;

    const client = clients.find(c => c.id == selectedClientId);
    if (!client?.email) {
      alert('Ce client n\'a pas d\'adresse email configurée');
      return;
    }

    setSending(true);
    try {
      await api.post('/clients/etat-compte/email', {
        clientId: selectedClientId,
        dateDebut: periode.dateDebut,
        dateFin: periode.dateFin
      });
      alert(`État de compte envoyé à ${client.email} avec succès!`);
    } catch (error) {
      alert('Erreur lors de l\'envoi: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const selectedClient = clients.find(c => c.id == selectedClientId);

  return (
    <div>
      <h3>📋 États de Compte Client</h3>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <FormField
            label="Client"
            type="select"
            value={selectedClientId}
            onChange={(e) => {
              setSelectedClientId(e.target.value);
              setEtatCompte(null);
            }}
            options={[
              { value: '', label: '-- Sélectionner un client --' },
              ...clients.map(c => ({ value: c.id, label: c.nom }))
            ]}
          />
          <FormField
            label="Date Début"
            type="date"
            value={periode.dateDebut}
            onChange={(e) => {
              setPeriode({ ...periode, dateDebut: e.target.value });
              setEtatCompte(null);
            }}
          />
          <FormField
            label="Date Fin"
            type="date"
            value={periode.dateFin}
            onChange={(e) => {
              setPeriode({ ...periode, dateFin: e.target.value });
              setEtatCompte(null);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={genererEtatCompte} disabled={loading || !selectedClientId}>
            {loading ? '⏳ Génération...' : '📄 Générer État de Compte'}
          </Button>
          {etatCompte && selectedClient?.email && (
            <Button variant="success" onClick={envoyerParEmail} disabled={sending}>
              {sending ? '📧 Envoi...' : `📧 Envoyer à ${selectedClient.email}`}
            </Button>
          )}
        </div>
      </div>

      {etatCompte && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #3498db', paddingBottom: '20px' }}>
            <h2 style={{ color: '#3498db', margin: '0 0 10px 0' }}>ÉTAT DE COMPTE CLIENT</h2>
            <p style={{ margin: '5px 0', fontSize: '16px' }}><strong>{selectedClient?.nom}</strong></p>
            <p style={{ margin: '5px 0', color: '#666' }}>
              Période: {new Date(periode.dateDebut).toLocaleDateString('fr-FR')} au {new Date(periode.dateFin).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Total Facturé</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#3498db' }}>
                {etatCompte.totalFacture?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#e8f8f0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Total Payé</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                {etatCompte.totalPaye?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Solde Restant</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: etatCompte.solde > 0 ? '#e74c3c' : '#27ae60' }}>
                {etatCompte.solde?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px', color: '#333' }}>📋 Factures</h4>
            {etatCompte.factures && etatCompte.factures.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>N° Facture</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Montant TTC</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {etatCompte.factures.map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{f.numeroFacture}</td>
                      <td style={{ padding: '12px' }}>{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{f.totalTTC?.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {(() => {
                          const display = getStatutFactureDisplay(f.statut, f.montantPaye, f.totalTTC);
                          return (
                            <span style={{ 
                              padding: '4px 12px', 
                              borderRadius: '12px', 
                              fontSize: '12px',
                              backgroundColor: display.bg,
                              color: display.color,
                              fontWeight: '500'
                            }}>
                              {display.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Aucune facture sur cette période</p>
            )}
          </div>

          <div>
            <h4 style={{ marginBottom: '15px', color: '#333' }}>💳 Paiements</h4>
            {etatCompte.paiements && etatCompte.paiements.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Référence</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Mode</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {etatCompte.paiements.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px' }}>{p.reference || '-'}</td>
                      <td style={{ padding: '12px' }}>{p.modePaiement}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                        {p.montant?.toLocaleString('fr-FR')} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Aucun paiement sur cette période</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

