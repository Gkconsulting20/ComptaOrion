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
  
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [receptionsEnAttente, setReceptionsEnAttente] = useState([]);
  const [selectedReceptions, setSelectedReceptions] = useState([]);
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
      
      const [stockRes, logRes] = await Promise.all([
        api.get(`/stock/rapports/stock-non-facture?${params}`),
        api.get(`/stock/rapports/logistique-non-facturee?${params}`)
      ]);
      setStockPending(stockRes.data);
      setLogistiquePending(logRes.data);
    } catch (err) {
      console.error('Erreur chargement données non facturées:', err);
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
    const coutsLog = [];
    
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
          <h3 style={{ margin: 0 }}>📄 Stock & Coûts Non Facturés</h3>
          <p style={{ color: '#7f8c8d', margin: '5px 0 0 0' }}>
            Réceptions validées en attente de facturation fournisseur.
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
                            <span style={{ fontWeight: 'bold', color: '#2196f3' }}>{parseFloat(rec.total_ht || 0).toLocaleString()} FCFA</span>
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
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#999' }}>{ligne.prixEstime.toLocaleString()}</td>
                        <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                          <input type="number" value={ligne.prixUnitaireReel}
                            onChange={(e) => updateLigne(idx, 'prixUnitaireReel', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                          {(ligne.quantite * (ligne.prixUnitaireReel || 0)).toLocaleString()}
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
                            <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', color: '#999' }}>{cout.montantEstime.toLocaleString()}</td>
                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                              <input type="number" value={cout.montantReel}
                                onChange={(e) => updateCout(idx, 'montantReel', parseFloat(e.target.value) || 0)}
                                style={{ width: '100%', padding: '5px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right', 
                              color: (cout.montantReel - cout.montantEstime) > 0 ? '#e74c3c' : (cout.montantReel - cout.montantEstime) < 0 ? '#27ae60' : '#333' }}>
                              {((cout.montantReel || 0) - cout.montantEstime).toLocaleString()}
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
                  <strong>{totals.totalArticles.toLocaleString()} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Total Logistique:</span>
                  <strong>{totals.totalLogistique.toLocaleString()} FCFA</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #4caf50', paddingTop: '10px' }}>
                  <span style={{ fontSize: '18px' }}>Total HT:</span>
                  <strong style={{ fontSize: '18px', color: '#2e7d32' }}>{totals.totalHT.toLocaleString()} FCFA</strong>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '25px' }}>
        <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>STOCK EN ATTENTE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#e65100' }}>{stockPending.totaux?.valeur?.toLocaleString() || 0} FCFA</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{stockPending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>LOGISTIQUE EN ATTENTE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#1565c0' }}>{logistiquePending.totaux?.montant?.toLocaleString() || 0} FCFA</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>{logistiquePending.totaux?.lignes || 0} lignes</p>
        </div>
        <div style={{ padding: '20px', background: '#fce4ec', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL NON FACTURÉ</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#c2185b' }}>
            {((stockPending.totaux?.valeur || 0) + (logistiquePending.totaux?.montant || 0)).toLocaleString()} FCFA
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
                { key: 'date_reception', label: 'Date Réception', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'reception_numero', label: 'N° Réception' },
                { key: 'produit_nom', label: 'Produit', render: (val, row) => `${row.produit_reference || ''} ${val || ''}` },
                { key: 'fournisseur_nom', label: 'Fournisseur' },
                { key: 'quantite_pending', label: 'Quantité', render: (val) => parseFloat(val).toFixed(0) },
                { key: 'prix_estime', label: 'Prix Estimé', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
                { key: 'valeur_estimee', label: 'Valeur', render: (val) => <strong>{parseFloat(val || 0).toLocaleString()} FCFA</strong> }
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
                    <strong>{typeLabels[t.type] || t.type}:</strong> {t.montant.toLocaleString()} FCFA ({t.lignes})
                  </div>
                ))}
              </div>
              <Table
                columns={[
                  { key: 'date_reception', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                  { key: 'reception_numero', label: 'N° Réception' },
                  { key: 'commande_numero', label: 'N° Commande' },
                  { key: 'fournisseur_nom', label: 'Fournisseur' },
                  { key: 'type', label: 'Type', render: (val) => typeLabels[val] || val },
                  { key: 'description', label: 'Description' },
                  { key: 'montant_estime', label: 'Montant', render: (val) => <strong>{parseFloat(val || 0).toLocaleString()} FCFA</strong> }
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
              { key: 'valeur', label: 'Valeur Stock', render: (val) => <strong>{parseFloat(val || 0).toLocaleString()} FCFA</strong> }
            ]}
            data={stockPending.parFournisseur || []}
          />
          
          <h4 style={{ marginTop: '30px' }}>🚚 Logistique par Fournisseur</h4>
          <Table
            columns={[
              { key: 'nom', label: 'Fournisseur' },
              { key: 'lignes', label: 'Lignes' },
              { key: 'montant', label: 'Montant Total', render: (val) => <strong>{parseFloat(val || 0).toLocaleString()} FCFA</strong> }
            ]}
            data={logistiquePending.parFournisseur || []}
          />
        </div>
      )}
    </div>
  );
}

