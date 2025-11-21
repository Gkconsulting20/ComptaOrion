import React, { useState, useEffect } from 'react';
import api from '../api';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';

export function StockInventaire() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [subTab, setSubTab] = useState('produits');
  
  const [data, setData] = useState({
    produits: [],
    categories: [],
    entrepots: [],
    mouvements: []
  });
  
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [p, c, e, m] = await Promise.all([
          api.get('/produits').catch(() => ({ data: { data: [] } })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/mouvements').catch(() => ({ data: [] }))
        ]);
        setData({
          produits: p.data.data || p.data || [],
          categories: c.data || [],
          entrepots: e.data || [],
          mouvements: m.data || []
        });
      } catch (err) {
        console.error('Load error:', err);
      }
    };
    load();
  }, []);

  const reload = async (type) => {
    try {
      if (type === 'produits') {
        const res = await api.get('/produits');
        setData(d => ({ ...d, produits: res.data.data || res.data || [] }));
      } else if (type === 'categories') {
        const res = await api.get('/stock/categories');
        setData(d => ({ ...d, categories: res.data || [] }));
      } else if (type === 'entrepots') {
        const res = await api.get('/stock/entrepots');
        setData(d => ({ ...d, entrepots: res.data || [] }));
      } else if (type === 'mouvements') {
        const res = await api.get('/stock/mouvements');
        setData(d => ({ ...d, mouvements: res.data || [] }));
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  };

  const openModal = (type, item = null) => {
    setModal({ open: true, type, item });
    if (type === 'produit') {
      setForm(item || { reference: '', nom: '', categorieId: null, prixAchat: 0, prixVente: 0, stockMinimum: 10, uniteMesure: 'pièce' });
    } else if (type === 'categorie') {
      setForm(item || { nom: '', description: '' });
    } else if (type === 'entrepot') {
      setForm(item || { nom: '', adresse: '', responsable: '' });
    } else if (type === 'inventaire') {
      setForm({ produitId: null, quantiteComptee: 0, notes: '' });
    }
  };

  const closeModal = () => {
    setModal({ open: false, type: null, item: null });
    setForm({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { type, item } = modal;
      
      if (type === 'produit') {
        if (item) {
          await api.put(`/produits/${item.id}`, form);
        } else {
          await api.post('/produits', form);
        }
        await reload('produits');
      } else if (type === 'categorie') {
        if (item) {
          await api.put(`/stock/categories/${item.id}`, form);
        } else {
          await api.post('/stock/categories', form);
        }
        await reload('categories');
      } else if (type === 'entrepot') {
        if (item) {
          await api.put(`/stock/entrepots/${item.id}`, form);
        } else {
          await api.post('/stock/entrepots', form);
        }
        await reload('entrepots');
      } else if (type === 'inventaire') {
        const produit = data.produits.find(p => p.id === parseInt(form.produitId));
        if (!produit) return alert('Sélectionnez un produit');
        
        const ecart = parseFloat(form.quantiteComptee) - parseFloat(produit.quantite || 0);
        if (ecart !== 0) {
          await api.post('/stock/mouvements', {
            entrepriseId: 1,
            produitId: form.produitId,
            type: 'ajustement',
            quantite: Math.abs(ecart),
            prixUnitaire: produit.prixAchat || 0,
            reference: `INV-${Date.now()}`,
            notes: `Inventaire: ${form.notes || 'Ajustement'}`
          });
          await reload('produits');
          await reload('mouvements');
        }
      }
      
      closeModal();
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (type, item) => {
    if (!confirm(`Supprimer ${item.nom || item.reference}?`)) return;
    try {
      if (type === 'produit') {
        await api.delete(`/produits/${item.id}`);
        await reload('produits');
      } else if (type === 'categorie') {
        await api.delete(`/stock/categories/${item.id}`);
        await reload('categories');
      } else if (type === 'entrepot') {
        await api.delete(`/stock/entrepots/${item.id}`);
        await reload('entrepots');
      }
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    }
  };

  const alertes = data.produits.filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0));
  const totalStock = data.produits.reduce((s, p) => s + parseFloat(p.quantite || 0), 0);
  const valorisation = data.produits.reduce((s, p) => s + (parseFloat(p.quantite || 0) * parseFloat(p.prixAchat || 0)), 0);

  return (
    <div>
      <h2>📦 Stock & Inventaire</h2>
      
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px' }}>
        {['parametres', 'mouvements', 'inventaires', 'alertes', 'rapports'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px', background: activeTab === tab ? '#fff' : 'transparent',
              border: 'none', borderBottom: activeTab === tab ? '3px solid #3498db' : '3px solid transparent',
              color: activeTab === tab ? '#3498db' : '#7f8c8d',
              fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer'
            }}>
            {tab === 'parametres' ? '⚙️ Paramètres' : 
             tab === 'mouvements' ? '🔄 Mouvements' :
             tab === 'inventaires' ? '📋 Inventaires' :
             tab === 'alertes' ? '⚠️ Alertes' : '📊 Rapports'}
          </button>
        ))}
      </div>

      {activeTab === 'parametres' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e1e8ed' }}>
            {[
              { id: 'produits', label: '📦 Produits', count: data.produits.length },
              { id: 'categories', label: '🏷️ Catégories', count: data.categories.length },
              { id: 'entrepots', label: '🏭 Entrepôts', count: data.entrepots.length }
            ].map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                style={{
                  padding: '10px 20px', background: subTab === t.id ? '#3498db' : '#ecf0f1',
                  color: subTab === t.id ? '#fff' : '#34495e', border: 'none',
                  borderRadius: '8px 8px 0 0', fontWeight: subTab === t.id ? 'bold' : 'normal', cursor: 'pointer'
                }}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {subTab === 'produits' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {data.produits.length} produits</p>
                <Button onClick={() => openModal('produit')}>+ Nouveau Produit</Button>
              </div>
              <Table
                columns={[
                  { key: 'reference', label: 'Référence' },
                  { key: 'nom', label: 'Nom' },
                  { key: 'quantite', label: 'Stock', render: (val, row) => {
                    const low = parseFloat(val || 0) < parseFloat(row.stockMinimum || 0);
                    return <span style={{ color: low ? '#e74c3c' : '#27ae60', fontWeight: low ? 'bold' : 'normal' }}>
                      {val || 0} {row.uniteMesure || 'pièce'} {low && '⚠️'}
                    </span>;
                  }},
                  { key: 'prixVente', label: 'Prix', render: (val) => `${val || 0} FCFA` }
                ]}
                data={data.produits}
                onEdit={(item) => openModal('produit', item)}
                onDelete={(item) => handleDelete('produit', item)}
              />
            </div>
          )}

          {subTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {data.categories.length} catégories</p>
                <Button onClick={() => openModal('categorie')}>+ Nouvelle Catégorie</Button>
              </div>
              <Table
                columns={[
                  { key: 'nom', label: 'Nom' },
                  { key: 'description', label: 'Description' }
                ]}
                data={data.categories}
                onEdit={(item) => openModal('categorie', item)}
                onDelete={(item) => handleDelete('categorie', item)}
              />
            </div>
          )}

          {subTab === 'entrepots' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <p>Total: {data.entrepots.length} entrepôts</p>
                <Button onClick={() => openModal('entrepot')}>+ Nouvel Entrepôt</Button>
              </div>
              <Table
                columns={[
                  { key: 'nom', label: 'Nom' },
                  { key: 'adresse', label: 'Adresse' },
                  { key: 'responsable', label: 'Responsable' }
                ]}
                data={data.entrepots}
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
            Générés automatiquement depuis les factures clients et fournisseurs.
          </p>
          {data.mouvements.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d' }}>Aucun mouvement enregistré</p>
            </div>
          ) : (
            <Table
              columns={[
                { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'type', label: 'Type', render: (val) => val === 'entree' ? '📥 Entrée' : val === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' },
                { key: 'produitId', label: 'Produit', render: (val) => data.produits.find(p => p.id === val)?.nom || `ID ${val}` },
                { key: 'quantite', label: 'Quantité' },
                { key: 'reference', label: 'Référence' }
              ]}
              data={data.mouvements}
            />
          )}
        </div>
      )}

      {activeTab === 'inventaires' && (
        <div>
          <h3>📋 Inventaires Tournants</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Enregistrez les comptages physiques.
          </p>
          <Button onClick={() => openModal('inventaire')}>📝 Nouveau Comptage</Button>
        </div>
      )}

      {activeTab === 'alertes' && (
        <div>
          <h3>⚠️ Alertes de Stock Faible</h3>
          {alertes.length === 0 ? (
            <div style={{ padding: '20px', background: '#d4edda', borderRadius: '8px', color: '#155724', marginTop: '20px' }}>
              ✅ Tous les stocks sont au-dessus du seuil
            </div>
          ) : (
            <div style={{ marginTop: '20px' }}>
              <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', marginBottom: '20px' }}>
                ⚠️ {alertes.length} produit(s) sous le seuil
              </div>
              <Table
                columns={[
                  { key: 'reference', label: 'Référence' },
                  { key: 'nom', label: 'Produit' },
                  { key: 'quantite', label: 'Stock', render: (val, row) => (
                    <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>{val || 0} {row.uniteMesure || 'pièce'}</span>
                  )},
                  { key: 'stockMinimum', label: 'Seuil' }
                ]}
                data={alertes}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'rapports' && (
        <div>
          <h3>📊 Rapports</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PRODUITS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{data.produits.length}</h2>
            </div>
            <div style={{ padding: '20px', background: '#f3e5f5', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>QUANTITÉ TOTALE</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#7b1fa2' }}>{totalStock.toFixed(0)}</h2>
            </div>
            <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>VALORISATION</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{valorisation.toLocaleString()} FCFA</h2>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={modal.type === 'produit' ? (modal.item ? 'Modifier' : 'Nouveau Produit') :
               modal.type === 'categorie' ? (modal.item ? 'Modifier' : 'Nouvelle Catégorie') :
               modal.type === 'entrepot' ? (modal.item ? 'Modifier' : 'Nouvel Entrepôt') :
               modal.type === 'inventaire' ? 'Comptage Physique' : ''}>
        <form onSubmit={handleSubmit}>
          {modal.type === 'produit' && (
            <>
              <FormField label="Référence" value={form.reference || ''} onChange={(e) => setForm({...form, reference: e.target.value})} required />
              <FormField label="Nom" value={form.nom || ''} onChange={(e) => setForm({...form, nom: e.target.value})} required />
              <FormField label="Catégorie" type="select" value={form.categorieId || ''} 
                onChange={(e) => setForm({...form, categorieId: parseInt(e.target.value) || null})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.categories.map(c => ({ value: c.id, label: c.nom }))]} />
              <FormField label="Prix Achat" type="number" value={form.prixAchat || 0} onChange={(e) => setForm({...form, prixAchat: parseFloat(e.target.value) || 0})} />
              <FormField label="Prix Vente" type="number" value={form.prixVente || 0} onChange={(e) => setForm({...form, prixVente: parseFloat(e.target.value) || 0})} required />
              <FormField label="Stock Min" type="number" value={form.stockMinimum || 10} onChange={(e) => setForm({...form, stockMinimum: parseFloat(e.target.value) || 0})} />
            </>
          )}

          {modal.type === 'categorie' && (
            <>
              <FormField label="Nom" value={form.nom || ''} onChange={(e) => setForm({...form, nom: e.target.value})} required />
              <FormField label="Description" type="textarea" value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} />
            </>
          )}

          {modal.type === 'entrepot' && (
            <>
              <FormField label="Nom" value={form.nom || ''} onChange={(e) => setForm({...form, nom: e.target.value})} required />
              <FormField label="Adresse" type="textarea" value={form.adresse || ''} onChange={(e) => setForm({...form, adresse: e.target.value})} />
              <FormField label="Responsable" value={form.responsable || ''} onChange={(e) => setForm({...form, responsable: e.target.value})} />
            </>
          )}

          {modal.type === 'inventaire' && (
            <>
              <FormField label="Produit" type="select" value={form.produitId || ''} 
                onChange={(e) => setForm({...form, produitId: parseInt(e.target.value) || null})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.produits.map(p => ({ value: p.id, label: `${p.reference} - ${p.nom} (Stock: ${p.quantite || 0})` }))]}
                required />
              <FormField label="Quantité Comptée" type="number" value={form.quantiteComptee || 0} onChange={(e) => setForm({...form, quantiteComptee: parseFloat(e.target.value) || 0})} required />
              <FormField label="Notes" type="textarea" value={form.notes || ''} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </>
          )}

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
            <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
