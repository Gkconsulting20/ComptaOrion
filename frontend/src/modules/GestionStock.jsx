import React, { useState, useEffect } from 'react';
import api from '../api';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';

export function GestionStockModule() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [activeSubTab, setActiveSubTab] = useState('produits');
  
  const [produits, setProduits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [entrepots, setEntrepots] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [produitsRes, categoriesRes, entrepotsRes, mouvementsRes] = await Promise.all([
        api.get('/produits').catch(() => ({ data: { data: [] } })),
        api.get('/stock/categories').catch(() => ({ data: [] })),
        api.get('/stock/entrepots').catch(() => ({ data: [] })),
        api.get('/stock/mouvements').catch(() => ({ data: [] }))
      ]);
      
      setProduits(produitsRes.data.data || produitsRes.data || []);
      setCategories(categoriesRes.data || []);
      setEntrepots(entrepotsRes.data || []);
      setMouvements(mouvementsRes.data || []);
    } catch (error) {
      console.error('Erreur chargement Stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const reloadProduits = async () => {
    const res = await api.get('/produits');
    setProduits(res.data.data || res.data || []);
  };

  const reloadCategories = async () => {
    const res = await api.get('/stock/categories');
    setCategories(res.data || []);
  };

  const reloadEntrepots = async () => {
    const res = await api.get('/stock/entrepots');
    setEntrepots(res.data || []);
  };

  const reloadMouvements = async () => {
    const res = await api.get('/stock/mouvements');
    setMouvements(res.data || []);
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (type === 'produit') {
      setFormData(item || {
        reference: '', nom: '', description: '', categorieId: null,
        valorisationMethod: 'FIFO', prixAchat: 0, prixVente: 0,
        stockMinimum: 10, uniteMesure: 'pièce', quantite: 0
      });
    } else if (type === 'categorie') {
      setFormData(item || { nom: '', description: '' });
    } else if (type === 'entrepot') {
      setFormData(item || { nom: '', adresse: '', responsable: '' });
    } else if (type === 'inventaire') {
      setFormData({ produitId: null, quantiteComptee: 0, notes: '' });
    }
    
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (modalType === 'produit') {
        if (editingItem) {
          await api.put(`/produits/${editingItem.id}`, formData);
        } else {
          await api.post('/produits', formData);
        }
        await reloadProduits();
      } else if (modalType === 'categorie') {
        if (editingItem) {
          await api.put(`/stock/categories/${editingItem.id}`, formData);
        } else {
          await api.post('/stock/categories', formData);
        }
        await reloadCategories();
      } else if (modalType === 'entrepot') {
        if (editingItem) {
          await api.put(`/stock/entrepots/${editingItem.id}`, formData);
        } else {
          await api.post('/stock/entrepots', formData);
        }
        await reloadEntrepots();
      } else if (modalType === 'inventaire') {
        const produit = produits.find(p => p.id === parseInt(formData.produitId));
        if (!produit) {
          alert('Sélectionnez un produit');
          return;
        }
        
        const ecart = parseFloat(formData.quantiteComptee) - parseFloat(produit.quantite || 0);
        if (ecart !== 0) {
          await api.post('/stock/mouvements', {
            entrepriseId: 1,
            produitId: formData.produitId,
            entrepotId: null,
            type: 'ajustement',
            quantite: Math.abs(ecart),
            prixUnitaire: produit.prixAchat || 0,
            reference: `INV-${Date.now()}`,
            notes: `Inventaire physique: ${formData.notes || 'Ajustement manuel'}`
          });
          
          await reloadProduits();
          await reloadMouvements();
        }
      }
      
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (type, item) => {
    if (!confirm(`Supprimer ${item.nom || item.reference} ?`)) return;
    
    try {
      if (type === 'produit') {
        await api.delete(`/produits/${item.id}`);
        await reloadProduits();
      } else if (type === 'categorie') {
        await api.delete(`/stock/categories/${item.id}`);
        await reloadCategories();
      } else if (type === 'entrepot') {
        await api.delete(`/stock/entrepots/${item.id}`);
        await reloadEntrepots();
      }
    } catch (error) {
      alert('Erreur: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#3498db' }}>⏳ Chargement des données...</p>
      </div>
    );
  }

  const mainTabs = [
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' },
    { id: 'mouvements', label: '🔄 Mouvements', icon: '🔄' },
    { id: 'inventaires', label: '📋 Inventaires', icon: '📋' },
    { id: 'alertes', label: '⚠️ Alertes', icon: '⚠️' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ];

  const subTabs = [
    { id: 'produits', label: '📦 Produits', count: produits.length },
    { id: 'categories', label: '🏷️ Catégories', count: categories.length },
    { id: 'entrepots', label: '🏭 Entrepôts', count: entrepots.length }
  ];

  const produitsEnAlerte = produits.filter(p => 
    parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0)
  );

  const totalStock = produits.reduce((sum, p) => sum + parseFloat(p.quantite || 0), 0);
  const valorisationTotale = produits.reduce((sum, p) => 
    sum + (parseFloat(p.quantite || 0) * parseFloat(p.prixAchat || 0)), 0
  );

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📦 Stock & Inventaire</h2>
      
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px' }}>
        {mainTabs.map(tab => (
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

          {activeSubTab === 'produits' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {produits.length} produits</p>
                <Button onClick={() => openModal('produit')}>+ Nouveau Produit</Button>
              </div>
              <Table
                columns={[
                  { key: 'reference', label: 'Référence' },
                  { key: 'nom', label: 'Nom' },
                  { key: 'categorieId', label: 'Catégorie', render: (val) => {
                    const cat = categories.find(c => c.id === val);
                    return cat ? cat.nom : '-';
                  }},
                  { key: 'quantite', label: 'Stock', render: (val, row) => {
                    const isLow = parseFloat(val || 0) < parseFloat(row.stockMinimum || 0);
                    return (
                      <span style={{ color: isLow ? '#e74c3c' : '#27ae60', fontWeight: isLow ? 'bold' : 'normal' }}>
                        {val || 0} {row.uniteMesure || 'pièce'} {isLow && ' ⚠️'}
                      </span>
                    );
                  }},
                  { key: 'prixVente', label: 'Prix', render: (val) => `${val || 0} FCFA` },
                ]}
                data={produits}
                onEdit={(item) => openModal('produit', item)}
                onDelete={(item) => handleDelete('produit', item)}
              />
            </div>
          )}

          {activeSubTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {categories.length} catégories</p>
                <Button onClick={() => openModal('categorie')}>+ Nouvelle Catégorie</Button>
              </div>
              <Table
                columns={[
                  { key: 'nom', label: 'Nom' },
                  { key: 'description', label: 'Description' },
                ]}
                data={categories}
                onEdit={(item) => openModal('categorie', item)}
                onDelete={(item) => handleDelete('categorie', item)}
              />
            </div>
          )}

          {activeSubTab === 'entrepots' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {entrepots.length} entrepôts</p>
                <Button onClick={() => openModal('entrepot')}>+ Nouvel Entrepôt</Button>
              </div>
              <Table
                columns={[
                  { key: 'nom', label: 'Nom' },
                  { key: 'adresse', label: 'Adresse' },
                  { key: 'responsable', label: 'Responsable' },
                ]}
                data={entrepots}
                onEdit={(item) => openModal('entrepot', item)}
                onDelete={(item) => handleDelete('entrepot', item)}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'mouvements' && (
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
                { key: 'type', label: 'Type', render: (val) => 
                  val === 'entree' ? '📥 Entrée' : val === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' 
                },
                { key: 'produitId', label: 'Produit', render: (val) => {
                  const prod = produits.find(p => p.id === val);
                  return prod ? prod.nom : `ID ${val}`;
                }},
                { key: 'reference', label: 'Référence' },
                { key: 'quantite', label: 'Quantité' },
                { key: 'notes', label: 'Notes' },
              ]}
              data={mouvements}
            />
          )}
        </div>
      )}

      {activeTab === 'inventaires' && (
        <div>
          <h3>📋 Inventaires Tournants</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Enregistrez les comptages physiques pour ajuster automatiquement les quantités en stock.
          </p>
          <Button onClick={() => openModal('inventaire')}>📝 Nouveau Comptage Physique</Button>
          
          <div style={{ marginTop: '30px', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>💡 Comment faire un inventaire?</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#1b5e20' }}>
              <li>Comptez physiquement les quantités de chaque produit</li>
              <li>Cliquez sur "Nouveau Comptage Physique"</li>
              <li>Sélectionnez le produit et entrez la quantité comptée</li>
              <li>Le système génère automatiquement un mouvement d'ajustement</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'alertes' && (
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
                  { key: 'actions', label: 'Action', render: (_, row) => (
                    <Button variant="warning" onClick={() => openModal('produit', row)}>
                      Réapprovisionner
                    </Button>
                  )}
                ]}
                data={produitsEnAlerte}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'rapports' && (
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

          <div style={{ marginTop: '30px' }}>
            <h4>📦 Répartition par Catégorie</h4>
            {categories.length === 0 ? (
              <p style={{ color: '#7f8c8d' }}>Aucune catégorie créée</p>
            ) : (
              <Table
                columns={[
                  { key: 'nom', label: 'Catégorie' },
                  { key: 'produits', label: 'Nb Produits', render: (_, row) => 
                    produits.filter(p => p.categorieId === row.id).length 
                  },
                  { key: 'stock', label: 'Stock Total', render: (_, row) =>
                    produits.filter(p => p.categorieId === row.id)
                      .reduce((sum, p) => sum + parseFloat(p.quantite || 0), 0).toFixed(0)
                  }
                ]}
                data={categories}
              />
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalType === 'produit' ? (editingItem ? 'Modifier Produit' : 'Nouveau Produit') :
          modalType === 'categorie' ? (editingItem ? 'Modifier Catégorie' : 'Nouvelle Catégorie') :
          modalType === 'entrepot' ? (editingItem ? 'Modifier Entrepôt' : 'Nouvel Entrepôt') :
          modalType === 'inventaire' ? 'Comptage Physique' : ''
        }
      >
        <form onSubmit={handleSubmit}>
          {modalType === 'produit' && (
            <>
              <FormField 
                label="Référence" 
                value={formData.reference || ''} 
                onChange={(e) => setFormData({...formData, reference: e.target.value})} 
                required 
              />
              <FormField 
                label="Nom" 
                value={formData.nom || ''} 
                onChange={(e) => setFormData({...formData, nom: e.target.value})} 
                required 
              />
              <FormField 
                label="Description" 
                type="textarea"
                value={formData.description || ''} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
              />
              <FormField 
                label="Catégorie" 
                type="select" 
                value={formData.categorieId || ''} 
                onChange={(e) => setFormData({...formData, categorieId: parseInt(e.target.value) || null})}
                options={[
                  { value: '', label: '-- Sélectionner --' },
                  ...categories.map(c => ({ value: c.id, label: c.nom }))
                ]}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FormField 
                  label="Prix Achat (FCFA)" 
                  type="number" 
                  value={formData.prixAchat || 0} 
                  onChange={(e) => setFormData({...formData, prixAchat: parseFloat(e.target.value) || 0})} 
                />
                <FormField 
                  label="Prix Vente (FCFA)" 
                  type="number" 
                  value={formData.prixVente || 0} 
                  onChange={(e) => setFormData({...formData, prixVente: parseFloat(e.target.value) || 0})} 
                  required 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FormField 
                  label="Stock Minimum" 
                  type="number" 
                  value={formData.stockMinimum || 10} 
                  onChange={(e) => setFormData({...formData, stockMinimum: parseFloat(e.target.value) || 0})} 
                />
                <FormField 
                  label="Unité de Mesure" 
                  value={formData.uniteMesure || 'pièce'} 
                  onChange={(e) => setFormData({...formData, uniteMesure: e.target.value})} 
                />
              </div>
              <FormField 
                label="Méthode Valorisation" 
                type="select" 
                value={formData.valorisationMethod || 'FIFO'}
                onChange={(e) => setFormData({...formData, valorisationMethod: e.target.value})}
                options={[
                  { value: 'FIFO', label: 'FIFO (Premier Entré, Premier Sorti)' },
                  { value: 'CMP', label: 'CMP (Coût Moyen Pondéré)' }
                ]}
              />
            </>
          )}

          {modalType === 'categorie' && (
            <>
              <FormField 
                label="Nom" 
                value={formData.nom || ''} 
                onChange={(e) => setFormData({...formData, nom: e.target.value})} 
                required 
              />
              <FormField 
                label="Description" 
                type="textarea" 
                value={formData.description || ''} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
              />
            </>
          )}

          {modalType === 'entrepot' && (
            <>
              <FormField 
                label="Nom" 
                value={formData.nom || ''} 
                onChange={(e) => setFormData({...formData, nom: e.target.value})} 
                required 
              />
              <FormField 
                label="Adresse" 
                type="textarea" 
                value={formData.adresse || ''} 
                onChange={(e) => setFormData({...formData, adresse: e.target.value})} 
              />
              <FormField 
                label="Responsable" 
                value={formData.responsable || ''} 
                onChange={(e) => setFormData({...formData, responsable: e.target.value})} 
              />
            </>
          )}

          {modalType === 'inventaire' && (
            <>
              <FormField 
                label="Produit" 
                type="select" 
                value={formData.produitId || ''} 
                onChange={(e) => setFormData({...formData, produitId: parseInt(e.target.value) || null})}
                options={[
                  { value: '', label: '-- Sélectionner un produit --' },
                  ...produits.map(p => ({ 
                    value: p.id, 
                    label: `${p.reference} - ${p.nom} (Stock actuel: ${p.quantite || 0})` 
                  }))
                ]}
                required
              />
              <FormField 
                label="Quantité Comptée" 
                type="number" 
                value={formData.quantiteComptee || 0} 
                onChange={(e) => setFormData({...formData, quantiteComptee: parseFloat(e.target.value) || 0})} 
                required 
              />
              <FormField 
                label="Notes" 
                type="textarea" 
                value={formData.notes || ''} 
                onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                placeholder="Ex: Inventaire hebdomadaire du 21/11/2025"
              />
              {formData.produitId && (
                <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '6px', marginTop: '10px' }}>
                  <strong>Écart:</strong> {
                    (parseFloat(formData.quantiteComptee || 0) - 
                     parseFloat(produits.find(p => p.id === parseInt(formData.produitId))?.quantite || 0)).toFixed(2)
                  } unités
                </div>
              )}
            </>
          )}

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button type="submit" variant="success">
              {editingItem ? 'Mettre à jour' : modalType === 'inventaire' ? 'Enregistrer Comptage' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
