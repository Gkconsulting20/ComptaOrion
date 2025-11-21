import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function StockModule() {
  const [activeTab, setActiveTab] = useState('produits');
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entrepots, setEntrepots] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    reference: '',
    nom: '',
    description: '',
    categorieId: null,
    valorisationMethod: 'FIFO',
    prixAchat: 0,
    prixVente: 0,
    quantite: 0,
    stockMinimum: 10,
    uniteMesure: 'pièce',
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'produits') await loadProduits();
      else if (activeTab === 'categories') await loadCategories();
      else if (activeTab === 'entrepots') await loadEntrepots();
      else if (activeTab === 'mouvements') await loadMouvements();
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProduits = async () => {
    const data = await api.get('/produits');
    setProduits(data.data || []);
  };

  const loadCategories = async () => {
    const data = await api.get('/stock/categories');
    setCategories(data.data || []);
  };

  const loadEntrepots = async () => {
    const data = await api.get('/stock/entrepots');
    setEntrepots(data.data || []);
  };

  const loadMouvements = async () => {
    const data = await api.get('/stock/mouvements');
    setMouvements(data.data || []);
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
      categorieId: null,
      valorisationMethod: 'FIFO',
      prixAchat: 0,
      prixVente: 0,
      quantite: 0,
      stockMinimum: 10,
      uniteMesure: 'pièce',
    });
  };

  const tabs = [
    { id: 'produits', label: '📦 Produits', icon: '📦' },
    { id: 'categories', label: '🏷️ Catégories', icon: '🏷️' },
    { id: 'entrepots', label: '🏭 Entrepôts', icon: '🏭' },
    { id: 'mouvements', label: '🔄 Mouvements', icon: '🔄' },
    { id: 'inventaires', label: '📋 Inventaires', icon: '📋' },
    { id: 'alertes', label: '⚠️ Alertes Stock', icon: '⚠️' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ];

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

  const renderTabContent = () => {
    if (loading) return <p>Chargement...</p>;

    switch (activeTab) {
      case 'produits':
        return <ProduitsTab produits={produits} categories={categories} onReload={loadProduits} />;
      case 'categories':
        return <CategoriesTab categories={categories} onReload={loadCategories} />;
      case 'entrepots':
        return <EntrepotsTab entrepots={entrepots} onReload={loadEntrepots} />;
      case 'mouvements':
        return <MouvementsTab mouvements={mouvements} produits={produits} entrepots={entrepots} onReload={loadMouvements} />;
      case 'inventaires':
        return <InventairesTab />;
      case 'alertes':
        return <AlertesTab produits={produits} />;
      case 'rapports':
        return <RapportsTab />;
      default:
        return null;
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📦 Stock & Inventaire</h2>
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #3498db' : '3px solid transparent',
              color: activeTab === tab.id ? '#3498db' : '#7f8c8d',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {renderTabContent()}
    </div>
  );
}

function ProduitsTab({ produits, categories, onReload }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    reference: '',
    nom: '',
    description: '',
    categorieId: null,
    valorisationMethod: 'FIFO',
    prixAchat: 0,
    prixVente: 0,
    stockMinimum: 10,
    uniteMesure: 'pièce',
  });

  useEffect(() => {
    if (categories.length === 0) {
      api.get('/stock/categories').then(data => {});
    }
  }, []);

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
    if (!confirm(`Supprimer le produit ${produit.nom} ?`)) return;
    try {
      await api.delete(`/produits/${produit.id}`);
      onReload();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      reference: '',
      nom: '',
      description: '',
      categorieId: null,
      valorisationMethod: 'FIFO',
      prixAchat: 0,
      prixVente: 0,
      stockMinimum: 10,
      uniteMesure: 'pièce',
    });
  };

  const columns = [
    { key: 'reference', label: 'Référence' },
    { key: 'nom', label: 'Nom' },
    { key: 'categorie', label: 'Catégorie', render: (val, row) => row.categorieStock?.nom || '-' },
    { key: 'quantite', label: 'Stock', render: (val, row) => {
      const isLow = parseFloat(val || 0) < parseFloat(row.stockMinimum || 0);
      return <span style={{ color: isLow ? '#e74c3c' : '#27ae60', fontWeight: isLow ? 'bold' : 'normal' }}>
        {val || 0} {row.uniteMesure || 'pièce'}
        {isLow && ' ⚠️'}
      </span>;
    }},
    { key: 'prixVente', label: 'Prix Vente', render: (val) => `${val || 0} FCFA` },
    { key: 'valorisationMethod', label: 'Valorisation', render: (val) => val || 'FIFO' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3>Liste des Produits</h3>
          <p style={{ color: '#7f8c8d', fontSize: '14px' }}>Total: {produits.length} produits</p>
        </div>
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
              name="categorieId"
              type="select"
              value={formData.categorieId || ''}
              onChange={(e) => setFormData({ ...formData, categorieId: parseInt(e.target.value) || null })}
              options={[
                { value: '', label: '-- Sélectionner --' },
                ...categories.map(cat => ({ value: cat.id, label: cat.nom }))
              ]}
            />
            <FormField
              label="Méthode de Valorisation"
              name="valorisationMethod"
              type="select"
              value={formData.valorisationMethod}
              onChange={(e) => setFormData({ ...formData, valorisationMethod: e.target.value })}
              options={[
                { value: 'FIFO', label: 'FIFO (Premier Entré, Premier Sorti)' },
                { value: 'CMP', label: 'CMP (Coût Moyen Pondéré)' },
              ]}
            />
            <FormField
              label="Unité de Mesure"
              name="uniteMesure"
              type="select"
              value={formData.uniteMesure}
              onChange={(e) => setFormData({ ...formData, uniteMesure: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, prixAchat: parseFloat(e.target.value) || 0 })}
            />
            <FormField
              label="Prix de Vente (FCFA)"
              name="prixVente"
              type="number"
              value={formData.prixVente}
              onChange={(e) => setFormData({ ...formData, prixVente: parseFloat(e.target.value) || 0 })}
              required
            />
            <FormField
              label="Stock Minimum"
              name="stockMinimum"
              type="number"
              value={formData.stockMinimum}
              onChange={(e) => setFormData({ ...formData, stockMinimum: parseFloat(e.target.value) || 0 })}
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

function CategoriesTab({ categories, onReload }) {
  return (
    <div>
      <h3>Catégories de Stock</h3>
      <p style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        ⚠️ Interface Catégories en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}

function EntrepotsTab({ entrepots, onReload }) {
  return (
    <div>
      <h3>Gestion des Entrepôts</h3>
      <p style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        ⚠️ Interface Entrepôts en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}

function MouvementsTab({ mouvements, produits, entrepots, onReload }) {
  return (
    <div>
      <h3>Mouvements de Stock</h3>
      <p style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        ⚠️ Interface Mouvements en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}

function InventairesTab() {
  return (
    <div>
      <h3>Inventaires Tournants</h3>
      <p style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        ⚠️ Interface Inventaires en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}

function AlertesTab({ produits }) {
  const produitsEnAlerte = produits.filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0));
  
  return (
    <div>
      <h3>Alertes de Stock Faible</h3>
      {produitsEnAlerte.length === 0 ? (
        <div style={{ marginTop: '20px', padding: '20px', background: '#d4edda', borderRadius: '8px', color: '#155724' }}>
          ✅ Aucune alerte - Tous les stocks sont au-dessus du seuil minimum
        </div>
      ) : (
        <div>
          <div style={{ marginTop: '10px', marginBottom: '20px', padding: '15px', background: '#f8d7da', borderRadius: '8px', color: '#721c24' }}>
            ⚠️ <strong>{produitsEnAlerte.length} produit(s)</strong> sous le seuil minimum
          </div>
          <Table 
            columns={[
              { key: 'reference', label: 'Référence' },
              { key: 'nom', label: 'Nom' },
              { key: 'quantite', label: 'Stock Actuel', render: (val, row) => `${val || 0} ${row.uniteMesure || 'pièce'}` },
              { key: 'stockMinimum', label: 'Seuil Minimum', render: (val, row) => `${val || 0} ${row.uniteMesure || 'pièce'}` },
              { key: 'ecart', label: 'Écart', render: (val, row) => {
                const ecart = (parseFloat(row.quantite || 0) - parseFloat(row.stockMinimum || 0));
                return <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{ecart.toFixed(2)}</span>;
              }},
            ]}
            data={produitsEnAlerte}
          />
        </div>
      )}
    </div>
  );
}

function RapportsTab() {
  return (
    <div>
      <h3>Rapports de Stock</h3>
      <p style={{ marginTop: '10px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
        ⚠️ Interface Rapports en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}
