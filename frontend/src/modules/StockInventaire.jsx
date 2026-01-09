import React, { useState, useEffect } from 'react';
import api from '../api';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { DetailsModal } from '../components/DetailsModal';

function NonFactureTab({ fournisseurs, produits }) {
  const [subTab, setSubTab] = useState('stock');
  const [stockPending, setStockPending] = useState({ items: [], totaux: {}, parFournisseur: [] });
  const [logistiquePending, setLogistiquePending] = useState({ items: [], totaux: {}, parType: [], parFournisseur: [] });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ fournisseurId: '', dateDebut: '', dateFin: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      
      const [stockRes, logRes] = await Promise.all([
        api.get(`/stock/rapports/stock-non-facture?${params}`).catch(() => ({ data: { items: [], totaux: {}, parFournisseur: [] } })),
        api.get(`/stock/rapports/logistique-non-facturee?${params}`).catch(() => ({ data: { items: [], totaux: {}, parType: [], parFournisseur: [] } }))
      ]);
      setStockPending(stockRes.data || { items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending(logRes.data || { items: [], totaux: {}, parType: [], parFournisseur: [] });
    } catch (err) {
      console.error('Erreur chargement données non facturées:', err);
      setStockPending({ items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending({ items: [], totaux: {}, parType: [], parFournisseur: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  const typeLabels = { transport: 'Transport', douane: 'Douane', manutention: 'Manutention', assurance: 'Assurance', autre: 'Autres' };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>📄 Stock & Coûts Non Facturés</h3>
        <p style={{ color: '#7f8c8d', margin: '5px 0 0 0' }}>
          Réceptions validées en attente de facturation. Pour créer une facture, allez dans <strong>Fournisseurs → Facturation</strong>.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
        <select value={filters.fournisseurId} onChange={(e) => setFilters({...filters, fournisseurId: e.target.value})}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '200px' }}>
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom || f.raisonSociale}</option>)}
        </select>
        <input type="date" value={filters.dateDebut} onChange={(e) => setFilters({...filters, dateDebut: e.target.value})}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} placeholder="Date début" />
        <input type="date" value={filters.dateFin} onChange={(e) => setFilters({...filters, dateFin: e.target.value})}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} placeholder="Date fin" />
        <Button onClick={loadData} variant="outline">🔄 Actualiser</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px' }}>
        <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>STOCK EN ATTENTE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#e65100' }}>{stockPending.totaux?.valeur?.toLocaleString('fr-FR') || 0} FCFA</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{stockPending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>LOGISTIQUE EN ATTENTE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#1565c0' }}>{logistiquePending.totaux?.montant?.toLocaleString('fr-FR') || 0} FCFA</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{logistiquePending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#fce4ec', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL NON FACTURÉ</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#c2185b' }}>
            {((stockPending.totaux?.valeur || 0) + (logistiquePending.totaux?.montant || 0)).toLocaleString('fr-FR')} FCFA
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {['stock', 'logistique', 'fournisseurs'].map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            style={{
              padding: '10px 20px', background: subTab === t ? '#3498db' : '#ecf0f1',
              color: subTab === t ? '#fff' : '#34495e', border: 'none', borderRadius: '8px',
              fontWeight: subTab === t ? 'bold' : 'normal', cursor: 'pointer'
            }}>
            {t === 'stock' ? '📦 Stock Non Facturé' : t === 'logistique' ? '🚚 Frais Logistiques' : '👥 Par Fournisseur'}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Chargement...</div>}

      {!loading && subTab === 'stock' && (
        <div>
          {stockPending.items?.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#d4edda', borderRadius: '8px', color: '#155724' }}>
              ✅ Aucun stock en attente de facturation
            </div>
          ) : (
            <Table
              columns={[
                { key: 'commande_numero', label: 'N° PO' },
                { key: 'fournisseur_nom', label: 'Fournisseur' },
                { key: 'date_reception', label: 'Date Réception', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'reception_numero', label: 'N° Réception' },
                { key: 'produit_nom', label: 'Produit', render: (val, row) => `${row.produit_reference || ''} ${val || ''}` },
                { key: 'quantite_pending', label: 'Qté', render: (val) => parseFloat(val).toFixed(0) },
                { key: 'prix_estime', label: 'Prix Estimé', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'valeur_estimee', label: 'Valeur', render: (val) => <strong>{parseFloat(val || 0).toLocaleString('fr-FR')} FCFA</strong> }
              ]}
              data={stockPending.items || []}
            />
          )}
        </div>
      )}

      {!loading && subTab === 'logistique' && (
        <div>
          {logistiquePending.items?.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#d4edda', borderRadius: '8px', color: '#155724' }}>
              ✅ Aucun frais logistique en attente
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {(logistiquePending.parType || []).map(t => (
                  <div key={t.type} style={{ padding: '10px 15px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <strong>{typeLabels[t.type] || t.type}:</strong> {t.montant.toLocaleString('fr-FR')} FCFA ({t.lignes})
                  </div>
                ))}
              </div>
              <Table
                columns={[
                  { key: 'commande_numero', label: 'N° PO' },
                  { key: 'fournisseur_nom', label: 'Fournisseur' },
                  { key: 'date_reception', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                  { key: 'reception_numero', label: 'N° Réception' },
                  { key: 'type', label: 'Type', render: (val) => typeLabels[val] || val },
                  { key: 'description', label: 'Description' },
                  { key: 'montant_estime', label: 'Montant', render: (val) => <strong>{parseFloat(val || 0).toLocaleString('fr-FR')} FCFA</strong> }
                ]}
                data={logistiquePending.items || []}
              />
            </>
          )}
        </div>
      )}

      {!loading && subTab === 'fournisseurs' && (
        <div>
          <h4>📦 Stock par Fournisseur</h4>
          <Table
            columns={[
              { key: 'nom', label: 'Fournisseur' },
              { key: 'lignes', label: 'Lignes' },
              { key: 'quantite', label: 'Quantité', render: (val) => parseFloat(val).toFixed(0) },
              { key: 'valeur', label: 'Valeur Stock', render: (val) => <strong>{parseFloat(val || 0).toLocaleString('fr-FR')} FCFA</strong> }
            ]}
            data={stockPending.parFournisseur || []}
          />
          
          <h4 style={{ marginTop: '30px' }}>🚚 Logistique par Fournisseur</h4>
          <Table
            columns={[
              { key: 'nom', label: 'Fournisseur' },
              { key: 'lignes', label: 'Lignes' },
              { key: 'montant', label: 'Montant Total', render: (val) => <strong>{parseFloat(val || 0).toLocaleString('fr-FR')} FCFA</strong> }
            ]}
            data={logistiquePending.parFournisseur || []}
          />
        </div>
      )}
    </div>
  );
}

