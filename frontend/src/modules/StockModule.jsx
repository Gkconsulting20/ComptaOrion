import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function StockModule() {
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    reference: '',
    nom: '',
    description: '',
    categorie: '',
    prixAchat: 0,
    prixVente: 0,
    quantite: 0,
    stockMinimum: 10,
    unite: 'pièce',
  });

  useEffect(() => {
    loadProduits();
  }, []);

  const loadProduits = async () => {
    try {
      const data = await api.get('/produits');
      setProduits(data.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduit) {
        await api.put(`/produits/${editingProduit.id}`, formData);
      } else {
        await api.post('/produits', formData);
      }
      setShowModal(false);
      setEditingProduit(null);
      resetForm();
      loadProduits();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (produit) => {
    setEditingProduit(produit);
    setFormData({ ...produit });
    setShowModal(true);
  };

  const handleDelete = async (produit) => {
    if (!confirm(`Supprimer le produit ${produit.nom} ?`)) return;
    try {
      await api.delete(`/produits/${produit.id}`);
      loadProduits();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      reference: '',
      nom: '',
      description: '',
      categorie: '',
      prixAchat: 0,
      prixVente: 0,
      quantite: 0,
      stockMinimum: 10,
      unite: 'pièce',
    });
  };

  const columns = [
    { key: 'reference', label: 'Référence' },
    { key: 'nom', label: 'Nom' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'quantite', label: 'Stock', render: (val, row) => {
      const isLow = parseFloat(val) < parseFloat(row.stockMinimum);
      return <span style={{ color: isLow ? '#e74c3c' : '#27ae60', fontWeight: isLow ? 'bold' : 'normal' }}>
        {val} {row.unite}
        {isLow && ' ⚠️'}
      </span>;
    }},
    { key: 'prixVente', label: 'Prix Vente', render: (val) => `${val} FCFA` },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📦 Stock & Inventaire</h2>
        <Button onClick={() => { resetForm(); setEditingProduit(null); setShowModal(true); }}>
          + Nouveau Produit
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={produits} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingProduit(null); resetForm(); }}
        title={editingProduit ? 'Modifier Produit' : 'Nouveau Produit'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <FormField
              label="Référence"
              name="reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              required
            />
            <FormField
              label="Nom"
              name="nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
            />
            <FormField
              label="Catégorie"
              name="categorie"
              value={formData.categorie}
              onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
            />
            <FormField
              label="Unité"
              name="unite"
              type="select"
              value={formData.unite}
              onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
              options={[
                { value: 'pièce', label: 'Pièce' },
                { value: 'kg', label: 'Kilogramme' },
                { value: 'litre', label: 'Litre' },
                { value: 'mètre', label: 'Mètre' },
              ]}
            />
            <FormField
              label="Prix d'Achat (FCFA)"
              name="prixAchat"
              type="number"
              value={formData.prixAchat}
              onChange={(e) => setFormData({ ...formData, prixAchat: parseFloat(e.target.value) })}
            />
            <FormField
              label="Prix de Vente (FCFA)"
              name="prixVente"
              type="number"
              value={formData.prixVente}
              onChange={(e) => setFormData({ ...formData, prixVente: parseFloat(e.target.value) })}
              required
            />
            <FormField
              label="Quantité en Stock"
              name="quantite"
              type="number"
              value={formData.quantite}
              onChange={(e) => setFormData({ ...formData, quantite: parseFloat(e.target.value) })}
            />
            <FormField
              label="Stock Minimum"
              name="stockMinimum"
              type="number"
              value={formData.stockMinimum}
              onChange={(e) => setFormData({ ...formData, stockMinimum: parseFloat(e.target.value) })}
            />
          </div>
          <FormField
            label="Description"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingProduit ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
