import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { DetailsModal } from '../components/DetailsModal';
import PeriodFilter, { getPeriodeDates } from '../components/PeriodFilter';
import api from '../api';
import { getInvoiceStatusDisplay, InvoiceStatusBadge } from '../utils/invoiceStatus';
import { formatPeriodeFR } from '../utils/dateUtils';

export function ClientsModule() {
  const [activeTab, setActiveTab] = useState('devis');

  const tabs = [
    { id: 'devis', label: '📝 Devis', icon: '📝' },
    { id: 'factures', label: '💵 Factures Client', icon: '💵' },
    { id: 'bons-livraison', label: '📦 Bons de Livraison', icon: '📦' },
    { id: 'paiements', label: '💳 Paiements', icon: '💳' },
    { id: 'table-prix', label: '💰 Table de Prix', icon: '💰' },
    { id: 'etats-compte', label: '📋 États de Compte', icon: '📋' },
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
      {activeTab === 'table-prix' && <TablePrixTab />}
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
    { key: 'totalTTC', label: 'Montant TTC', render: (val) => `${Math.round(parseFloat(val || 0)).toLocaleString('fr-FR')} FCFA` },
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
                { label: 'Total HT', value: `${Math.round(parseFloat(selectedDevis.totalHT || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'TVA', value: `${Math.round(parseFloat(selectedDevis.montantTVA || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'Total TTC', value: `${Math.round(parseFloat(selectedDevis.totalTTC || 0)).toLocaleString('fr-FR')} FCFA` }
              ]
            }
          ]}
          tables={selectedDevis.items ? [{
            title: 'Articles / Services',
            columns: [
              { key: 'description', label: 'Description' },
              { key: 'quantite', label: 'Qté', align: 'center' },
              { key: 'prixUnitaire', label: 'P.U.', align: 'right', render: (val) => `${Math.round(parseFloat(val || 0)).toLocaleString('fr-FR')} FCFA` },
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
  const [selectedBL, setSelectedBL] = useState(null);
  const [showBLDetails, setShowBLDetails] = useState(false);

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
        onRowClick={(bon) => { setSelectedBL(bon); setShowBLDetails(true); }}
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

      {/* MODAL DÉTAILS BON DE LIVRAISON */}
      {selectedBL && showBLDetails && (
        <DetailsModal
          title={`📦 Bon de Livraison ${selectedBL.numeroBL || ''}`}
          isOpen={showBLDetails}
          onClose={() => { setShowBLDetails(false); setSelectedBL(null); }}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'Numéro BL', value: selectedBL.numeroBL || '-' },
                { label: 'Date Livraison', value: selectedBL.dateLivraison ? new Date(selectedBL.dateLivraison).toLocaleDateString('fr-FR') : '-' },
                { label: 'Client', value: selectedBL.client?.nom || '-' },
                { label: 'Notes', value: selectedBL.notes || '-' },
              ]
            }
          ]}
          tables={(selectedBL.items && selectedBL.items.length > 0) ? [{
            title: 'Articles Livrés',
            columns: [
              { key: 'produitId', label: 'ID Produit' },
              { key: 'quantite', label: 'Quantité', render: (val) => val || 0 }
            ],
            data: selectedBL.items
          }] : []}
        />
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
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [showFactureDetails, setShowFactureDetails] = useState(false);
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
          { key: 'statut', label: 'Statut', render: (_, row) => (
            <InvoiceStatusBadge 
              statut={row.statut} 
              montantPaye={row.montantPaye} 
              montantTTC={row.totalTTC} 
            />
          )},
        ]}
        data={filteredFactures}
        onRowClick={(facture) => { setSelectedFacture(facture); setShowFactureDetails(true); }}
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

      {/* MODAL DÉTAILS FACTURE */}
      {selectedFacture && showFactureDetails && (
        <DetailsModal
          title={`💵 Facture ${selectedFacture.numeroFacture || ''}`}
          isOpen={showFactureDetails}
          onClose={() => { setShowFactureDetails(false); setSelectedFacture(null); }}
          sections={[
            {
              title: 'Informations Client',
              fields: [
                { label: 'Client', value: selectedFacture.client?.nom || '-' },
                { label: 'Email', value: selectedFacture.client?.email || '-' },
                { label: 'Téléphone', value: selectedFacture.client?.telephone || '-' },
                { label: 'Adresse', value: selectedFacture.client?.adresse || '-' },
              ]
            },
            {
              title: 'Détails Facture',
              fields: [
                { label: 'Numéro', value: selectedFacture.numeroFacture || '-' },
                { label: 'Date Émission', value: selectedFacture.dateFacture ? new Date(selectedFacture.dateFacture).toLocaleDateString('fr-FR') : '-' },
                { label: 'Date Échéance', value: selectedFacture.dateEcheance ? new Date(selectedFacture.dateEcheance).toLocaleDateString('fr-FR') : '-' },
                { label: 'Statut', value: selectedFacture.statut || '-' },
              ]
            },
            {
              title: 'Montants',
              fields: [
                { label: 'Total HT', value: `${parseFloat(selectedFacture.totalHT || 0).toLocaleString()} FCFA` },
                { label: 'TVA', value: `${parseFloat(selectedFacture.montantTVA || 0).toLocaleString()} FCFA` },
                { label: 'Total TTC', value: `${parseFloat(selectedFacture.totalTTC || 0).toLocaleString()} FCFA`, highlight: true },
                { label: 'Montant Payé', value: `${parseFloat(selectedFacture.montantPaye || 0).toLocaleString()} FCFA` },
                { label: 'Reste à Payer', value: `${parseFloat((selectedFacture.totalTTC || 0) - (selectedFacture.montantPaye || 0)).toLocaleString()} FCFA` },
              ]
            }
          ]}
          tables={selectedFacture.items ? [{
            title: 'Articles / Services',
            columns: [
              { key: 'description', label: 'Description' },
              { key: 'quantite', label: 'Qté', render: (val) => val || 0 },
              { key: 'prixUnitaire', label: 'Prix Unit.', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
              { key: 'montantHT', label: 'Montant HT', render: (val, row) => `${parseFloat((row.quantite || 0) * (row.prixUnitaire || 0)).toLocaleString()} FCFA` }
            ],
            data: selectedFacture.items
          }] : []}
        />
      )}
    </div>
  );
}

