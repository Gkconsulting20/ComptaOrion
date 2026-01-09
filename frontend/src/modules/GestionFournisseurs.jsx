import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { DetailsModal } from '../components/DetailsModal';
import PeriodFilter, { getPeriodeDates } from '../components/PeriodFilter';
import api from '../api';
import { getInvoiceStatusDisplay, InvoiceStatusBadge } from '../utils/invoiceStatus';

function FacturationTab({ fournisseurs }) {
  const [subTab, setSubTab] = useState('stock');
  const [stockPending, setStockPending] = useState({ items: [], totaux: {}, parFournisseur: [] });
  const [logistiquePending, setLogistiquePending] = useState({ items: [], totaux: {}, parType: [], parFournisseur: [] });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ fournisseurId: '', dateDebut: '', dateFin: '' });
  
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [receptionsEnAttente, setReceptionsEnAttente] = useState([]);
  const [selectedReceptions, setSelectedReceptions] = useState([]);
  const [produits, setProduits] = useState([]);
  const [factureForm, setFactureForm] = useState({
    fournisseurId: '',
    numeroFactureFournisseur: '',
    dateFacture: new Date().toISOString().split('T')[0],
    dateEcheance: '',
    lignes: [],
    coutsLogistiques: [],
    notes: ''
  });
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

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
      setStockPending(stockRes.data || { items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending(logRes.data || { items: [], totaux: {}, parType: [], parFournisseur: [] });
      setProduits(produitsRes.data || []);
    } catch (err) {
      console.error('Erreur chargement données:', err);
      setStockPending({ items: [], totaux: {}, parFournisseur: [] });
      setLogistiquePending({ items: [], totaux: {}, parType: [], parFournisseur: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filters]);

  const typeLabels = { transport: 'Transport', douane: 'Douane', manutention: 'Manutention', assurance: 'Assurance', autre: 'Autres' };

  const openFactureModal = () => {
    setShowFactureModal(true);
    setStep(1);
    setSelectedReceptions([]);
    setFactureForm({
      fournisseurId: '',
      numeroFactureFournisseur: '',
      dateFacture: new Date().toISOString().split('T')[0],
      dateEcheance: '',
      lignes: [],
      coutsLogistiques: [],
      notes: ''
    });
  };

  const loadReceptionsForFournisseur = async (fournisseurId) => {
    if (!fournisseurId) {
      setReceptionsEnAttente([]);
      return;
    }
    try {
      const res = await api.get(`/achats/receptions-en-attente?fournisseurId=${fournisseurId}`);
      setReceptionsEnAttente(res.data.data || []);
    } catch (err) {
      console.error('Erreur chargement réceptions:', err);
    }
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
        lignes.push({
          produitId: l.produit_id,
          produitNom: produits.find(p => p.id === l.produit_id)?.nom || `Produit ${l.produit_id}`,
          quantite: parseFloat(l.quantite_recue),
          prixEstime: parseFloat(l.prix_unitaire_estime || 0),
          prixUnitaireReel: parseFloat(l.prix_unitaire_estime || 0),
          description: produits.find(p => p.id === l.produit_id)?.nom || `Article réception ${rec.numero}`
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
    return { totalArticles, totalLogistique, totalHT: totalArticles + totalLogistique };
  };

  const submitFacture = async () => {
    setSubmitting(true);
    try {
      const payload = {
        fournisseurId: factureForm.fournisseurId,
        numeroFactureFournisseur: factureForm.numeroFactureFournisseur,
        dateFacture: factureForm.dateFacture,
        dateEcheance: factureForm.dateEcheance || null,
        receptionsIds: selectedReceptions,
        lignes: factureForm.lignes.map(l => ({
          produitId: l.produitId,
          quantite: l.quantite,
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
      
      await api.post('/achats/factures-avec-rapprochement', payload);
      alert('Facture créée avec succès !');
      setShowFactureModal(false);
      loadData();
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>📄 Créer Facture depuis Réceptions</h3>
          <p style={{ color: '#7f8c8d', margin: '5px 0 0 0' }}>
            Convertir les stocks et coûts logistiques non facturés en facture fournisseur.
          </p>
        </div>
        <Button onClick={openFactureModal} variant="success">+ Créer Facture Fournisseur</Button>
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

      {showFactureModal && (
        <Modal isOpen={true} onClose={() => setShowFactureModal(false)} title="Créer Facture Fournisseur avec Rapprochement" size="xlarge">
          {step === 1 && (
            <div>
              <h4>Étape 1: Sélectionner le fournisseur et les réceptions</h4>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fournisseur *</label>
                <select 
                  value={factureForm.fournisseurId} 
                  onChange={(e) => {
                    setFactureForm(prev => ({ ...prev, fournisseurId: e.target.value }));
                    loadReceptionsForFournisseur(e.target.value);
                    setSelectedReceptions([]);
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <option value="">-- Sélectionner un fournisseur --</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom || f.raisonSociale}</option>)}
                </select>
              </div>

              {factureForm.fournisseurId && (
                <div>
                  <h5>Réceptions en attente de facturation ({receptionsEnAttente.length})</h5>
                  {receptionsEnAttente.length === 0 ? (
                    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                      Aucune réception en attente pour ce fournisseur
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
                            <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{parseFloat(rec.total_ht || 0).toLocaleString('fr-FR')} FCFA</span>
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
                  <label style={{ display: 'block', marginBottom: '5px' }}>N° Facture Fournisseur *</label>
                  <input type="text" value={factureForm.numeroFactureFournisseur}
                    onChange={(e) => setFactureForm(prev => ({ ...prev, numeroFactureFournisseur: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date Facture *</label>
                  <input type="date" value={factureForm.dateFacture}
                    onChange={(e) => setFactureForm(prev => ({ ...prev, dateFacture: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Date Échéance</label>
                  <input type="date" value={factureForm.dateEcheance}
                    onChange={(e) => setFactureForm(prev => ({ ...prev, dateEcheance: e.target.value }))}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
                </div>
              </div>

              <h5>Articles ({factureForm.lignes.length})</h5>
              <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Produit</th>
                      <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '100px' }}>Quantité</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '120px' }}>Prix Estimé</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '150px' }}>Prix Réel *</th>
                      <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd', width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factureForm.lignes.map((ligne, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>{ligne.produitNom || ligne.description}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{ligne.quantite}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#999' }}>{ligne.prixEstime.toLocaleString('fr-FR')}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <input type="number" value={ligne.prixUnitaireReel}
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
                              <input type="number" value={cout.montantReel}
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

              <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Articles:</span>
                  <strong>{totals.totalArticles.toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Logistique:</span>
                  <strong>{totals.totalLogistique.toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #4caf50', paddingTop: '10px' }}>
                  <span style={{ fontSize: '18px' }}>Total HT:</span>
                  <strong style={{ fontSize: '18px', color: '#2e7d32' }}>{totals.totalHT.toLocaleString('fr-FR')} FCFA</strong>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Notes</label>
                <textarea value={factureForm.notes}
                  onChange={(e) => setFactureForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setStep(1)}>← Retour</Button>
                <Button variant="success" onClick={submitFacture} disabled={submitting || !factureForm.numeroFactureFournisseur}>
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
                <h3 style={{ margin: '5px 0 0', color: '#d32f2f' }}>{Math.round(stockNonFacture.totaux?.valeur || 0).toLocaleString('fr-FR')} FCFA</h3>
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
                  { key: 'valeur', label: 'Montant Total', render: (v) => `${Math.round(parseFloat(v || 0)).toLocaleString('fr-FR')} FCFA` }
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
              { key: 'prix_unitaire_estime', label: 'P.U.', render: (v) => `${Math.round(parseFloat(v || 0)).toLocaleString('fr-FR')}` },
              { key: 'valeur_estimee', label: 'Montant', render: (v) => `${Math.round(parseFloat(v || 0)).toLocaleString('fr-FR')} FCFA` },
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
                <h3 style={{ margin: '5px 0 0', color: '#d32f2f' }}>{Math.round(logistiqueNonFacturee.totaux?.montant || 0).toLocaleString('fr-FR')} FCFA</h3>
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
                    <span style={{ fontWeight: 'bold' }}>{typeLabels[t.type] || t.type}:</span> {Math.round(parseFloat(t.montant || 0)).toLocaleString('fr-FR')} FCFA
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
                  { key: 'montant', label: 'Montant Total', render: (v) => `${Math.round(parseFloat(v || 0)).toLocaleString('fr-FR')} FCFA` }
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
              { key: 'montant_estime', label: 'Montant', render: (v) => `${Math.round(parseFloat(v || 0)).toLocaleString('fr-FR')} FCFA` },
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
            **${montant.toLocaleString('fr-FR')} FCFA**
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
      const [fournisseursRes, commandesRes, facturesRes] = await Promise.all([
        api.get('/fournisseurs'),
        api.get('/commandes-achat'),
        api.get('/factures-fournisseurs').catch(() => ({ data: [] }))
      ]);
      setData({
        fournisseurs: fournisseursRes.data || [],
        commandes: commandesRes.data || [],
        receptions: [],
        factures: facturesRes.data || [],
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

  const openModal = (type, item = null) => {
    setModal({ open: true, type, item });
    if (type === 'fournisseur') {
      setForm(item || {
        nom: '', email: '', telephone: '', adresse: '', ville: '', pays: 'Côte d\'Ivoire',
        delaiPaiement: 30, evaluation: 5
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
        fournisseurId: '', numeroFacture: '', dateFacture: new Date().toISOString().split('T')[0],
        dateEcheance: '', montantHT: 0, tva: 0, notes: ''
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
        if (item) {
          await api.put(`/fournisseurs/${item.id}`, form);
        } else {
          await api.post('/fournisseurs', form);
        }
      } else if (type === 'commande') {
        await api.post('/commandes-achat', form);
      } else if (type === 'reception') {
        await api.post('/receptions', form);
      } else if (type === 'facture') {
        await api.post('/factures-fournisseurs', form);
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
      const factureData = {
        fournisseurId: fournisseur?.id,
        numeroFacture: `F-${commande.commande?.numeroCommande}`,
        dateFacture: new Date().toISOString().split('T')[0],
        dateEcheance: new Date(Date.now() + (fournisseur?.delaiPaiement || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        montantHT: commande.commande?.totalHT || 0,
        tva: 18,
        notes: `Facture générée depuis commande ${commande.commande?.numeroCommande}`
      };
      await api.post('/factures-fournisseurs', factureData);
      alert('Commande convertie en facture avec succès!');
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
    { id: 'facturation', label: '📄 Facturation', icon: '📄' },
    { id: 'factures', label: '🧾 Factures', icon: '🧾' },
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
                  { key: 'numeroFournisseur', label: 'N° Fournisseur' },
                  { key: 'nom', label: 'Nom' },
                  { key: 'email', label: 'Email' },
                  { key: 'telephone', label: 'Téléphone' },
                  { key: 'ville', label: 'Ville' },
                  { key: 'delaiPaiement', label: 'Échéance', render: (val) => `${val || 30} jours` },
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
            <Button onClick={() => openModal('facture')}>+ Nouvelle Facture</Button>
          </div>
          <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune facture enregistrée</p>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>📊 Rapports Fournisseurs</h3>
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
          </div>
          
          <div id="fournisseur-rapport-content">

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
                onClick={loadAllData}
                style={{ fontWeight: 'bold', padding: '10px 20px' }}
              >
                Générer
              </Button>
            </div>
          </div>

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
              <h2 style={{ margin: '10px 0 0 0', color: '#f57c00' }}>{totalAchats.toLocaleString('fr-FR')} FCFA</h2>
              <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>Cliquer pour détails</p>
            </div>
            <div 
              onClick={() => openDrillDown('paiements', 'Détail des paiements')}
              style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PAIEMENTS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{totalPaiements.toLocaleString('fr-FR')} FCFA</h2>
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
                  return `${total.toLocaleString('fr-FR')} FCFA`;
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
          modal.type === 'facture' ? 'Nouvelle Facture Fournisseur' :
          modal.type === 'paiement' ? 'Nouveau Paiement' :
          modal.type === 'taxe' ? (modal.item ? 'Modifier Taxe' : 'Nouvelle Taxe') :
          modal.type === 'codeComptable' ? (modal.item ? 'Modifier Code' : 'Nouveau Code Comptable') : ''
        }
        size={modal.type === 'commande' ? 'xlarge' : 'large'}
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
                <FormField label="Délai de paiement (jours)" name="delaiPaiement" type="number" value={form.delaiPaiement}
                  onChange={(e) => setForm({...form, delaiPaiement: parseInt(e.target.value)})} />
                <FormField label="Évaluation (1-5)" name="evaluation" type="number" value={form.evaluation}
                  onChange={(e) => setForm({...form, evaluation: parseInt(e.target.value)})} />
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
                  onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                  options={data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))} required />
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
                <span>Total Articles: <strong>{(form.items || []).reduce((sum, i) => sum + (parseFloat(i.quantite || 0) * parseFloat(i.prixUnitaire || 0)), 0).toLocaleString('fr-FR')} FCFA</strong></span>
                <span>Total Logistique: <strong>{Object.values(form.coutsLogistiques || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0).toLocaleString('fr-FR')} FCFA</strong></span>
                <span>Total Commande: <strong>{((form.items || []).reduce((sum, i) => sum + (parseFloat(i.quantite || 0) * parseFloat(i.prixUnitaire || 0)), 0) + Object.values(form.coutsLogistiques || {}).reduce((sum, v) => sum + (parseFloat(v) || 0), 0)).toLocaleString('fr-FR')} FCFA</strong></span>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Fournisseur" name="fournisseurId" type="select" value={form.fournisseurId}
                  onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                  options={data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))} required />
                <FormField label="N° Facture" name="numeroFacture" value={form.numeroFacture}
                  onChange={(e) => setForm({...form, numeroFacture: e.target.value})} required />
                <FormField label="Date Facture" name="dateFacture" type="date" value={form.dateFacture}
                  onChange={(e) => setForm({...form, dateFacture: e.target.value})} required />
                <FormField label="Date Échéance" name="dateEcheance" type="date" value={form.dateEcheance}
                  onChange={(e) => setForm({...form, dateEcheance: e.target.value})} />
                <FormField label="Montant HT" name="montantHT" type="number" value={form.montantHT}
                  onChange={(e) => setForm({...form, montantHT: parseFloat(e.target.value)})} required />
                <FormField label="TVA (%)" name="tva" type="number" value={form.tva}
                  onChange={(e) => setForm({...form, tva: parseFloat(e.target.value)})} />
              </div>
              <FormField label="Notes" name="notes" value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})} />
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Enregistrer</Button>
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
                      onChange={(e) => setForm({...form, fournisseurId: e.target.value, factureId: '', montant: 0})}
                      options={[
                        { value: '', label: fournisseursAvecFacturesImpayees.length > 0 ? '-- Choisir un fournisseur --' : '-- Aucun fournisseur avec facture impayée --' },
                        ...fournisseursAvecFacturesImpayees.map(f => {
                          const facturesImpayees = data.factures.filter(fact => fact.fournisseurId == f.id && fact.statut !== 'payee');
                          const montantTotal = facturesImpayees.reduce((sum, fact) => sum + parseFloat(fact.montantTotal || fact.montantHT || 0), 0);
                          return { 
                            value: f.id, 
                            label: `${f.nom} (${facturesImpayees.length} facture${facturesImpayees.length > 1 ? 's' : ''} - ${montantTotal.toLocaleString('fr-FR')} FCFA)` 
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
                        label: `${f.numeroFacture || 'Facture'} - ${new Date(f.dateFacture).toLocaleDateString('fr-FR')} - ${f.montantTotal || f.montantHT || 0} FCFA` 
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
                      { value: 'carte', label: 'Carte Bancaire' }
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
          title={`Détails Fournisseur - ${selectedFournisseur.nom}`}
          sections={[
            {
              title: 'Informations Générales',
              fields: [
                { label: 'N° Fournisseur', value: selectedFournisseur.numeroFournisseur },
                { label: 'Nom', value: selectedFournisseur.nom },
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
                { label: 'Délai Paiement', value: `${selectedFournisseur.delaiPaiement || 30} jours` },
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
                { label: 'Total HT', value: `${Math.round(parseFloat(selectedCommande.commande?.totalHT || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'TVA', value: `${Math.round(parseFloat(selectedCommande.commande?.montantTVA || 0)).toLocaleString('fr-FR')} FCFA` },
                { label: 'Total TTC', value: `${Math.round(parseFloat(selectedCommande.commande?.totalTTC || 0)).toLocaleString('fr-FR')} FCFA` }
              ]
            }
          ]}
          tables={selectedCommande.commande?.items ? [{
            title: 'Articles',
            columns: [
              { key: 'description', label: 'Description' },
              { key: 'quantite', label: 'Qté', align: 'center' },
              { key: 'prixUnitaire', label: 'P.U.', align: 'right', render: (val) => `${Math.round(parseFloat(val || 0)).toLocaleString('fr-FR')} FCFA` },
              { key: 'total', label: 'Total', align: 'right', render: (val, row) => 
                `${Math.round((row.quantite || 0) * (row.prixUnitaire || 0)).toLocaleString('fr-FR')} FCFA` 
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
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#f57c00' }}>{parseFloat(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{item.statut || '-'}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '10px' }}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ padding: '10px' }}>{item.fournisseur || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.modePaiement || '-'}</td>
                            <td style={{ padding: '10px' }}>{item.reference || '-'}</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#388e3c' }}>{parseFloat(item.montant || 0).toLocaleString('fr-FR')} FCFA</td>
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
                          {drillModal.data?.reduce((sum, item) => sum + parseFloat(item.montant || 0), 0).toLocaleString('fr-FR')} FCFA
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
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Montant (FCFA) *</label>
                <input
                  type="number"
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

  const selectedFournisseur = fournisseurs.find(f => f.id == selectedFournisseurId);

  const imprimerEtatCompte = () => {
    if (!etatCompte || !selectedFournisseur) return;

    const facturesRows = (etatCompte.factures || []).map(f => {
      const statut = f.statut === 'payee' ? 'Payée' : f.statut === 'validee' ? 'Validée' : f.statut;
      const montant = Math.round(parseFloat(f.totalTTC || f.montantTotal || f.montantHT || 0)).toLocaleString('fr-FR');
      return '<tr><td>' + (f.numeroFacture || 'N/A') + '</td><td>' + new Date(f.dateFacture).toLocaleDateString('fr-FR') + '</td><td class="text-right amount">' + montant + ' FCFA</td><td class="text-center"><span class="status status-' + f.statut + '">' + statut + '</span></td></tr>';
    }).join('');

    const paiementsRows = (etatCompte.paiements || []).map(p => {
      const montant = Math.round(parseFloat(p.montant || 0)).toLocaleString('fr-FR');
      return '<tr><td>' + new Date(p.datePaiement).toLocaleDateString('fr-FR') + '</td><td>' + (p.reference || '-') + '</td><td>' + (p.modePaiement || '-') + '</td><td class="text-right amount" style="color: #388e3c;">' + montant + ' FCFA</td></tr>';
    }).join('');

    const facturesTable = facturesRows ? '<table><thead><tr><th>N° Facture</th><th>Date</th><th class="text-right">Montant TTC</th><th class="text-center">Statut</th></tr></thead><tbody>' + facturesRows + '</tbody></table>' : '<div class="no-data">Aucune facture sur cette période</div>';
    const paiementsTable = paiementsRows ? '<table><thead><tr><th>Date</th><th>Référence</th><th>Mode</th><th class="text-right">Montant</th></tr></thead><tbody>' + paiementsRows + '</tbody></table>' : '<div class="no-data">Aucun paiement sur cette période</div>';

    const printWindow = window.open('', '_blank');
    const printContent = '<!DOCTYPE html><html><head><title>État de Compte Fournisseur - ' + selectedFournisseur.raisonSociale + '</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: "Segoe UI", Arial, sans-serif; padding: 30px; color: #333; } .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1976d2; } .header h1 { color: #1976d2; font-size: 24px; margin-bottom: 15px; } .fournisseur-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; } .fournisseur-info h3 { margin-bottom: 10px; color: #1976d2; } .fournisseur-info p { margin: 5px 0; font-size: 13px; } .periode { color: #666; font-style: italic; margin-top: 10px; } .summary { display: flex; justify-content: space-between; margin-bottom: 30px; } .summary-box { flex: 1; padding: 15px; margin: 0 10px; border-radius: 8px; text-align: center; } .summary-box:first-child { margin-left: 0; } .summary-box:last-child { margin-right: 0; } .summary-box.facture { background: #e3f2fd; } .summary-box.paye { background: #e8f5e9; } .summary-box.solde { background: #fff3e0; } .summary-box .label { color: #666; font-size: 12px; margin-bottom: 5px; } .summary-box .value { font-size: 20px; font-weight: bold; } .summary-box.facture .value { color: #1976d2; } .summary-box.paye .value { color: #388e3c; } .summary-box.solde .value { color: #e65100; } .section { margin-bottom: 25px; } .section h3 { margin-bottom: 15px; color: #333; font-size: 16px; } table { width: 100%; border-collapse: collapse; } th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6; font-size: 12px; } td { padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 12px; } .text-right { text-align: right; } .text-center { text-align: center; } .amount { font-weight: bold; } .status { padding: 3px 8px; border-radius: 4px; font-size: 11px; } .status-payee { background: #d4edda; color: #155724; } .status-validee { background: #fff3cd; color: #856404; } .status-brouillon { background: #e2e3e5; color: #383d41; } .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; } .no-data { color: #999; font-style: italic; padding: 20px; text-align: center; } @media print { body { padding: 15px; } }</style></head><body>' +
      '<div class="header"><h1>ÉTAT DE COMPTE FOURNISSEUR</h1></div>' +
      '<div class="fournisseur-info"><h3>' + selectedFournisseur.raisonSociale + '</h3>' +
      '<p><strong>Code:</strong> ' + (selectedFournisseur.codeAuxiliaire || selectedFournisseur.numeroFournisseur || '-') + '</p>' +
      (selectedFournisseur.adresse ? '<p><strong>Adresse:</strong> ' + selectedFournisseur.adresse + '</p>' : '') +
      (selectedFournisseur.email ? '<p><strong>Email:</strong> ' + selectedFournisseur.email + '</p>' : '') +
      (selectedFournisseur.telephone ? '<p><strong>Téléphone:</strong> ' + selectedFournisseur.telephone + '</p>' : '') +
      '<p class="periode"><strong>Période:</strong> ' + new Date(periode.dateDebut).toLocaleDateString('fr-FR') + ' au ' + new Date(periode.dateFin).toLocaleDateString('fr-FR') + '</p></div>' +
      '<div class="summary"><div class="summary-box facture"><div class="label">Total Facturé</div><div class="value">' + Math.round(etatCompte.totalFacture || 0).toLocaleString('fr-FR') + ' FCFA</div></div>' +
      '<div class="summary-box paye"><div class="label">Total Payé</div><div class="value">' + Math.round(etatCompte.totalPaye || 0).toLocaleString('fr-FR') + ' FCFA</div></div>' +
      '<div class="summary-box solde"><div class="label">Solde Dû</div><div class="value">' + Math.round(etatCompte.solde || 0).toLocaleString('fr-FR') + ' FCFA</div></div></div>' +
      '<div class="section"><h3>Factures</h3>' + facturesTable + '</div>' +
      '<div class="section"><h3>Paiements</h3>' + paiementsTable + '</div>' +
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
              ...fournisseurs.map(f => ({ value: f.id, label: f.raisonSociale || f.nom }))
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
            <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Code:</strong> {selectedFournisseur?.codeAuxiliaire || selectedFournisseur?.numeroFournisseur || '-'}</p>
            {selectedFournisseur?.adresse && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Adresse:</strong> {selectedFournisseur.adresse}</p>}
            {selectedFournisseur?.email && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Email:</strong> {selectedFournisseur.email}</p>}
            {selectedFournisseur?.telephone && <p style={{ margin: '5px 0', fontSize: '14px' }}><strong>Téléphone:</strong> {selectedFournisseur.telephone}</p>}
            <p style={{ margin: '10px 0 0 0', fontSize: '14px', fontStyle: 'italic', color: '#666' }}>
              <strong>Période:</strong> {new Date(periode.dateDebut).toLocaleDateString('fr-FR')} au {new Date(periode.dateFin).toLocaleDateString('fr-FR')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Total Facturé</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {etatCompte.totalFacture?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#e8f8f0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Total Payé</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#27ae60' }}>
                {etatCompte.totalPaye?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px' }}>Solde Dû</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: etatCompte.solde > 0 ? '#e74c3c' : '#27ae60' }}>
                {etatCompte.solde?.toLocaleString('fr-FR') || 0} FCFA
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px', color: '#333' }}>📋 Factures Fournisseur</h4>
            {etatCompte.factures && etatCompte.factures.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>N° Facture</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Montant Total</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {etatCompte.factures.map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{f.numeroFacture || 'N/A'}</td>
                      <td style={{ padding: '12px' }}>{new Date(f.dateFacture).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                        {(f.montantTotal || f.montantHT || 0).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <InvoiceStatusBadge 
                          statut={f.statut} 
                          montantPaye={f.montantPaye} 
                          montantTTC={f.totalTTC} 
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Aucune facture sur cette période</p>
            )}
          </div>

          <div>
            <h4 style={{ marginBottom: '15px', color: '#333' }}>💳 Paiements Effectués</h4>
            {etatCompte.paiements && etatCompte.paiements.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Référence</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Mode</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {etatCompte.paiements.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>{new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '12px' }}>{p.reference || '-'}</td>
                      <td style={{ padding: '12px' }}>{p.modePaiement || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#27ae60' }}>
                        {(p.montant || 0).toLocaleString('fr-FR')} FCFA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#999', fontStyle: 'italic' }}>Aucun paiement sur cette période</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
