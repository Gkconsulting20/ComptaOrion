import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function FacturesModule() {
  const [factures, setFactures] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingFacture, setEditingFacture] = useState(null);
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [tauxTVA, setTauxTVA] = useState(18);
  const [formData, setFormData] = useState({
    clientId: '',
    dateFacture: new Date().toISOString().split('T')[0],
    dateEcheance: '',
    items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0 }],
  });
  const [paiementData, setPaiementData] = useState({
    montant: 0,
    datePaiement: new Date().toISOString().split('T')[0],
    modePaiement: 'virement',
    reference: '',
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
      const facturesData = facturesRes.data?.data || facturesRes.data;
      const clientsData = clientsRes.data?.data || clientsRes.data;
      setFactures(Array.isArray(facturesData) ? facturesData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let totalHT = 0;
    formData.items.forEach(item => {
      const montantLigne = item.quantite * item.prixUnitaire;
      const montantRemise = montantLigne * (item.remise / 100);
      totalHT += montantLigne - montantRemise;
    });
    const montantTVA = totalHT * (tauxTVA / 100);
    const totalTTC = totalHT + montantTVA;
    return { totalHT, montantTVA, totalTTC };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const totals = calculateTotals();
    const factureData = {
      ...formData,
      ...totals,
      tauxTVA,
    };

    try {
      if (editingFacture) {
        await api.put(`/factures/${editingFacture.id}`, factureData);
      } else {
        await api.post('/factures', factureData);
      }
      setShowModal(false);
      setEditingFacture(null);
      resetForm();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    setFormData({
      clientId: facture.clientId,
      dateFacture: facture.dateFacture?.split('T')[0] || '',
      dateEcheance: facture.dateEcheance?.split('T')[0] || '',
      items: facture.items && facture.items.length > 0 ? facture.items : [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0 }],
    });
    setShowModal(true);
  };

  const handleDelete = async (facture) => {
    if (!confirm(`Supprimer la facture ${facture.numeroFacture} ?`)) return;
    try {
      await api.delete(`/factures/${facture.id}`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleSendEmail = async (row) => {
    const client = row.client || {};
    
    if (!client.email) {
      alert('Le client n\'a pas d\'adresse email renseignée');
      return;
    }

    if (!confirm(`Envoyer la facture ${row.numeroFacture} par email à ${client.email} ?`)) return;
    
    try {
      const response = await api.post(`/factures/${row.id}/send-email`);
      
      if (response.data?.simulation) {
        alert('⚠️ Mode Simulation : SendGrid n\'est pas configuré.\n\nPour activer l\'envoi réel d\'emails :\n1. Ajoutez votre clé API SendGrid comme secret : SENDGRID_API_KEY\n2. Configurez l\'email expéditeur (optionnel) : SENDGRID_FROM_EMAIL');
      } else if (response.data?.success) {
        alert(`✅ Email envoyé avec succès à ${client.email}`);
      } else {
        alert(`❌ Échec d'envoi : ${response.data?.message || 'Erreur inconnue'}`);
      }
      
      loadData();
    } catch (error) {
      alert('❌ Erreur : ' + error.message);
    }
  };

  const handleRowClick = (facture) => {
    setSelectedFacture(facture);
    setShowDetailsModal(true);
  };

  const handlePaiement = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/factures/${selectedFacture.id}/paiement`, paiementData);
      setShowPaiementModal(false);
      setSelectedFacture(null);
      setPaiementData({
        montant: 0,
        datePaiement: new Date().toISOString().split('T')[0],
        modePaiement: 'virement',
        reference: '',
      });
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantite: 1, prixUnitaire: 0, remise: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      dateFacture: new Date().toISOString().split('T')[0],
      dateEcheance: '',
      items: [{ description: '', quantite: 1, prixUnitaire: 0, remise: 0 }],
    });
  };

  const columns = [
    { key: 'numeroFacture', label: 'N° Facture' },
    { 
      key: 'client', 
      label: 'Client',
      render: (val, row) => row.client?.nom || row.facture?.clientId || '-'
    },
    { key: 'dateFacture', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { key: 'totalTTC', label: 'Montant TTC', render: (val) => `${val || 0} FCFA` },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = {
          brouillon: '#95a5a6',
          envoyee: '#3498db',
          payee: '#27ae60',
          retard: '#e74c3c',
          annulee: '#e74c3c'
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
        <h2>💵 Factures Ventes</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={async () => {
            try {
              const response = await fetch('/api/factures/export/csv', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
              });
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'factures.csv';
              a.click();
              window.URL.revokeObjectURL(url);
            } catch (err) {
              alert('Erreur export: ' + err.message);
            }
          }}>
            Export CSV
          </Button>
          <Button onClick={() => { resetForm(); setEditingFacture(null); setShowModal(true); }}>
            + Nouvelle Facture
          </Button>
        </div>
      </div>

      <Table 
        columns={columns} 
        data={factures.map(f => ({ ...f.facture, client: f.client }))} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSendEmail={handleSendEmail}
        onRowClick={handleRowClick}
        actions={true}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingFacture(null); resetForm(); }}
        title={editingFacture ? 'Modifier Facture' : 'Nouvelle Facture'}
        size="xlarge"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <FormField
              label="Client"
              name="clientId"
              type="select"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              options={clients.map(c => ({ value: c.id, label: c.nom }))}
              required
            />
            <FormField
              label="Date Facture"
              name="dateFacture"
              type="date"
              value={formData.dateFacture}
              onChange={(e) => setFormData({ ...formData, dateFacture: e.target.value })}
              required
            />
            <FormField
              label="Date Échéance"
              name="dateEcheance"
              type="date"
              value={formData.dateEcheance}
              onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
            />
          </div>

          <h4>Lignes de facture</h4>
          {formData.items.map((item, index) => (
            <div key={index} style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr 1fr 60px', 
              gap: '10px', 
              marginBottom: '10px',
              alignItems: 'end'
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
              <Button 
                type="button" 
                variant="danger" 
                size="small"
                onClick={() => removeItem(index)}
                disabled={formData.items.length === 1}
              >
                ×
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="small" onClick={addItem}>
            + Ajouter une ligne
          </Button>

          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>Total HT:</strong>
              <span>{totals.totalHT.toFixed(2)} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>TVA ({tauxTVA}%):</strong>
              <span>{totals.montantTVA.toFixed(2)} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', paddingTop: '10px', borderTop: '2px solid #dee2e6' }}>
              <strong>Total TTC:</strong>
              <span>{totals.totalTTC.toFixed(2)} FCFA</span>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditingFacture(null); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingFacture ? 'Mettre à jour' : 'Créer Facture'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showPaiementModal}
        onClose={() => { setShowPaiementModal(false); setSelectedFacture(null); }}
        title="Enregistrer un paiement"
        size="medium"
      >
        <form onSubmit={handlePaiement}>
          <FormField
            label="Montant"
            name="montant"
            type="number"
            value={paiementData.montant}
            onChange={(e) => setPaiementData({ ...paiementData, montant: parseFloat(e.target.value) })}
            required
          />
          <FormField
            label="Date Paiement"
            name="datePaiement"
            type="date"
            value={paiementData.datePaiement}
            onChange={(e) => setPaiementData({ ...paiementData, datePaiement: e.target.value })}
            required
          />
          <FormField
            label="Mode de Paiement"
            name="modePaiement"
            type="select"
            value={paiementData.modePaiement}
            onChange={(e) => setPaiementData({ ...paiementData, modePaiement: e.target.value })}
            options={[
              { value: 'virement', label: 'Virement' },
              { value: 'cheque', label: 'Chèque' },
              { value: 'especes', label: 'Espèces' },
              { value: 'carte', label: 'Carte Bancaire' },
            ]}
          />
          <FormField
            label="Référence"
            name="reference"
            value={paiementData.reference}
            onChange={(e) => setPaiementData({ ...paiementData, reference: e.target.value })}
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowPaiementModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Enregistrer Paiement
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedFacture(null); }}
        title={`Détails Facture ${selectedFacture?.numeroFacture || ''}`}
        size="large"
      >
        {selectedFacture && (
          <div style={{ padding: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Informations Générales</h4>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Numéro:</strong> {selectedFacture.numeroFacture}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Date:</strong> {selectedFacture.dateFacture?.split('T')[0]}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Date échéance:</strong> {selectedFacture.dateEcheance?.split('T')[0] || '-'}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Statut:</strong> <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: {
                      brouillon: '#95a5a6',
                      envoyee: '#3498db',
                      payee: '#27ae60',
                      retard: '#e74c3c',
                      annulee: '#e74c3c'
                    }[selectedFacture.statut] || '#999',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>{selectedFacture.statut}</span>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Client</h4>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Nom:</strong> {selectedFacture.client?.nom || '-'}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Email:</strong> {selectedFacture.client?.email || '-'}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Téléphone:</strong> {selectedFacture.client?.telephone || '-'}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Adresse:</strong> {selectedFacture.client?.adresse || '-'}
                </div>
              </div>
            </div>

            {selectedFacture.items && selectedFacture.items.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Lignes de Facture</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Quantité</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Prix Unit.</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Remise</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFacture.items.map((item, idx) => {
                      const montant = item.quantite * item.prixUnitaire;
                      const remise = montant * (item.remise / 100);
                      const total = montant - remise;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '10px' }}>{item.description}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantite}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{item.prixUnitaire} FCFA</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{item.remise}%</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{total.toFixed(2)} FCFA</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>Total HT:</strong>
                <span>{selectedFacture.totalHT?.toFixed(2) || 0} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>TVA ({selectedFacture.tauxTVA || 18}%):</strong>
                <span>{selectedFacture.montantTVA?.toFixed(2) || 0} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', paddingTop: '10px', borderTop: '2px solid #dee2e6' }}>
                <strong>Total TTC:</strong>
                <span>{selectedFacture.totalTTC?.toFixed(2) || 0} FCFA</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={() => { setShowDetailsModal(false); handleEdit(selectedFacture); }}>
                Modifier
              </Button>
              {selectedFacture.client?.email && (
                <Button variant="success" onClick={() => { setShowDetailsModal(false); handleSendEmail(selectedFacture); }}>
                  📧 Envoyer par Email
                </Button>
              )}
              <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