// ONGLET: RAPPORTS CLIENT
// ==========================================
function RapportsTab() {
  const [rapportData, setRapportData] = useState(null);
  const [creancesData, setCreancesData] = useState(null);
  const [rapportPeriode, setRapportPeriode] = useState(null);
  const [loadingRapports, setLoadingRapports] = useState(true);
  const [loadingCreances, setLoadingCreances] = useState(true);
  const [loadingPeriode, setLoadingPeriode] = useState(true);
  const [erreurPeriode, setErreurPeriode] = useState(null);
  const [drillModal, setDrillModal] = useState({ open: false, title: '', data: [], loading: false, type: null });
  
  const [dateDebut, setDateDebut] = useState(() => {
    return getPeriodeDates('annee').dateDebut;
  });
  const [dateFin, setDateFin] = useState(() => {
    return getPeriodeDates('annee').dateFin;
  });

  const openDrillDown = async (type, title) => {
    setDrillModal({ open: true, title, data: [], loading: true, type });
    try {
      const res = await api.get(`/clients/detail/${type}`, { dateDebut, dateFin });
      setDrillModal({ open: true, title, data: res || [], loading: false, type });
    } catch (error) {
      console.error('Erreur drill-down:', error);
      setDrillModal(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadCreances();
    loadRapports();
    genererRapportPeriode();
  }, []);

  const loadRapports = async () => {
    setLoadingRapports(true);
    try {
      const res = await api.get('/clients/rapports');
      setRapportData(res.data?.data || null);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoadingRapports(false);
    }
  };

  const loadCreances = async () => {
    setLoadingCreances(true);
    try {
      const res = await api.get('/clients/comptes-a-recevoir');
      setCreancesData(res.data?.data || null);
    } catch (error) {
      console.error('Erreur chargement créances:', error);
    } finally {
      setLoadingCreances(false);
    }
  };

  const genererRapportPeriode = async () => {
    setErreurPeriode(null);
    
    if (!dateDebut || !dateFin) {
      setErreurPeriode('Veuillez sélectionner une période');
      return;
    }
    
    if (new Date(dateDebut) > new Date(dateFin)) {
      setErreurPeriode('La date de début doit être antérieure à la date de fin');
      return;
    }
    
    setLoadingPeriode(true);
    try {
      // Construire l'URL manuellement pour éviter les conflits avec api.get()
      const url = `/api/clients/rapport-periode?dateDebut=${encodeURIComponent(dateDebut)}&dateFin=${encodeURIComponent(dateFin)}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Erreur lors de la génération du rapport');
      }
      
      setRapportPeriode(data?.data || null);
      setErreurPeriode(null);
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      setErreurPeriode(error.message || 'Erreur lors de la génération du rapport');
      setRapportPeriode(null);
    } finally {
      setLoadingPeriode(false);
    }
  };

  const { topClients = [], clientsRetard = [], chiffreAffaireTotal = 0, echeances = { prochains7jours: { count: 0, montant: 0 }, prochains30jours: { count: 0, montant: 0 } }, distributionPaiements = [] } = rapportData || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>📊 Rapports Client</h3>
        <div style={{ display: 'flex', gap: '10px' }} className="no-print">
          <button 
            onClick={() => {
              const content = document.getElementById('client-rapport-content');
              const printWindow = window.open('', '_blank');
              printWindow.document.write(`
                <html>
                  <head>
                    <title>Rapport Client - ComptaOrion</title>
                    <style>
                      body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
                      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                      th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                      th { background-color: #f5f5f5; }
                      h3, h4 { color: #333; margin-top: 20px; }
                      @media print { body { margin: 0; } }
                    </style>
                  </head>
                  <body>
                    <h2>Rapport Client</h2>
                    <p>Période: ${dateDebut} au ${dateFin}</p>
                    ${content.innerHTML}
                    <div style="margin-top: 30px; text-align: center; color: #666; font-size: 10px;">
                      Document généré par ComptaOrion le ${new Date().toLocaleDateString('fr-FR')}
                    </div>
                  </body>
                </html>
              `);
              printWindow.document.close();
              printWindow.print();
            }}
            style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            🖨️ Imprimer
          </button>
          <button 
            onClick={() => {
              const content = document.getElementById('client-rapport-content');
              const htmlContent = `
                <html>
                  <head><meta charset="utf-8"><title>Rapport Client</title>
                    <style>body { font-family: Arial; margin: 20px; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px; } th { background: #f5f5f5; }</style>
                  </head>
                  <body>
                    <h2>Rapport Client</h2>
                    <p>Période: ${dateDebut} au ${dateFin}</p>
                    ${content.innerHTML}
                  </body>
                </html>
              `;
              const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Rapport_Client_${dateDebut}_${dateFin}.html`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ⬇️ Télécharger
          </button>
        </div>
      </div>
      
      <div id="client-rapport-content">

      {/* RAPPORT PAR PÉRIODE */}
      <div className="form-card" style={{ marginTop: '20px', backgroundColor: '#fff' }}>
        <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>📅 Rapport Client par Période</h3>
        <PeriodFilter
          dateDebut={dateDebut}
          dateFin={dateFin}
          onDateDebutChange={setDateDebut}
          onDateFinChange={setDateFin}
          onApply={genererRapportPeriode}
          loading={loadingPeriode}
          compact={true}
        />

        {erreurPeriode && (
          <div style={{
            padding: '15px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33',
            marginTop: '15px',
            marginBottom: '15px'
          }}>
            ⚠️ {erreurPeriode}
          </div>
        )}

        {loadingPeriode && !rapportPeriode && !erreurPeriode && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>⏳ Génération du rapport en cours...</div>
          </div>
        )}

        {rapportPeriode && !loadingPeriode && (
          <div>
            <div style={{ 
              padding: '15px',
              backgroundColor: '#f0f8ff',
              borderLeft: '4px solid #3498db',
              marginBottom: '20px',
              borderRadius: '4px'
            }}>
              <strong>📅 Période sélectionnée :</strong> Du {new Date(rapportPeriode.periode.dateDebut).toLocaleDateString('fr-FR')} au {new Date(rapportPeriode.periode.dateFin).toLocaleDateString('fr-FR')}
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginBottom: '30px'
            }}>
              <div style={{
                padding: '20px',
                backgroundColor: '#3498db',
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onClick={() => openDrillDown('chiffre-affaires', 'Détail du Chiffre d\'Affaires')}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.9 }}>CHIFFRE D'AFFAIRES</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(rapportPeriode.chiffreAffaires || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.7 }}>Cliquer pour détails</div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#27ae60',
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onClick={() => openDrillDown('factures', 'Détail des Factures Émises')}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.9 }}>FACTURES ÉMISES</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {rapportPeriode.nombreFactures || 0}
                </div>
                <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.7 }}>Cliquer pour détails</div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#f39c12',
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onClick={() => openDrillDown('paiements', 'Détail des Paiements Reçus')}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.9 }}>PAIEMENTS REÇUS</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(rapportPeriode.paiementsRecus || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.7 }}>Cliquer pour détails</div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#e74c3c',
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onClick={() => openDrillDown('impayes', 'Détail des Soldes Impayés')}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize: '12px', marginBottom: '5px', opacity: 0.9 }}>SOLDES IMPAYÉS</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(rapportPeriode.soldesImpayes || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.7 }}>Cliquer pour détails</div>
              </div>
            </div>

            {rapportPeriode.topClients && rapportPeriode.topClients.length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <h4 style={{ marginBottom: '15px' }}>Top Clients de la Période</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Client</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Factures</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>CA (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapportPeriode.topClients.map((client, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '12px' }}>{client.nom}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>{client.nombreFactures}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500' }}>
                          {parseFloat(client.chiffreAffaires || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RAPPORT D'ANCIENNETÉ DES CRÉANCES */}
      <div className="form-card" style={{ marginTop: '20px', backgroundColor: '#f8f9fa' }}>
        <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>📋 Rapport d'Ancienneté des Créances</h3>
        {loadingCreances ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Chargement du rapport...</p>
        ) : !creancesData ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Aucune donnée disponible</p>
        ) : (
          <>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Soldes à payer des clients organisés par période d'échéance
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginBottom: '30px'
            }}>
              <div style={{
                padding: '20px',
                backgroundColor: '#d32f2f',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                  EN RETARD
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(creancesData.totaux?.enRetard || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  {creancesData.facturesParPeriode?.enRetard?.length || 0} facture(s)
                </div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#27ae60',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                  0-30 JOURS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(creancesData.totaux?.de0a30jours || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  {creancesData.facturesParPeriode?.de0a30jours?.length || 0} facture(s)
                </div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#f39c12',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                  31-60 JOURS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(creancesData.totaux?.de31a60jours || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  {creancesData.facturesParPeriode?.de31a60jours?.length || 0} facture(s)
                </div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#3498db',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                  61-90 JOURS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(creancesData.totaux?.de61a90jours || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  {creancesData.facturesParPeriode?.de61a90jours?.length || 0} facture(s)
                </div>
              </div>

              <div style={{
                padding: '20px',
                backgroundColor: '#95a5a6',
                color: 'white',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                  90+ JOURS
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {parseFloat(creancesData.totaux?.plus90jours || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', marginTop: '5px', opacity: 0.8 }}>
                  {creancesData.facturesParPeriode?.plus90jours?.length || 0} facture(s)
                </div>
              </div>
            </div>

            <div style={{
              padding: '20px',
              backgroundColor: '#2c3e50',
              color: 'white',
              borderRadius: '8px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '18px'
            }}>
              TOTAL CRÉANCES: {parseFloat(creancesData.totaux?.total || 0).toLocaleString()} FCFA
            </div>
          </>
        )}
      </div>

      {/* AUTRES STATISTIQUES */}
      {!loadingRapports && rapportData && (
        <>
          <div className="metrics-grid" style={{ marginTop: '30px' }}>
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-info">
            <div className="metric-label">Chiffre d'Affaires Total</div>
            <div className="metric-value">{parseFloat(chiffreAffaireTotal || 0).toLocaleString()} FCFA</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏰</div>
          <div className="metric-info">
            <div className="metric-label">Échéances 7 jours</div>
            <div className="metric-value">{echeances.prochains7jours.count} factures</div>
            <small>{parseFloat(echeances.prochains7jours.montant || 0).toLocaleString()} FCFA</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📅</div>
          <div className="metric-info">
            <div className="metric-label">Échéances 30 jours</div>
            <div className="metric-value">{echeances.prochains30jours.count} factures</div>
            <small>{parseFloat(echeances.prochains30jours.montant || 0).toLocaleString()} FCFA</small>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚠️</div>
          <div className="metric-info">
            <div className="metric-label">Clients en Retard</div>
            <div className="metric-value">{clientsRetard.length} clients</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
        <div className="form-card">
          <h3>🏆 Top 10 Clients (CA)</h3>
          {topClients && topClients.length > 0 ? (
            <Table
              columns={[
                { key: 'nom', label: 'Client' },
                { key: 'nombreFactures', label: 'Factures', render: (val) => val || 0 },
                { key: 'chiffreAffaires', label: 'CA', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` }
              ]}
              data={topClients}
            />
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Aucune donnée disponible</p>
          )}
        </div>

        <div className="form-card">
          <h3>⚠️ Clients avec Retards</h3>
          {clientsRetard && clientsRetard.length > 0 ? (
            <Table
              columns={[
                { key: 'nom', label: 'Client' },
                { key: 'nombreFactures', label: 'Factures', render: (val) => val || 0 },
                { key: 'montantRetard', label: 'Montant', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` }
              ]}
              data={clientsRetard}
            />
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Aucun retard de paiement</p>
          )}
        </div>
      </div>

          <div className="form-card" style={{ marginTop: '20px' }}>
            <h3>💳 Distribution des Paiements (Top 10)</h3>
            {distributionPaiements && distributionPaiements.length > 0 ? (
              <Table
                columns={[
                  { key: 'nom', label: 'Client' },
                  { key: 'nombrePaiements', label: 'Nb Paiements', render: (val) => val || 0 },
                  { key: 'totalPaye', label: 'Total Payé', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` }
                ]}
                data={distributionPaiements}
              />
            ) : (
              <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Aucun paiement enregistré</p>
            )}
          </div>
        </>
      )}

      {/* Modal Drill-Down */}
      {drillModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '900px',
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{drillModal.title}</h3>
              <button onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false, type: null })} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666'
              }}>&times;</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {drillModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
              ) : drillModal.data?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Aucune donnée pour cette période</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      {drillModal.type === 'chiffre-affaires' || drillModal.type === 'factures' ? (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>N° Facture</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Client</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Montant TTC</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
                        </>
                      ) : drillModal.type === 'paiements' ? (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Client</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Mode</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Référence</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Montant</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>N° Facture</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Client</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Échéance</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Solde Restant</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {drillModal.data?.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        {drillModal.type === 'chiffre-affaires' || drillModal.type === 'factures' ? (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.numero}</td>
                            <td style={{ padding: '10px' }}>{item.client || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#3498db' }}>{parseFloat(item.montant || 0).toLocaleString()} FCFA</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                                backgroundColor: item.statut === 'payee' ? '#d4edda' : item.statut === 'envoyee' ? '#fff3cd' : '#f8d7da',
                                color: item.statut === 'payee' ? '#155724' : item.statut === 'envoyee' ? '#856404' : '#721c24'
                              }}>{item.statut}</span>
                            </td>
                          </>
                        ) : drillModal.type === 'paiements' ? (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.client || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.modePaiement || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.reference || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>{parseFloat(item.montant || 0).toLocaleString()} FCFA</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.numero}</td>
                            <td style={{ padding: '10px' }}>{item.client || '-'}</td>
                            <td style={{ padding: '10px', color: '#e74c3c' }}>{item.echeance ? new Date(item.echeance).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#e74c3c' }}>{parseFloat(item.solde || 0).toLocaleString()} FCFA</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                      <td colSpan={drillModal.type === 'paiements' ? 4 : 3} style={{ padding: '12px' }}>TOTAL</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: drillModal.type === 'impayes' ? '#e74c3c' : '#333' }}>
                        {drillModal.data?.reduce((sum, item) => sum + parseFloat(item.montant || item.solde || 0), 0).toLocaleString()} FCFA
                      </td>
                      {(drillModal.type === 'chiffre-affaires' || drillModal.type === 'factures') && <td></td>}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '13px' }}>{drillModal.data?.length || 0} élément(s)</span>
              <Button variant="secondary" onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false, type: null })}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
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
    { key: 'montant', label: 'Montant', render: (val) => `${Math.round(parseFloat(val || 0)).toLocaleString('fr-FR')} FCFA` },
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="secondary" onClick={async () => {
                try {
                  const response = await fetch('/api/clients/export/csv', {
                    credentials: 'include'
                  });
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'clients.csv';
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  alert('Erreur export: ' + err.message);
                }
              }}>
                Export CSV
              </Button>
              <Button variant="primary" onClick={handleNewClient}>
                ➕ Nouveau Client
              </Button>
            </div>
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
                { label: 'Limite Crédit', value: `${Math.round(parseFloat(selectedClient.limiteCredit || 0)).toLocaleString('fr-FR')} FCFA` },
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

  const imprimerEtatCompte = () => {
    if (!etatCompte || !selectedClient) return;

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>État de Compte - ${selectedClient.nom}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #3498db; }
          .header h1 { color: #3498db; font-size: 24px; margin-bottom: 10px; }
          .header .client-name { font-size: 18px; font-weight: bold; margin: 10px 0; }
          .header .periode { color: #666; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .summary-box { flex: 1; padding: 15px; margin: 0 10px; border-radius: 8px; text-align: center; }
          .summary-box:first-child { margin-left: 0; }
          .summary-box:last-child { margin-right: 0; }
          .summary-box.facture { background: #e8f4f8; }
          .summary-box.paye { background: #e8f8f0; }
          .summary-box.solde { background: #fff3e0; }
          .summary-box .label { color: #666; font-size: 12px; margin-bottom: 5px; }
          .summary-box .value { font-size: 20px; font-weight: bold; }
          .summary-box.facture .value { color: #3498db; }
          .summary-box.paye .value { color: #27ae60; }
          .summary-box.solde .value { color: #e74c3c; }
          .section { margin-bottom: 25px; }
          .section h3 { margin-bottom: 15px; color: #333; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 12px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .amount { font-weight: bold; }
          .status { padding: 3px 8px; border-radius: 4px; font-size: 11px; }
          .status-payee { background: #d4edda; color: #155724; }
          .status-envoyee { background: #fff3cd; color: #856404; }
          .status-retard { background: #f8d7da; color: #721c24; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; }
          .no-data { color: #999; font-style: italic; padding: 20px; text-align: center; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ÉTAT DE COMPTE CLIENT</h1>
          <div class="client-name">${selectedClient.nom}</div>
          <div class="periode">Période: ${formatPeriodeFR(periode.dateDebut, periode.dateFin)}</div>
        </div>

        <div class="summary">
          <div class="summary-box facture">
            <div class="label">Total Facturé</div>
            <div class="value">${etatCompte.totalFacture?.toLocaleString('fr-FR') || 0} FCFA</div>
          </div>
          <div class="summary-box paye">
            <div class="label">Total Payé</div>
            <div class="value">${etatCompte.totalPaye?.toLocaleString('fr-FR') || 0} FCFA</div>
          </div>
          <div class="summary-box solde">
            <div class="label">Solde Restant</div>
            <div class="value">${etatCompte.solde?.toLocaleString('fr-FR') || 0} FCFA</div>
          </div>
        </div>

        <div class="section">
          <h3>Factures</h3>
          ${etatCompte.factures && etatCompte.factures.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Date</th>
                  <th class="text-right">Montant TTC</th>
                  <th class="text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                ${etatCompte.factures.map(f => `
                  <tr>
                    <td>${f.numeroFacture}</td>
                    <td>${new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                    <td class="text-right amount">${Math.round(parseFloat(f.totalTTC || 0)).toLocaleString('fr-FR')} FCFA</td>
                    <td class="text-center">
                      <span class="status status-${f.statut}">${f.statut === 'payee' ? 'Payée' : f.statut === 'envoyee' ? 'Envoyée' : f.statut === 'retard' ? 'En retard' : f.statut}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="no-data">Aucune facture sur cette période</div>'}
        </div>

        <div class="section">
          <h3>Paiements</h3>
          ${etatCompte.paiements && etatCompte.paiements.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Référence</th>
                  <th>Mode</th>
                  <th class="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                ${etatCompte.paiements.map(p => `
                  <tr>
                    <td>${new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                    <td>${p.reference || '-'}</td>
                    <td>${p.modePaiement}</td>
                    <td class="text-right amount" style="color: #27ae60;">${Math.round(parseFloat(p.montant || 0)).toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="no-data">Aucun paiement sur cette période</div>'}
        </div>

        <div class="footer">
          <p>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          <p>ComptaOrion - Système de Gestion Comptable</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

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
          {etatCompte && (
            <Button variant="secondary" onClick={() => imprimerEtatCompte()}>
              🖨️ Imprimer / PDF
            </Button>
          )}
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
              Période: {formatPeriodeFR(periode.dateDebut, periode.dateFin)}
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
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{Math.round(parseFloat(f.totalTTC || 0)).toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <InvoiceStatusBadge 
                          statut={f.statut} 
                          montantPaye={f.montantPaye} 
                          montantTTC={f.totalTTC} 
                        />
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
                        {Math.round(parseFloat(p.montant || 0)).toLocaleString('fr-FR')} FCFA
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

// ==========================================
// ONGLET: TABLE DE PRIX (Marge Brute)
// ==========================================
function TablePrixTab() {
  const [prixList, setPrixList] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPrix, setEditingPrix] = useState(null);
  const [calculPreview, setCalculPreview] = useState(null);
  const [formData, setFormData] = useState({
    produitId: '',
    coutAchat: '',
    margeBruteCible: '30',
    prixVenteManuel: '',
    categorieClient: 'standard',
    canalVente: 'tous',
    dateEffet: new Date().toISOString().split('T')[0],
    dateExpiration: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prixRes, produitsRes] = await Promise.all([
        api.get('/clients/prix-produits'),
        api.get('/produits')
      ]);
      setPrixList(prixRes.data || []);
      setProduits(produitsRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculPreview = async () => {
    if (!formData.coutAchat || !formData.margeBruteCible) return;
    
    try {
      const res = await api.post('/clients/prix-produits/calculer', {
        coutAchat: parseFloat(formData.coutAchat),
        margeBruteCible: parseFloat(formData.margeBruteCible)
      });
      setCalculPreview(res.data);
    } catch (error) {
      console.error('Erreur calcul:', error);
    }
  };

  useEffect(() => {
    if (formData.coutAchat && formData.margeBruteCible) {
      const timer = setTimeout(handleCalculPreview, 300);
      return () => clearTimeout(timer);
    }
  }, [formData.coutAchat, formData.margeBruteCible]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPrix) {
        await api.put(`/clients/prix-produits/${editingPrix.id}`, formData);
      } else {
        await api.post('/clients/prix-produits', formData);
      }
      setShowModal(false);
      setEditingPrix(null);
      resetForm();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (prix) => {
    setEditingPrix(prix);
    const product = produits.find((item) => Number(item.id) === Number(prix.produitId));
    setFormData({
      produitId: prix.produitId,
      coutAchat: prix.coutCMV ?? product?.coutMoyen ?? product?.prixAchat ?? prix.coutAchat,
      margeBruteCible: prix.margeBruteCible,
      prixVenteManuel: prix.prixVenteManuel || '',
      categorieClient: prix.categorieClient || 'standard',
      canalVente: prix.canalVente || 'tous',
      dateEffet: prix.dateEffet?.split('T')[0] || '',
      dateExpiration: prix.dateExpiration?.split('T')[0] || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce prix ?')) return;
    try {
      await api.delete(`/clients/prix-produits/${id}`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      produitId: '',
      coutAchat: '',
      margeBruteCible: '30',
      prixVenteManuel: '',
      categorieClient: 'standard',
      canalVente: 'tous',
      dateEffet: new Date().toISOString().split('T')[0],
      dateExpiration: ''
    });
    setCalculPreview(null);
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>💰 Table de Prix avec Marge Brute</h3>
        <Button variant="success" onClick={() => { resetForm(); setShowModal(true); }}>
          + Nouveau Prix
        </Button>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4fd', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>📊 Formule de calcul</h4>
        <p style={{ margin: 0, color: '#555' }}>
          <strong>Prix de vente = CMV × (1 + majoration / 100)</strong>
          <br />
          <span style={{ fontSize: '13px', color: '#777' }}>
            Exemple : CMV de 100 FCFA et majoration de 30 % → prix de vente de 130 FCFA.
            Le CMV est recalculé à chaque achat, frais logistiques répartis compris.
          </span>
        </p>
      </div>

      {prixList.length > 0 ? (
        <Table
          columns={[
            { key: 'produitNom', label: 'Produit' },
            { key: 'produitReference', label: 'Référence' },
            { key: 'coutCMV', label: 'CMV actuel', render: (val, row) => `${parseFloat(val ?? row.coutAchat ?? 0).toLocaleString('fr-FR')} FCFA` },
            { key: 'margeBruteCible', label: 'Majoration CMV', render: (val) => `${val}%` },
            { key: 'prixVenteCalcule', label: 'Prix Calculé', render: (val) => `${parseFloat(val).toLocaleString('fr-FR')} FCFA` },
            { key: 'prixVenteManuel', label: 'Prix Manuel', render: (val) => val ? `${parseFloat(val).toLocaleString('fr-FR')} FCFA` : '-' },
            { key: 'categorieClient', label: 'Catégorie' },
            { key: 'actif', label: 'Actif', render: (val) => val ? '✅' : '❌' }
          ]}
          data={prixList}
          actions={(row) => (
            <div style={{ display: 'flex', gap: '5px' }}>
              <Button size="sm" variant="secondary" onClick={() => handleEdit(row)}>Modifier</Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)}>Supprimer</Button>
            </div>
          )}
        />
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
          <p style={{ color: '#666' }}>Aucun prix configuré. Cliquez sur "Nouveau Prix" pour commencer.</p>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingPrix(null); resetForm(); }}
        title={editingPrix ? 'Modifier le Prix' : 'Nouveau Prix Produit'}
      >
        <form onSubmit={handleSubmit}>
          <FormField
            label="Produit"
            type="select"
            value={formData.produitId}
            onChange={(e) => {
              const product = produits.find((item) => Number(item.id) === Number(e.target.value));
              const cmv = product?.coutMoyen || product?.prixAchat || 0;
              setFormData({ ...formData, produitId: e.target.value, coutAchat: String(cmv) });
            }}
            required
            disabled={!!editingPrix}
          >
            <option value="">Sélectionner un produit</option>
            {produits.map(p => (
              <option key={p.id} value={p.id}>{p.reference} - {p.nom}</option>
            ))}
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 14, color: '#495057', marginBottom: 5 }}>
                CMV actuel (FCFA)
              </label>
              <div style={{ border: '1px solid #ced4da', borderRadius: 4, padding: '10px 12px', minHeight: 20 }}>
                {Number(formData.coutAchat || 0).toLocaleString('fr-FR')}
              </div>
              <small style={{ color: '#777' }}>Calculé depuis le coût moyen pondéré du stock.</small>
            </div>
            <FormField
              label="Majoration du CMV (%)"
              type="number"
              value={formData.margeBruteCible}
              onChange={(e) => setFormData({ ...formData, margeBruteCible: e.target.value })}
              required
              min="0"
              max="1000"
              step="0.1"
            />
          </div>

          {calculPreview && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#d4edda', 
              borderRadius: '8px', 
              marginBottom: '15px',
              border: '1px solid #c3e6cb'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>💡 Calcul automatique</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ color: '#666', fontSize: '12px' }}>Prix de vente calculé:</span>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>
                    {calculPreview.prixVenteCalcule?.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div>
                  <span style={{ color: '#666', fontSize: '12px' }}>Marge ajoutée:</span>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#28a745' }}>
                    {calculPreview.beneficeBrut?.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              </div>
              <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
                {calculPreview.formule}
              </p>
            </div>
          )}

          <FormField
            label="Prix de vente manuel (optionnel - surcharge le calcul)"
            type="number"
            value={formData.prixVenteManuel}
            onChange={(e) => setFormData({ ...formData, prixVenteManuel: e.target.value })}
            min="0"
            step="0.01"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <FormField
              label="Catégorie client"
              type="select"
              value={formData.categorieClient}
              onChange={(e) => setFormData({ ...formData, categorieClient: e.target.value })}
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="grossiste">Grossiste</option>
              <option value="revendeur">Revendeur</option>
            </FormField>
            <FormField
              label="Canal de vente"
              type="select"
              value={formData.canalVente}
              onChange={(e) => setFormData({ ...formData, canalVente: e.target.value })}
            >
              <option value="tous">Tous</option>
              <option value="boutique">Boutique</option>
              <option value="en_ligne">En ligne</option>
              <option value="grossiste">Grossiste</option>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <FormField
              label="Date d'effet"
              type="date"
              value={formData.dateEffet}
              onChange={(e) => setFormData({ ...formData, dateEffet: e.target.value })}
              required
            />
            <FormField
              label="Date d'expiration (optionnel)"
              type="date"
              value={formData.dateExpiration}
              onChange={(e) => setFormData({ ...formData, dateExpiration: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <Button type="submit" variant="success">
              {editingPrix ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditingPrix(null); resetForm(); }}>
              Annuler
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

