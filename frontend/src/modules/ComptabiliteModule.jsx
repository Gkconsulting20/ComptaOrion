import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function ComptabiliteModule() {
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    numero: '',
    nom: '',
    categorie: 'Actif',
    sousCategorie: '',
    devise: 'XOF',
  });

  useEffect(() => {
    loadComptes();
  }, []);

  const loadComptes = async () => {
    try {
      const data = await api.get('/comptabilite/comptes');
      setComptes(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/comptabilite/comptes', { ...formData, userId: 1, ipAddress: '127.0.0.1' });
      setShowModal(false);
      resetForm();
      loadComptes();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      numero: '',
      nom: '',
      categorie: 'Actif',
      sousCategorie: '',
      devise: 'XOF',
    });
  };

  const columns = [
    { key: 'numero', label: 'N° Compte' },
    { key: 'nom', label: 'Nom' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'sousCategorie', label: 'Sous-Catégorie' },
    { key: 'solde', label: 'Solde', render: (val) => `${val || 0} FCFA` },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>📖 Comptabilité Générale</h2>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          + Nouveau Compte
        </Button>
      </div>

      <Table 
        columns={columns} 
        data={comptes} 
        actions={false}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="Nouveau Compte Comptable"
        size="medium"
      >
        <form onSubmit={handleSubmit}>
          <FormField
            label="Numéro de Compte"
            name="numero"
            value={formData.numero}
            onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
            placeholder="Ex: 601000"
            required
          />
          <FormField
            label="Nom du Compte"
            name="nom"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            required
          />
          <FormField
            label="Catégorie"
            name="categorie"
            type="select"
            value={formData.categorie}
            onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
            options={[
              { value: 'Actif', label: 'Actif' },
              { value: 'Passif', label: 'Passif' },
              { value: 'Capitaux propres', label: 'Capitaux Propres' },
              { value: 'Charges', label: 'Charges' },
              { value: 'Produits', label: 'Produits' },
            ]}
          />
          <FormField
            label="Sous-Catégorie"
            name="sousCategorie"
            value={formData.sousCategorie}
            onChange={(e) => setFormData({ ...formData, sousCategorie: e.target.value })}
          />
          <FormField
            label="Devise"
            name="devise"
            type="select"
            value={formData.devise}
            onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
            options={[
              { value: 'XOF', label: 'XOF (FCFA)' },
              { value: 'EUR', label: 'EUR (Euro)' },
              { value: 'USD', label: 'USD (Dollar)' },
            ]}
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Créer Compte
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
