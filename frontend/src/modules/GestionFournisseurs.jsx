import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { NumberInput } from '../components/NumberInput.jsx';
import { DetailsModal } from '../components/DetailsModal';
import PeriodFilter, { getPeriodeDates } from '../components/PeriodFilter';
import ReportPageHeader from '../components/ReportPageHeader';
import api from '../api';
import { getInvoiceStatusDisplay, InvoiceStatusBadge } from '../utils/invoiceStatus';
import { addDaysToIsoDate, formatPeriodeFR } from '../utils/dateUtils';
import { getCashDiscountPreview } from '../utils/cashDiscount';
import {
  convertPriceBetweenUnits,
  convertQuantityBetweenUnits,
  getMeasurementUnitOptions,
} from '../utils/measurementUnits';
import { readApiList } from '../utils/apiList';
import SupplierInvoiceOcr from './SupplierInvoiceOcr';

function FacturationTab({ fournisseurs }) {
  const [subTab, setSubTab] = useState('stock');
  const [stockPending, setStockPending] = useState({ items: [], totaux: {}, parFournisseur: [] });
  const [logistiquePending, setLogistiquePending] = useState({ items: [], totaux: {}, parType: [], parFournisseur: [] });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ fournisseurId: '', dateDebut: '', dateFin: '' });
  
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [receptionsEnAttente, setReceptionsEnAttente] = useState([]);
  const [allReceptionsEnAttente, setAllReceptionsEnAttente] = useState([]);
  const [loadingReceptions, setLoadingReceptions] = useState(false);
  const [receptionsLoadError, setReceptionsLoadError] = useState('');
  const [selectedReceptions, setSelectedReceptions] = useState([]);
  const [produits, setProduits] = useState([]);
  const [comptesEcart, setComptesEcart] = useState([]);
  const [compteEcartParDefaut, setCompteEcartParDefaut] = useState('');
  const [comptesEcartError, setComptesEcartError] = useState('');
  const [totalComptesPlan, setTotalComptesPlan] = useState(null);
  const [comptesEcartInactifs, setComptesEcartInactifs] = useState(0);
  const [compteEcartSearch, setCompteEcartSearch] = useState('');
  const [chargementComptesEcart, setChargementComptesEcart] = useState(true);
  const [initialisationPlan, setInitialisationPlan] = useState(false);
  const [tauxTva, setTauxTva] = useState(18);
  const [factureForm, setFactureForm] = useState({
    fournisseurId: '',
    numeroFactureFournisseur: '',
    dateFacture: new Date().toISOString().split('T')[0],
    dateEcheance: '',
    compteEcartId: '',
    tvaExoneree: false,
    lignes: [],
    coutsLogistiques: [],
    notes: ''
  });
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [factureSubmitError, setFactureSubmitError] = useState('');

  const getSupplierDueDate = (supplierId, invoiceDate) => {
    const supplier = fournisseurs.find((item) => Number(item.id) === Number(supplierId));
    return supplier ? addDaysToIsoDate(invoiceDate, supplier.delaiPaiement ?? 30) : '';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fournisseurId) params.append('fournisseurId', filters.fournisseurId);
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      
      const [stockRes, logRes, produitsRes] = await Promise.all([
        api.get(`/stock/rapports/stock-non-facture?${params}`).catch(() => ({ data: { items: [], totaux: {}, parFournisseur: [] } })),
        api.get(`/stock/rapports/logistique-non-facturee?${params}`).catch(() => ({ data: { items: [], totaux: {}, parType: [], parFournisseur: [] } })),
        api.get('/produits').catch(() => ({ data: [] }))
      ]);
      setStockPending(Array.isArray(stockRes?.items) ? stockRes : { items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending(Array.isArray(logRes?.items) ? logRes : { items: [], totaux: {}, parType: [], parFournisseur: [] });
      setProduits(readApiList(produitsRes));
    } catch (err) {
      console.error('Erreur chargement données:', err);
      setStockPending({ items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending({ items: [], totaux: {}, parType: [], parFournisseur: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  const loadAccountingSettings = async () => {
    setChargementComptesEcart(true);
    setComptesEcartError('');
    try {
      const accountsResponse = await api.get('/achats/comptes-ecarts');
      const accounts = Array.isArray(accountsResponse.accounts) ? accountsResponse.accounts : [];
      const defaultAccountId = String(accountsResponse.defaultAccountId || '');
      if (accountsResponse.tauxTva !== null
        && accountsResponse.tauxTva !== undefined
        && Number.isFinite(Number(accountsResponse.tauxTva))) {
        setTauxTva(Number(accountsResponse.tauxTva));
      }
      setComptesEcart(accounts);
      setCompteEcartParDefaut(defaultAccountId);
      setTotalComptesPlan(Number(accountsResponse.totalAccountCount || 0));
      setComptesEcartInactifs(Number(accountsResponse.inactiveEligibleCount || 0));
      setFactureForm((current) => ({
        ...current,
        compteEcartId: current.compteEcartId || defaultAccountId,
      }));
    } catch (error) {
      const message = error?.message || 'Impossible de charger les comptes d’écart.';
      setComptesEcart([]);
      setComptesEcartError(message);
      console.error('Impossible de charger les comptes d’écart:', error);
    } finally {
      setChargementComptesEcart(false);
    }
  };

  useEffect(() => { loadAccountingSettings(); }, []);

  const initialiserPlanSyscohada = async () => {
    if (!window.confirm('Aucun compte n’existe pour cette entreprise. Ajouter le plan SYSCOHADA standard ?')) return;
    setInitialisationPlan(true);
    try {
      const result = await api.post('/comptabilite/init-syscohada', {});
      await loadAccountingSettings();
      alert(`Plan comptable initialisé : ${result.comptesCreés || 0} comptes créés.`);
    } catch (error) {
      alert(`Impossible d’initialiser le plan comptable : ${error.message}`);
    } finally {
      setInitialisationPlan(false);
    }
  };

  const typeLabels = { transport: 'Transport', douane: 'Douane', manutention: 'Manutention', assurance: 'Assurance', autre: 'Autres' };

  const openFactureModal = async () => {
    setShowFactureModal(true);
    setStep(1);
    setFactureSubmitError('');
    setSelectedReceptions([]);
    setReceptionsEnAttente([]);
    setAllReceptionsEnAttente([]);
    setReceptionsLoadError('');
    const dateFacture = new Date().toISOString().split('T')[0];
    const initialForm = {
      fournisseurId: '',
      numeroFactureFournisseur: '',
      dateFacture,
      dateEcheance: '',
      compteEcartId: compteEcartParDefaut,
      tvaExoneree: false,
      lignes: [],
      coutsLogistiques: [],
      notes: ''
    };
    setFactureForm(initialForm);
    setLoadingReceptions(true);
    try {
      const response = await api.get('/achats/receptions-en-attente');
      const pendingReceptions = readApiList(response, 'data');
      setAllReceptionsEnAttente(pendingReceptions);

      const supplierIds = [...new Set(
        pendingReceptions
          .map((reception) => reception.fournisseur_id)
          .filter((id) => id != null)
          .map(String)
      )];

      // Quand une seule réception est à rapprocher, la présélection évite
      // de bloquer l’utilisateur sur un bouton « Suivant » désactivé.
      if (supplierIds.length === 1) {
        const fournisseurId = supplierIds[0];
        const supplierReceptions = pendingReceptions.filter(
          (reception) => String(reception.fournisseur_id) === fournisseurId
        );
        setFactureForm({
          ...initialForm,
          fournisseurId,
          dateEcheance: getSupplierDueDate(fournisseurId, dateFacture),
        });
        setReceptionsEnAttente(supplierReceptions);
        if (supplierReceptions.length === 1) {
          setSelectedReceptions([supplierReceptions[0].id]);
        }
      }
    } catch (error) {
      console.error('Erreur chargement des réceptions à rapprocher:', error);
      setReceptionsLoadError('Impossible de charger les réceptions. Réessayez après avoir actualisé la page.');
    } finally {
      setLoadingReceptions(false);
    }
  };

  const loadReceptionsForFournisseur = (fournisseurId) => {
    if (!fournisseurId) {
      setReceptionsEnAttente([]);
      return [];
    }
    const supplierReceptions = allReceptionsEnAttente.filter(
      (reception) => String(reception.fournisseur_id) === String(fournisseurId)
    );
    setReceptionsEnAttente(supplierReceptions);
    return supplierReceptions;
  };

  const toggleReception = (recId) => {
    setSelectedReceptions(prev => 
      prev.includes(recId) ? prev.filter(id => id !== recId) : [...prev, recId]
    );
  };

  const goToStep2 = () => {
    if (!factureForm.fournisseurId || selectedReceptions.length === 0) {
      alert('Sélectionnez un fournisseur et au moins une réception');
      return;
    }
    const selectedRecs = receptionsEnAttente.filter(r => selectedReceptions.includes(r.id));
    const lignes = [];
    
    for (const rec of selectedRecs) {
      const recLignes = rec.lignes || [];
      for (const l of recLignes) {
        const product = produits.find(p => p.id === l.produit_id);
        lignes.push({
          produitId: l.produit_id,
          produitNom: product?.nom || `Produit ${l.produit_id}`,
          uniteStock: product?.uniteMesure || 'pièce',
          quantite: parseFloat(l.quantite_saisie ?? l.quantite_recue),
          uniteSaisie: l.unite_saisie || product?.uniteMesure || 'pièce',
          prixEstime: parseFloat(l.prix_unitaire_saisi ?? l.prix_unitaire_estime ?? 0),
          prixUnitaireReel: parseFloat(l.prix_unitaire_saisi ?? l.prix_unitaire_estime ?? 0),
          description: product?.nom || `Article réception ${rec.numero}`
        });
      }
    }
    
    const logItems = logistiquePending.items?.filter(l => selectedReceptions.includes(l.bon_reception_id)) || [];
    const groupedCouts = {};
    for (const l of logItems) {
      if (!groupedCouts[l.type]) {
        groupedCouts[l.type] = { type: l.type, montantEstime: 0, montantReel: 0, description: typeLabels[l.type] || l.type };
      }
      groupedCouts[l.type].montantEstime += parseFloat(l.montant_estime || 0);
      groupedCouts[l.type].montantReel += parseFloat(l.montant_estime || 0);
    }
    
    setFactureForm(prev => ({
      ...prev,
      lignes,
      coutsLogistiques: Object.values(groupedCouts)
    }));
    setStep(2);
  };

  const updateLigne = (index, field, value) => {
    setFactureForm(prev => {
      const newLignes = [...prev.lignes];
      newLignes[index] = { ...newLignes[index], [field]: value };
      return { ...prev, lignes: newLignes };
    });
  };

  const updateCout = (index, field, value) => {
    setFactureForm(prev => {
      const newCouts = [...prev.coutsLogistiques];
      newCouts[index] = { ...newCouts[index], [field]: value };
      return { ...prev, coutsLogistiques: newCouts };
    });
  };

  const calculateTotals = () => {
    const totalArticles = factureForm.lignes.reduce((sum, l) => sum + (parseFloat(l.quantite) * parseFloat(l.prixUnitaireReel || 0)), 0);
    const totalLogistique = factureForm.coutsLogistiques.reduce((sum, c) => sum + parseFloat(c.montantReel || 0), 0);
    const totalHT = totalArticles + totalLogistique;
    const totalTVA = factureForm.tvaExoneree
      ? 0
      : Math.round((totalHT * tauxTva / 100) * 100) / 100;
    return { totalArticles, totalLogistique, totalHT, totalTVA };
  };

  const submitFacture = async () => {
    setFactureSubmitError('');
    const numeroFactureFournisseur = String(factureForm.numeroFactureFournisseur || '').trim();
    if (!numeroFactureFournisseur) {
      setFactureSubmitError('Saisissez le numéro de la facture du fournisseur avant de créer la facture.');
      return;
    }
    if (hasVariance && !factureForm.compteEcartId) {
      setFactureSubmitError('Sélectionnez un compte comptable pour enregistrer les écarts de prix.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        fournisseurId: factureForm.fournisseurId,
        numeroFactureFournisseur,
        dateFacture: factureForm.dateFacture,
        compteEcartId: factureForm.compteEcartId ? Number(factureForm.compteEcartId) : null,
        tvaExoneree: factureForm.tvaExoneree,
        receptionsIds: selectedReceptions,
        lignes: factureForm.lignes.map(l => ({
          produitId: l.produitId,
          quantite: l.quantite,
          uniteSaisie: l.uniteSaisie,
          prixUnitaireReel: l.prixUnitaireReel,
          description: l.description
        })),
        coutsLogistiques: factureForm.coutsLogistiques.map(c => ({
          type: c.type,
          montantReel: c.montantReel,
          description: c.description
        })),
        notes: factureForm.notes
      };
      
      const response = await api.post('/achats/factures-avec-rapprochement', payload);
      const warnings = response.data?.coutRevient?.avertissements || [];
      alert([
        response.data?.message || 'Facture créée avec rapprochement réussi.',
        ...warnings,
      ].join('\n\n'));
      setShowFactureModal(false);
      loadData();
    } catch (err) {
      setFactureSubmitError(err.response?.data?.message || err.message || 'La facture n’a pas pu être créée.');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();
  const estimatedHT = factureForm.lignes.reduce((sum, line) =>
    sum + Number(line.quantite || 0) * Number(line.prixEstime || 0), 0
  ) + factureForm.coutsLogistiques.reduce((sum, cost) => sum + Number(cost.montantEstime || 0), 0);
  const totalVariance = totals.totalHT - estimatedHT;
  const hasVariance = Math.abs(totalVariance) >= 0.01;
  const selectedVarianceAccount = comptesEcart.find(
    (account) => String(account.id) === String(factureForm.compteEcartId)
  );
  const normalizedAccountQuery = compteEcartSearch.trim().toLocaleLowerCase('fr');
  const filteredVarianceAccounts = comptesEcart.filter((account) =>
    `${account.numero || ''} ${account.nom || ''}`.toLocaleLowerCase('fr').includes(normalizedAccountQuery)
  );
  const totalTTC = totals.totalHT + totals.totalTVA;
  const fournisseursAvecReception = [...new Map(
    allReceptionsEnAttente
      .filter((reception) => reception.fournisseur_id != null)
      .map((reception) => {
        const id = String(reception.fournisseur_id);
        const supplier = fournisseurs.find((item) => String(item.id) === id);
        return [id, supplier || {
          id,
          raisonSociale: reception.fournisseur_nom || `Fournisseur ${id}`,
        }];
      })
  ).values()];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>📄 Créer Facture depuis Réceptions</h3>
          <p style={{ color: '#7f8c8d', margin: '5px 0 0 0' }}>
            Convertir les stocks et coûts logistiques non facturés en facture fournisseur.
          </p>
        </div>
        <Button onClick={openFactureModal} variant="success">+ Rapprocher une facture de stock</Button>
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
        {['stock', 'logistique'].map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            style={{
              padding: '10px 20px', background: subTab === t ? '#3498db' : '#ecf0f1',
              color: subTab === t ? '#fff' : '#34495e', border: 'none', borderRadius: '8px',
              fontWeight: subTab === t ? 'bold' : 'normal', cursor: 'pointer'
            }}>
            {t === 'stock' ? '📦 Stock Non Facturé' : '🚚 Frais Logistiques'}
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

      {showFactureModal && (
        <Modal isOpen={true} onClose={() => setShowFactureModal(false)} title="Créer Facture Fournisseur avec Rapprochement" size="xlarge">
          {step === 1 && (
            <div>
              <h4>Étape 1: Sélectionner le fournisseur et les réceptions</h4>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fournisseur *</label>
                <select 
                  disabled={loadingReceptions || fournisseursAvecReception.length === 0}
                  value={factureForm.fournisseurId} 
                  onChange={(e) => {
                    const fournisseurId = e.target.value;
                    setFactureForm(prev => ({
                      ...prev,
                      fournisseurId,
                      dateEcheance: getSupplierDueDate(fournisseurId, prev.dateFacture),
                    }));
                    const supplierReceptions = loadReceptionsForFournisseur(fournisseurId);
                    setSelectedReceptions(
                      supplierReceptions.length === 1 ? [supplierReceptions[0].id] : []
                    );
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <option value="">
                    {loadingReceptions
                      ? '-- Chargement des réceptions --'
                      : fournisseursAvecReception.length
                        ? '-- Sélectionner un fournisseur --'
                        : '-- Aucune réception à rapprocher --'}
                  </option>
                  {fournisseursAvecReception.map(f => <option key={f.id} value={f.id}>{f.nom || f.raisonSociale}</option>)}
                </select>
                {receptionsLoadError && (
                  <p role="alert" style={{ color: '#b42318', marginTop: 8 }}>
                    {receptionsLoadError}
                  </p>
                )}
                {!loadingReceptions && !receptionsLoadError && !allReceptionsEnAttente.length && (
                  <p style={{ color: '#52606d', marginTop: 8 }}>
                    Aucune réception validée n’attend actuellement une facture. Vérifiez que la réception du bon de commande est validée.
                  </p>
                )}
              </div>

              {factureForm.fournisseurId && (
                <div>
                  <h5>Réceptions en attente de facturation ({receptionsEnAttente.length})</h5>
                  {receptionsEnAttente.length === 0 ? (
                    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                      Le fournisseur est sélectionné, mais aucune réception validée n’attend sa facture. Créez un bon de commande et validez sa réception. Pour un service ou un achat sans stock, utilisez « Facture directe hors stock ».
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}>
                      {receptionsEnAttente.map(rec => (
                        <div key={rec.id} 
                          onClick={() => toggleReception(rec.id)}
                          style={{ 
                            padding: '15px', borderBottom: '1px solid #eee', cursor: 'pointer',
                            background: selectedReceptions.includes(rec.id) ? '#e3f2fd' : '#fff'
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <input type="checkbox" checked={selectedReceptions.includes(rec.id)} onChange={() => {}} style={{ marginRight: '10px' }} />
                              <strong>{rec.numero}</strong> - {new Date(rec.date_reception).toLocaleDateString('fr-FR')}
                            </div>
                            <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{Number(rec.total_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                            {(rec.lignes || []).length} article(s)
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setShowFactureModal(false)}>Annuler</Button>
                <Button variant="info" onClick={goToStep2} disabled={!factureForm.fournisseurId || selectedReceptions.length === 0}>
                  Suivant →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h4>Étape 2: Saisir les coûts réels</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date Facture *</label>
                  <input type="date" value={factureForm.dateFacture}
                    onChange={(e) => setFactureForm(prev => ({
                      ...prev,
                      dateFacture: e.target.value,
                      dateEcheance: getSupplierDueDate(prev.fournisseurId, e.target.value),
                    }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date Échéance (automatique)</label>
                  <input type="date" value={factureForm.dateEcheance} readOnly
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: '#f3f5f7' }} />
                </div>
              </div>

              <h5>Articles ({factureForm.lignes.length})</h5>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '-8px' }}>
                Les quantités en g, kg ou t sont converties vers l’unité principale du produit avant le calcul du stock et des frais logistiques.
              </p>
              <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Produit</th>
                        <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '165px' }}>Quantité / unité</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '120px' }}>Prix Estimé</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '150px' }}>Prix Réel *</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factureForm.lignes.map((ligne, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ligne.produitNom || ligne.description}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <NumberInput
                              min="0.001"
                              step="0.001"
                              value={ligne.quantite}
                              onChange={(e) => updateLigne(idx, 'quantite', parseFloat(e.target.value) || 0)}
                              style={{ width: '75px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <select
                              value={ligne.uniteSaisie || ligne.uniteStock}
                              onChange={(e) => {
                                const newUnit = e.target.value;
                                const newQuantity = convertQuantityBetweenUnits(
                                  ligne.quantite,
                                  ligne.uniteSaisie || ligne.uniteStock,
                                  newUnit
                                );
                                const newPrice = convertPriceBetweenUnits(
                                  ligne.prixUnitaireReel,
                                  ligne.uniteSaisie || ligne.uniteStock,
                                  newUnit
                                );
                                const newEstimatedPrice = convertPriceBetweenUnits(
                                  ligne.prixEstime,
                                  ligne.uniteSaisie || ligne.uniteStock,
                                  newUnit
                                );
                                setFactureForm(prev => ({
                                  ...prev,
                                  lignes: prev.lignes.map((item, itemIndex) => itemIndex === idx
                                    ? {
                                      ...item,
                                      uniteSaisie: newUnit,
                                      quantite: newQuantity,
                                      prixUnitaireReel: newPrice,
                                      prixEstime: newEstimatedPrice,
                                    }
                                    : item),
                                }));
                              }}
                              style={{ minWidth: '70px', padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                              {getMeasurementUnitOptions(ligne.uniteStock).map((unit) => (
                                <option key={unit.value} value={unit.value}>{unit.value}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#999' }}>{ligne.prixEstime.toLocaleString('fr-FR')}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <NumberInput value={ligne.prixUnitaireReel}
                            onChange={(e) => updateLigne(idx, 'prixUnitaireReel', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                          {(ligne.quantite * (ligne.prixUnitaireReel || 0)).toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {factureForm.coutsLogistiques.length > 0 && (
                <>
                  <h5>Coûts Logistiques ({factureForm.coutsLogistiques.length})</h5>
                  <div style={{ marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5' }}>
                          <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Type</th>
                          <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '150px' }}>Montant Estimé</th>
                          <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '180px' }}>Montant Réel *</th>
                          <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '120px' }}>Écart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {factureForm.coutsLogistiques.map((cout, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{cout.description}</td>
                            <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#999' }}>{cout.montantEstime.toLocaleString('fr-FR')}</td>
                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                              <NumberInput value={cout.montantReel}
                                onChange={(e) => updateCout(idx, 'montantReel', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', 
                              color: (cout.montantReel - cout.montantEstime) > 0 ? '#e74c3c' : (cout.montantReel - cout.montantEstime) < 0 ? '#27ae60' : '#333' }}>
                              {((cout.montantReel || 0) - cout.montantEstime).toLocaleString('fr-FR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div style={{ margin: '0 0 16px', padding: '12px', background: '#f3f7fb', borderRadius: 8 }}>
                TVA calculée automatiquement au taux de {tauxTva}% configuré pour l’entreprise.
                {tauxTva === 0 && ' Le taux configuré est nul : aucune TVA ne sera ajoutée.'}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={factureForm.tvaExoneree}
                    onChange={(e) => setFactureForm((current) => ({ ...current, tvaExoneree: e.target.checked }))}
                  />
                  Facture fournisseur exonérée de TVA
                </label>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 5 }}>
                  Compte comptable des écarts{hasVariance ? ' *' : ''}
                </label>
                <div style={{ width: '100%', maxWidth: 520, position: 'relative' }}>
                  <input
                    type="text"
                    role="combobox"
                    aria-label="Rechercher un compte comptable pour l’écart"
                    aria-autocomplete="list"
                    aria-expanded={Boolean(normalizedAccountQuery)}
                    aria-controls="supplier-variance-account-options"
                    autoComplete="off"
                    value={compteEcartSearch}
                    placeholder={chargementComptesEcart
                      ? 'Chargement des comptes…'
                      : hasVariance
                        ? 'Rechercher un compte de charge ou de produit'
                        : 'Aucun compte requis si l’écart est nul'}
                    onChange={(event) => {
                      setCompteEcartSearch(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setCompteEcartSearch('');
                      } else if (event.key === 'Enter' && normalizedAccountQuery && filteredVarianceAccounts.length) {
                        event.preventDefault();
                        const account = filteredVarianceAccounts[0];
                        setFactureForm((current) => ({ ...current, compteEcartId: String(account.id) }));
                        setCompteEcartSearch('');
                      }
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid #9aa7b2',
                      background: '#fff',
                      color: '#17212b',
                      fontSize: 14,
                      cursor: 'text',
                      pointerEvents: 'auto',
                    }}
                  />
                  {normalizedAccountQuery && (
                    <div
                      id="supplier-variance-account-options"
                      role="listbox"
                      aria-label="Comptes de charge ou de produit disponibles"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 3px)',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        maxHeight: 220,
                        overflowY: 'auto',
                        border: '1px solid #9aa7b2',
                        borderRadius: 5,
                        background: '#fff',
                        boxShadow: '0 6px 16px rgba(20, 35, 50, 0.18)',
                      }}
                    >
                      {filteredVarianceAccounts.length ? filteredVarianceAccounts.map((account) => {
                        const isSelected = String(account.id) === String(factureForm.compteEcartId);
                        return (
                          <button
                            key={account.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setFactureForm((current) => ({ ...current, compteEcartId: String(account.id) }));
                              setCompteEcartSearch('');
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '9px 10px',
                              border: 0,
                              borderBottom: '1px solid #edf0f2',
                              textAlign: 'left',
                              cursor: 'pointer',
                              background: isSelected ? '#e8f1ff' : '#fff',
                              color: '#17212b',
                            }}
                          >
                            {account.numero} — {account.nom}
                            {String(account.id) === compteEcartParDefaut ? ' (compte par défaut)' : ''}
                          </button>
                        );
                      }) : (
                        <div style={{ padding: 10, color: '#667085' }}>
                          {comptesEcart.length ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte de charge ou de produit actif disponible.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedVarianceAccount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <p style={{ color: '#247a45', fontSize: 13, margin: 0 }}>
                      Compte sélectionné : {selectedVarianceAccount.numero} — {selectedVarianceAccount.nom}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFactureForm((current) => ({ ...current, compteEcartId: '' }));
                        setCompteEcartSearch('');
                      }}
                      style={{ border: '1px solid #9aa7b2', borderRadius: 4, background: '#fff', padding: '5px 9px', cursor: 'pointer' }}
                    >
                      Modifier
                    </button>
                  </div>
                )}
                  {!selectedVarianceAccount && comptesEcart.length > 0 && !normalizedAccountQuery && (
                    <p style={{ color: '#52606d', fontSize: 13, margin: '6px 0 0' }}>
                      Saisissez un numéro ou un nom de compte pour afficher les choix.
                    </p>
                  )}
                <p style={{ color: '#52606d', fontSize: 13, margin: '6px 0 0' }}>
                  Écart HT constaté : {totalVariance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF. Il sera débité si défavorable, crédité si favorable.
                </p>
                {!hasVariance && (
                  <p style={{ color: '#247a45', fontSize: 13, margin: '6px 0 0' }}>
                    Aucun écart à comptabiliser : la facture peut être créée sans choisir de compte d’écart.
                  </p>
                )}
                {comptesEcartError && (
                  <p style={{ color: '#b42318', fontSize: 13, margin: '6px 0 0' }}>
                    Chargement des comptes impossible : {comptesEcartError}
                  </p>
                )}
                {chargementComptesEcart && (
                  <p style={{ color: '#52606d', fontSize: 13, margin: '6px 0 0' }}>Chargement des comptes comptables…</p>
                )}
                {!chargementComptesEcart && !comptesEcartError && !comptesEcart.length && totalComptesPlan === 0 && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ color: hasVariance ? '#b42318' : '#52606d', fontSize: 13, margin: '6px 0' }}>
                      Le plan comptable ne contient aucun compte. Pour enregistrer un écart, initialisez le plan SYSCOHADA ou créez/importez le plan de l’entreprise.
                    </p>
                    <button type="button" onClick={initialiserPlanSyscohada} disabled={initialisationPlan}
                      style={{ padding: '7px 12px', border: 0, borderRadius: 5, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
                      {initialisationPlan ? 'Initialisation…' : 'Initialiser le plan SYSCOHADA'}
                    </button>
                  </div>
                )}
                {!chargementComptesEcart && !comptesEcartError && !comptesEcart.length && totalComptesPlan > 0 && (
                  <p style={{ color: hasVariance ? '#b42318' : '#52606d', fontSize: 13, margin: '6px 0 0' }}>
                    {comptesEcartInactifs > 0
                      ? `${comptesEcartInactifs} compte(s) de charge ou de produit sont inactifs. Réactivez le compte voulu dans Comptabilité → Charte des comptes.`
                      : 'Aucun compte actif de charge ou de produit n’a été reconnu. Activez ou classez les comptes concernés dans Comptabilité → Charte des comptes.'}
                  </p>
                )}
              </div>
              <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Articles:</span>
                  <strong>{totals.totalArticles.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Logistique:</span>
                  <strong>{totals.totalLogistique.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #4caf50', paddingTop: '10px' }}>
                  <span style={{ fontSize: '18px' }}>Total HT:</span>
                  <strong style={{ fontSize: '18px', color: '#2e7d32' }}>{totals.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                  <span>TVA facturée:</span>
                  <strong>{totals.totalTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '18px' }}>Total TTC:</span>
                  <strong style={{ fontSize: '18px', color: '#2e7d32' }}>{totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Notes</label>
                <textarea value={factureForm.notes}
                  onChange={(e) => setFactureForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }} />
              </div>

              <div style={{ margin: '12px 0 18px', position: 'relative', zIndex: 2 }}>
                {factureSubmitError && (
                  <p role="alert" style={{ color: '#b42318', background: '#fff1f0', padding: 10, borderRadius: 5, margin: '0 0 10px' }}>
                    {factureSubmitError}
                  </p>
                )}
                <label htmlFor="supplier-invoice-number" style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>
                  N° Facture Fournisseur *
                </label>
                <input
                  id="supplier-invoice-number"
                  name="numeroFactureFournisseur"
                  aria-label="Numéro de facture du fournisseur"
                  type="text"
                  value={factureForm.numeroFactureFournisseur}
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={submitting}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFactureForm((prev) => ({ ...prev, numeroFactureFournisseur: value }));
                    if (value.trim()) setFactureSubmitError('');
                  }}
                  style={{
                    position: 'relative',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    touchAction: 'manipulation',
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 10,
                    borderRadius: 4,
                    border: '1px solid #8998a7',
                    fontSize: 16,
                    background: '#fff',
                    color: '#17212b',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                <Button variant="secondary" onClick={() => setStep(1)}>← Retour</Button>
                <Button variant="success" onClick={submitFacture} disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer la Facture'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function RapportsClotureComptable({ periode, fournisseurs }) {
  const [stockNonFacture, setStockNonFacture] = useState({ items: [], totaux: {}, parFournisseur: [] });
  const [logistiqueNonFacturee, setLogistiqueNonFacturee] = useState({ items: [], totaux: {}, parType: [], parFournisseur: [] });
  const [loading, setLoading] = useState(false);
  const [activeRapport, setActiveRapport] = useState('stock');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (periode.dateDebut) params.append('dateDebut', periode.dateDebut);
        if (periode.dateFin) params.append('dateFin', periode.dateFin);

        const [stockRes, logRes] = await Promise.all([
          api.get(`/stock/rapports/stock-non-facture?${params}`).catch(() => ({ data: { items: [], totaux: {}, parFournisseur: [] } })),
          api.get(`/stock/rapports/logistique-non-facturee?${params}`).catch(() => ({ data: { items: [], totaux: {}, parType: [], parFournisseur: [] } }))
        ]);
        setStockNonFacture(stockRes.data || { items: [], totaux: {}, parFournisseur: [] });
        setLogistiqueNonFacturee(logRes.data || { items: [], totaux: {}, parType: [], parFournisseur: [] });
      } catch (err) {
        console.error('Erreur chargement rapports clôture:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [periode]);

  const exportCSV = (type) => {
    let csv = '';
    const date = new Date().toLocaleDateString('fr-FR');
    
    if (type === 'stock') {
      csv = `RAPPORT STOCK NON FACTURE - Clôture Comptable\nPériode: ${periode.dateDebut} au ${periode.dateFin}\nDate: ${date}\n\n`;
      csv += 'Fournisseur;Produit;Référence;Quantité;Prix Unitaire;Montant Total;Date Réception;Réception N°\n';
      (stockNonFacture.items || []).forEach(item => {
        const pu = Math.round(parseFloat(item.prix_unitaire_estime || 0));
        const montant = Math.round(parseFloat(item.valeur_estimee || 0));
        csv += `${item.fournisseur_nom || ''};${item.produit_nom || ''};${item.produit_reference || ''};${item.quantite_pending || 0};${pu};${montant};${item.date_reception || ''};${item.reception_numero || ''}\n`;
      });
      csv += `\nTOTAL STOCK NON FACTURE;;;;;${Math.round(stockNonFacture.totaux?.valeur || 0)};;`;
    } else {
      csv = `RAPPORT COUTS LOGISTIQUES NON FACTURES - Clôture Comptable\nPériode: ${periode.dateDebut} au ${periode.dateFin}\nDate: ${date}\n\n`;
      csv += 'Fournisseur;Type;Montant;Date Réception;Réception N°;Commande N°\n';
      (logistiqueNonFacturee.items || []).forEach(item => {
        const montant = Math.round(parseFloat(item.montant_estime || 0));
        csv += `${item.fournisseur_nom || ''};${item.type || ''};${montant};${item.date_reception || ''};${item.reception_numero || ''};${item.commande_numero || ''}\n`;
      });
      csv += `\nTOTAL LOGISTIQUE NON FACTUREE;;;${Math.round(logistiqueNonFacturee.totaux?.montant || 0)};;`;
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${type}_non_facture_${periode.dateDebut}_${periode.dateFin}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const typeLabels = { transport: 'Transport', douane: 'Douane', manutention: 'Manutention', assurance: 'Assurance', autre: 'Autres' };

  return (
    <div style={{ marginTop: '30px', borderTop: '2px solid #1976d2', paddingTop: '20px' }}>
      <h4 style={{ marginBottom: '15px', color: '#1976d2' }}>📋 Rapports de Clôture Comptable - Coûts Non Facturés</h4>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveRapport('stock')}
          style={{ 
            padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            background: activeRapport === 'stock' ? '#1976d2' : '#e0e0e0',
            color: activeRapport === 'stock' ? 'white' : '#333'
          }}>
          📦 Stock Non Facturé
        </button>
        <button 
          onClick={() => setActiveRapport('logistique')}
          style={{ 
            padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer',
            background: activeRapport === 'logistique' ? '#1976d2' : '#e0e0e0',
            color: activeRapport === 'logistique' ? 'white' : '#333'
          }}>
          🚚 Coûts Logistiques Non Facturés
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>Chargement...</div>
      ) : activeRapport === 'stock' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>ARTICLES EN ATTENTE</p>
                <h3 style={{ margin: '5px 0 0', color: '#f57c00' }}>{stockNonFacture.totaux?.lignes || 0}</h3>
              </div>
              <div style={{ padding: '15px', background: '#ffebee', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>MONTANT TOTAL NON FACTURÉ</p>
                <h3 style={{ margin: '5px 0 0', color: '#d32f2f' }}>{Number(stockNonFacture.totaux?.valeur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h3>
              </div>
            </div>
            <Button variant="secondary" onClick={() => exportCSV('stock')}>📥 Exporter CSV</Button>
          </div>

          {stockNonFacture.parFournisseur?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ marginBottom: '10px' }}>Récapitulatif par Fournisseur (Compte 408 - Factures Non Parvenues)</h5>
              <Table
                columns={[
                  { key: 'nom', label: 'Fournisseur' },
                  { key: 'lignes', label: 'Nb Articles' },
                  { key: 'valeur', label: 'Montant Total', render: (v) => `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` }
                ]}
                data={stockNonFacture.parFournisseur}
                actions={false}
              />
            </div>
          )}

          <h5 style={{ marginBottom: '10px' }}>Détail des Articles</h5>
          <Table
            columns={[
              { key: 'fournisseur_nom', label: 'Fournisseur' },
              { key: 'produit_nom', label: 'Produit' },
              { key: 'produit_reference', label: 'Réf.' },
              { key: 'quantite_pending', label: 'Qté' },
              { key: 'prix_unitaire_estime', label: 'P.U.', render: (v) => `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
              { key: 'valeur_estimee', label: 'Montant', render: (v) => `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
              { key: 'date_reception', label: 'Date Réception' },
              { key: 'reception_numero', label: 'Réception N°' }
            ]}
            data={stockNonFacture.items || []}
            actions={false}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>LIGNES EN ATTENTE</p>
                <h3 style={{ margin: '5px 0 0', color: '#1976d2' }}>{logistiqueNonFacturee.totaux?.lignes || 0}</h3>
              </div>
              <div style={{ padding: '15px', background: '#ffebee', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>MONTANT TOTAL NON FACTURÉ</p>
                <h3 style={{ margin: '5px 0 0', color: '#d32f2f' }}>{Number(logistiqueNonFacturee.totaux?.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h3>
              </div>
            </div>
            <Button variant="secondary" onClick={() => exportCSV('logistique')}>📥 Exporter CSV</Button>
          </div>

          {logistiqueNonFacturee.parType?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ marginBottom: '10px' }}>Récapitulatif par Type de Coût</h5>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                {logistiqueNonFacturee.parType.map(t => (
                  <div key={t.type} style={{ padding: '10px 15px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{typeLabels[t.type] || t.type}:</span> {Number(t.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
                  </div>
                ))}
              </div>
            </div>
          )}

          {logistiqueNonFacturee.parFournisseur?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ marginBottom: '10px' }}>Récapitulatif par Fournisseur</h5>
              <Table
                columns={[
                  { key: 'nom', label: 'Fournisseur' },
                  { key: 'lignes', label: 'Nb Lignes' },
                  { key: 'montant', label: 'Montant Total', render: (v) => `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` }
                ]}
                data={logistiqueNonFacturee.parFournisseur}
                actions={false}
              />
            </div>
          )}

          <h5 style={{ marginBottom: '10px' }}>Détail des Coûts Logistiques</h5>
          <Table
            columns={[
              { key: 'fournisseur_nom', label: 'Fournisseur' },
              { key: 'type', label: 'Type', render: (v) => typeLabels[v] || v },
              { key: 'montant_estime', label: 'Montant', render: (v) => `${Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
              { key: 'date_reception', label: 'Date Réception' },
              { key: 'reception_numero', label: 'Réception N°' },
              { key: 'commande_numero', label: 'Commande N°' }
            ]}
            data={logistiqueNonFacturee.items || []}
            actions={false}
          />
        </div>
      )}
    </div>
  );
}

export function GestionFournisseurs() {
  const [activeTab, setActiveTab] = useState('facturation');
  const [subTab, setSubTab] = useState('fournisseurs');
  const [data, setData] = useState({
    fournisseurs: [],
    commandes: [],
    receptions: [],
    factures: [],
    paiements: [],
    taxes: [],
    codesComptables: []
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [selectedCommande, setSelectedCommande] = useState(null);
  const [showFournisseurDetails, setShowFournisseurDetails] = useState(false);
  const [showCommandeDetails, setShowCommandeDetails] = useState(false);
  const [periode, setPeriode] = useState({
    dateDebut: getPeriodeDates('annee').dateDebut,
    dateFin: getPeriodeDates('annee').dateFin
  });
  const [drillModal, setDrillModal] = useState({ open: false, title: '', data: [], loading: false, type: null });
  const [chequeModal, setChequeModal] = useState({ open: false });
  const [comptesBancaires, setComptesBancaires] = useState([]);
  const [chequeForm, setChequeForm] = useState({
    fournisseurId: '',
    montant: 0,
    numeroCheque: '',
    dateCheque: new Date().toISOString().split('T')[0],
    compteBancaireId: '',
    memo: ''
  });
  const [supplierAvoirModal, setSupplierAvoirModal] = useState({
    open: false, invoice: null, lines: [], motif: '', saving: false,
  });
  const [supplierQualityCreditModal, setSupplierQualityCreditModal] = useState({
    open: false, invoice: null, lines: [], motif: '', saving: false,
  });
  const [supplierPaymentModal, setSupplierPaymentModal] = useState({
    open: false, invoice: null, montant: '', modePaiement: 'virement',
    datePaiement: new Date().toISOString().slice(0, 10), reference: '', notes: '',
    compteBancaireId: '', appliquerEscompte: false, saving: false,
  });
  const [invoiceAccountModal, setInvoiceAccountModal] = useState({
    open: false, invoice: null, accounts: [], selectedId: '', query: '',
    loading: false, saving: false, error: '',
  });
  const [validatingInvoiceId, setValidatingInvoiceId] = useState(null);

  const nombreEnLettres = (n) => {
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    if (n === 0) return 'zéro';
    if (n < 0) return 'moins ' + nombreEnLettres(-n);
    if (n < 20) return units[n];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (t === 7 || t === 9) return tens[t] + (u === 1 ? '-et-' : '-') + units[10 + u];
      if (t === 8 && u === 0) return 'quatre-vingts';
      return tens[t] + (u === 1 && t < 8 ? '-et-' : (u > 0 ? '-' : '')) + units[u];
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return (h === 1 ? 'cent' : units[h] + ' cent' + (r === 0 && h > 1 ? 's' : '')) + (r > 0 ? ' ' + nombreEnLettres(r) : '');
    }
    if (n < 1000000) {
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? 'mille' : nombreEnLettres(m) + ' mille') + (r > 0 ? ' ' + nombreEnLettres(r) : '');
    }
    if (n < 1000000000) {
      const m = Math.floor(n / 1000000);
      const r = n % 1000000;
      return nombreEnLettres(m) + ' million' + (m > 1 ? 's' : '') + (r > 0 ? ' ' + nombreEnLettres(r) : '');
    }
    return n.toString();
  };

  const loadComptesBancaires = async () => {
    try {
      const res = await api.get('/tresorerie/comptes');
      console.log('Comptes bancaires chargés:', res.data);
      setComptesBancaires(res.data || []);
    } catch (err) {
      console.error('Erreur chargement comptes bancaires:', err);
      setComptesBancaires([]);
    }
  };

  const handleOpenSupplierAvoir = async invoice => {
    try {
      const response = await api.get(`/achats/factures/${invoice.id}`);
      const payload = response.data || response;
      const detail = payload.data || payload;
      const facture = detail.facture || detail;
      const items = detail.items || facture.items || [];
      setSupplierAvoirModal({
        open: true,
        invoice: facture,
        motif: '',
        saving: false,
        lines: items.map(item => ({
          factureAchatItemId: item.id,
          description: item.description,
          quantiteOriginale: Number(item.quantite || 0),
          quantiteRetour: 0,
          stockable: Boolean(item.produitId && item.mouvementStockId),
        })),
      });
    } catch (error) {
      alert(`Impossible de charger les lignes de la facture : ${error.message}`);
    }
  };

  const handleSubmitSupplierAvoir = async () => {
    const items = supplierAvoirModal.lines
      .filter(line => Number(line.quantiteRetour) > 0)
      .map(line => ({ factureAchatItemId: line.factureAchatItemId, quantite: Number(line.quantiteRetour) }));
    if (!items.length) return alert('Indiquez la quantité retournée pour au moins un article.');
    setSupplierAvoirModal(current => ({ ...current, saving: true }));
    try {
      await api.post(`/achats/factures/${supplierAvoirModal.invoice.id}/avoir`, {
        items,
        motif: supplierAvoirModal.motif,
      });
      setSupplierAvoirModal({ open: false, invoice: null, lines: [], motif: '', saving: false });
      await loadData();
      alert('Avoir fournisseur créé. Le stock, le solde fournisseur et la comptabilité ont été mis à jour.');
    } catch (error) {
      setSupplierAvoirModal(current => ({ ...current, saving: false }));
      alert(`Avoir fournisseur non créé : ${error.message}`);
    }
  };

  const loadSupplierInvoiceLines = async invoice => {
    const response = await api.get(`/achats/factures/${invoice.id}`);
    const payload = response.data || response;
    const detail = payload.data || payload;
    const facture = detail.facture || detail;
    return { facture, items: detail.items || facture.items || [] };
  };

  const handleOpenSupplierQualityCredit = async invoice => {
    try {
      const { facture, items } = await loadSupplierInvoiceLines(invoice);
      setSupplierQualityCreditModal({
        open: true,
        invoice: facture,
        motif: '',
        saving: false,
        lines: items.map(item => ({
          factureAchatItemId: item.id,
          description: item.description,
          totalHTOriginal: Number(item.totalLigne || Number(item.quantite || 0) * Number(item.prixUnitaire || 0)),
          montantHT: '',
        })),
      });
    } catch (error) {
      alert(`Impossible de charger la facture fournisseur : ${error.message}`);
    }
  };

  const handleSubmitSupplierQualityCredit = async () => {
    const items = supplierQualityCreditModal.lines
      .filter(line => Number(line.montantHT) > 0)
      .map(line => ({ factureAchatItemId: line.factureAchatItemId, montantHT: Number(line.montantHT) }));
    if (!items.length || !supplierQualityCreditModal.motif.trim()) {
      return alert('Indiquez un montant HT sur au moins une ligne et le motif qualité.');
    }
    setSupplierQualityCreditModal(current => ({ ...current, saving: true }));
    try {
      await api.post(`/achats/factures/${supplierQualityCreditModal.invoice.id}/avoir-qualite`, {
        items,
        motif: supplierQualityCreditModal.motif.trim(),
      });
      setSupplierQualityCreditModal({ open: false, invoice: null, lines: [], motif: '', saving: false });
      await loadAllData();
      alert('Avoir qualité créé. Aucun mouvement de quantité en stock n’a été enregistré.');
    } catch (error) {
      setSupplierQualityCreditModal(current => ({ ...current, saving: false }));
      alert(`Avoir qualité non créé : ${error.message}`);
    }
  };

  const handleSubmitSupplierPayment = async () => {
    const invoice = supplierPaymentModal.invoice;
    const amount = Number(supplierPaymentModal.montant);
    if (!invoice || !Number.isFinite(amount) || amount <= 0) return alert('Saisissez un montant de paiement valide.');
    setSupplierPaymentModal(current => ({ ...current, saving: true }));
    try {
      await api.post(`/achats/factures/${invoice.id}/paiement`, {
        montant: amount,
        modePaiement: supplierPaymentModal.modePaiement,
        datePaiement: supplierPaymentModal.datePaiement,
        reference: supplierPaymentModal.reference,
        notes: supplierPaymentModal.notes,
        compteBancaireId: supplierPaymentModal.compteBancaireId || undefined,
        appliquerEscompte: supplierPaymentModal.appliquerEscompte,
      });
      setSupplierPaymentModal({
        open: false, invoice: null, montant: '', modePaiement: 'virement',
        datePaiement: new Date().toISOString().slice(0, 10), reference: '', notes: '',
        compteBancaireId: '', appliquerEscompte: false, saving: false,
      });
      await loadAllData();
      alert('Paiement fournisseur enregistré.');
    } catch (error) {
      setSupplierPaymentModal(current => ({ ...current, saving: false }));
      alert(`Paiement non enregistré : ${error.message}`);
    }
  };

  const imprimerCheque = () => {
    const fournisseur = data.fournisseurs.find(f => f.id === parseInt(chequeForm.fournisseurId));
    if (!fournisseur) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }
    const compteBancaire = comptesBancaires.find(c => c.id === parseInt(chequeForm.compteBancaireId));
    if (!compteBancaire) {
      alert('Veuillez sélectionner un compte bancaire');
      return;
    }
    const montant = parseFloat(chequeForm.montant) || 0;
    const montantLettres = nombreEnLettres(Math.floor(montant)).toUpperCase() + ' FRANCS CFA';
    const dateCheque = new Date(chequeForm.dateCheque).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chèque N° ${chequeForm.numeroCheque}</title>
        <style>
          @page { size: 200mm 85mm; margin: 0; }
          body { font-family: 'Courier New', monospace; margin: 0; padding: 0; }
          .cheque { 
            width: 200mm; height: 85mm; 
            border: 2px solid #333; 
            position: relative; 
            padding: 10mm;
            box-sizing: border-box;
            background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
          }
          .banque { font-size: 16pt; font-weight: bold; color: #1a5276; margin-bottom: 5mm; }
          .numero-cheque { position: absolute; top: 10mm; right: 15mm; font-size: 12pt; color: #666; }
          .ligne { margin: 4mm 0; display: flex; align-items: baseline; }
          .label { font-size: 9pt; color: #666; width: 25mm; }
          .valeur { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #333; flex: 1; padding-left: 2mm; min-height: 6mm; }
          .montant-chiffres { 
            position: absolute; top: 10mm; right: 15mm; 
            font-size: 14pt; font-weight: bold; 
            border: 2px solid #333; padding: 2mm 5mm;
            background: #fff;
            margin-top: 15mm;
          }
          .montant-lettres { 
            font-size: 10pt; 
            text-transform: uppercase; 
            border: 1px solid #999; 
            padding: 3mm;
            margin: 4mm 0;
            min-height: 12mm;
            background: #fff;
          }
          .signature-zone {
            position: absolute;
            bottom: 10mm;
            right: 15mm;
            text-align: center;
          }
          .signature-ligne { width: 50mm; border-top: 1px solid #333; margin-top: 15mm; }
          .signature-label { font-size: 8pt; color: #666; }
          .memo { font-size: 9pt; color: #666; font-style: italic; margin-top: 5mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="cheque">
          <div class="banque">${compteBancaire.banque || compteBancaire.nomCompte || 'BANQUE'}</div>
          <div style="font-size: 10pt; color: #666;">Compte: ${compteBancaire.numeroCompte || ''}</div>
          <div class="numero-cheque">N° ${chequeForm.numeroCheque || '________'}</div>
          
          <div class="montant-chiffres">
            **${Number(montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF**
          </div>
          
          <div style="margin-top: 20mm;">
            <div class="ligne">
              <span class="label">Payez contre ce chèque à</span>
              <span class="valeur">${fournisseur.nom || ''}</span>
            </div>
            
            <div class="montant-lettres">
              La somme de: ${montantLettres}
            </div>
            
            <div class="ligne">
              <span class="label">À</span>
              <span class="valeur">Lomé, le ${dateCheque}</span>
            </div>
          </div>
          
          ${chequeForm.memo ? `<div class="memo">Mémo: ${chequeForm.memo}</div>` : ''}
          
          <div class="signature-zone">
            <div class="signature-ligne"></div>
            <div class="signature-label">Signature</div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setChequeModal({ open: false });
  };

  const openDrillDown = async (type, title) => {
    setDrillModal({ open: true, title, data: [], loading: true, type });
    try {
      const params = `?dateDebut=${periode.dateDebut}&dateFin=${periode.dateFin}`;
      const result = await api.get(`/fournisseurs/detail/${type}${params}`);
      setDrillModal(prev => ({ ...prev, data: result.data || result || [], loading: false }));
    } catch (error) {
      console.error('Erreur drill-down fournisseurs:', error);
      setDrillModal(prev => ({ ...prev, data: [], loading: false }));
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);


  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fournisseursRes, commandesRes, facturesRes, accountsRes] = await Promise.all([
        api.get('/fournisseurs', { limit: 500 }).catch((error) => {
          console.error('Erreur chargement fournisseurs:', error);
          return null;
        }),
        api.get('/commandes-achat').catch((error) => {
          console.error('Erreur chargement commandes fournisseur:', error);
          return null;
        }),
        api.get('/achats/factures').catch(() => ({ data: [] })),
        api.get('/tresorerie/comptes').catch(() => ({ data: [] })),
      ]);
      setComptesBancaires(readApiList(accountsRes, 'data'));
      setData({
        fournisseurs: readApiList(fournisseursRes, 'data'),
        commandes: readApiList(commandesRes, 'data'),
        receptions: [],
        factures: readApiList(facturesRes, 'data'),
        paiements: [],
        taxes: [
          { id: 1, nom: 'TVA 18%', taux: 18, codeComptable: '4431' },
          { id: 2, nom: 'TVA 9%', taux: 9, codeComptable: '4432' }
        ],
        codesComptables: [
          { id: 1, code: '401', libelle: 'Fournisseurs' },
          { id: 2, code: '4011', libelle: 'Fournisseurs - Achats de biens' },
          { id: 3, code: '4431', libelle: 'TVA facturée' }
        ]
      });
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInvoiceAccountModal = async (invoice) => {
    setInvoiceAccountModal({
      open: true,
      invoice,
      accounts: [],
      selectedId: String(invoice.compteEcartId || ''),
      query: '',
      loading: true,
      saving: false,
      error: '',
    });
    try {
      const response = await api.get('/achats/comptes-ecarts');
      const payload = response.data || response;
      const accounts = payload.accounts || payload.data?.accounts || [];
      setInvoiceAccountModal((current) => ({
        ...current,
        accounts,
        selectedId: String(invoice.compteEcartId || payload.defaultAccountId || ''),
        loading: false,
        error: accounts.length ? '' : 'Aucun compte de charge ou de produit actif n’est disponible.',
      }));
    } catch (error) {
      setInvoiceAccountModal((current) => ({
        ...current,
        loading: false,
        error: error.response?.data?.message || 'Impossible de charger les comptes comptables.',
      }));
    }
  };

  const saveInvoiceAccount = async () => {
    const invoice = invoiceAccountModal.invoice;
    if (!invoice || !invoiceAccountModal.selectedId) {
      setInvoiceAccountModal((current) => ({ ...current, error: 'Choisissez un compte comptable avant de continuer.' }));
      return;
    }
    setInvoiceAccountModal((current) => ({ ...current, saving: true, error: '' }));
    try {
      const endpoint = `/achats/factures/${invoice.id}`;
      const response = invoice.ecritureComptableId
        ? await api.put(`${endpoint}/compte-ecart`, { compteEcartId: Number(invoiceAccountModal.selectedId) })
        : await api.post(`${endpoint}/reprendre-comptabilisation`, { compteEcartId: Number(invoiceAccountModal.selectedId) });
      const payload = response.data || response;
      setInvoiceAccountModal({
        open: false, invoice: null, accounts: [], selectedId: '', query: '',
        loading: false, saving: false, error: '',
      });
      await loadAllData();
      alert(payload.message || 'La mise à jour comptable a été enregistrée.');
    } catch (error) {
      setInvoiceAccountModal((current) => ({
        ...current,
        saving: false,
        error: error.response?.data?.message || 'La mise à jour comptable n’a pas abouti.',
      }));
    }
  };

  const handleConfirmSupplierInvoice = async (invoice) => {
    const confirmed = window.confirm(
      `Confirmer la facture ${invoice.numeroFactureFournisseur || invoice.numeroFacture} ? La dette fournisseur sera comptabilisée. Les réceptions déjà enregistrées ne seront pas ajoutées une seconde fois.`,
    );
    if (!confirmed) return;

    setValidatingInvoiceId(invoice.id);
    try {
      const response = await api.put(`/achats/factures/${invoice.id}/valider`, {});
      const payload = response.data || response;
      await loadAllData();
      alert(payload.message || 'Facture fournisseur confirmée et comptabilisée.');
    } catch (error) {
      alert(error.response?.data?.message || error.message || 'La facture fournisseur n’a pas pu être confirmée.');
    } finally {
      setValidatingInvoiceId(null);
    }
  };

  const openModal = (type, item = null) => {
    setModal({ open: true, type, item });
    if (type === 'fournisseur') {
      setForm(item ? {
        ...item,
        nom: item.nom || item.raisonSociale || '',
        delaiPaiement: item.delaiPaiement ?? 30,
        escomptePourcentage: Number(item.escomptePourcentage || 0),
        delaiEscompte: Number(item.delaiEscompte || 0),
        modesPaiementPreferes: item.modesPaiementPreferes || [],
      } : {
        nom: '', email: '', telephone: '', adresse: '', ville: '', pays: 'Côte d\'Ivoire',
        delaiPaiement: 30, escomptePourcentage: 0, delaiEscompte: 0, modesPaiementPreferes: [], evaluation: 5
      });
    } else if (type === 'commande') {
      setForm(item || {
        fournisseurId: '', dateCommande: new Date().toISOString().split('T')[0],
        dateLivraisonPrevue: '', items: [{ description: '', quantite: 1, prixUnitaire: 0 }]
      });
    } else if (type === 'reception') {
      setForm(item || { commandeId: '', dateReception: new Date().toISOString().split('T')[0], notes: '' });
    } else if (type === 'facture') {
      setForm(item || {
        fournisseurId: '', numeroFactureFournisseur: '', dateFacture: new Date().toISOString().split('T')[0],
        dateEcheance: '', description: 'Facture fournisseur (à détailler)', montantHT: '',
        montantTVA: '', montantTTC: '', notes: ''
      });
    } else if (type === 'paiement') {
      setForm(item || {
        fournisseurId: '', factureId: '', datePaiement: new Date().toISOString().split('T')[0],
        montant: 0, modePaiement: 'virement', reference: '', notes: ''
      });
    } else if (type === 'taxe') {
      setForm(item || { nom: '', taux: 0, codeComptable: '' });
    } else if (type === 'codeComptable') {
      setForm(item || { code: '', libelle: '' });
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
      if (type === 'fournisseur') {
        const fournisseurPayload = {
          ...form,
          raisonSociale: form.raisonSociale || form.nom,
          delaiPaiement: Number(form.delaiPaiement ?? 30),
          escomptePourcentage: Number(form.escomptePourcentage || 0),
          delaiEscompte: Number(form.delaiEscompte || 0),
        };
        delete fournisseurPayload.nom;
        if (item) {
          await api.put(`/fournisseurs/${item.id}`, fournisseurPayload);
        } else {
          await api.post('/fournisseurs', fournisseurPayload);
        }
      } else if (type === 'commande') {
        await api.post('/commandes-achat', form);
      } else if (type === 'reception') {
        await api.post('/receptions', form);
      } else if (type === 'facture') {
        const montantHT = Number(form.montantHT);
        const montantTVA = Number(form.montantTVA || 0);
        const montantTTC = form.montantTTC === '' || form.montantTTC === undefined
          ? montantHT + montantTVA
          : Number(form.montantTTC);
        await api.post('/achats/factures', {
          fournisseurId: Number(form.fournisseurId),
          numeroFactureFournisseur: String(form.numeroFactureFournisseur || '').trim(),
          dateFacture: form.dateFacture,
          dateEcheance: form.dateEcheance || null,
          totalHT: montantHT,
          totalTVA: montantTVA,
          totalTTC: montantTTC,
          items: [{
            description: String(form.description || 'Facture fournisseur').trim(),
            quantite: 1,
            prixUnitaire: montantHT,
            remise: 0
          }],
          notes: form.notes || null
        });
      } else if (type === 'paiement') {
        await api.post('/paiements-fournisseurs', form);
      } else if (type === 'taxe' || type === 'codeComptable') {
        alert('Configuration enregistrée (démo)');
      }
      closeModal();
      loadAllData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const convertirEnFacture = async (commande) => {
    if (!confirm('Convertir cette commande en facture ?')) return;
    try {
      const fournisseur = commande.fournisseur;
      const totalHT = Number(commande.commande?.totalHT || 0);
      const totalTVA = Number(commande.commande?.montantTVA || 0);
      const totalTTC = Number(commande.commande?.totalTTC || (totalHT + totalTVA));
      const factureData = {
        fournisseurId: fournisseur?.id,
        numeroFactureFournisseur: `F-${commande.commande?.numeroCommande}`,
        dateFacture: new Date().toISOString().split('T')[0],
        dateEcheance: new Date(Date.now() + (fournisseur?.delaiPaiement ?? 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        totalHT,
        totalTVA,
        totalTTC,
        items: [{
          description: `Commande ${commande.commande?.numeroCommande || ''}`,
          quantite: 1,
          prixUnitaire: totalHT,
          remise: 0
        }],
        notes: `Brouillon créé depuis la commande ${commande.commande?.numeroCommande || ''}; vérifier la facture fournisseur.`
      };
      await api.post('/achats/factures', factureData);
      alert('Brouillon de facture créé depuis la commande. Vérifiez les montants avant validation.');
      loadAllData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Confirmer la suppression ?')) return;
    try {
      if (type === 'fournisseur') await api.delete(`/fournisseurs/${id}`);
      loadAllData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...(form.items || []), { description: '', quantite: 1, prixUnitaire: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems.length > 0 ? newItems : [{ description: '', quantite: 1, prixUnitaire: 0 }] });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    setForm({ ...form, items: newItems });
  };

  const tabs = [
    { id: 'facturation', label: '📥 Réceptions & factures de stock', icon: '📥' },
    { id: 'factures', label: '🧾 Factures fournisseurs', icon: '🧾' },
    { id: 'paiements', label: '💰 Paiements', icon: '💰' },
    { id: 'etats-compte', label: '📋 États de Compte', icon: '📋' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' },
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' }
  ];

  if (loading) return <div style={{ padding: '20px' }}>Chargement...</div>;

  const totalAchats = data.commandes.reduce((sum, c) => sum + parseFloat(c.commande?.totalHT || 0), 0);
  const totalPaiements = data.paiements.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0);

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>🏭 Gestion Fournisseurs</h2>

      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '25px', 
        borderBottom: '2px solid #e0e0e0',
        flexWrap: 'wrap'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#1976d2' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'parametres' && (
        <div>
          <h3>⚙️ Paramètres</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
            {['fournisseurs', 'taxes', 'codesComptables'].map(tab => (
              <button
                key={tab}
                onClick={() => setSubTab(tab)}
                style={{
                  padding: '10px 18px',
                  border: 'none',
                  background: subTab === tab ? '#3498db' : 'transparent',
                  color: subTab === tab ? 'white' : '#666',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: subTab === tab ? 'bold' : 'normal',
                  fontSize: '13px'
                }}
              >
                {tab === 'fournisseurs' ? '🏭 Fournisseurs' :
                 tab === 'taxes' ? '💰 Taxes' : '📋 Codes Comptables'}
              </button>
            ))}
          </div>

          {subTab === 'fournisseurs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4>🏭 Gestion Fournisseurs</h4>
                <Button onClick={() => openModal('fournisseur')}>+ Nouveau Fournisseur</Button>
              </div>
              <Table
                columns={[
                  {
                    key: 'numeroFournisseur',
                    label: 'ID Fournisseur',
                    render: (value, row) => value || row?.codeAuxiliaire || (row?.id ? `FOU${String(row.id).padStart(5, '0')}` : '-'),
                  },
                  { key: 'raisonSociale', label: 'Nom' },
                  { key: 'email', label: 'Email' },
                  { key: 'telephone', label: 'Téléphone' },
                  { key: 'ville', label: 'Ville' },
                  { key: 'delaiPaiement', label: 'Échéance', render: (val) => Number(val ?? 30) === 0 ? 'À réception' : `${val ?? 30} jours` },
                  { key: 'evaluation', label: 'Évaluation', render: (val) => '⭐'.repeat(val || 3) }
                ]}
                data={data.fournisseurs}
                onRowClick={(item) => { setSelectedFournisseur(item); setShowFournisseurDetails(true); }}
                onEdit={(item) => openModal('fournisseur', item)}
                onDelete={(item) => handleDelete('fournisseur', item.id)}
              />
            </div>
          )}

          {subTab === 'taxes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4>💰 Configuration des Taxes</h4>
                <Button onClick={() => openModal('taxe')}>+ Nouvelle Taxe</Button>
              </div>
              <Table
                columns={[
                  { key: 'nom', label: 'Nom' },
                  { key: 'taux', label: 'Taux (%)', render: (val) => `${val}%` },
                  { key: 'codeComptable', label: 'Code Comptable' }
                ]}
                data={data.taxes}
                onEdit={(item) => openModal('taxe', item)}
                actions={true}
              />
            </div>
          )}

          {subTab === 'codesComptables' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4>📋 Codes Comptables</h4>
                <Button onClick={() => openModal('codeComptable')}>+ Nouveau Code</Button>
              </div>
              <Table
                columns={[
                  { key: 'code', label: 'Code' },
                  { key: 'libelle', label: 'Libellé' }
                ]}
                data={data.codesComptables}
                onEdit={(item) => openModal('codeComptable', item)}
                actions={true}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'facturation' && (
        <FacturationTab fournisseurs={data.fournisseurs} />
      )}

      {activeTab === 'factures' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>🧾 Factures Fournisseurs</h3>
            <Button onClick={() => openModal('facture')}>+ Facture directe hors stock</Button>
          </div>
          <p style={{ marginTop: -10, color: '#64717d', fontSize: 13 }}>
            Utilisez cette saisie pour les services et autres achats sans stock. Pour les marchandises, réceptionnez le bon de commande puis rapprochez la facture dans « Réceptions & factures de stock ».
          </p>
          {data.factures.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px', color: '#52606d' }}>
              Aucune facture fournisseur enregistrée.
            </div>
          ) : (
            <Table
              columns={[
                { key: 'numeroFacture', label: 'N° Compta' },
                { key: 'numeroFactureFournisseur', label: 'N° fournisseur' },
                { key: 'fournisseur', label: 'Fournisseur', render: value => value?.nom || '—' },
                { key: 'dateFacture', label: 'Date' },
                { key: 'totalHT', label: 'HT', render: value => `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { key: 'totalTVA', label: 'TVA', render: value => `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { key: 'totalTTC', label: 'TTC', render: value => `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { key: 'statut', label: 'Statut', render: value => value === 'brouillon' ? 'Brouillon — à vérifier' : value },
                {
                  key: 'compteEcart',
                  label: 'Compte d’écart',
                  render: (value, row) => value
                    ? `${value.numero} — ${value.nom}`
                    : row.hasStockPending && !row.ecritureComptableId ? 'Comptabilisation à reprendre' : '—',
                }
              ]}
              data={data.factures}
              actions={true}
              customActions={facture => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {facture.statut === 'brouillon'
                      && (!facture.hasStockPending || facture.ecritureComptableId)
                      && (
                      <Button
                        size="small"
                        variant="success"
                        disabled={validatingInvoiceId === facture.id}
                        onClick={() => handleConfirmSupplierInvoice(facture)}
                      >
                        {validatingInvoiceId === facture.id ? 'Confirmation…' : 'Confirmer la facture'}
                      </Button>
                    )}
                    {facture.statut === 'brouillon' && facture.hasStockPending && !facture.ecritureComptableId && (
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => openInvoiceAccountModal(facture)}
                      >
                        Reprendre l’écriture
                      </Button>
                    )}
                    {facture.statut === 'brouillon' && facture.ecritureComptableId && facture.compteEcartId && (
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => openInvoiceAccountModal(facture)}
                      >
                        Modifier le compte
                      </Button>
                    )}
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={['brouillon', 'annulee'].includes(String(facture.statut).toLowerCase())}
                    onClick={() => handleOpenSupplierAvoir(facture)}
                  >
                    ↩ Retour
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={['brouillon', 'annulee'].includes(String(facture.statut).toLowerCase())}
                    onClick={() => handleOpenSupplierQualityCredit(facture)}
                  >
                    Avoir qualité
                  </Button>
                  {Number(facture.soldeRestant || 0) > 0 && !['brouillon', 'annulee'].includes(String(facture.statut).toLowerCase()) && (
                    <Button
                      size="small"
                      variant="success"
                      onClick={() => setSupplierPaymentModal({
                        open: true,
                        invoice: facture,
                        montant: facture.soldeRestant,
                        modePaiement: 'virement',
                        datePaiement: new Date().toISOString().slice(0, 10),
                        reference: '',
                        notes: '',
                        compteBancaireId: '',
                        appliquerEscompte: false,
                        saving: false,
                      })}
                    >
                      Payer
                    </Button>
                  )}
                </div>
              )}
            />
          )}
          {invoiceAccountModal.open && (
            <Modal
              isOpen={invoiceAccountModal.open}
              onClose={() => !invoiceAccountModal.saving && setInvoiceAccountModal({
                open: false, invoice: null, accounts: [], selectedId: '', query: '',
                loading: false, saving: false, error: '',
              })}
              title={invoiceAccountModal.invoice?.ecritureComptableId
                ? 'Modifier le compte d’écart'
                : 'Reprendre la comptabilisation'}
              size="medium"
            >
              <p>
                Facture {invoiceAccountModal.invoice?.numeroFacture || ''}. Choisissez le compte à utiliser pour l’écart de prix.
              </p>
              {invoiceAccountModal.loading ? (
                <p>Chargement des comptes…</p>
              ) : (
                <>
                  {invoiceAccountModal.selectedId && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 12, marginBottom: 12, background: '#edf7ef', borderRadius: 6 }}>
                      <span>
                        Compte choisi : {(() => {
                          const account = invoiceAccountModal.accounts.find(
                            item => String(item.id) === String(invoiceAccountModal.selectedId),
                          );
                          return account ? `${account.numero} — ${account.nom}` : 'compte non disponible';
                        })()}
                      </span>
                      <Button
                        type="button"
                        size="small"
                        variant="secondary"
                        onClick={() => setInvoiceAccountModal(current => ({ ...current, selectedId: '', query: '' }))}
                      >
                        Choisir un autre compte
                      </Button>
                    </div>
                  )}
                  <label htmlFor="invoice-variance-account-search" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
                    Rechercher un compte de charge ou de produit
                  </label>
                  <input
                    id="invoice-variance-account-search"
                    type="search"
                    value={invoiceAccountModal.query}
                    onChange={event => setInvoiceAccountModal(current => ({ ...current, query: event.target.value }))}
                    placeholder="Code ou nom du compte"
                    autoComplete="off"
                    style={{ width: '100%', boxSizing: 'border-box', padding: 10, marginBottom: 8 }}
                  />
                  {invoiceAccountModal.query.trim() && (
                    <div role="listbox" aria-label="Comptes disponibles" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #d8dee5', borderRadius: 6 }}>
                      {invoiceAccountModal.accounts
                        .filter(account => `${account.numero} ${account.nom}`.toLowerCase().includes(invoiceAccountModal.query.trim().toLowerCase()))
                        .slice(0, 20)
                        .map(account => (
                          <button
                            key={account.id}
                            type="button"
                            role="option"
                            aria-selected={String(account.id) === String(invoiceAccountModal.selectedId)}
                            onClick={() => setInvoiceAccountModal(current => ({
                              ...current,
                              selectedId: String(account.id),
                              query: '',
                              error: '',
                            }))}
                            style={{ display: 'block', width: '100%', padding: 10, textAlign: 'left', border: 0, borderBottom: '1px solid #edf0f3', background: '#fff', cursor: 'pointer' }}
                          >
                            {account.numero} — {account.nom}
                          </button>
                        ))}
                      {!invoiceAccountModal.accounts.some(account => `${account.numero} ${account.nom}`.toLowerCase().includes(invoiceAccountModal.query.trim().toLowerCase())) && (
                        <p style={{ padding: '8px 10px', margin: 0, color: '#687585' }}>Aucun compte correspondant.</p>
                      )}
                    </div>
                  )}
                </>
              )}
              {invoiceAccountModal.error && (
                <p role="alert" style={{ color: '#a33434', marginTop: 12 }}>{invoiceAccountModal.error}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <Button
                  variant="secondary"
                  disabled={invoiceAccountModal.saving}
                  onClick={() => setInvoiceAccountModal({
                    open: false, invoice: null, accounts: [], selectedId: '', query: '',
                    loading: false, saving: false, error: '',
                  })}
                >
                  Annuler
                </Button>
                <Button
                  variant="success"
                  disabled={invoiceAccountModal.loading || invoiceAccountModal.saving || !invoiceAccountModal.selectedId}
                  onClick={saveInvoiceAccount}
                >
                  {invoiceAccountModal.saving
                    ? 'Enregistrement…'
                    : invoiceAccountModal.invoice?.ecritureComptableId
                      ? 'Enregistrer le compte'
                      : 'Reprendre l’écriture'}
                </Button>
              </div>
            </Modal>
          )}
          {supplierAvoirModal.open && (
            <Modal
              isOpen={supplierAvoirModal.open}
              onClose={() => !supplierAvoirModal.saving && setSupplierAvoirModal({ open: false, invoice: null, lines: [], motif: '', saving: false })}
              title={`Retour / avoir fournisseur — ${supplierAvoirModal.invoice?.numeroFacture || ''}`}
              size="large"
            >
              <p>Le coût de stock sorti est calculé à partir de la valeur actuelle du stock. Le fournisseur est crédité du montant de la facture retournée.</p>
              {supplierAvoirModal.lines.map(line => (
                <div key={line.factureAchatItemId} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 130px 150px', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <span>{line.description}{!line.stockable ? ' — stock d’origine indisponible' : ''}</span>
                  <span>Facturé : {line.quantiteOriginale}</span>
                  <NumberInput
                    min="0"
                    max={line.quantiteOriginale}
                    step="0.001"
                    value={line.quantiteRetour}
                    disabled={!line.stockable || supplierAvoirModal.saving}
                    onChange={event => setSupplierAvoirModal(current => ({
                      ...current,
                      lines: current.lines.map(item => item.factureAchatItemId === line.factureAchatItemId
                        ? { ...item, quantiteRetour: event.target.value }
                        : item),
                    }))}
                    aria-label={`Quantité retournée : ${line.description}`}
                  />
                </div>
              ))}
              <label style={{ display: 'block', margin: '16px 0 6px', fontWeight: 600 }}>Motif du retour</label>
              <textarea
                value={supplierAvoirModal.motif}
                onChange={event => setSupplierAvoirModal(current => ({ ...current, motif: event.target.value }))}
                rows={3}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Button variant="secondary" disabled={supplierAvoirModal.saving} onClick={() => setSupplierAvoirModal({ open: false, invoice: null, lines: [], motif: '', saving: false })}>Annuler</Button>
                <Button variant="success" disabled={supplierAvoirModal.saving} onClick={handleSubmitSupplierAvoir}>{supplierAvoirModal.saving ? 'Création…' : 'Créer l’avoir'}</Button>
              </div>
            </Modal>
          )}
          {supplierQualityCreditModal.open && (
            <Modal
              isOpen={supplierQualityCreditModal.open}
              onClose={() => !supplierQualityCreditModal.saving && setSupplierQualityCreditModal({ open: false, invoice: null, lines: [], motif: '', saving: false })}
              title={`Avoir fournisseur — ajustement qualité`}
              size="large"
            >
              <p>En cas de défaut ou de baisse de qualité sans retour physique, indiquez le crédit HT par ligne. La quantité en stock ne change pas; le coût des articles encore en stock est corrigé, et le reste est imputé en ajustement de coût.</p>
              {supplierQualityCreditModal.lines.map(line => (
                <div key={line.factureAchatItemId} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 140px 160px', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <span>{line.description}</span>
                  <span>HT d’origine : {Number(line.totalHTOriginal).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</span>
                  <NumberInput
                    min="0"
                    max={line.totalHTOriginal}
                    step="0.01"
                    value={line.montantHT}
                    disabled={supplierQualityCreditModal.saving}
                    onChange={event => setSupplierQualityCreditModal(current => ({
                      ...current,
                      lines: current.lines.map(item => item.factureAchatItemId === line.factureAchatItemId
                        ? { ...item, montantHT: event.target.value }
                        : item),
                    }))}
                    aria-label={`Ajustement HT : ${line.description}`}
                  />
                </div>
              ))}
              <label style={{ display: 'block', margin: '16px 0 6px', fontWeight: 600 }}>Motif de qualité</label>
              <textarea
                value={supplierQualityCreditModal.motif}
                onChange={event => setSupplierQualityCreditModal(current => ({ ...current, motif: event.target.value }))}
                rows={3}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Button variant="secondary" disabled={supplierQualityCreditModal.saving} onClick={() => setSupplierQualityCreditModal({ open: false, invoice: null, lines: [], motif: '', saving: false })}>Annuler</Button>
                <Button variant="success" disabled={supplierQualityCreditModal.saving} onClick={handleSubmitSupplierQualityCredit}>{supplierQualityCreditModal.saving ? 'Création…' : 'Créer l’avoir qualité'}</Button>
              </div>
            </Modal>
          )}
          {supplierPaymentModal.open && (
            <Modal
              isOpen={supplierPaymentModal.open}
              onClose={() => !supplierPaymentModal.saving && setSupplierPaymentModal(current => ({ ...current, open: false }))}
              title={`Règlement fournisseur — ${supplierPaymentModal.invoice?.numeroFacture || ''}`}
              size="medium"
            >
              <p>Solde restant : {Number(supplierPaymentModal.invoice?.soldeRestant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF.</p>
              {(() => {
                const discount = getCashDiscountPreview(supplierPaymentModal.invoice, supplierPaymentModal.datePaiement);
                if (!discount) return null;
                return (
                  <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, marginBottom: 14, border: '1px solid #c8dfcf', borderRadius: 8, background: '#f1faf3' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(supplierPaymentModal.appliquerEscompte)}
                      onChange={event => setSupplierPaymentModal(current => ({
                        ...current,
                        appliquerEscompte: event.target.checked,
                        montant: event.target.checked ? discount.netTTC : (current.invoice?.soldeRestant ?? ''),
                      }))}
                    />
                    <span>
                      Escompte de règlement {Number(supplierPaymentModal.invoice.escomptePourcentage).toLocaleString('fr-FR')} % : {discount.discountHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF sur le HT. TVA inchangée : {discount.invoiceTVA.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF; la facture reste inchangée. Montant à régler : <strong>{discount.netTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong>.
                    </span>
                  </label>
                );
              })()}
              <FormField
                label="Date du règlement"
                type="date"
                value={supplierPaymentModal.datePaiement}
                onChange={event => {
                  const datePaiement = event.target.value;
                  const discount = getCashDiscountPreview(supplierPaymentModal.invoice, datePaiement);
                  setSupplierPaymentModal(current => ({
                    ...current,
                    datePaiement,
                    appliquerEscompte: current.appliquerEscompte && Boolean(discount),
                    montant: current.appliquerEscompte && discount ? discount.netTTC : (current.invoice?.soldeRestant ?? ''),
                  }));
                }}
                required
              />
              <FormField
                label="Mode de paiement"
                type="select"
                value={supplierPaymentModal.modePaiement}
                onChange={event => setSupplierPaymentModal(current => ({ ...current, modePaiement: event.target.value }))}
                options={[
                  { value: 'virement', label: 'Virement' },
                  { value: 'cheque', label: 'Chèque' },
                  { value: 'especes', label: 'Espèces' },
                  { value: 'mobile_money', label: 'Mobile Money' },
                ]}
                required
              />
              {!['especes', 'cheque'].includes(supplierPaymentModal.modePaiement) && (
                <FormField
                  label="Compte de trésorerie"
                  type="select"
                  value={supplierPaymentModal.compteBancaireId}
                  onChange={event => setSupplierPaymentModal(current => ({ ...current, compteBancaireId: event.target.value }))}
                  options={[
                    { value: '', label: '-- Sélectionner un compte --' },
                    ...comptesBancaires.map(account => ({
                      value: account.id,
                      label: `${account.nomCompte || account.banque || 'Compte'}${account.numeroCompte ? ` — ${account.numeroCompte}` : ''}`,
                    })),
                  ]}
                  required
                />
              )}
              <FormField
                label="Montant à payer"
                type="number"
                min="0.01"
                step="0.01"
                value={supplierPaymentModal.montant}
                onChange={event => setSupplierPaymentModal(current => ({ ...current, montant: event.target.value, appliquerEscompte: false }))}
                required
              />
              <FormField
                label="Référence du paiement"
                value={supplierPaymentModal.reference}
                onChange={event => setSupplierPaymentModal(current => ({ ...current, reference: event.target.value }))}
                required={supplierPaymentModal.modePaiement === 'cheque'}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <Button variant="secondary" disabled={supplierPaymentModal.saving} onClick={() => setSupplierPaymentModal(current => ({ ...current, open: false }))}>Annuler</Button>
                <Button variant="success" disabled={supplierPaymentModal.saving} onClick={handleSubmitSupplierPayment}>{supplierPaymentModal.saving ? 'Enregistrement…' : 'Enregistrer le règlement'}</Button>
              </div>
            </Modal>
          )}
          <p style={{ marginTop: 12, color: '#52606d', fontSize: 13 }}>
            Les factures importées sont enregistrées en brouillon. Elles ne créent pas d’écriture comptable ni de mouvement de stock à ce stade.
          </p>
        </div>
      )}

      {activeTab === 'paiements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>💰 Paiements Fournisseurs</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button 
                onClick={async () => {
                  setChequeForm({
                    fournisseurId: '',
                    montant: 0,
                    numeroCheque: '',
                    dateCheque: new Date().toISOString().split('T')[0],
                    compteBancaireId: '',
                    memo: ''
                  });
                  await loadComptesBancaires();
                  setChequeModal({ open: true });
                }}
                style={{ backgroundColor: '#9b59b6' }}
              >
                🖨️ Imprimer Chèque
              </Button>
              <Button onClick={() => openModal('paiement')}>+ Nouveau Paiement</Button>
            </div>
          </div>
          <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#7f8c8d', margin: 0 }}>Aucun paiement enregistré</p>
          </div>
        </div>
      )}

      {activeTab === 'etats-compte' && <EtatsCompteFournisseurTab />}

      {activeTab === 'rapports' && (
        <div>
          <ReportPageHeader
            title="Rapports fournisseurs"
            description="Suivi des achats, règlements et soldes sur la période choisie"
          >
            <PeriodFilter
              dateDebut={periode.dateDebut}
              dateFin={periode.dateFin}
              onDateDebutChange={(val) => setPeriode((current) => ({ ...current, dateDebut: val }))}
              onDateFinChange={(val) => setPeriode((current) => ({ ...current, dateFin: val }))}
              onApply={loadAllData}
              compactSelector={true}
              ariaLabel="Période du rapport fournisseur"
            />
            <div style={{ display: 'flex', gap: '10px' }} className="no-print">
              <button 
                onClick={() => {
                  const content = document.getElementById('fournisseur-rapport-content');
                  const printWindow = window.open('', '_blank');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Rapport Fournisseurs - ComptaOrion</title>
                        <style>
                          body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
                          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                          th { background-color: #f5f5f5; }
                          h3, h4 { color: #333; margin-top: 20px; }
                          @media print { body { margin: 0; } }
                        </style>
                      </head>
                      <body>
                        <h2>Rapport Fournisseurs</h2>
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
                  const content = document.getElementById('fournisseur-rapport-content');
                  const htmlContent = `
                    <html>
                      <head><meta charset="utf-8"><title>Rapport Fournisseurs</title>
                        <style>body { font-family: Arial; margin: 20px; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px; } th { background: #f5f5f5; }</style>
                      </head>
                      <body>
                        <h2>Rapport Fournisseurs</h2>
                        <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                        ${content.innerHTML}
                      </body>
                    </html>
                  `;
                  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Rapport_Fournisseurs_${periode.dateDebut}_${periode.dateFin}.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                ⬇️ Télécharger
              </button>
            </div>
          </ReportPageHeader>
          
          <div id="fournisseur-rapport-content">

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div 
              onClick={() => openDrillDown('fournisseurs', 'Liste des fournisseurs')}
              style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL FOURNISSEURS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{data.fournisseurs.length}</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>Cliquer pour détails</p>
            </div>
            <div 
              onClick={() => openDrillDown('achats', 'Détail des achats')}
              style={{ padding: '20px', background: '#fff3e0', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL ACHATS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#f57c00' }}>{totalAchats.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>Cliquer pour détails</p>
            </div>
            <div 
              onClick={() => openDrillDown('paiements', 'Détail des paiements')}
              style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PAIEMENTS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{totalPaiements.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>Cliquer pour détails</p>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>📋 Rapport par Fournisseur</h4>
            <Table
              columns={[
                { key: 'nom', label: 'Fournisseur' },
                { key: 'nbCommandes', label: 'Nb Commandes', render: (_, row) => 
                  data.commandes.filter(c => c.fournisseur?.id === row.id).length 
                },
                { key: 'totalAchats', label: 'Total Achats', render: (_, row) => {
                  const total = data.commandes
                    .filter(c => c.fournisseur?.id === row.id)
                    .reduce((sum, c) => sum + parseFloat(c.commande?.totalHT || 0), 0);
                  return `${Number(total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`;
                }},
                { key: 'evaluation', label: 'Évaluation', render: (val) => '⭐'.repeat(val || 3) }
              ]}
              data={data.fournisseurs}
              actions={false}
            />
          </div>

          <RapportsClotureComptable periode={periode} fournisseurs={data.fournisseurs} />
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={
          modal.type === 'fournisseur' ? (modal.item ? 'Modifier Fournisseur' : 'Nouveau Fournisseur') :
          modal.type === 'commande' ? 'Nouvelle Commande d\'Achat' :
          modal.type === 'reception' ? 'Nouvelle Réception' :
          modal.type === 'facture' ? (modal.item ? 'Modifier une facture fournisseur' : 'Facture directe hors stock') :
          modal.type === 'paiement' ? 'Nouveau Paiement' :
          modal.type === 'taxe' ? (modal.item ? 'Modifier Taxe' : 'Nouvelle Taxe') :
          modal.type === 'codeComptable' ? (modal.item ? 'Modifier Code' : 'Nouveau Code Comptable') : ''
        }
        size={modal.type === 'commande' || modal.type === 'facture' ? 'xlarge' : 'large'}
      >
        <form onSubmit={handleSubmit}>
          {modal.type === 'fournisseur' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Nom" name="nom" value={form.nom} 
                  onChange={(e) => setForm({...form, nom: e.target.value})} required />
                <FormField label="Email" name="email" type="email" value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})} />
                <FormField label="Téléphone" name="telephone" value={form.telephone}
                  onChange={(e) => setForm({...form, telephone: e.target.value})} />
                <FormField label="Adresse" name="adresse" value={form.adresse}
                  onChange={(e) => setForm({...form, adresse: e.target.value})} />
                <FormField label="Ville" name="ville" value={form.ville}
                  onChange={(e) => setForm({...form, ville: e.target.value})} />
                <FormField label="Pays" name="pays" value={form.pays}
                  onChange={(e) => setForm({...form, pays: e.target.value})} />
                <FormField label="Échéance de paiement" name="delaiPaiement" type="select" value={form.delaiPaiement ?? 30}
                  onChange={(e) => setForm({...form, delaiPaiement: Number(e.target.value)})}
                  options={[
                    { value: 0, label: 'À réception' },
                    { value: 15, label: '15 jours' },
                    { value: 30, label: '30 jours' },
                    { value: 60, label: '60 jours' },
                  ]} />
                <FormField
                  label="Escompte de caisse (%)"
                  name="escomptePourcentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.escomptePourcentage ?? 0}
                  onChange={(e) => {
                    const escomptePourcentage = Number(e.target.value) || 0;
                    setForm({
                      ...form,
                      escomptePourcentage,
                      delaiEscompte: escomptePourcentage > 0
                        ? Math.min(Number(form.delaiEscompte || 15), Math.max(0, Number(form.delaiPaiement || 0) - 1))
                        : 0,
                    });
                  }}
                />
                <FormField
                  label="Délai d’escompte (jours)"
                  name="delaiEscompte"
                  type="number"
                  min="0"
                  max={Math.max(0, Number(form.delaiPaiement || 0) - 1)}
                  step="1"
                  value={form.delaiEscompte ?? 0}
                  onChange={(e) => setForm({ ...form, delaiEscompte: Number(e.target.value) || 0 })}
                />
                <FormField label="Évaluation (1-5)" name="evaluation" type="number" value={form.evaluation}
                  onChange={(e) => setForm({...form, evaluation: parseInt(e.target.value)})} />
              </div>
              <p style={{ marginTop: 0, color: '#64748b', fontSize: 12 }}>
                Exemple : 1 % si le règlement est effectué sous 15 jours; sinon, paiement à l’échéance nette.
              </p>
              <div style={{ marginTop: '15px' }}>
                <strong>Modes de paiement préférés</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                  {[
                    ['virement', 'Virement'],
                    ['cheque', 'Chèque'],
                    ['mobile_money', 'Mobile Money'],
                    ['especes', 'Espèces'],
                    ['credit', 'Achat à crédit'],
                  ].map(([value, label]) => (
                    <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={(form.modesPaiementPreferes || []).includes(value)}
                        onChange={(e) => {
                          const current = form.modesPaiementPreferes || [];
                          setForm({
                            ...form,
                            modesPaiementPreferes: e.target.checked
                              ? [...current, value]
                              : current.filter(mode => mode !== value),
                          });
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'commande' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <FormField label="Fournisseur" name="fournisseurId" type="select" value={form.fournisseurId}
                  onChange={(e) => {
                    const fournisseurId = e.target.value;
                    const supplier = data.fournisseurs.find((item) => Number(item.id) === Number(fournisseurId));
                    setForm((current) => ({
                      ...current,
                      fournisseurId,
                      dateEcheance: supplier
                        ? addDaysToIsoDate(current.dateFacture, supplier.delaiPaiement ?? 30)
                        : '',
                    }));
                  }}
                  options={data.fournisseurs.map(f => ({ value: f.id, label: f.nom || f.raisonSociale }))} required />
                <FormField label="Date Commande" name="dateCommande" type="date" value={form.dateCommande}
                  onChange={(e) => setForm({...form, dateCommande: e.target.value})} required />
                <FormField label="Date Livraison Prévue" name="dateLivraisonPrevue" type="date" value={form.dateLivraisonPrevue}
                  onChange={(e) => setForm({...form, dateLivraisonPrevue: e.target.value})} />
              </div>
              <h4>Articles</h4>
              {(form.items || []).map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
                  <FormField label="Description" value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)} required />
                  <FormField label="Quantité" type="number" value={item.quantite}
                    onChange={(e) => updateItem(index, 'quantite', parseFloat(e.target.value))} required />
                  <FormField label="Prix Unitaire" type="number" value={item.prixUnitaire}
                    onChange={(e) => updateItem(index, 'prixUnitaire', parseFloat(e.target.value))} required />
                  <Button type="button" variant="danger" size="small" onClick={() => removeItem(index)}
                    disabled={form.items.length === 1}>×</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="small" onClick={addItem}>+ Ajouter un article</Button>
              
              <h4 style={{ marginTop: '20px' }}>Coûts Logistiques Estimés</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
                <FormField label="Transport" type="number" value={form.coutsLogistiques?.transport || 0}
                  onChange={(e) => setForm({...form, coutsLogistiques: {...(form.coutsLogistiques || {}), transport: parseFloat(e.target.value) || 0}})} />
                <FormField label="Douane" type="number" value={form.coutsLogistiques?.douane || 0}
                  onChange={(e) => setForm({...form, coutsLogistiques: {...(form.coutsLogistiques || {}), douane: parseFloat(e.target.value) || 0}})} />
                <FormField label="Manutention" type="number" value={form.coutsLogistiques?.manutention || 0}
                  onChange={(e) => setForm({...form, coutsLogistiques: {...(form.coutsLogistiques || {}), manutention: parseFloat(e.target.value) || 0}})} />
                <FormField label="Assurance" type="number" value={form.coutsLogistiques?.assurance || 0}
                  onChange={(e) => setForm({...form, coutsLogistiques: {...(form.coutsLogistiques || {}), assurance: parseFloat(e.target.value) || 0}})} />
                <FormField label="Autres" type="number" value={form.coutsLogistiques?.autre || 0}
                  onChange={(e) => setForm({...form, coutsLogistiques: {...(form.coutsLogistiques || {}), autre: parseFloat(e.target.value) || 0}})} />
              </div>
              <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Articles: <strong>{(form.items || []).reduce((sum, i) => sum + (parseFloat(i.quantite || 0) * parseFloat(i.prixUnitaire || 0)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></span>
                <span>Total Logistique: <strong>{Object.values(form.coutsLogistiques || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></span>
                <span>Total Commande: <strong>{((form.items || []).reduce((sum, i) => sum + (parseFloat(i.quantite || 0) * parseFloat(i.prixUnitaire || 0)), 0) + Object.values(form.coutsLogistiques || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</strong></span>
              </div>
              
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Créer Commande</Button>
              </div>
            </>
          )}

          {modal.type === 'reception' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Commande" name="commandeId" type="select" value={form.commandeId}
                  onChange={(e) => setForm({...form, commandeId: e.target.value})}
                  options={data.commandes.map(c => ({ value: c.commande?.id, label: c.commande?.numeroCommande || 'Commande' }))} required />
                <FormField label="Date Réception" name="dateReception" type="date" value={form.dateReception}
                  onChange={(e) => setForm({...form, dateReception: e.target.value})} required />
              </div>
              <FormField label="Notes" name="notes" value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})} />
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Enregistrer</Button>
              </div>
            </>
          )}

          {modal.type === 'facture' && (
            <>
              <div style={{ marginBottom: 16, padding: 12, color: '#315f78', background: '#eef6fa', borderRadius: 8 }}>
                Saisie directe réservée aux services et achats sans stock. Pour une marchandise, créez un bon de commande, réceptionnez-la, puis rapprochez sa facture avec les réceptions.
              </div>
              {!modal.item && (
                <SupplierInvoiceOcr
                  onExtract={(extracted) => setForm(current => {
                    const montantHT = extracted.montantHT == null ? current.montantHT : String(extracted.montantHT);
                    const montantTVA = extracted.montantTVA == null ? current.montantTVA : String(extracted.montantTVA);
                    return {
                      ...current,
                      numeroFactureFournisseur: extracted.numeroFactureFournisseur || current.numeroFactureFournisseur,
                      dateFacture: extracted.dateFacture || current.dateFacture,
                      montantHT,
                      montantTVA,
                      montantTTC: extracted.montantTTC == null
                        ? (montantHT !== '' && montantTVA !== '' ? String(Number(montantHT) + Number(montantTVA)) : current.montantTTC)
                        : String(extracted.montantTTC)
                    };
                  })}
                />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Fournisseur" name="fournisseurId" type="select" value={form.fournisseurId}
                  onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                  options={data.fournisseurs.map(f => ({ value: f.id, label: f.nom || f.raisonSociale }))} required />
                <FormField label="N° facture fournisseur" name="numeroFactureFournisseur" value={form.numeroFactureFournisseur}
                  onChange={(e) => setForm({...form, numeroFactureFournisseur: e.target.value})} required />
                <FormField label="Date Facture" name="dateFacture" type="date" value={form.dateFacture}
                  onChange={(e) => {
                    const dateFacture = e.target.value;
                    const supplier = data.fournisseurs.find((item) => Number(item.id) === Number(form.fournisseurId));
                    setForm((current) => ({
                      ...current,
                      dateFacture,
                      dateEcheance: supplier
                        ? addDaysToIsoDate(dateFacture, supplier.delaiPaiement ?? 30)
                        : '',
                    }));
                  }} required />
                <FormField label="Date Échéance (automatique)" name="dateEcheance" type="date" value={form.dateEcheance}
                  disabled />
                <FormField label="Montant HT (XOF)" name="montantHT" type="number" value={form.montantHT}
                  onChange={(e) => {
                    const montantHT = e.target.value;
                    setForm(current => ({
                      ...current,
                      montantHT,
                      montantTTC: montantHT !== '' && current.montantTVA !== ''
                        ? String(Number(montantHT) + Number(current.montantTVA))
                        : current.montantTTC
                    }));
                  }} required />
                <FormField label="Montant TVA (XOF)" name="montantTVA" type="number" value={form.montantTVA}
                  onChange={(e) => {
                    const montantTVA = e.target.value;
                    setForm(current => ({
                      ...current,
                      montantTVA,
                      montantTTC: montantTVA !== '' && current.montantHT !== ''
                        ? String(Number(current.montantHT) + Number(montantTVA))
                        : current.montantTTC
                    }));
                  }} />
                <FormField label="Montant TTC (XOF)" name="montantTTC" type="number" value={form.montantTTC}
                  onChange={(e) => setForm({...form, montantTTC: e.target.value})} required />
              </div>
              <FormField label="Libellé résumé de la facture" name="description" value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})} required />
              <FormField label="Notes" name="notes" value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})} />
              <p style={{ color: '#52606d', fontSize: 13 }}>
                Vérifiez les montants extraits. L’échéance est calculée automatiquement selon le délai du fournisseur.
                La facture sera enregistrée comme brouillon, sans envoi de la photo ni écriture automatique.
              </p>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Enregistrer le brouillon</Button>
              </div>
            </>
          )}

          {modal.type === 'paiement' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                {(() => {
                  const fournisseursAvecFacturesImpayees = data.fournisseurs.filter(f => 
                    data.factures.some(fact => fact.fournisseurId == f.id && fact.statut !== 'payee')
                  );
                  return (
                    <FormField label="1️⃣ Sélectionner le Fournisseur (avec factures impayées)" name="fournisseurId" type="select" value={form.fournisseurId}
                  onChange={(e) => {
                    const fournisseur = data.fournisseurs.find(item => String(item.id) === e.target.value);
                    const preferred = (fournisseur?.modesPaiementPreferes || []).find(mode =>
                      ['virement', 'cheque', 'especes', 'mobile_money', 'carte_bancaire'].includes(mode)
                    );
                    setForm({
                      ...form,
                      fournisseurId: e.target.value,
                      factureId: '',
                      montant: 0,
                      modePaiement: preferred === 'carte_bancaire' ? 'carte' : preferred || 'virement',
                    });
                  }}
                      options={[
                        { value: '', label: fournisseursAvecFacturesImpayees.length > 0 ? '-- Choisir un fournisseur --' : '-- Aucun fournisseur avec facture impayée --' },
                        ...fournisseursAvecFacturesImpayees.map(f => {
                          const facturesImpayees = data.factures.filter(fact => fact.fournisseurId == f.id && fact.statut !== 'payee');
                          const montantTotal = facturesImpayees.reduce((sum, fact) => sum + parseFloat(fact.montantTotal || fact.montantHT || 0), 0);
                          return { 
                            value: f.id, 
                            label: `${f.nom || f.raisonSociale} (${facturesImpayees.length} facture${facturesImpayees.length > 1 ? 's' : ''} - ${Number(montantTotal || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF)`
                          };
                        })
                      ]} required />
                  );
                })()}
                
                {form.fournisseurId && (
                  <FormField label="2️⃣ Sélectionner la Facture à Payer" name="factureId" type="select" value={form.factureId}
                    onChange={(e) => {
                      const facture = data.factures
                        .filter(f => f.fournisseurId == form.fournisseurId && f.statut !== 'payee')
                        .find(f => f.id === e.target.value);
                      setForm({...form, factureId: e.target.value, montant: facture?.montantTotal || facture?.montantHT || 0});
                    }}
                    options={data.factures
                      .filter(f => f.fournisseurId == form.fournisseurId && f.statut !== 'payee')
                      .sort((a, b) => new Date(a.dateFacture) - new Date(b.dateFacture))
                      .map(f => ({ 
                        value: f.id, 
                        label: `${f.numeroFacture || 'Facture'} - ${new Date(f.dateFacture).toLocaleDateString('fr-FR')} - ${f.montantTotal || f.montantHT || 0} XOF`
                      }))}
                    required />
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <FormField label="Montant" name="montant" type="number" value={form.montant}
                    onChange={(e) => setForm({...form, montant: parseFloat(e.target.value)})} required />
                  <FormField label="Date Paiement" name="datePaiement" type="date" value={form.datePaiement}
                    onChange={(e) => setForm({...form, datePaiement: e.target.value})} required />
                  <FormField label="Mode de Paiement" name="modePaiement" type="select" value={form.modePaiement}
                    onChange={(e) => setForm({...form, modePaiement: e.target.value})}
                      options={[
                      { value: 'virement', label: 'Virement' },
                      { value: 'cheque', label: 'Chèque' },
                      { value: 'especes', label: 'Espèces' },
                        { value: 'carte', label: 'Carte Bancaire' },
                        { value: 'mobile_money', label: 'Mobile Money' },
                    ]} required />
                  <FormField label="Référence" name="reference" value={form.reference}
                    onChange={(e) => setForm({...form, reference: e.target.value})} />
                </div>
              </div>
              <FormField label="Notes" name="notes" value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})} />
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Enregistrer</Button>
              </div>
            </>
          )}

          {modal.type === 'taxe' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Nom de la Taxe" name="nom" value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})} required
                  placeholder="Ex: TVA 18%" />
                <FormField label="Taux (%)" name="taux" type="number" value={form.taux}
                  onChange={(e) => setForm({...form, taux: parseFloat(e.target.value)})} required
                  placeholder="Ex: 18" />
                <FormField label="Code Comptable" name="codeComptable" value={form.codeComptable}
                  onChange={(e) => setForm({...form, codeComptable: e.target.value})}
                  placeholder="Ex: 4431" />
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'codeComptable' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                <FormField label="Code" name="code" value={form.code}
                  onChange={(e) => setForm({...form, code: e.target.value})} required
                  placeholder="Ex: 401" />
                <FormField label="Libellé" name="libelle" value={form.libelle}
                  onChange={(e) => setForm({...form, libelle: e.target.value})} required
                  placeholder="Ex: Fournisseurs" />
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* MODAL DE DÉTAILS FOURNISSEUR */}
      {selectedFournisseur && (
        <DetailsModal
          isOpen={showFournisseurDetails}
          onClose={() => { setShowFournisseurDetails(false); setSelectedFournisseur(null); }}
          title={`Détails Fournisseur - ${selectedFournisseur.nom || selectedFournisseur.raisonSociale}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'N° Fournisseur', value: selectedFournisseur.numeroFournisseur || selectedFournisseur.codeAuxiliaire || `FOU${String(selectedFournisseur.id).padStart(5, '0')}` },
                { label: 'Nom', value: selectedFournisseur.nom || selectedFournisseur.raisonSociale },
                { label: 'Email', value: selectedFournisseur.email || '-' },
                { label: 'Téléphone', value: selectedFournisseur.telephone || '-' }
              ]
            },
            {
              title: 'Adresse',
              fields: [
                { label: 'Adresse', value: selectedFournisseur.adresse || '-' },
                { label: 'Ville', value: selectedFournisseur.ville || '-' },
                { label: 'Pays', value: selectedFournisseur.pays || '-' }
              ]
            },
            {
              title: 'Paramètres',
              fields: [
                { label: 'Échéance', value: Number(selectedFournisseur.delaiPaiement ?? 30) === 0 ? 'À réception' : `${selectedFournisseur.delaiPaiement ?? 30} jours` },
                { label: 'Évaluation', value: '⭐'.repeat(selectedFournisseur.evaluation || 3) }
              ]
            }
          ]}
          actions={[
            {
              label: '✏️ Modifier',
              variant: 'info',
              onClick: () => {
                setShowFournisseurDetails(false);
                openModal('fournisseur', selectedFournisseur);
              }
            }
          ]}
        />
      )}

      {/* MODAL DE DÉTAILS COMMANDE */}
      {selectedCommande && (
        <DetailsModal
          isOpen={showCommandeDetails}
          onClose={() => { setShowCommandeDetails(false); setSelectedCommande(null); }}
          title={`Détails Commande ${selectedCommande.commande?.numeroCommande || ''}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'N° Commande', value: selectedCommande.commande?.numeroCommande },
                { label: 'Fournisseur', value: selectedCommande.fournisseur?.nom || '-' },
                { label: 'Date Commande', value: selectedCommande.commande?.dateCommande?.split('T')[0] },
                { label: 'Livraison Prévue', value: selectedCommande.commande?.dateLivraisonPrevue?.split('T')[0] || '-' },
                { label: 'Statut', value: selectedCommande.commande?.statut }
              ]
            },
            {
              title: 'Totaux',
              fields: [
                { label: 'Total HT', value: `${Number(selectedCommande.commande?.totalHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { label: 'TVA', value: `${Number(selectedCommande.commande?.montantTVA || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
                { label: 'Total TTC', value: `${Number(selectedCommande.commande?.totalTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` }
              ]
            }
          ]}
          tables={selectedCommande.commande?.items ? [{
            title: 'Articles',
            columns: [
              { key: 'description', label: 'Description' },
              { key: 'quantite', label: 'Qté', align: 'center' },
              { key: 'prixUnitaire', label: 'P.U.', align: 'right', render: (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF` },
              { key: 'total', label: 'Total', align: 'right', render: (val, row) => 
                `${((row.quantite || 0) * (row.prixUnitaire || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF`
              }
            ],
            data: selectedCommande.commande.items
          }] : []}
          actions={[
            {
              label: '🧾 Convertir en Facture',
              variant: 'success',
              onClick: () => {
                setShowCommandeDetails(false);
                convertirEnFacture(selectedCommande);
              }
            }
          ]}
        />
      )}

      {/* Modal Drill-Down */}
      {drillModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '900px',
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{drillModal.title}</h3>
              <button onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false, type: null })} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666'
              }}>&times;</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {drillModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
              ) : drillModal.data?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Aucune donnée pour cette période</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      {drillModal.type === 'fournisseurs' ? (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Raison Sociale</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Email</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Téléphone</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Catégorie</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
                        </>
                      ) : drillModal.type === 'achats' ? (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>N° Commande</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Fournisseur</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Montant HT</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Fournisseur</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Mode</th>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Référence</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Montant</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {drillModal.data?.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        {drillModal.type === 'fournisseurs' ? (
                          <>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.nom}</td>
                            <td style={{ padding: '10px' }}>{item.email || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.telephone || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.categorie || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '12px',
                                backgroundColor: item.actif ? '#e8f5e9' : '#ffebee',
                                color: item.actif ? '#2e7d32' : '#c62828'
                              }}>
                                {item.actif ? 'Actif' : 'Inactif'}
                              </span>
                            </td>
                          </>
                        ) : drillModal.type === 'achats' ? (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.numero}</td>
                            <td style={{ padding: '10px' }}>{item.fournisseur || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#f57c00' }}>{Number(item.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{item.statut || '-'}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.fournisseur || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.modePaiement || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.reference || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#388e3c' }}>{Number(item.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {drillModal.type !== 'fournisseurs' && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                        <td colSpan={3} style={{ padding: '12px' }}>TOTAL</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {Number(drillModal.data?.reduce((sum, item) => sum + parseFloat(item.montant || 0), 0) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '13px' }}>{drillModal.data?.length || 0} élément(s)</span>
              <Button variant="secondary" onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false, type: null })}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Impression Chèque */}
      {chequeModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '500px',
            maxHeight: '80vh', overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#9b59b6', color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>🖨️ Imprimer un Chèque</h3>
              <button onClick={() => setChequeModal({ open: false })} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'white'
              }}>&times;</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Fournisseur (Bénéficiaire) *</label>
                <select
                  value={chequeForm.fournisseurId}
                  onChange={(e) => setChequeForm({...chequeForm, fournisseurId: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                >
                  <option value="">-- Sélectionner --</option>
                  {data.fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.nom || f.raisonSociale}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Montant (XOF) *</label>
                <NumberInput
                  value={chequeForm.montant}
                  onChange={(e) => setChequeForm({...chequeForm, montant: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="0"
                />
                {chequeForm.montant > 0 && (
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                    {nombreEnLettres(Math.floor(parseFloat(chequeForm.montant) || 0)).toUpperCase()} FRANCS CFA
                  </p>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>N° Chèque</label>
                  <input
                    type="text"
                    value={chequeForm.numeroCheque}
                    onChange={(e) => setChequeForm({...chequeForm, numeroCheque: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                    placeholder="Ex: 0001234"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Date du Chèque</label>
                  <input
                    type="date"
                    value={chequeForm.dateCheque}
                    onChange={(e) => setChequeForm({...chequeForm, dateCheque: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Compte Bancaire *</label>
                {comptesBancaires.filter(c => c.type === 'banque').length === 0 ? (
                  <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '4px', color: '#856404', fontSize: '14px' }}>
                    Aucun compte bancaire configuré. Veuillez d'abord ajouter un compte de type "banque" dans le module Trésorerie.
                  </div>
                ) : (
                  <select
                    value={chequeForm.compteBancaireId}
                    onChange={(e) => setChequeForm({...chequeForm, compteBancaireId: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  >
                    <option value="">-- Sélectionner un compte --</option>
                    {comptesBancaires.filter(c => c.type === 'banque').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.banque || c.nomCompte} - {c.numeroCompte || 'N/A'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Mémo (optionnel)</label>
                <input
                  type="text"
                  value={chequeForm.memo}
                  onChange={(e) => setChequeForm({...chequeForm, memo: e.target.value})}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="Ex: Facture N° FA-2024-001"
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setChequeModal({ open: false })}>
                  Annuler
                </Button>
                <Button 
                  onClick={imprimerCheque}
                  style={{ backgroundColor: '#9b59b6' }}
                  disabled={!chequeForm.fournisseurId || !chequeForm.montant || !chequeForm.compteBancaireId}
                >
                  🖨️ Imprimer le Chèque
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EtatsCompteFournisseurTab() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState('');
  const [periode, setPeriode] = useState({
    dateDebut: getPeriodeDates('annee').dateDebut,
    dateFin: getPeriodeDates('annee').dateFin
  });
  const [etatCompte, setEtatCompte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadFournisseurs();
  }, []);

  const loadFournisseurs = async () => {
    try {
      const res = await api.get('/fournisseurs');
      setFournisseurs(res.data || []);
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
    }
  };

  const genererEtatCompte = async () => {
    if (!selectedFournisseurId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/fournisseurs/etat-compte', {
        fournisseurId: selectedFournisseurId,
        dateDebut: periode.dateDebut,
        dateFin: periode.dateFin
      });
      setEtatCompte(res.data);
    } catch (error) {
      alert('Erreur lors de la génération: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const envoyerParEmail = async () => {
    if (!etatCompte) return;

    const fournisseur = fournisseurs.find(f => f.id == selectedFournisseurId);
    if (!fournisseur?.email) {
      alert('Ce fournisseur n\'a pas d\'adresse email configurée');
      return;
    }

    setSending(true);
    try {
      await api.post('/fournisseurs/etat-compte/email', {
        fournisseurId: selectedFournisseurId,
        dateDebut: periode.dateDebut,
        dateFin: periode.dateFin
      });
      alert(`État de compte envoyé à ${fournisseur.email} avec succès!`);
    } catch (error) {
      alert('Erreur lors de l\'envoi: ' + error.message);
    } finally {
      setSending(false);
    }
  };

    const getFournisseurNumber = (fournisseur) =>
      fournisseur?.numeroFournisseur || fournisseur?.codeAuxiliaire || (fournisseur?.id ? `FOU${String(fournisseur.id).padStart(5, '0')}` : '-');
    const selectedFournisseur = fournisseurs.find(f => getFournisseurNumber(f) === String(selectedFournisseurId));

  const imprimerEtatCompte = () => {
    if (!etatCompte || !selectedFournisseur) return;

    const mouvementsRows = (etatCompte.mouvements || []).map(m => {
      const amount = value => Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const type = m.libelle || (m.type === 'facture_fournisseur' ? 'Facture fournisseur' : m.type === 'paiement_fournisseur' ? 'Règlement' : m.type);
      return '<tr><td>' + new Date(`${m.date}T00:00:00`).toLocaleDateString('fr-FR') + '</td><td>' + type + '</td><td>' + (m.reference || '-') + '</td><td class="text-right">' + amount(m.debit) + ' XOF</td><td class="text-right">' + amount(m.credit) + ' XOF</td><td class="text-right amount">' + amount(m.solde) + ' XOF</td></tr>';
    }).join('');
    const mouvementsTable = mouvementsRows
      ? '<table><thead><tr><th>Date</th><th>Opération</th><th>Référence</th><th class="text-right">Débit</th><th class="text-right">Crédit</th><th class="text-right">Solde dû</th></tr></thead><tbody>' + mouvementsRows + '</tbody></table>'
      : '<div class="no-data">Aucune opération sur cette période</div>';

    const printWindow = window.open('', '_blank');
    const printContent = '<!DOCTYPE html><html><head><title>État de Compte Fournisseur - ' + selectedFournisseur.raisonSociale + '</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: "Segoe UI", Arial, sans-serif; padding: 30px; color: #333; } .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1976d2; } .header h1 { color: #1976d2; font-size: 24px; margin-bottom: 15px; } .fournisseur-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; } .fournisseur-info h3 { margin-bottom: 10px; color: #1976d2; } .fournisseur-info p { margin: 5px 0; font-size: 13px; } .periode { color: #666; font-style: italic; margin-top: 10px; } .summary { display: flex; justify-content: space-between; margin-bottom: 30px; } .summary-box { flex: 1; padding: 15px; margin: 0 10px; border-radius: 8px; text-align: center; } .summary-box:first-child { margin-left: 0; } .summary-box:last-child { margin-right: 0; } .summary-box.facture { background: #e3f2fd; } .summary-box.paye { background: #e8f5e9; } .summary-box.solde { background: #fff3e0; } .summary-box .label { color: #666; font-size: 12px; margin-bottom: 5px; } .summary-box .value { font-size: 20px; font-weight: bold; } .summary-box.facture .value { color: #1976d2; } .summary-box.paye .value { color: #388e3c; } .summary-box.solde .value { color: #e65100; } .section { margin-bottom: 25px; } .section h3 { margin-bottom: 15px; color: #333; font-size: 16px; } table { width: 100%; border-collapse: collapse; } th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; } td { padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 12px; } .text-right { text-align: right; } .text-center { text-align: center; } .amount { font-weight: bold; } .status { padding: 3px 8px; border-radius: 4px; font-size: 11px; } .status-payee { background: #d4edda; color: #155724; } .status-validee { background: #fff3cd; color: #856404; } .status-brouillon { background: #e2e3e5; color: #383d41; } .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; } .no-data { color: #999; font-style: italic; padding: 20px; text-align: center; } @media print { body { padding: 15px; } }</style></head><body>' +
      '<div class="header"><h1>ÉTAT DE COMPTE FOURNISSEUR</h1></div>' +
      '<div class="fournisseur-info"><h3>' + selectedFournisseur.raisonSociale + '</h3>' +
      '<p><strong>N° Fournisseur:</strong> ' + getFournisseurNumber(selectedFournisseur) + '</p>' +
      (selectedFournisseur.adresse ? '<p><strong>Adresse:</strong> ' + selectedFournisseur.adresse + '</p>' : '') +
      (selectedFournisseur.email ? '<p><strong>Email:</strong> ' + selectedFournisseur.email + '</p>' : '') +
      (selectedFournisseur.telephone ? '<p><strong>Téléphone:</strong> ' + selectedFournisseur.telephone + '</p>' : '') +
      '<p class="periode"><strong>Période:</strong> ' + formatPeriodeFR(periode.dateDebut, periode.dateFin) + '</p></div>' +
      '<div class="summary"><div class="summary-box facture"><div class="label">Solde d’ouverture</div><div class="value">' + Number(etatCompte.soldeOuverture || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' XOF</div></div>' +
      '<div class="summary-box facture"><div class="label">Factures période</div><div class="value">' + Number(etatCompte.totalFacture || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' XOF</div></div>' +
      '<div class="summary-box paye"><div class="label">Règlements période</div><div class="value">' + Number(etatCompte.totalPaye || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' XOF</div></div>' +
      '<div class="summary-box solde"><div class="label">Solde de clôture</div><div class="value">' + Number(etatCompte.soldeCloture ?? etatCompte.solde ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' XOF</div></div></div>' +
      '<div class="section"><h3>Grand livre auxiliaire fournisseur</h3>' + mouvementsTable + '</div>' +
      '<div class="footer"><p>Document généré le ' + new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR') + '</p><p>ComptaOrion - Système de Gestion Comptable</p></div>' +
      '</body></html>';

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return (
    <div>
      <h3>📋 États de Compte Fournisseur</h3>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <FormField
            label="Fournisseur"
            type="select"
            value={selectedFournisseurId}
            onChange={(e) => {
              setSelectedFournisseurId(e.target.value);
              setEtatCompte(null);
            }}
            options={[
              { value: '', label: '-- Sélectionner un fournisseur --' },
               ...fournisseurs.map(f => {
                 const numero = getFournisseurNumber(f);
                 return { value: numero, label: `${numero} — ${f.raisonSociale || f.nom}` };
               })
            ]}
          />
          <FormField
            label="Date Début"
            type="date"
            value={periode.dateDebut}
            onChange={(e) => {
              setPeriode({ ...periode, dateDebut: e.target.value });
              setEtatCompte(null);
            }}
          />
          <FormField
            label="Date Fin"
            type="date"
            value={periode.dateFin}
            onChange={(e) => {
              setPeriode({ ...periode, dateFin: e.target.value });
              setEtatCompte(null);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button onClick={genererEtatCompte} disabled={loading || !selectedFournisseurId}>
            {loading ? '⏳ Génération...' : '📄 Générer État de Compte'}
          </Button>
          {etatCompte && (
            <Button variant="secondary" onClick={imprimerEtatCompte}>
              🖨️ Imprimer / PDF
            </Button>
          )}
          {etatCompte && selectedFournisseur?.email && (
            <Button variant="success" onClick={envoyerParEmail} disabled={sending}>
              {sending ? '📧 Envoi...' : `📧 Envoyer à ${selectedFournisseur.email}`}
            </Button>
          )}
        </div>
      </div>

      {etatCompte && (
        <div style={{ 
          backgroundColor: 'white', 
          padding: '30px', 
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #1976d2', paddingBottom: '20px' }}>
            <h2 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>ÉTAT DE COMPTE FOURNISSEUR</h2>
          </div>

          <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>{selectedFournisseur?.raisonSociale}</h3>
            <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>N° Fournisseur:</strong> {getFournisseurNumber(selectedFournisseur)}</p>
            {selectedFournisseur?.adresse && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Adresse:</strong> {selectedFournisseur.adresse}</p>}
            {selectedFournisseur?.email && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Email:</strong> {selectedFournisseur.email}</p>}
            {selectedFournisseur?.telephone && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Téléphone:</strong> {selectedFournisseur.telephone}</p>}
            <p style={{ margin: '10px 0 0 0', fontSize: '14px', fontStyle: 'italic', color: '#666' }}>
              <strong>Période:</strong> {formatPeriodeFR(periode.dateDebut, periode.dateFin)}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
            <div style={{ padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Solde d’ouverture</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {Number(etatCompte.soldeOuverture || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#eef4fb', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Factures de la période</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {Number(etatCompte.totalFacture || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#e8f8f0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Règlements de la période</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                {Number(etatCompte.totalPaye || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Solde de clôture</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: etatCompte.solde > 0 ? '#e74c3c' : '#27ae60' }}>
                {Number(etatCompte.soldeCloture ?? etatCompte.solde ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF
              </p>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '15px', color: '#333' }}>Grand livre auxiliaire fournisseur</h4>
            {etatCompte.mouvements && etatCompte.mouvements.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Opération</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Référence</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Débit</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Crédit</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Solde dû</th>
                  </tr>
                </thead>
                <tbody>
                  {etatCompte.mouvements.map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{new Date(`${m.date}T00:00:00`).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px' }}>{m.libelle || (m.type === 'facture_fournisseur' ? 'Facture fournisseur' : m.type === 'paiement_fournisseur' ? 'Règlement' : m.type)}</td>
                      <td style={{ padding: '12px' }}>{m.reference || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{Number(m.debit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{Number(m.credit || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{Number(m.solde || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XOF</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Aucune opération sur cette période</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
