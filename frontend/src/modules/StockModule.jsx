import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function StockModule() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [stockData, setStockData] = useState({
    produits: [],
    categories: [],
    entrepots: [],
    mouvements: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const [produitsRes, categoriesRes, entrepotsRes, mouvementsRes] = await Promise.all([
          api.get('/produits').catch(() => ({ data: [] })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/mouvements').catch(() => ({ data: [] }))
        ]);
        
        setStockData({
          produits: produitsRes.data || [],
          categories: categoriesRes.data || [],
          entrepots: entrepotsRes.data || [],
          mouvements: mouvementsRes.data || []
        });
      } catch (error) {
        console.error('Erreur chargement Stock:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const reloadProduits = async () => {
    const data = await api.get('/produits');
    setStockData(prev => ({ ...prev, produits: data.data || [] }));
  };

  const reloadCategories = async () => {
    const data = await api.get('/stock/categories');
    setStockData(prev => ({ ...prev, categories: data.data || [] }));
  };

  const reloadEntrepots = async () => {
    const data = await api.get('/stock/entrepots');
    setStockData(prev => ({ ...prev, entrepots: data.data || [] }));
  };

  const reloadMouvements = async () => {
    const data = await api.get('/stock/mouvements');
    setStockData(prev => ({ ...prev, mouvements: data.data || [] }));
  };

  const tabs = [
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' },
    { id: 'mouvements', label: '🔄 Mouvements', icon: '🔄' },
    { id: 'inventaires', label: '📋 Inventaires', icon: '📋' },
    { id: 'alertes', label: '⚠️ Alertes', icon: '⚠️' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#3498db' }}>⏳ Chargement des données...</p>
      </div>
    );
  }

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

      {activeTab === 'parametres' && (
        <ParametresTab 
          produits={stockData.produits}
          categories={stockData.categories}
          entrepots={stockData.entrepots}
          onReloadProduits={reloadProduits}
          onReloadCategories={reloadCategories}
          onReloadEntrepots={reloadEntrepots}
        />
      )}
      {activeTab === 'mouvements' && (
        <MouvementsTab mouvements={stockData.mouvements} onReload={reloadMouvements} />
      )}
      {activeTab === 'inventaires' && <InventairesTab />}
      {activeTab === 'alertes' && <AlertesTab produits={stockData.produits} />}
      {activeTab === 'rapports' && <RapportsTab produits={stockData.produits} />}
    </div>
  );
}

function ParametresTab({ produits, categories, entrepots, onReloadProduits, onReloadCategories, onReloadEntrepots }) {
  const [activeSubTab, setActiveSubTab] = useState('produits');

  const subTabs = [
    { id: 'produits', label: '📦 Produits', count: produits.length },
    { id: 'categories', label: '🏷️ Catégories', count: categories.length },
    { id: 'entrepots', label: '🏭 Entrepôts', count: entrepots.length }
  ];

  return (
    <div>
      <h3>⚙️ Configuration du Stock</h3>
      <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '20px' }}>
        Gérez les données de base: produits, catégories et entrepôts
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e1e8ed' }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeSubTab === tab.id ? '#3498db' : '#ecf0f1',
              color: activeSubTab === tab.id ? '#fff' : '#34495e',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontWeight: activeSubTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeSubTab === 'produits' && <ProduitsSubTab produits={produits} categories={categories} onReload={onReloadProduits} />}
      {activeSubTab === 'categories' && <CategoriesSubTab categories={categories} onReload={onReloadCategories} />}
      {activeSubTab === 'entrepots' && <EntrepotsSubTab entrepots={entrepots} onReload={onReloadEntrepots} />}
    </div>
  );
}

function ProduitsSubTab({ produits, categories, onReload }) {
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

function CategoriesSubTab({ categories, onReload }) {
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
      <Table columns={columns} data={categories} onEdit={(c) => { setEditingCategory(c); setFormData(c); setShowModal(true); }} onDelete={async (c) => { if(confirm(`Supprimer ${c.nom} ?`)) { await api.delete(`/stock/categories/${c.id}`); onReload(); }}} />
      
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

function EntrepotsSubTab({ entrepots, onReload }) {
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
      <Table columns={columns} data={entrepots} onEdit={(e) => { setEditingEntrepot(e); setFormData(e); setShowModal(true); }} onDelete={async (e) => { if(confirm(`Supprimer ${e.nom} ?`)) { await api.delete(`/stock/entrepots/${e.id}`); onReload(); }}} />
      
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

function MouvementsTab({ mouvements, onReload }) {
  return (
    <div>
      <h3>🔄 Mouvements de Stock (Lecture Seule)</h3>
      <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
        Les mouvements sont générés automatiquement depuis les factures clients et fournisseurs validées.
      </p>
      {mouvements.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ color: '#7f8c8d' }}>Aucun mouvement de stock enregistré</p>
        </div>
      ) : (
        <Table 
          columns={[
            { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
            { key: 'type', label: 'Type', render: (val) => val === 'entree' ? '📥 Entrée' : val === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' },
            { key: 'reference', label: 'Référence' },
            { key: 'quantite', label: 'Quantité' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={mouvements}
        />
      )}
    </div>
  );
}

function InventairesTab() {
  return (
    <div>
      <h3>📋 Inventaires Tournants</h3>
      <p style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', marginTop: '10px' }}>
        ⚙️ Interface de comptage physique en cours de développement - Fonctionnalité à venir
      </p>
    </div>
  );
}

function AlertesTab({ produits }) {
  const produitsEnAlerte = produits.filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0));
  
  return (
    <div>
      <h3>⚠️ Alertes de Stock Faible</h3>
      {produitsEnAlerte.length === 0 ? (
        <div style={{ padding: '20px', background: '#d4edda', borderRadius: '8px', color: '#155724', marginTop: '20px' }}>
          ✅ Aucune alerte - Tous les stocks sont au-dessus du seuil minimum
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', marginBottom: '20px' }}>
            ⚠️ {produitsEnAlerte.length} produit(s) sous le seuil minimum
          </div>
          <Table 
            columns={[
              { key: 'reference', label: 'Référence' },
              { key: 'nom', label: 'Produit' },
              { key: 'quantite', label: 'Stock Actuel', render: (val, row) => (
                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                  {val || 0} {row.uniteMesure || 'pièce'}
                </span>
              )},
              { key: 'stockMinimum', label: 'Seuil Min', render: (val) => val || 0 },
            ]}
            data={produitsEnAlerte}
          />
        </div>
      )}
    </div>
  );
}

function RapportsTab({ produits }) {
  const totalStock = produits.reduce((sum, p) => sum + parseFloat(p.quantite || 0), 0);
  const valorisationTotale = produits.reduce((sum, p) => sum + (parseFloat(p.quantite || 0) * parseFloat(p.prixAchat || 0)), 0);

  return (
    <div>
      <h3>📊 Rapports & Statistiques</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PRODUITS</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{produits.length}</h2>
        </div>
        <div style={{ padding: '20px', background: '#f3e5f5', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>QUANTITÉ TOTALE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#7b1fa2' }}>{totalStock.toFixed(0)}</h2>
        </div>
        <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>VALORISATION STOCK</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{valorisationTotale.toLocaleString()} FCFA</h2>
        </div>
      </div>
    </div>
  );
}
