import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { FormField } from '../../components/FormField';
import api from '../../api';

export function EntrepotsSubTab({ entrepots, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editingEntrepot, setEditingEntrepot] = useState(null);
  const [formData, setFormData] = useState({ nom: '', adresse: '', responsable: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntrepot) {
        await api.put(`/stock/entrepots/${editingEntrepot.id}`, formData);
      } else {
        await api.post('/stock/entrepots', formData);
      }
      setShowModal(false);
      setEditingEntrepot(null);
      onReload();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const columns = [
    { key: 'nom', label: 'Nom' },
    { key: 'adresse', label: 'Adresse' },
    { key: 'responsable', label: 'Responsable' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <p>Total: {entrepots.length} entrepôts</p>
        <Button onClick={() => { setEditingEntrepot(null); setShowModal(true); }}>+ Nouvel Entrepôt</Button>
      </div>
      <Table columns={columns} data={entrepots} 
        onEdit={(e) => { setEditingEntrepot(e); setFormData(e); setShowModal(true); }} 
        onDelete={async (e) => { if(confirm(`Supprimer ${e.nom} ?`)) { await api.delete(`/stock/entrepots/${e.id}`); onReload(); }}} 
      />
      
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEntrepot ? 'Modifier' : 'Nouvel Entrepôt'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Nom" value={formData.nom} onChange={(e) => setFormData({...formData, nom: e.target.value})} required />
          <FormField label="Adresse" type="textarea" value={formData.adresse} onChange={(e) => setFormData({...formData, adresse: e.target.value})} />
          <FormField label="Responsable" value={formData.responsable} onChange={(e) => setFormData({...formData, responsable: e.target.value})} />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" variant="success">{editingEntrepot ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
