import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import api from '../../api';

export function ProduitsSubTab({ produits, categories, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    reference: '', nom: '', description: '', categorieId: null,
    valorisationMethod: 'FIFO', prixAchat: 0, prixVente: 0,
    stockMinimum: 10, uniteMesure: 'pièce',
  });

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
      onReload();
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
    if (!confirm(`Supprimer ${produit.nom} ?`)) return;
    try {
      await api.delete(`/produits/${produit.id}`);
      onReload();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const columns = [
    { key: 'reference', label: 'Référence' },
    { key: 'nom', label: 'Nom' },
    { key: 'quantite', label: 'Stock', render: (val, row) => {
      const isLow = parseFloat(val || 0) < parseFloat(row.stockMinimum || 0);
      return <span style={{ color: isLow ? '#e74c3c' : '#27ae60', fontWeight: isLow ? 'bold' : 'normal' }}>
        {val || 0} {row.uniteMesure || 'pièce'} {isLow && ' ⚠️'}
      </span>;
    }},
    { key: 'prixVente', label: 'Prix', render: (val) => `${val || 0} FCFA` },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <p>Total: {produits.length} produits</p>
        <Button onClick={() => { setEditingProduit(null); setShowModal(true); }}>+ Nouveau Produit</Button>
      </div>
      <Table columns={columns} data={produits} onEdit={handleEdit} onDelete={handleDelete} />
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingProduit ? 'Modifier' : 'Nouveau Produit'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Référence" value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} required />
          <FormField label="Nom" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} required />
          <FormField label="Catégorie" type="select" value={formData.categorieId || ''} onChange={(e) => setFormData({...formData, categorieId: parseInt(e.target.value) || null})}
            options={[{ value: '', label: '-- Sélectionner --' }, ...categories.map(c => ({ value: c.id, label: c.nom }))]} />
          <FormField label="Prix Achat" type="number" value={formData.prixAchat} onChange={(e) => setFormData({...formData, prixAchat: parseFloat(e.target.value) || 0})} />
          <FormField label="Prix Vente" type="number" value={formData.prixVente} onChange={(e) => setFormData({...formData, prixVente: parseFloat(e.target.value) || 0})} required />
          <FormField label="Stock Min" type="number" value={formData.stockMinimum} onChange={(e) => setFormData({...formData, stockMinimum: parseFloat(e.target.value) || 0})} />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" variant="success">{editingProduit ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
