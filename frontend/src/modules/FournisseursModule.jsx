import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function FournisseursModule() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: 'Côte d\'Ivoire',
    delaiPaiement: 30,
    evaluation: 5,
  });

  useEffect(() => {
    loadFournisseurs();
  }, []);

  const loadFournisseurs = async () => {
    try {
      const data = await api.get('/fournisseurs');
      setFournisseurs(data.data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFournisseur) {
        await api.put(`/fournisseurs/${editingFournisseur.id}`, formData);
      } else {
        await api.post('/fournisseurs', formData);
      }
      setShowModal(false);
      setEditingFournisseur(null);
      resetForm();
      loadFournisseurs();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (fournisseur) => {
    setEditingFournisseur(fournisseur);
    setFormData({ ...fournisseur });
    setShowModal(true);
  };

  const handleDelete = async (fournisseur) => {
    if (!confirm(`Supprimer le fournisseur ${fournisseur.nom} ?`)) return;
    try {
      await api.delete(`/fournisseurs/${fournisseur.id}`);
      loadFournisseurs();
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
      delaiPaiement: 30,
      evaluation: 5,
    });
  };

  const columns = [
    { key: 'numeroFournisseur', label: 'N° Fournisseur' },
    { key: 'nom', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'ville', label: 'Ville' },
    { 
      key: 'evaluation', 
      label: 'Évaluation',
      render: (val) => '⭐'.repeat(val || 3)
    },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🏭 Fournisseurs</h2>
        <Button onClick={() => { resetForm(); setEditingFournisseur(null); setShowModal(true); }}>
          + Nouveau Fournisseur
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={fournisseurs} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingFournisseur(null); resetForm(); }}
        title={editingFournisseur ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}
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
              label="Délai de paiement (jours)"
              name="delaiPaiement"
              type="number"
              value={formData.delaiPaiement}
              onChange={(e) => setFormData({ ...formData, delaiPaiement: parseInt(e.target.value) })}
            />
            <FormField
              label="Évaluation (1-5)"
              name="evaluation"
              type="number"
              value={formData.evaluation}
              onChange={(e) => setFormData({ ...formData, evaluation: parseInt(e.target.value) })}
            />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingFournisseur ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
