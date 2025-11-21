import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function CommandesAchatModule() {
  const [commandes, setCommandes] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    fournisseurId: '',
    dateCommande: new Date().toISOString().split('T')[0],
    dateLivraisonPrevue: '',
    items: [{ description: '', quantite: 1, prixUnitaire: 0 }],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commandesRes, fournisseursRes] = await Promise.all([
        api.get('/commandes-achat'),
        api.get('/fournisseurs')
      ]);
      setCommandes(commandesRes.data || []);
      setFournisseurs(fournisseursRes.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/commandes-achat', formData);
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantite: 1, prixUnitaire: 0 }]
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
      fournisseurId: '',
      dateCommande: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: '',
      items: [{ description: '', quantite: 1, prixUnitaire: 0 }],
    });
  };

  const columns = [
    { key: 'numeroCommande', label: 'N° Commande' },
    { 
      key: 'fournisseur', 
      label: 'Fournisseur',
      render: (val, row) => row.fournisseur?.nom || row.commande?.fournisseurId || '-'
    },
    { key: 'dateCommande', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { key: 'totalHT', label: 'Total HT', render: (val) => `${val || 0} FCFA` },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = {
          brouillon: '#95a5a6',
          validee: '#3498db',
          recue: '#27ae60',
          annulee: '#e74c3c'
        };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px'
        }}>{val}</span>;
      }
    },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📦 Commandes Achat</h2>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          + Nouvelle Commande
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={commandes.map(c => ({ ...c.commande, fournisseur: c.fournisseur }))} 
        actions={false}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="Nouvelle Commande d'Achat"
        size="xlarge"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <FormField
              label="Fournisseur"
              name="fournisseurId"
              type="select"
              value={formData.fournisseurId}
              onChange={(e) => setFormData({ ...formData, fournisseurId: e.target.value })}
              options={fournisseurs.map(f => ({ value: f.id, label: f.nom }))}
              required
            />
            <FormField
              label="Date Commande"
              name="dateCommande"
              type="date"
              value={formData.dateCommande}
              onChange={(e) => setFormData({ ...formData, dateCommande: e.target.value })}
              required
            />
            <FormField
              label="Date Livraison Prévue"
              name="dateLivraisonPrevue"
              type="date"
              value={formData.dateLivraisonPrevue}
              onChange={(e) => setFormData({ ...formData, dateLivraisonPrevue: e.target.value })}
            />
          </div>

          <h4>Articles</h4>
          {formData.items.map((item, index) => (
            <div key={index} style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr 60px', 
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
                onChange={(e) => updateItem(index, 'quantite', parseFloat(e.target.value))}
                required
              />
              <FormField
                label="Prix Unitaire"
                type="number"
                value={item.prixUnitaire}
                onChange={(e) => updateItem(index, 'prixUnitaire', parseFloat(e.target.value))}
                required
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
            + Ajouter un article
          </Button>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Créer Commande
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
