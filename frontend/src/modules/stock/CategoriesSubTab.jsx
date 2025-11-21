import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import api from '../../api';

export function CategoriesSubTab({ categories, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ nom: '', description: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/stock/categories/${editingCategory.id}`, formData);
      } else {
        await api.post('/stock/categories', formData);
      }
      setShowModal(false);
      setEditingCategory(null);
      onReload();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Nom' },
    { key: 'description', label: 'Description' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <p>Total: {categories.length} catégories</p>
        <Button onClick={() => { setEditingCategory(null); setShowModal(true); }}>+ Nouvelle Catégorie</Button>
      </div>
      <Table columns={columns} data={categories} 
        onEdit={(c) => { setEditingCategory(c); setFormData(c); setShowModal(true); }} 
        onDelete={async (c) => { if(confirm(`Supprimer ${c.nom} ?`)) { await api.delete(`/stock/categories/${c.id}`); onReload(); }}} 
      />
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCategory ? 'Modifier' : 'Nouvelle Catégorie'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Nom" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} required />
          <FormField label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" variant="success">{editingCategory ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