export function StockInventaire() {
  const [activeTab, setActiveTab] = useState('commandes');
  const [subTab, setSubTab] = useState('produits');
  
  const [data, setData] = useState({
    produits: [],
    categories: [],
    entrepots: [],
    receptions: [],
    fournisseurs: [],
    commandes: []
  });
  
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [selectedProduit, setSelectedProduit] = useState(null);
  const [showProduitDetails, setShowProduitDetails] = useState(false);
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [p, c, e, r, f, cmd] = await Promise.all([
          api.get('/produits').catch(() => ({ data: { data: [] } })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/receptions').catch(() => ({ data: [] })),
          api.get('/fournisseurs').catch(() => ({ data: { data: [] } })),
          api.get('/commandes-achat').catch(() => ({ data: { data: [] } }))
        ]);
        setData({
          produits: p.data.data || p.data || [],
          categories: c.data || [],
          entrepots: e.data || [],
          receptions: r.data || [],
          fournisseurs: f.data.data || f.data || [],
          commandes: cmd.data?.data || cmd.data || []
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
      } else if (type === 'receptions') {
        const res = await api.get('/stock/receptions');
        setData(d => ({ ...d, receptions: res.data || [] }));
      } else if (type === 'commandes') {
        const res = await api.get('/commandes-achat');
        setData(d => ({ ...d, commandes: res.data?.data || res.data || [] }));
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  };

  const openModal = (type, item = null) => {
    setModal({ open: true, type, item });
    if (type === 'produit') {
      setForm(item || { reference: '', nom: '', categorieId: null, prixAchat: 0, prixVente: 0, stockMinimum: 10, uniteMesure: 'pièce', valorisationMethod: 'FIFO' });
    } else if (type === 'categorie') {
      setForm(item || { nom: '', description: '' });
    } else if (type === 'entrepot') {
      setForm(item || { nom: '', adresse: '', responsable: '' });
    } else if (type === 'inventaire') {
      setForm({ produitId: null, entrepotId: '', quantiteComptee: 0, notes: '' });
    } else if (type === 'reception') {
      setForm({ 
        fournisseurId: '', 
        dateReception: new Date().toISOString().split('T')[0],
        entrepotId: '', 
        notes: '', 
        lignes: [{ produitId: '', quantiteRecue: 1, prixUnitaireEstime: 0 }] 
      });
    } else if (type === 'commande') {
      setForm(item || {
        fournisseurId: '',
        dateCommande: new Date().toISOString().split('T')[0],
        dateLivraisonPrevue: '',
        notes: '',
        lignes: [{ produitId: '', quantite: 1, prixUnitaire: 0 }]
      });
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
        if (!form.entrepotId) return alert('Veuillez sélectionner un entrepôt. Créez-en un dans Paramètres → Entrepôts si nécessaire.');
        
        const ecart = parseFloat(form.quantiteComptee) - parseFloat(produit.quantite || 0);
        if (ecart !== 0) {
          await api.post('/stock/mouvements', {
            produitId: form.produitId,
            entrepotId: parseInt(form.entrepotId),
            type: 'ajustement',
            quantite: Math.abs(ecart),
            prixUnitaire: produit.prixAchat || 0,
            reference: `INV-${Date.now()}`,
            notes: `Inventaire: ${form.notes || 'Ajustement'}`
          });
          await reload('produits');
          await reload('mouvements');
        }
      } else if (type === 'reception') {
        const lignesValides = form.lignes.filter(l => l.produitId && parseFloat(l.quantiteRecue) > 0);
        if (!form.fournisseurId || lignesValides.length === 0) {
          return alert('Veuillez saisir un fournisseur et au moins une ligne valide');
        }
        if (!form.entrepotId) {
          return alert('Veuillez sélectionner un entrepôt. Créez-en un dans Paramètres → Entrepôts si nécessaire.');
        }
        await api.post('/stock/receptions', {
          fournisseurId: parseInt(form.fournisseurId),
          dateReception: form.dateReception,
          entrepotId: parseInt(form.entrepotId),
          notes: form.notes,
          lignes: lignesValides.map(l => ({
            produitId: parseInt(l.produitId),
            quantiteRecue: parseFloat(l.quantiteRecue),
            prixUnitaireEstime: parseFloat(l.prixUnitaireEstime)
          }))
        });
        await reload('receptions');
        alert('Bon de reception cree avec succes. Validez-le pour mettre a jour le stock.');
      } else if (type === 'commande') {
        const lignesValides = form.lignes.filter(l => l.produitId && parseFloat(l.quantite) > 0);
        if (!form.fournisseurId || lignesValides.length === 0) {
          return alert('Veuillez saisir un fournisseur et au moins une ligne valide');
        }
        await api.post('/commandes-achat', {
          fournisseurId: parseInt(form.fournisseurId),
          dateCommande: form.dateCommande,
          dateLivraisonPrevue: form.dateLivraisonPrevue || null,
          notes: form.notes,
          items: lignesValides.map(l => ({
            produitId: parseInt(l.produitId),
            description: data.produits.find(p => p.id === parseInt(l.produitId))?.nom || '',
            quantite: parseFloat(l.quantite),
            prixUnitaire: parseFloat(l.prixUnitaire)
          }))
        });
        await reload('commandes');
        alert('Commande d\'achat creee avec succes.');
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

  const alertes = data.produits.filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0) && parseFloat(p.quantite || 0) > 0);
  const totalStock = data.produits.reduce((s, p) => s + parseFloat(p.quantite || 0), 0);
  const valorisation = data.produits.reduce((s, p) => {
    const qty = parseFloat(p.quantite || 0);
    const coutUnit = parseFloat(p.coutMoyen || p.prixAchat || 0);
    return s + (qty * coutUnit);
  }, 0);

  return (
    <div>
      <h2>📦 Stock & Inventaire</h2>
      
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['commandes', 'receptions', 'inventaires', 'alertes', 'nonfacture', 'rapports', 'parametres'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px', background: activeTab === tab ? '#fff' : 'transparent',
              border: 'none', borderBottom: activeTab === tab ? '3px solid #3498db' : '3px solid transparent',
              color: activeTab === tab ? '#3498db' : '#7f8c8d',
              fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer'
            }}>
            {tab === 'commandes' ? '📦 Commandes Achat' :
             tab === 'receptions' ? '📥 Réceptions' :
             tab === 'inventaires' ? '📋 Inventaires' :
             tab === 'alertes' ? '⚠️ Alertes' :
             tab === 'nonfacture' ? '📄 Non Facturé' :
             tab === 'rapports' ? '📊 Rapports' : '⚙️ Paramètres'}
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
                  { key: 'prixVente', label: 'Prix', render: (val) => `${Math.round(parseFloat(val || 0)).toLocaleString('fr-FR')} FCFA` }
                ]}
                data={data.produits}
                onRowClick={(item) => { setSelectedProduit(item); setShowProduitDetails(true); }}
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

      {activeTab === 'commandes' && (
        <div>
          <h3>📦 Commandes d'Achat</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Créez des commandes d'achat pour vos fournisseurs. Vous pourrez ensuite créer des réceptions à leur arrivée.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <span style={{ background: '#f8f9fa', padding: '5px 10px', borderRadius: '4px', marginRight: '10px' }}>
                Total: {data.commandes.length} commandes
              </span>
            </div>
            <Button onClick={() => openModal('commande')}>+ Nouvelle Commande</Button>
          </div>

          {data.commandes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d' }}>Aucune commande d'achat</p>
            </div>
          ) : (
            <Table
              columns={[
                { key: 'numeroCommande', label: 'N° Commande' },
                { key: 'fournisseur', label: 'Fournisseur', render: (val, row) => row.fournisseur?.nom || val?.nom || '-' },
                { key: 'dateCommande', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '-' },
                { key: 'totalHT', label: 'Total HT', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'statut', label: 'Statut', render: (val) => {
                  const statut = val || 'brouillon';
                  const colors = { brouillon: '#95a5a6', validee: '#3498db', recue: '#27ae60', annulee: '#e74c3c' };
                  return <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', backgroundColor: colors[statut] || '#999',
                    color: 'white', fontSize: '11px'
                  }}>{statut}</span>;
                }}
              ]}
              data={data.commandes}
            />
          )}
        </div>
      )}

      {activeTab === 'receptions' && (
        <div>
          <h3>📥 Bons de Réception</h3>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Réceptionnez les marchandises avant de les facturer. Chaque validation génère une écriture comptable.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <span style={{ background: '#e8f5e9', padding: '5px 10px', borderRadius: '4px', marginRight: '10px' }}>
                Brouillon: {data.receptions.filter(r => r.statut === 'brouillon').length}
              </span>
              <span style={{ background: '#e3f2fd', padding: '5px 10px', borderRadius: '4px', marginRight: '10px' }}>
                Validées: {data.receptions.filter(r => r.statut === 'validee').length}
              </span>
              <span style={{ background: '#f3e5f5', padding: '5px 10px', borderRadius: '4px' }}>
                Facturées: {data.receptions.filter(r => r.statut === 'facturee').length}
              </span>
            </div>
            <Button onClick={() => openModal('reception')}>+ Nouvelle Réception</Button>
          </div>

          {data.receptions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d' }}>Aucun bon de réception</p>
            </div>
          ) : (
            <Table
              columns={[
                { key: 'numero', label: 'Numéro' },
                { key: 'date_reception', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'fournisseur_nom', label: 'Fournisseur' },
                { key: 'entrepot_nom', label: 'Entrepôt', render: (val) => val || '-' },
                { key: 'total_ht', label: 'Total HT', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'nb_lignes', label: 'Lignes' },
                { key: 'statut', label: 'Statut', render: (val) => (
                  <span style={{ 
                    padding: '3px 8px', borderRadius: '4px', fontSize: '12px',
                    background: val === 'brouillon' ? '#fff3cd' : val === 'validee' ? '#d4edda' : val === 'facturee' ? '#cce5ff' : '#f8d7da',
                    color: val === 'brouillon' ? '#856404' : val === 'validee' ? '#155724' : val === 'facturee' ? '#004085' : '#721c24'
                  }}>
                    {val === 'brouillon' ? 'Brouillon' : val === 'validee' ? 'Validée' : val === 'facturee' ? 'Facturée' : val}
                  </span>
                )},
                { key: 'actions', label: 'Actions', render: (_, row) => (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {row.statut === 'brouillon' && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Valider ce bon de réception ? Le stock sera mis à jour.')) {
                            try {
                              await api.post(`/stock/receptions/${row.id}/valider`);
                              await reload('receptions');
                              await reload('mouvements');
                              alert('Bon validé avec succès. Stock et écritures comptables mis à jour.');
                            } catch (err) {
                              alert('Erreur: ' + (err.response?.data?.error || err.message));
                            }
                          }
                        }}
                        style={{ padding: '4px 8px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Valider
                      </button>
                    )}
                    {row.statut === 'brouillon' && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Supprimer ce bon de réception ?')) {
                            try {
                              await api.delete(`/stock/receptions/${row.id}`);
                              await reload('receptions');
                            } catch (err) {
                              alert('Erreur: ' + (err.response?.data?.error || err.message));
                            }
                          }
                        }}
                        style={{ padding: '4px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                )}
              ]}
              data={data.receptions}
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

      {activeTab === 'nonfacture' && (
        <NonFactureTab fournisseurs={data.fournisseurs} produits={data.produits} />
      )}

      {activeTab === 'rapports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>📊 Rapports d'Inventaire</h3>
            <div style={{ display: 'flex', gap: '10px' }} className="no-print">
              <button 
                onClick={() => {
                  const content = document.getElementById('stock-rapport-content');
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Rapport d'Inventaire - ComptaOrion</title>
                        <style>
                          body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
                          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                          th { background-color: #f5f5f5; }
                          h3, h4 { color: #333; margin-top: 20px; }
                          .summary { display: flex; gap: 20px; margin: 15px 0; }
                          .summary-box { padding: 15px; background: #f5f5f5; border-radius: 8px; }
                          @media print { body { margin: 0; } }
                        </style>
                      </head>
                      <body>
                        <h2>Rapport d'Inventaire</h2>
                        <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                        ${content.innerHTML}
                        <div style="margin-top: 30px; text-align: center; color: #666; font-size: 10px;">
                          Document généré par ComptaOrion le ${new Date().toLocaleDateString('fr-FR')}
                        </div>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }}
                style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🖨️ Imprimer
              </button>
              <button 
                onClick={() => {
                  const content = document.getElementById('stock-rapport-content');
                  const htmlContent = `
                    <html>
                      <head><meta charset="utf-8"><title>Rapport Inventaire</title>
                        <style>body { font-family: Arial; margin: 20px; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px; } th { background: #f5f5f5; }</style>
                      </head>
                      <body>
                        <h2>Rapport d'Inventaire</h2>
                        <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                        ${content.innerHTML}
                      </body>
                    </html>
                  `;
                  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Rapport_Inventaire_${periode.dateDebut}_${periode.dateFin}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ⬇️ Télécharger
              </button>
            </div>
          </div>
          
          <div id="stock-rapport-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PRODUITS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{data.produits.length}</h2>
            </div>
            <div style={{ padding: '20px', background: '#f3e5f5', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>QUANTITÉ TOTALE</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#7b1fa2' }}>{totalStock.toFixed(0)}</h2>
            </div>
            <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>VALORISATION TOTALE</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{Math.round(valorisation).toLocaleString('fr-FR')} FCFA</h2>
            </div>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📅 Filtrer par Période</h4>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input
                  type="date"
                  value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input
                  type="date"
                  value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              <Button 
                variant="success" 
                onClick={() => reload('produits')}
                style={{ fontWeight: 'bold', padding: '10px 20px' }}
              >
                Générer
              </Button>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>📋 Rapport de Valorisation par Produit (Méthode CMP)</h4>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '15px' }}>
              Valorisation selon le <strong>Coût Moyen Pondéré (CMP)</strong> - recalculé automatiquement à chaque entrée de stock
            </p>
            <Table
              columns={[
                { key: 'reference', label: 'Référence' },
                { key: 'nom', label: 'Produit' },
                { key: 'categorieId', label: 'Catégorie', render: (val) => {
                  const cat = data.categories.find(c => c.id === val);
                  return cat ? cat.nom : '-';
                }},
                { key: 'quantite', label: 'Quantité', render: (val, row) => `${val || 0} ${row.uniteMesure || 'pièce'}` },
                { key: 'coutMoyen', label: 'Coût Moyen (CMP)', render: (val, row) => {
                  const cmp = parseFloat(val || row.prixAchat || 0);
                  return `${Math.round(cmp).toLocaleString('fr-FR')} FCFA`;
                }},
                { key: 'valorisation', label: 'Valorisation Totale', render: (_, row) => {
                  const coutUnit = parseFloat(row.coutMoyen || row.prixAchat || 0);
                  const val = Math.round(parseFloat(row.quantite || 0) * coutUnit);
                  return <strong style={{ color: '#388e3c' }}>{val.toLocaleString('fr-FR')} FCFA</strong>;
                }}
              ]}
              data={data.produits}
            />
            <div style={{ marginTop: '15px', padding: '15px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>VALORISATION TOTALE DU STOCK</p>
              <h2 style={{ margin: '5px 0 0 0', color: '#388e3c' }}>{Math.round(valorisation).toLocaleString('fr-FR')} FCFA</h2>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '15px' }}>📦 Rapport des Quantités par Catégorie</h4>
            <Table
              columns={[
                { key: 'nom', label: 'Catégorie' },
                { key: 'nbProduits', label: 'Nb Produits', render: (_, row) => 
                  data.produits.filter(p => p.categorieId === row.id).length 
                },
                { key: 'quantiteTotale', label: 'Quantité Totale', render: (_, row) => {
                  const total = data.produits
                    .filter(p => p.categorieId === row.id)
                    .reduce((sum, p) => sum + parseFloat(p.quantite || 0), 0);
                  return total.toFixed(0);
                }},
                { key: 'valorisation', label: 'Valorisation', render: (_, row) => {
                  const val = Math.round(data.produits
                    .filter(p => p.categorieId === row.id)
                    .reduce((sum, p) => sum + (parseFloat(p.quantite || 0) * parseFloat(p.coutMoyen || p.prixAchat || 0)), 0));
                  return <strong style={{ color: '#388e3c' }}>{val.toLocaleString('fr-FR')} FCFA</strong>;
                }}
              ]}
              data={data.categories}
            />
          </div>
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={modal.type === 'produit' ? (modal.item ? 'Modifier' : 'Nouveau Produit') :
               modal.type === 'categorie' ? (modal.item ? 'Modifier' : 'Nouvelle Catégorie') :
               modal.type === 'entrepot' ? (modal.item ? 'Modifier' : 'Nouvel Entrepôt') :
               modal.type === 'inventaire' ? 'Comptage Physique' : 
               modal.type === 'reception' ? 'Nouveau Bon de Réception' :
               modal.type === 'commande' ? 'Nouvelle Commande d\'Achat' : ''}>
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
              <FormField label="Méthode de Valorisation" type="select" value={form.valorisationMethod || 'FIFO'} 
                onChange={(e) => setForm({...form, valorisationMethod: e.target.value})}
                options={[
                  { value: 'FIFO', label: 'FIFO (Premier Entré, Premier Sorti)' },
                  { value: 'CMP', label: 'CMP (Coût Moyen Pondéré)' },
                  { value: 'LIFO', label: 'LIFO (Dernier Entré, Premier Sorti)' }
                ]} />
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
              {data.entrepots.length === 0 && (
                <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffc107' }}>
                  <strong>⚠️ Aucun entrepôt configuré</strong>
                  <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
                    Vous devez d'abord créer un entrepôt dans <strong>Paramètres → Entrepôts</strong> avant de pouvoir effectuer un inventaire.
                  </p>
                </div>
              )}
              <FormField label="Entrepôt *" type="select" value={form.entrepotId || ''} 
                onChange={(e) => setForm({...form, entrepotId: e.target.value})}
                options={data.entrepots.length > 0 
                  ? [{ value: '', label: '-- Sélectionner un entrepôt --' }, ...data.entrepots.map(e => ({ value: e.id, label: e.nom }))]
                  : [{ value: '', label: '-- Créez d\'abord un entrepôt --' }]
                }
                required />
              <FormField label="Produit" type="select" value={form.produitId || ''} 
                onChange={(e) => setForm({...form, produitId: parseInt(e.target.value) || null})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.produits.map(p => ({ value: p.id, label: `${p.reference} - ${p.nom} (Stock: ${p.quantite || 0})` }))]}
                required />
              <FormField label="Quantité Comptée" type="number" value={form.quantiteComptee || 0} onChange={(e) => setForm({...form, quantiteComptee: parseFloat(e.target.value) || 0})} required />
              <FormField label="Notes" type="textarea" value={form.notes || ''} onChange={(e) => setForm({...form, notes: e.target.value})} />
            </>
          )}

          {modal.type === 'reception' && (
            <>
              {data.entrepots.length === 0 && (
                <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffc107' }}>
                  <strong>⚠️ Aucun entrepôt configuré</strong>
                  <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
                    Vous devez d'abord créer un entrepôt dans <strong>Paramètres → Entrepôts</strong> avant de pouvoir réceptionner du stock.
                  </p>
                </div>
              )}
              <FormField label="Fournisseur" type="select" value={form.fournisseurId || ''} 
                onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))]}
                required />
              <FormField label="Date Réception" type="date" value={form.dateReception || ''} 
                onChange={(e) => setForm({...form, dateReception: e.target.value})} required />
              <FormField label="Entrepôt *" type="select" value={form.entrepotId || ''} 
                onChange={(e) => setForm({...form, entrepotId: e.target.value})}
                options={data.entrepots.length > 0 
                  ? [{ value: '', label: '-- Sélectionner un entrepôt --' }, ...data.entrepots.map(e => ({ value: e.id, label: e.nom }))]
                  : [{ value: '', label: '-- Créez d\'abord un entrepôt --' }]
                }
                required />
              <FormField label="Notes" type="textarea" value={form.notes || ''} 
                onChange={(e) => setForm({...form, notes: e.target.value})} />

              <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>Lignes de Réception</h4>
                  <button type="button" onClick={() => setForm({
                    ...form, 
                    lignes: [...(form.lignes || []), { produitId: '', quantiteRecue: 1, prixUnitaireEstime: 0 }]
                  })} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Ajouter Ligne
                  </button>
                </div>
                
                {(form.lignes || []).map((ligne, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Produit</label>
                      <select 
                        value={ligne.produitId || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          const produit = data.produits.find(p => p.id === parseInt(e.target.value));
                          newLignes[index] = { 
                            ...newLignes[index], 
                            produitId: e.target.value,
                            prixUnitaireEstime: produit ? produit.prixAchat || 0 : 0
                          };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        <option value="">-- Sélectionner --</option>
                        {data.produits.map(p => (
                          <option key={p.id} value={p.id}>{p.reference} - {p.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Quantité</label>
                      <input 
                        type="number" 
                        value={ligne.quantiteRecue || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          newLignes[index] = { ...newLignes[index], quantiteRecue: e.target.value };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Prix Unit. Estimé</label>
                      <input 
                        type="number" 
                        value={ligne.prixUnitaireEstime || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          newLignes[index] = { ...newLignes[index], prixUnitaireEstime: e.target.value };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" onClick={() => {
                        const newLignes = form.lignes.filter((_, i) => i !== index);
                        setForm({...form, lignes: newLignes.length > 0 ? newLignes : [{ produitId: '', quantiteRecue: 1, prixUnitaireEstime: 0 }]});
                      }} style={{ padding: '8px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        X
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', textAlign: 'right' }}>
                  <strong>Total HT estimé: </strong>
                  {(form.lignes || []).reduce((sum, l) => sum + (parseFloat(l.quantiteRecue || 0) * parseFloat(l.prixUnitaireEstime || 0)), 0).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </>
          )}

          {modal.type === 'commande' && (
            <>
              <FormField label="Fournisseur" type="select" value={form.fournisseurId || ''} 
                onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))]}
                required />
              <FormField label="Date Commande" type="date" value={form.dateCommande || ''} 
                onChange={(e) => setForm({...form, dateCommande: e.target.value})} required />
              <FormField label="Date Livraison Prévue" type="date" value={form.dateLivraisonPrevue || ''} 
                onChange={(e) => setForm({...form, dateLivraisonPrevue: e.target.value})} />
              <FormField label="Notes" type="textarea" value={form.notes || ''} 
                onChange={(e) => setForm({...form, notes: e.target.value})} />

              <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>Lignes de Commande</h4>
                  <button type="button" onClick={() => setForm({
                    ...form, 
                    lignes: [...(form.lignes || []), { produitId: '', quantite: 1, prixUnitaire: 0 }]
                  })} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Ajouter Ligne
                  </button>
                </div>
                
                {(form.lignes || []).map((ligne, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Produit</label>
                      <select 
                        value={ligne.produitId || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          const produit = data.produits.find(p => p.id === parseInt(e.target.value));
                          newLignes[index] = { 
                            ...newLignes[index], 
                            produitId: e.target.value,
                            prixUnitaire: produit ? produit.prixAchat || 0 : 0
                          };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        <option value="">-- Sélectionner --</option>
                        {data.produits.map(p => (
                          <option key={p.id} value={p.id}>{p.reference} - {p.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Quantité</label>
                      <input 
                        type="number" 
                        value={ligne.quantite || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          newLignes[index] = { ...newLignes[index], quantite: e.target.value };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Prix Unitaire</label>
                      <input 
                        type="number" 
                        value={ligne.prixUnitaire || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          newLignes[index] = { ...newLignes[index], prixUnitaire: e.target.value };
                          setForm({...form, lignes: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" onClick={() => {
                        const newLignes = form.lignes.filter((_, i) => i !== index);
                        setForm({...form, lignes: newLignes.length > 0 ? newLignes : [{ produitId: '', quantite: 1, prixUnitaire: 0 }]});
                      }} style={{ padding: '8px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        X
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', textAlign: 'right' }}>
                  <strong>Total HT: </strong>
                  {(form.lignes || []).reduce((sum, l) => sum + (parseFloat(l.quantite || 0) * parseFloat(l.prixUnitaire || 0)), 0).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
            <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE DÉTAILS PRODUIT */}
      {selectedProduit && (
        <DetailsModal
          isOpen={showProduitDetails}
          onClose={() => { setShowProduitDetails(false); setSelectedProduit(null); }}
          title={`Détails Produit - ${selectedProduit.nom}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'Référence', value: selectedProduit.reference },
                { label: 'Nom', value: selectedProduit.nom },
                { label: 'Catégorie', value: (() => {
                  const cat = data.categories.find(c => c.id === selectedProduit.categorieId);
                  return cat ? cat.nom : 'Non catégorisé';
                })() },
                { label: 'Unité Mesure', value: selectedProduit.uniteMesure || 'pièce' }
              ]
            },
            {
              title: 'Stock & Prix',
              fields: [
                { label: 'Stock Actuel', value: `${selectedProduit.quantite || 0} ${selectedProduit.uniteMesure || 'pièce'}` },
                { label: 'Stock Minimum', value: `${selectedProduit.stockMinimum || 0} ${selectedProduit.uniteMesure || 'pièce'}` },
                { label: 'Méthode de Valorisation', value: selectedProduit.valorisationMethod || 'FIFO' },
                { label: 'Prix Achat', value: `${Math.round(parseFloat(selectedProduit.prixAchat || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'Prix Vente', value: `${Math.round(parseFloat(selectedProduit.prixVente || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'Marge', value: `${Math.round((parseFloat(selectedProduit.prixVente || 0) - parseFloat(selectedProduit.prixAchat || 0))).toLocaleString('fr-FR')} FCFA` }
              ]
            }
          ]}
          actions={[
            {
              label: '✏️ Modifier',
              variant: 'info',
              onClick: () => {
                setShowProduitDetails(false);
                openModal('produit', selectedProduit);
              }
            }
          ]}
        />
      )}

    </div>
  );
}
