import React, { useState, useEffect } from 'react';
import DownloadReportButton from '../components/DownloadReportButton';
import api from '../api';
import { readApiList, readAutomaticCosting } from '../utils/apiList.js';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { NumberInput } from '../components/NumberInput.jsx';
import { DetailsModal } from '../components/DetailsModal';
import ReportPageHeader from '../components/ReportPageHeader';
import { convertPriceFromBase, getMeasurementUnitOptions, isMassUnit } from '../utils/measurementUnits';
import { readPendingStockReport } from '../utils/pendingStockReport.js';

function NonFactureTab({ fournisseurs, produits }) {
  const [subTab, setSubTab] = useState('stock');
  const [stockPending, setStockPending] = useState({ items: [], totaux: {}, parFournisseur: [] });
  const [logistiquePending, setLogistiquePending] = useState({ items: [], totaux: {}, parType: [], parFournisseur: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filters, setFilters] = useState({ fournisseurId: '', dateDebut: '', dateFin: '' });

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      
      const [stockRes, logRes] = await Promise.all([
        api.get(`/stock/rapports/stock-non-facture?${params}`),
        api.get(`/stock/rapports/logistique-non-facturee?${params}`)
      ]);
      const stock = readPendingStockReport(stockRes);
      const logistics = readPendingStockReport(logRes);
      setStockPending(stock);
      setLogistiquePending(logistics);
    } catch (err) {
      console.error('Erreur chargement données non facturées:', err);
      setLoadError(err.message || 'Impossible de charger les réceptions non facturées.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  const typeLabels = { transport: 'Transport', douane: 'Douane', manutention: 'Manutention', assurance: 'Assurance', autre: 'Autres' };

  if (loadError) {
    return (
      <div role="alert">
        <p>{loadError}</p>
        <Button onClick={loadData}>Réessayer le chargement du non-facturé</Button>
      </div>
    );
  }

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
          <h2 style={{ margin: '10px 0 0 0', color: '#e65100' }}>{Number(stockPending.totaux?.valeur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{stockPending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>LOGISTIQUE EN ATTENTE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#1565c0' }}>{Number(logistiquePending.totaux?.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{logistiquePending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#fce4ec', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL NON FACTURÉ</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#c2185b' }}>
            {((stockPending.totaux?.valeur || 0) + (logistiquePending.totaux?.montant || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
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
                { key: 'prix_estime', label: 'Prix Estimé', render: (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { key: 'valeur_estimee', label: 'Valeur', render: (val) => <strong>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong> }
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
                    <strong>{typeLabels[t.type] || t.type}:</strong> {Number(t.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF ({t.lignes})
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
                  { key: 'montant_estime', label: 'Montant', render: (val) => <strong>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong> }
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
              { key: 'valeur', label: 'Valeur Stock', render: (val) => <strong>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong> }
            ]}
            data={stockPending.parFournisseur || []}
          />
          
          <h4 style={{ marginTop: '30px' }}>🚚 Logistique par Fournisseur</h4>
          <Table
            columns={[
              { key: 'nom', label: 'Fournisseur' },
              { key: 'lignes', label: 'Lignes' },
              { key: 'montant', label: 'Montant Total', render: (val) => <strong>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong> }
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
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pendingReceptionOrder, setPendingReceptionOrder] = useState(null);
  const [automaticCosting, setAutomaticCosting] = useState(false);
  const [stockReport, setStockReport] = useState({ products: [], total: 0, loading: false, error: '' });
  const [selectedProduit, setSelectedProduit] = useState(null);
  const [showProduitDetails, setShowProduitDetails] = useState(false);

  useEffect(() => {
    if (activeTab !== 'rapports') return;
    let cancelled = false;
    setStockReport({ products: [], total: 0, loading: true, error: '' });
    api.get('/stock/rapports/valorisation').then(report => {
      if (!Array.isArray(report.produits) || !Number.isFinite(Number(report.totalValorisation))) {
        throw new Error('Le rapport de valorisation reçu est incomplet.');
      }
      if (!cancelled) setStockReport({
        products: report.produits, total: Number(report.totalValorisation), loading: false, error: '',
      });
    }).catch(error => {
      if (!cancelled) setStockReport({ products: [], total: 0, loading: false, error: error.message });
    });
    return () => { cancelled = true; };
  }, [activeTab, data.produits]);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, c, e, r, f, cmd, capabilities] = await Promise.all([
          api.get('/produits').catch(() => ({ data: { data: [] } })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/receptions').catch(() => ({ data: [] })),
          api.get('/fournisseurs').catch(() => ({ data: { data: [] } })),
          api.get('/commandes-achat').catch(() => ({ data: { data: [] } })),
          api.get('/produits/capacites').catch(() => ({ automaticCosting: false }))
        ]);
        setAutomaticCosting(readAutomaticCosting(capabilities));
        setData({
          produits: readApiList(p, 'data'),
          categories: readApiList(c),
          entrepots: readApiList(e),
          receptions: readApiList(r),
          fournisseurs: readApiList(f, 'data'),
          commandes: readApiList(cmd, 'data')
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
        setData(d => ({ ...d, produits: readApiList(res, 'data') }));
      } else if (type === 'categories') {
        const res = await api.get('/stock/categories');
        setData(d => ({ ...d, categories: readApiList(res) }));
      } else if (type === 'entrepots') {
        const res = await api.get('/stock/entrepots');
        setData(d => ({ ...d, entrepots: readApiList(res) }));
      } else if (type === 'receptions') {
        const res = await api.get('/stock/receptions');
        setData(d => ({ ...d, receptions: readApiList(res) }));
      } else if (type === 'commandes') {
        const res = await api.get('/commandes-achat');
        setData(d => ({ ...d, commandes: readApiList(res, 'data') }));
      }
    } catch (err) {
      console.error('Reload error:', err);
    }
  };

  const openModal = (type, item = null) => {
    setFormError('');
    setPendingReceptionOrder(null);
    setModal({ open: true, type, item });
    if (type === 'produit') {
      setForm(item || {
        reference: '',
        nom: '',
        categorieId: null,
        prixAchat: 0,
        prixVente: 0,
        coutMoyen: 0,
        stockMinimum: 10,
        uniteMesure: 'pièce',
        poidsParUnite: '',
        unitePoids: 'kg',
        valorisationMethod: 'CMP',
      });
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
        lignes: [{ produitId: '', quantiteRecue: 1, uniteSaisie: '', prixUnitaireEstime: 0 }] 
      });
    } else if (type === 'commande') {
      setForm(item || {
        fournisseurId: '',
        dateCommande: new Date().toISOString().split('T')[0],
        dateLivraisonPrevue: '',
        notes: '',
        items: [{ produitId: '', description: '', quantite: 1, prixUnitaire: 0 }],
        coutsLogistiques: { transport: 0, douane: 0, manutention: 0, assurance: 0, autre: 0 }
      });
    }
  };

  const handleEditCommande = async (order) => {
    try {
      const response = await api.get(`/commandes-achat/${order.id}`);
      const details = response.data;
      const logistics = { transport: 0, douane: 0, manutention: 0, assurance: 0, autre: 0 };
      (details.coutsLogistiques || []).forEach((cost) => {
        logistics[cost.type] = (Number(logistics[cost.type]) || 0) + Number(cost.montant || 0);
      });
      setModal({ open: true, type: 'commande', item: details });
      setForm({
        fournisseurId: String(details.fournisseurId || ''),
        dateCommande: String(details.dateCommande || '').slice(0, 10),
        dateLivraisonPrevue: String(details.dateLivraisonPrevue || '').slice(0, 10),
        notes: details.notes || '',
        items: (details.items || []).map((line) => ({
          id: line.id,
          produitId: line.produitId || '',
          description: line.description || line.produit?.nom || '',
          quantite: Number(line.quantite || 0),
          prixUnitaire: Number(line.prixUnitaire || 0),
          remise: Number(line.remise || 0),
        })),
        coutsLogistiques: logistics,
      });
      setFormError('');
    } catch (error) {
      alert(`Impossible d’ouvrir le bon de commande : ${error.message}`);
    }
  };

  const handleOpenCommandeReception = async (order) => {
    try {
      const [response, warehousesResponse] = await Promise.all([
        api.get(`/commandes-achat/${order.id}`),
        api.get('/stock/entrepots'),
      ]);
      const details = response.data;
      const activeWarehouses = readApiList(warehousesResponse)
        .filter((warehouse) => warehouse.actif !== false);
      setData((current) => ({ ...current, entrepots: activeWarehouses }));
      setPendingReceptionOrder(activeWarehouses.length === 0 ? details : null);
      setModal({ open: true, type: 'commandeReception', item: details });
      setForm({
        commandeId: details.id,
        dateReception: new Date().toISOString().slice(0, 10),
        entrepotId: activeWarehouses.length === 1 ? String(activeWarehouses[0].id) : '',
        numeroLivraison: '',
        notes: '',
        items: (details.items || [])
          .filter((line) => line.produitId)
          .map((line) => ({
            commandeItemId: line.id,
            description: line.description || line.produit?.nom || 'Article',
              uniteMesure: line.produit?.uniteMesure || 'pièce',
              poidsParUnite: isMassUnit(line.produit?.uniteMesure) ? '' : (line.produit?.poidsParUnite ?? ''),
              unitePoids: line.produit?.unitePoids || 'kg',
            quantiteRestante: Math.max(0, Number(line.quantite || 0) - Number(line.quantiteRecue || 0)),
            quantiteRecue: 0,
          })),
      });
      setFormError('');
    } catch (error) {
      alert(`Impossible d’ouvrir la réception : ${error.message}`);
    }
  };

  const createWarehouseForPendingReception = () => {
    setModal({ open: true, type: 'entrepot', item: null });
    setForm({ nom: 'Entrepôt principal', adresse: '', responsable: '' });
    setFormError('');
  };

  const handleConfirmerCommande = async (order) => {
    try {
      await api.put(`/commandes-achat/${order.id}/confirmer`, {});
      await reload('commandes');
    } catch (error) {
      alert(`Impossible de confirmer le bon : ${error.message}`);
    }
  };

  const closeModal = () => {
    setModal({ open: false, type: null, item: null });
    setForm({});
    setFormError('');
    setPendingReceptionOrder(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      const { type, item } = modal;
      
      if (type === 'produit') {
        const productData = { ...form };
        if (automaticCosting) {
          delete productData.prixVente;
          delete productData.coutMoyen;
        }
        if (item) {
          await api.put(`/produits/${item.id}`, productData);
        } else {
          await api.post('/produits', productData);
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
            uniteSaisie: l.uniteSaisie || undefined,
            prixUnitaireEstime: parseFloat(l.prixUnitaireEstime)
          }))
        });
        await reload('receptions');
        alert('Bon de reception cree avec succes. Validez-le pour mettre a jour le stock.');
      } else if (type === 'commande') {
        const itemsValides = (form.items || []).filter(l => l.produitId && Number(l.quantite) > 0);
        if (!form.fournisseurId || itemsValides.length === 0) {
          return alert('Veuillez saisir un fournisseur et au moins une ligne valide');
        }
        const logisticsLabels = {
          transport: 'Transport',
          douane: 'Douane',
          manutention: 'Manutention',
          assurance: 'Assurance',
          autre: 'Autres frais',
        };
        const orderPayload = {
          fournisseurId: parseInt(form.fournisseurId),
          dateCommande: form.dateCommande,
          dateLivraisonPrevue: form.dateLivraisonPrevue || null,
          notes: form.notes,
          items: itemsValides.map(l => ({
            produitId: parseInt(l.produitId),
            description: l.description || data.produits.find(p => p.id === parseInt(l.produitId))?.nom || '',
            quantite: parseFloat(l.quantite),
            prixUnitaire: parseFloat(l.prixUnitaire),
            remise: parseFloat(l.remise || 0),
          })),
          coutsLogistiques: Object.entries(form.coutsLogistiques || {})
            .map(([type, montant]) => ({
              type,
              description: logisticsLabels[type],
              montant: Number(montant || 0),
            }))
            .filter((cost) => cost.montant > 0),
        };
        if (item) {
          await api.put(`/commandes-achat/${item.id}`, orderPayload);
        } else {
          await api.post('/commandes-achat', orderPayload);
        }
        await reload('commandes');
      } else if (type === 'commandeReception') {
        const receivedItems = (form.items || [])
          .map(line => ({
            commandeItemId: Number(line.commandeItemId),
            quantiteRecue: Number(line.quantiteRecue),
            poidsParUnite: isMassUnit(line.uniteMesure) ||
              line.poidsParUnite == null || String(line.poidsParUnite).trim() === ''
              ? null
              : Number(line.poidsParUnite),
            unitePoids: line.unitePoids || 'kg',
          }));
        if (!receivedItems.some((item) => item.quantiteRecue > 0)) {
          return alert('Saisissez au moins une quantité reçue.');
        }
        const fraisLogistiquesPrevus = Number(modal.item?.totalLogistique || 0);
        const poidsManquant = fraisLogistiquesPrevus > 0 && (form.items || []).some((line) =>
          !isMassUnit(line.uniteMesure) &&
          (!Number.isFinite(Number(line.poidsParUnite)) || Number(line.poidsParUnite) <= 0)
        );
        if (poidsManquant) {
          setFormError('Renseignez le poids par unité de chaque article avant de répartir les frais logistiques.');
          return;
        }
        if (!form.entrepotId) {
          return alert('Sélectionnez un entrepôt pour enregistrer le stock reçu.');
        }
        await api.post('/receptions', {
          commandeId: Number(form.commandeId),
          dateReception: form.dateReception,
          entrepotId: Number(form.entrepotId),
          numeroLivraison: form.numeroLivraison || null,
          notes: form.notes || null,
          items: receivedItems,
        });
        await Promise.all([reload('commandes'), reload('produits'), reload('receptions')]);
      }
      
      if (type === 'entrepot' && !item && pendingReceptionOrder) {
        const orderToResume = pendingReceptionOrder;
        setPendingReceptionOrder(null);
        await handleOpenCommandeReception(orderToResume);
      } else {
        closeModal();
      }
    } catch (err) {
      console.error('Échec de l’enregistrement du formulaire Stock:', err);
      setFormError(err.message || 'Enregistrement impossible. Réessayez.');
    } finally {
      setIsSaving(false);
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
  const valuationProducts = stockReport.products.map(row => ({
    ...data.produits.find(product => Number(product.id) === Number(row.id)),
    ...row,
    coutMoyen: Number(row.cout_unitaire),
    valeurStock: Number(row.valeur_totale),
    valorisationMethod: row.valorisation_method,
  }));
  const valorisation = stockReport.total;
  const activeEntrepots = data.entrepots.filter((warehouse) => warehouse.actif !== false);

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
                  { key: 'prixAchat', label: 'Coût standard', render: (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                  { key: 'coutMoyen', label: automaticCosting ? 'Coût calculé' : 'Coût de revient manuel', render: (val) => Number(val || 0) > 0
                    ? `${Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`
                    : automaticCosting ? 'En attente de réception' : 'À saisir' },
                  { key: 'prixVente', label: automaticCosting ? 'Prix de vente calculé' : 'Prix de vente manuel', render: (val, row) => Number(row.coutMoyen || 0) > 0
                    ? `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`
                    : automaticCosting ? 'Non calculé' : 'À saisir' }
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
            Créez un bon avec ses coûts logistiques prévisionnels. Confirmez-le avant réception : la réception met à jour le stock et les coûts non facturés. Le bon reste modifiable jusqu’à la première réception.
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
                { key: 'fournisseur', label: 'Fournisseur', render: (val, row) => row.fournisseur?.raisonSociale || row.fournisseur?.nom || val?.raisonSociale || val?.nom || '-' },
                { key: 'dateCommande', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : '-' },
                { key: 'totalHT', label: 'Total HT', render: (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { key: 'statut', label: 'Statut', render: (val) => {
                  const statut = val || 'brouillon';
                  const colors = { brouillon: '#95a5a6', confirmee: '#3498db', preparee: '#f0ad4e', livree: '#27ae60', annulee: '#e74c3c' };
                  const labels = { brouillon: 'Brouillon', confirmee: 'Confirmée', preparee: 'Réception partielle', livree: 'Réceptionnée', annulee: 'Annulée' };
                  return <span style={{ 
                    padding: '4px 8px', borderRadius: '4px', backgroundColor: colors[statut] || '#999',
                    color: 'white', fontSize: '11px'
                  }}>{labels[statut] || statut}</span>;
                }}
              ]}
              data={data.commandes}
              actions={true}
              customActions={(order) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {order.statut === 'brouillon' && (
                    <Button size="small" variant="success" onClick={() => handleConfirmerCommande(order)}>
                      Confirmer
                    </Button>
                  )}
                  {!['preparee', 'livree', 'annulee'].includes(order.statut) && (
                    <Button size="small" variant="outline" onClick={() => handleEditCommande(order)}>
                      Modifier
                    </Button>
                  )}
                  {['confirmee', 'preparee'].includes(order.statut) && (
                    <Button size="small" onClick={() => handleOpenCommandeReception(order)}>
                      Réceptionner
                    </Button>
                  )}
                </div>
              )}
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
                { key: 'total_ht', label: 'Total HT', render: (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
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
          <ReportPageHeader
            title="Rapports d’inventaire"
            description="Vue synthétique des quantités et de la valorisation du stock"
            actions={<div style={{ display: 'flex', gap: '10px' }} className="no-print">
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
                        <p>Situation actuelle du stock au ${new Date().toLocaleDateString('fr-FR')}</p>
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
                            <DownloadReportButton elementId="stock-rapport-content" baseName={`Rapport_Inventaire_Actuel_${new Date().toISOString().slice(0, 10)}`} title="Rapport d'Inventaire" />
            </div>}
          >
            <p style={{ margin: 0, color: '#64748b' }}>
              Situation actuelle du stock. La valorisation historique à une date passée n’est pas encore disponible.
            </p>
          </ReportPageHeader>
          
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
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{Number(valorisation || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>📋 Rapport de Valorisation par Produit</h4>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '15px' }}>
              Situation actuelle selon la méthode de chaque produit. Les valeurs utilisent les coûts du stock restant, sans multiplier un coût unitaire déjà arrondi.
            </p>
            {stockReport.loading && <p role="status">Chargement de la valorisation...</p>}
            {stockReport.error && <p role="alert">{stockReport.error}</p>}
            <Table
              columns={[
                { key: 'reference', label: 'Référence' },
                { key: 'nom', label: 'Produit' },
                { key: 'categorieId', label: 'Catégorie', render: (val) => {
                  const cat = data.categories.find(c => c.id === val);
                  return cat ? cat.nom : '-';
                }},
                { key: 'quantite', label: 'Quantité', render: (val, row) => `${val || 0} ${row.uniteMesure || 'pièce'}` },
                { key: 'valorisationMethod', label: 'Méthode' },
                { key: 'coutMoyen', label: 'Coût unitaire moyen', render: (val, row) => {
                  const cmp = parseFloat(val || 0);
                  return `${Number(cmp || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`;
                }},
                { key: 'valorisation', label: 'Valorisation Totale', render: (_, row) => {
                  const val = row.valeurStock;
                  return <strong style={{ color: '#388e3c' }}>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>;
                }}
              ]}
              data={valuationProducts}
            />
            <div style={{ marginTop: '15px', padding: '15px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>VALORISATION TOTALE DU STOCK</p>
              <h2 style={{ margin: '5px 0 0 0', color: '#388e3c' }}>{Number(valorisation || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
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
                  const val = valuationProducts
                    .filter(p => p.categorieId === row.id)
                    .reduce((sum, p) => sum + p.valeurStock, 0);
                  return <strong style={{ color: '#388e3c' }}>{Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>;
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
               modal.type === 'commandeReception' ? `Réception — ${modal.item?.numeroCommande || ''}` :
               modal.type === 'commande' ? (modal.item ? 'Modifier le bon de commande' : 'Nouveau Bon de Commande Fournisseur') : ''}>
        <form onSubmit={handleSubmit}>
          {modal.type === 'produit' && (
            <>
              <FormField label="Référence (facultative)" value={form.reference || ''} onChange={(e) => setForm({...form, reference: e.target.value})} />
              <FormField label="Nom" value={form.nom || ''} onChange={(e) => setForm({...form, nom: e.target.value})} required />
              <FormField label="Catégorie" type="select" value={form.categorieId || ''} 
                onChange={(e) => setForm({...form, categorieId: parseInt(e.target.value) || null})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.categories.map(c => ({ value: c.id, label: c.nom }))]} />
              <FormField
                label="Unité principale de stock"
                value={form.uniteMesure || 'pièce'}
                onChange={(e) => setForm({ ...form, uniteMesure: e.target.value })}
                placeholder="Ex. pièce, sac, kg"
                required
              />
              {isMassUnit(form.uniteMesure) ? (
                <small style={{ display: 'block', margin: '-8px 0 12px', color: '#666' }}>
                  Le poids est automatiquement déduit de l’unité principale ; les saisies en g, kg et t seront converties.
                </small>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField
                      label={`Poids par unité de stock${form.uniteMesure ? ` (${form.uniteMesure})` : ''}`}
                      type="number"
                      value={form.poidsParUnite ?? ''}
                      onChange={(e) => setForm({
                        ...form,
                        poidsParUnite: e.target.value === '' ? '' : parseFloat(e.target.value),
                      })}
                      min="0.000001"
                      step="0.000001"
                      placeholder="Ex. 0,5 pour une pièce de 500 g"
                    />
                    <FormField
                      label="Unité du poids"
                      type="select"
                      value={form.unitePoids || 'kg'}
                      onChange={(e) => setForm({ ...form, unitePoids: e.target.value })}
                      options={[
                        { value: 'g', label: 'Gramme (g)' },
                        { value: 'kg', label: 'Kilogramme (kg)' },
                        { value: 't', label: 'Tonne (t)' },
                        { value: 'mg', label: 'Milligramme (mg)' },
                        { value: 'lb', label: 'Livre (lb)' },
                      ]}
                    />
                  </div>
                  <small style={{ display: 'block', margin: '-8px 0 12px', color: '#666' }}>
                    Obligatoire pour répartir des frais logistiques sur les articles à la pièce ou au sac.
                  </small>
                </>
              )}
              <FormField
                label="Coût standard (devis fournisseur)"
                type="number"
                value={form.prixAchat || 0}
                onChange={(e) => setForm({...form, prixAchat: parseFloat(e.target.value) || 0})}
              />
              <small style={{ display: 'block', margin: '-8px 0 12px', color: '#666' }}>
                Référence de devis uniquement. Ce montant n’est pas le CMV et ne calcule pas le prix de vente.
              </small>
              {automaticCosting ? (
                <div style={{ padding: '12px', marginBottom: '12px', borderRadius: '6px', background: Number(form.coutMoyen || 0) > 0 ? '#eef7ee' : '#fff7e6' }}>
                  <strong>Coût calculé par le système :</strong>{' '}
                  {Number(form.coutMoyen || 0) > 0
                    ? `${Number(form.coutMoyen).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`
                    : 'disponible après validation d’une réception fournisseur'}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                    Le prix de vente se calcule ensuite depuis ce coût réel et la majoration choisie dans la bibliothèque de prix.
                  </div>
                </div>
              ) : (
                <>
                  <FormField
                    label="Coût de revient manuel"
                    type="number"
                    value={form.coutMoyen ?? 0}
                    onChange={(e) => setForm({ ...form, coutMoyen: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                  <FormField
                    label="Prix de vente manuel"
                    type="number"
                    value={form.prixVente ?? 0}
                    onChange={(e) => setForm({ ...form, prixVente: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                  <small style={{ display: 'block', margin: '-8px 0 12px', color: '#666' }}>
                    Les factures et les quantités de stock restent suivies; le coût et le prix ne sont pas recalculés par le logiciel.
                  </small>
                </>
              )}
              <FormField label="Stock Min" type="number" value={form.stockMinimum || 10} onChange={(e) => setForm({...form, stockMinimum: parseFloat(e.target.value) || 0})} />
              {automaticCosting && (
                <FormField label="Méthode de Valorisation" type="select" value={form.valorisationMethod || 'CMP'}
                  onChange={(e) => setForm({...form, valorisationMethod: e.target.value})}
                  options={[
                    { value: 'FIFO', label: 'FIFO (Premier Entré, Premier Sorti)' },
                    { value: 'CMP', label: 'CMP (Coût Moyen Pondéré)' },
                  ]} />
              )}
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
                    lignes: [...(form.lignes || []), { produitId: '', quantiteRecue: 1, uniteSaisie: '', prixUnitaireEstime: 0 }]
                  })} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Ajouter Ligne
                  </button>
                </div>
                
                {(form.lignes || []).map((ligne, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
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
                            uniteSaisie: produit?.uniteMesure || '',
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
                      <label style={{ fontSize: '12px', color: '#666' }}>Unité saisie</label>
                      <select
                        value={ligne.uniteSaisie || data.produits.find(p => p.id === parseInt(ligne.produitId))?.uniteMesure || 'pièce'}
                        onChange={(e) => {
                          const newLignes = [...form.lignes];
                          const produit = data.produits.find(p => p.id === parseInt(ligne.produitId));
                          const prixParUnite = convertPriceFromBase(
                            produit?.prixAchat || 0,
                            e.target.value,
                            produit?.uniteMesure || e.target.value
                          );
                          newLignes[index] = {
                            ...newLignes[index],
                            uniteSaisie: e.target.value,
                            prixUnitaireEstime: Number.isFinite(prixParUnite) ? prixParUnite : 0,
                          };
                          setForm({ ...form, lignes: newLignes });
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        {getMeasurementUnitOptions(
                          data.produits.find(p => p.id === parseInt(ligne.produitId))?.uniteMesure
                        ).map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Quantité</label>
                      <NumberInput
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
                      <NumberInput
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
                        setForm({...form, lignes: newLignes.length > 0 ? newLignes : [{ produitId: '', quantiteRecue: 1, uniteSaisie: '', prixUnitaireEstime: 0 }]});
                      }} style={{ padding: '8px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        X
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', textAlign: 'right' }}>
                  <strong>Total HT estimé: </strong>
                  {(form.lignes || []).reduce((sum, l) => sum + (parseFloat(l.quantiteRecue || 0) * parseFloat(l.prixUnitaireEstime || 0)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
                </div>
              </div>
            </>
          )}

          {modal.type === 'commande' && (
            <>
              <div style={{ marginBottom: 16, padding: 12, color: '#315f78', background: '#eef6fa', borderRadius: 8, fontSize: 13 }}>
                Le bon est modifiable jusqu’à la première réception. Sa réception met à jour le stock et crée le suivi des coûts logistiques non facturés.
              </div>
              <FormField label="Fournisseur" type="select" value={form.fournisseurId || ''} 
                onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.fournisseurs.map(f => ({ value: f.id, label: f.nom || f.raisonSociale }))]}
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
                    items: [...(form.items || []), { produitId: '', description: '', quantite: 1, prixUnitaire: 0 }]
                  })} style={{ padding: '5px 10px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Ajouter Ligne
                  </button>
                </div>
                
                {(form.items || []).map((ligne, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Produit</label>
                      <select 
                        value={ligne.produitId || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.items];
                          const produit = data.produits.find(p => p.id === parseInt(e.target.value));
                          newLignes[index] = { 
                            ...newLignes[index], 
                            produitId: e.target.value,
                            description: produit?.nom || '',
                            prixUnitaire: produit ? produit.prixAchat || 0 : 0
                          };
                          setForm({...form, items: newLignes});
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
                      <NumberInput
                        min="0.001"
                        step="0.001"
                        value={ligne.quantite || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.items];
                          newLignes[index] = { ...newLignes[index], quantite: e.target.value };
                          setForm({...form, items: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666' }}>Prix Unitaire</label>
                      <NumberInput
                        min="0"
                        step="0.01"
                        value={ligne.prixUnitaire || ''} 
                        onChange={(e) => {
                          const newLignes = [...form.items];
                          newLignes[index] = { ...newLignes[index], prixUnitaire: e.target.value };
                          setForm({...form, items: newLignes});
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button type="button" onClick={() => {
                        const newItems = form.items.filter((_, i) => i !== index);
                        setForm({...form, items: newItems.length > 0 ? newItems : [{ produitId: '', description: '', quantite: 1, prixUnitaire: 0 }]});
                      }} style={{ padding: '8px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        X
                      </button>
                    </div>
                  </div>
                ))}
                
                <h4 style={{ marginTop: 20 }}>Frais logistiques prévisionnels</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 15 }}>
                  {[
                    ['transport', 'Transport'],
                    ['douane', 'Douane'],
                    ['manutention', 'Manutention'],
                    ['assurance', 'Assurance'],
                    ['autre', 'Autres frais'],
                  ].map(([type, label]) => (
                    <FormField
                      key={type}
                      label={label}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.coutsLogistiques?.[type] ?? 0}
                      onChange={(event) => setForm({
                        ...form,
                        coutsLogistiques: { ...(form.coutsLogistiques || {}), [type]: event.target.value },
                      })}
                    />
                  ))}
                </div>
                <div style={{ marginTop: '15px', padding: '10px', background: '#e3f2fd', borderRadius: '4px', textAlign: 'right' }}>
                  <div>Articles HT : <strong>{(form.items || []).reduce((sum, l) => sum + (parseFloat(l.quantite || 0) * parseFloat(l.prixUnitaire || 0)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></div>
                  <div>Logistique prévisionnelle : <strong>{Object.values(form.coutsLogistiques || {}).reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></div>
                  <div>Total prévisionnel : <strong>{(
                    (form.items || []).reduce((sum, l) => sum + (parseFloat(l.quantite || 0) * parseFloat(l.prixUnitaire || 0)), 0) +
                    Object.values(form.coutsLogistiques || {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
                  ).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></div>
                </div>
              </div>
            </>
          )}

          {modal.type === 'commandeReception' && (
            <>
              <div style={{ marginBottom: 16, padding: 12, background: '#eef6fa', borderRadius: 8 }}>
                <strong>{modal.item?.fournisseur?.raisonSociale || modal.item?.fournisseur?.nom || 'Fournisseur'}</strong>
                <div>Bon {modal.item?.numeroCommande} · réception partielle ou complète</div>
                <div>Coûts logistiques prévisionnels : {Number(modal.item?.totalLogistique || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</div>
              </div>
              <FormField
                label="Entrepôt de réception"
                type="select"
                value={form.entrepotId || ''}
                onChange={(event) => setForm({ ...form, entrepotId: event.target.value })}
                options={activeEntrepots.map((warehouse) => ({ value: warehouse.id, label: warehouse.nom }))}
                disabled={activeEntrepots.length === 0}
                required
              />
              {activeEntrepots.length === 0 && (
                <div role="alert" style={{ margin: '-8px 0 16px', padding: 12, color: '#664d03', background: '#fff3cd', border: '1px solid #ffecb5', borderRadius: 6 }}>
                  Aucun entrepôt actif n’est disponible, donc la liste est vide. Créez-en un pour recevoir cette commande.
                  <div style={{ marginTop: 10 }}>
                    <Button type="button" variant="outline" onClick={createWarehouseForPendingReception}>
                      Créer un entrepôt et revenir à la réception
                    </Button>
                  </div>
                </div>
              )}
              <FormField label="Date de réception" type="date" value={form.dateReception || ''}
                onChange={(event) => setForm({ ...form, dateReception: event.target.value })} required />
              <FormField label="N° du bon de livraison" value={form.numeroLivraison || ''}
                onChange={(event) => setForm({ ...form, numeroLivraison: event.target.value })} />
              <FormField label="Notes" type="textarea" value={form.notes || ''}
                onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <div style={{ marginTop: 12 }}>
                {(form.items || []).map((line, index) => (
                  <div key={line.commandeItemId} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end', padding: '10px 0', borderBottom: '1px solid #e5e9ed' }}>
                    <div>
                      <strong>{line.description}</strong>
                      <div style={{ fontSize: 12, color: '#60717d' }}>Reste à recevoir : {line.quantiteRestante}</div>
                    </div>
                    <label style={{ fontSize: 12, color: '#52606d' }}>
                      Quantité reçue
                      <NumberInput
                        aria-label={`Quantité reçue ${line.description}`}
                        min="0"
                        max={line.quantiteRestante}
                        step="0.001"
                        value={line.quantiteRecue}
                        disabled={line.quantiteRestante <= 0}
                        onChange={(event) => {
                          const items = [...form.items];
                          items[index] = { ...items[index], quantiteRecue: event.target.value };
                          setForm({ ...form, items });
                        }}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 8, border: '1px solid #d4dce2', borderRadius: 5 }}
                      />
                    </label>
                    {isMassUnit(line.uniteMesure) ? (
                      <div style={{ fontSize: 12, color: '#52606d' }}>
                        Poids automatique
                        <strong style={{ display: 'block', marginTop: 4 }}>Déduit de l’unité {line.uniteMesure}</strong>
                      </div>
                    ) : (
                      <>
                        <label style={{ fontSize: 12, color: '#52606d' }}>
                          Poids par unité{Number(modal.item?.totalLogistique || 0) > 0 ? ' *' : ''}
                          <NumberInput
                            aria-label={`Poids par unité ${line.description}`}
                            min="0.000001"
                            step="0.000001"
                            value={line.poidsParUnite ?? ''}
                            onChange={(event) => {
                              const items = [...form.items];
                              items[index] = {
                                ...items[index],
                                poidsParUnite: event.target.value === '' ? '' : event.target.value,
                              };
                              setForm({ ...form, items });
                            }}
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 8, border: '1px solid #d4dce2', borderRadius: 5 }}
                          />
                        </label>
                        <label style={{ fontSize: 12, color: '#52606d' }}>
                          Unité
                          <select
                            aria-label={`Unité du poids ${line.description}`}
                            value={line.unitePoids || 'kg'}
                            onChange={(event) => {
                              const items = [...form.items];
                              items[index] = { ...items[index], unitePoids: event.target.value };
                              setForm({ ...form, items });
                            }}
                            style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: 8, border: '1px solid #d4dce2', borderRadius: 5 }}
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="t">t</option>
                            <option value="mg">mg</option>
                            <option value="lb">lb</option>
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {formError && (
            <div role="alert" style={{ marginTop: 16, padding: 12, color: '#842029', background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: 6 }}>
              {formError}
            </div>
          )}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
            <Button type="submit" variant="success" disabled={isSaving || (modal.type === 'commandeReception' && activeEntrepots.length === 0)}>
              {isSaving ? 'Enregistrement…' : modal.type === 'commandeReception' ? 'Enregistrer la réception' : modal.item ? 'Mettre à jour' : 'Créer'}
            </Button>
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
                { label: 'Unité principale de stock', value: selectedProduit.uniteMesure || 'pièce' },
                {
                  label: 'Poids par unité de stock',
                  value: isMassUnit(selectedProduit.uniteMesure)
                    ? `Automatique depuis ${selectedProduit.uniteMesure}`
                    : selectedProduit.poidsParUnite
                    ? `${selectedProduit.poidsParUnite} ${selectedProduit.unitePoids || 'kg'}`
                    : 'Non renseigné',
                }
              ]
            },
            {
              title: 'Stock & Prix',
              fields: [
                { label: 'Stock Actuel', value: `${selectedProduit.quantite || 0} ${selectedProduit.uniteMesure || 'pièce'}` },
                { label: 'Stock Minimum', value: `${selectedProduit.stockMinimum || 0} ${selectedProduit.uniteMesure || 'pièce'}` },
                ...(automaticCosting ? [{ label: 'Méthode de Valorisation', value: selectedProduit.valorisationMethod || 'CMP' }] : []),
                { label: 'Coût standard (devis)', value: `${Number(selectedProduit.prixAchat || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { label: automaticCosting ? 'Coût calculé (CMV)' : 'Coût de revient manuel', value: Number(selectedProduit.coutMoyen || 0) > 0 ? `${Number(selectedProduit.coutMoyen).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` : automaticCosting ? 'En attente de réception fournisseur' : 'À saisir' },
                { label: automaticCosting ? 'Prix de vente calculé' : 'Prix de vente manuel', value: Number(selectedProduit.prixVente || 0) > 0 ? `${Number(selectedProduit.prixVente).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` : automaticCosting ? 'Non calculé' : 'À saisir' },
                ...(automaticCosting ? [{ label: 'Marge ajoutée', value: Number(selectedProduit.coutMoyen || 0) > 0 ? `${(Number(selectedProduit.prixVente || 0) - Number(selectedProduit.coutMoyen || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` : '—' }] : [])
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
