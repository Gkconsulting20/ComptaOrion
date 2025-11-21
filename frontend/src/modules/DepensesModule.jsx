import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { DetailsModal } from '../components/DetailsModal';
import api from '../api';

export function DepensesModule() {
  const [depenses, setDepenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDepenseDetails, setShowDepenseDetails] = useState(false);
  const [editingDepense, setEditingDepense] = useState(null);
  const [selectedDepense, setSelectedDepense] = useState(null);
  const [formData, setFormData] = useState({
    employeId: '',
    categorieId: '',
    montant: 0,
    dateDepense: new Date().toISOString().split('T')[0],
    description: '',
    récurrente: false,
  });
  const [categoryFormData, setCategoryFormData] = useState({
    nom: '',
    description: '',
    limiteApproval: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depensesRes, categoriesRes, employesRes] = await Promise.all([
        api.get('/depenses/list'),
        api.get('/depenses/categories'),
        api.get('/employes/list')
      ]);
      setDepenses(depensesRes || []);
      setCategories(categoriesRes || []);
      setEmployes(employesRes || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDepense) {
        await api.put(`/depenses/${editingDepense.id}`, { ...formData, userId: 1, ipAddress: '127.0.0.1' });
      } else {
        await api.post('/depenses/create', { ...formData, userId: 1, ipAddress: '127.0.0.1' });
      }
      setShowModal(false);
      setEditingDepense(null);
      resetForm();
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/depenses/categories', categoryFormData);
      setShowCategoryModal(false);
      setCategoryFormData({ nom: '', description: '', limiteApproval: 0 });
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (depense) => {
    setEditingDepense(depense);
    setFormData({ ...depense });
    setShowModal(true);
  };

  const handleDelete = async (depense) => {
    if (!confirm(`Supprimer la dépense ?`)) return;
    try {
      await api.delete(`/depenses/${depense.id}`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleApproval = async (etape, statut) => {
    try {
      await api.post('/depenses/approve', {
        depenseId: selectedDepense.id,
        etape,
        statut,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      setShowApprovalModal(false);
      setSelectedDepense(null);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleRembourser = async () => {
    try {
      await api.post('/depenses/rembourser', {
        depenseId: selectedDepense.id,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      setShowApprovalModal(false);
      setSelectedDepense(null);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      employeId: '',
      categorieId: '',
      montant: 0,
      dateDepense: new Date().toISOString().split('T')[0],
      description: '',
      récurrente: false,
    });
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'description', label: 'Description' },
    { key: 'montant', label: 'Montant', render: (val) => `${val} FCFA` },
    { key: 'dateDepense', label: 'Date', render: (val) => val?.split('T')[0] || '-' },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = {
          en_attente: '#f39c12',
          approuve: '#27ae60',
          rejete: '#e74c3c',
          rembourse: '#3498db'
        };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px',
          fontWeight: '600'
        }}>{val?.replace('_', ' ')}</span>;
      }
    },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>💸 Dépenses (ORION EXPENSE)</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
            Gérer Catégories
          </Button>
          <Button onClick={() => { resetForm(); setEditingDepense(null); setShowModal(true); }}>
            + Nouvelle Dépense
          </Button>
        </div>
      </div>

      <Table 
        columns={columns} 
        data={depenses}
        onRowClick={(depense) => { setSelectedDepense(depense); setShowDepenseDetails(true); }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        actions={true}
      />

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingDepense(null); resetForm(); }}
        title={editingDepense ? 'Modifier Dépense' : 'Nouvelle Dépense'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <FormField
            label="Employé"
            name="employeId"
            type="select"
            value={formData.employeId}
            onChange={(e) => setFormData({ ...formData, employeId: e.target.value })}
            options={employes.map(emp => ({ value: emp.id, label: `${emp.prenom} ${emp.nom}` }))}
            required
          />
          <FormField
            label="Catégorie"
            name="categorieId"
            type="select"
            value={formData.categorieId}
            onChange={(e) => setFormData({ ...formData, categorieId: e.target.value })}
            options={categories.map(cat => ({ value: cat.id, label: cat.nom }))}
            required
          />
          <FormField
            label="Montant (FCFA)"
            name="montant"
            type="number"
            value={formData.montant}
            onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) })}
            required
          />
          <FormField
            label="Date Dépense"
            name="dateDepense"
            type="date"
            value={formData.dateDepense}
            onChange={(e) => setFormData({ ...formData, dateDepense: e.target.value })}
            required
          />
          <FormField
            label="Description"
            name="description"
            type="textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); setEditingDepense(null); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingDepense ? 'Mettre à jour' : 'Créer Dépense'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Nouvelle Catégorie"
        size="medium"
      >
        <form onSubmit={handleCategorySubmit}>
          <FormField
            label="Nom"
            value={categoryFormData.nom}
            onChange={(e) => setCategoryFormData({ ...categoryFormData, nom: e.target.value })}
            required
          />
          <FormField
            label="Description"
            type="textarea"
            value={categoryFormData.description}
            onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
          />
          <FormField
            label="Limite d'Approbation (FCFA)"
            type="number"
            value={categoryFormData.limiteApproval}
            onChange={(e) => setCategoryFormData({ ...categoryFormData, limiteApproval: parseFloat(e.target.value) })}
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Créer Catégorie
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showApprovalModal}
        onClose={() => { setShowApprovalModal(false); setSelectedDepense(null); }}
        title="Workflow d'Approbation (3 Niveaux)"
        size="medium"
      >
        {selectedDepense && (
          <div>
            <p><strong>Description:</strong> {selectedDepense.description}</p>
            <p><strong>Montant:</strong> {selectedDepense.montant} FCFA</p>
            <p><strong>Statut:</strong> {selectedDepense.statut}</p>
            
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h4>Étapes du Workflow</h4>
              <div style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    backgroundColor: '#3498db', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>1</div>
                  <span>Approbation Manager</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    backgroundColor: '#95a5a6', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>2</div>
                  <span>Approbation Comptable</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    backgroundColor: '#95a5a6', 
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>3</div>
                  <span>Remboursement</span>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <h4>Actions</h4>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <Button variant="success" onClick={() => handleApproval('manager', 'approuve')}>
                  ✓ Approuver (Manager)
                </Button>
                <Button variant="success" onClick={() => handleApproval('comptable', 'approuve')}>
                  ✓ Approuver (Comptable)
                </Button>
                <Button variant="danger" onClick={() => handleApproval('manager', 'rejete')}>
                  × Rejeter
                </Button>
                {selectedDepense.statut === 'approuve' && (
                  <Button variant="primary" onClick={handleRembourser}>
                    💰 Marquer comme Remboursé
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL DE DÉTAILS DÉPENSE */}
      {selectedDepense && (
        <DetailsModal
          isOpen={showDepenseDetails}
          onClose={() => { setShowDepenseDetails(false); setSelectedDepense(null); }}
          title={`Détails Dépense #${selectedDepense.id}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'ID', value: selectedDepense.id },
                { label: 'Description', value: selectedDepense.description || '-' },
                { label: 'Montant', value: `${selectedDepense.montant || 0} FCFA` },
                { label: 'Date', value: selectedDepense.dateDepense?.split('T')[0] || '-' },
                { label: 'Statut', value: selectedDepense.statut?.replace('_', ' ') }
              ]
            },
            {
              title: 'Détails',
              fields: [
                { label: 'Employé', value: (() => {
                  const emp = employes.find(e => e.id === selectedDepense.employeId);
                  return emp ? emp.nom : 'Non assigné';
                })() },
                { label: 'Catégorie', value: (() => {
                  const cat = categories.find(c => c.id === selectedDepense.categorieId);
                  return cat ? cat.nom : 'Non catégorisé';
                })() },
                { label: 'Récurrente', value: selectedDepense.récurrente ? 'Oui' : 'Non' }
              ]
            }
          ]}
          actions={[
            {
              label: '✏️ Modifier',
              variant: 'info',
              onClick: () => {
                setShowDepenseDetails(false);
                handleEdit(selectedDepense);
              }
            },
            {
              label: '✓ Approuver',
              variant: 'success',
              onClick: () => {
                setShowDepenseDetails(false);
                setShowApprovalModal(true);
              },
              disabled: selectedDepense.statut === 'rembourse'
            }
          ]}
        />
      )}
    </div>
  );
}