export function StockInventaire() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [subTab, setSubTab] = useState('produits');
  
  const [data, setData] = useState({
    produits: [],
    categories: [],
    entrepots: [],
    mouvements: [],
    receptions: [],
    fournisseurs: []
  });
  
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [selectedProduit, setSelectedProduit] = useState(null);
  const [selectedMouvement, setSelectedMouvement] = useState(null);
  const [showProduitDetails, setShowProduitDetails] = useState(false);
  const [showMouvementDetails, setShowMouvementDetails] = useState(false);
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [p, c, e, m, r, f] = await Promise.all([
          api.get('/produits').catch(() => ({ data: { data: [] } })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/mouvements').catch(() => ({ data: [] })),
          api.get('/stock/receptions').catch(() => ({ data: [] })),
          api.get('/fournisseurs').catch(() => ({ data: { data: [] } }))
        ]);
        setData({
          produits: p.data.data || p.data || [],
          categories: c.data || [],
          entrepots: e.data || [],
          mouvements: m.data || [],
          receptions: r.data || [],
          fournisseurs: f.data.data || f.data || []
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
      } else if (type === 'receptions') {
        const res = await api.get('/stock/receptions');
        setData(d => ({ ...d, receptions: res.data || [] }));
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
      setForm({ produitId: null, quantiteComptee: 0, notes: '' });
    } else if (type === 'reception') {
      setForm({ 
        fournisseurId: '', 
        dateReception: new Date().toISOString().split('T')[0],
        entrepotId: '', 
        notes: '', 
        lignes: [{ produitId: '', quantiteRecue: 1, prixUnitaireEstime: 0 }] 
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
      } else if (type === 'reception') {
        const lignesValides = form.lignes.filter(l => l.produitId && parseFloat(l.quantiteRecue) > 0);
        if (!form.fournisseurId || lignesValides.length === 0) {
          return alert('Veuillez saisir un fournisseur et au moins une ligne valide');
        }
        await api.post('/stock/receptions', {
          fournisseurId: parseInt(form.fournisseurId),
          dateReception: form.dateReception,
          entrepotId: form.entrepotId ? parseInt(form.entrepotId) : null,
          notes: form.notes,
          lignes: lignesValides.map(l => ({
            produitId: parseInt(l.produitId),
            quantiteRecue: parseFloat(l.quantiteRecue),
            prixUnitaireEstime: parseFloat(l.prixUnitaireEstime)
          }))
        });
        await reload('receptions');
        alert('Bon de reception cree avec succes. Validez-le pour mettre a jour le stock.');
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
      
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['parametres', 'receptions', 'mouvements', 'inventaires', 'alertes', 'nonfacture', 'rapports'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px', background: activeTab === tab ? '#fff' : 'transparent',
              border: 'none', borderBottom: activeTab === tab ? '3px solid #3498db' : '3px solid transparent',
              color: activeTab === tab ? '#3498db' : '#7f8c8d',
              fontWeight: activeTab === tab ? 'bold' : 'normal', cursor: 'pointer'
            }}>
            {tab === 'parametres' ? '⚙️ Paramètres' : 
             tab === 'receptions' ? '📥 Réceptions' :
             tab === 'mouvements' ? '🔄 Mouvements' :
             tab === 'inventaires' ? '📋 Inventaires' :
             tab === 'alertes' ? '⚠️ Alertes' :
             tab === 'nonfacture' ? '📄 Non Facturé' : '📊 Rapports'}
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
                { key: 'total_ht', label: 'Total HT', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
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
              onRowClick={(item) => { setSelectedMouvement(item); setShowMouvementDetails(true); }}
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
          <h3>📊 Rapports d'Inventaire</h3>
          
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
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{valorisation.toLocaleString()} FCFA</h2>
            </div>
          </div>

          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📅 Filtrer par Période</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input
                  type="date"
                  value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{
                    width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input
                  type="date"
                  value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{
                    width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>📋 Rapport de Valorisation par Produit</h4>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '15px' }}>
              Valorisation de chaque produit basée sur le stock actuel et le prix d'achat
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
                { key: 'prixAchat', label: 'Prix Achat', render: (val) => `${val || 0} FCFA` },
                { key: 'valorisation', label: 'Valorisation Totale', render: (_, row) => {
                  const val = (parseFloat(row.quantite || 0) * parseFloat(row.prixAchat || 0));
                  return <strong style={{ color: '#388e3c' }}>{val.toLocaleString()} FCFA</strong>;
                }}
              ]}
              data={data.produits}
            />
            <div style={{ marginTop: '15px', padding: '15px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>VALORISATION TOTALE DU STOCK</p>
              <h2 style={{ margin: '5px 0 0 0', color: '#388e3c' }}>{valorisation.toLocaleString()} FCFA</h2>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>📊 Rapport des Mouvements par Période</h4>
            <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '15px' }}>
              Mouvements de stock survenus entre le {new Date(periode.dateDebut).toLocaleDateString('fr-FR')} et le {new Date(periode.dateFin).toLocaleDateString('fr-FR')}
            </p>
            {(() => {
              const mouvementsPeriode = data.mouvements.filter(m => {
                const dateMvt = new Date(m.createdAt);
                const debut = new Date(periode.dateDebut);
                const fin = new Date(periode.dateFin);
                return dateMvt >= debut && dateMvt <= fin;
              });

              const entrees = mouvementsPeriode.filter(m => m.type === 'entree').reduce((sum, m) => sum + parseFloat(m.quantite || 0), 0);
              const sorties = mouvementsPeriode.filter(m => m.type === 'sortie').reduce((sum, m) => sum + parseFloat(m.quantite || 0), 0);
              const ajustements = mouvementsPeriode.filter(m => m.type === 'ajustement').reduce((sum, m) => sum + parseFloat(m.quantite || 0), 0);

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                    <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>📥 ENTRÉES</p>
                      <h3 style={{ margin: '5px 0 0 0', color: '#1976d2' }}>{entrees.toFixed(0)} unités</h3>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>
                        {mouvementsPeriode.filter(m => m.type === 'entree').length} mouvements
                      </p>
                    </div>
                    <div style={{ padding: '15px', background: '#ffebee', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>📤 SORTIES</p>
                      <h3 style={{ margin: '5px 0 0 0', color: '#d32f2f' }}>{sorties.toFixed(0)} unités</h3>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>
                        {mouvementsPeriode.filter(m => m.type === 'sortie').length} mouvements
                      </p>
                    </div>
                    <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>🔄 AJUSTEMENTS</p>
                      <h3 style={{ margin: '5px 0 0 0', color: '#f57c00' }}>{ajustements.toFixed(0)} unités</h3>
                      <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#999' }}>
                        {mouvementsPeriode.filter(m => m.type === 'ajustement').length} mouvements
                      </p>
                    </div>
                  </div>

                  {mouvementsPeriode.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
                      <p style={{ color: '#7f8c8d', margin: 0 }}>Aucun mouvement pour cette période</p>
                    </div>
                  ) : (
                    <Table
                      columns={[
                        { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                        { key: 'type', label: 'Type', render: (val) => 
                          val === 'entree' ? '📥 Entrée' : val === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' 
                        },
                        { key: 'produitId', label: 'Produit', render: (val) => {
                          const prod = data.produits.find(p => p.id === val);
                          return prod ? prod.nom : `ID ${val}`;
                        }},
                        { key: 'quantite', label: 'Quantité' },
                        { key: 'reference', label: 'Référence' },
                        { key: 'notes', label: 'Notes' }
                      ]}
                      data={mouvementsPeriode}
                    />
                  )}
                </>
              );
            })()}
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
                  const val = data.produits
                    .filter(p => p.categorieId === row.id)
                    .reduce((sum, p) => sum + (parseFloat(p.quantite || 0) * parseFloat(p.prixAchat || 0)), 0);
                  return <strong style={{ color: '#388e3c' }}>{val.toLocaleString()} FCFA</strong>;
                }}
              ]}
              data={data.categories}
            />
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={modal.type === 'produit' ? (modal.item ? 'Modifier' : 'Nouveau Produit') :
               modal.type === 'categorie' ? (modal.item ? 'Modifier' : 'Nouvelle Catégorie') :
               modal.type === 'entrepot' ? (modal.item ? 'Modifier' : 'Nouvel Entrepôt') :
               modal.type === 'inventaire' ? 'Comptage Physique' : 
               modal.type === 'reception' ? 'Nouveau Bon de Réception' : ''}>
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
              <FormField label="Fournisseur" type="select" value={form.fournisseurId || ''} 
                onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                options={[{ value: '', label: '-- Sélectionner --' }, ...data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))]}
                required />
              <FormField label="Date Réception" type="date" value={form.dateReception || ''} 
                onChange={(e) => setForm({...form, dateReception: e.target.value})} required />
              <FormField label="Entrepôt" type="select" value={form.entrepotId || ''} 
                onChange={(e) => setForm({...form, entrepotId: e.target.value})}
                options={[{ value: '', label: '-- Aucun --' }, ...data.entrepots.map(e => ({ value: e.id, label: e.nom }))]} />
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
                  {(form.lignes || []).reduce((sum, l) => sum + (parseFloat(l.quantiteRecue || 0) * parseFloat(l.prixUnitaireEstime || 0)), 0).toLocaleString()} FCFA
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
                { label: 'Prix Achat', value: `${selectedProduit.prixAchat || 0} FCFA` },
                { label: 'Prix Vente', value: `${selectedProduit.prixVente || 0} FCFA` },
                { label: 'Marge', value: `${((selectedProduit.prixVente || 0) - (selectedProduit.prixAchat || 0))} FCFA` }
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

      {/* MODAL DE DÉTAILS MOUVEMENT */}
      {selectedMouvement && (
        <DetailsModal
          isOpen={showMouvementDetails}
          onClose={() => { setShowMouvementDetails(false); setSelectedMouvement(null); }}
          title="Détails Mouvement de Stock"
          sections={[
            {
              title: 'Informations',
              fields: [
                { label: 'Date', value: new Date(selectedMouvement.createdAt).toLocaleDateString('fr-FR') },
                { label: 'Type', value: selectedMouvement.type === 'entree' ? '📥 Entrée' : selectedMouvement.type === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' },
                { label: 'Produit', value: (() => {
                  const prod = data.produits.find(p => p.id === selectedMouvement.produitId);
                  return prod ? `${prod.reference} - ${prod.nom}` : `ID ${selectedMouvement.produitId}`;
                })() },
                { label: 'Quantité', value: selectedMouvement.quantite },
                { label: 'Prix Unitaire', value: `${selectedMouvement.prixUnitaire || 0} FCFA` },
                { label: 'Référence', value: selectedMouvement.reference || '-' },
                { label: 'Notes', value: selectedMouvement.notes || '-' }
              ]
            }
          ]}
        />
      )}
    </div>
  );
}
