import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

const CLASSES_SYSCOHADA = {
  '1': { nom: 'Comptes de ressources durables', type: 'Bilan', color: '#e3f2fd' },
  '2': { nom: 'Comptes d\'actif immobilisé', type: 'Bilan', color: '#f3e5f5' },
  '3': { nom: 'Comptes de stocks', type: 'Bilan', color: '#e8f5e9' },
  '4': { nom: 'Comptes de tiers', type: 'Bilan', color: '#fff3e0' },
  '5': { nom: 'Comptes de trésorerie', type: 'Bilan', color: '#e1f5fe' },
  '6': { nom: 'Comptes de charges', type: 'Gestion', color: '#ffebee' },
  '7': { nom: 'Comptes de produits', type: 'Gestion', color: '#e8f5e9' },
  '8': { nom: 'Comptes spéciaux', type: 'Résultat', color: '#fafafa' }
};

function PlanComptableTab({ data, loadAllData, openModal, api }) {
  const [viewMode, setViewMode] = useState('liste');
  const [charteData, setCharteData] = useState(null);
  const [loadingCharte, setLoadingCharte] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const loadCharteComptes = async () => {
    setLoadingCharte(true);
    try {
      const res = await api.get('/comptabilite/rapports/charte-comptes');
      setCharteData(res);
      const expanded = {};
      (res.classes || []).forEach(c => { expanded[c.classe] = true; });
      setExpandedClasses(expanded);
    } catch (err) {
      console.error('Erreur chargement charte:', err);
    } finally {
      setLoadingCharte(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'charte' && !charteData) {
      loadCharteComptes();
    }
  }, [viewMode]);

  const toggleClasse = (classe) => {
    setExpandedClasses(prev => ({ ...prev, [classe]: !prev[classe] }));
  };

  const exportCharteCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/comptabilite/export/charte-comptes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Erreur téléchargement');
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `charte_comptes_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur export: ' + err.message);
    }
  };

  const filteredComptes = searchTerm 
    ? data.comptes.filter(c => 
        c.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.nom?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : data.comptes;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>📋 Plan Comptable ({data.comptes.length} comptes)</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'flex', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('liste')} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              background: viewMode === 'liste' ? '#1976d2' : '#fff',
              color: viewMode === 'liste' ? '#fff' : '#333'
            }}>📋 Liste</button>
            <button onClick={() => setViewMode('charte')} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              background: viewMode === 'charte' ? '#1976d2' : '#fff',
              color: viewMode === 'charte' ? '#fff' : '#333'
            }}>📊 Charte des Comptes</button>
          </div>
        </div>
      </div>

      {viewMode === 'liste' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="🔍 Rechercher un compte..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', width: '300px' }}
            />
            {data.comptes.length < 20 && (
              <Button variant="success" onClick={async () => {
                if (!confirm('Initialiser le plan comptable SYSCOHADA complet (120+ comptes) ?')) return;
                try {
                  const result = await api.post('/comptabilite/init-syscohada', {});
                  alert(`Plan SYSCOHADA initialisé : ${result.comptesCreés} comptes créés`);
                  loadAllData();
                } catch (err) {
                  alert('Erreur: ' + err.message);
                }
              }}>Initialiser SYSCOHADA</Button>
            )}
            <Button variant="secondary" onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                const response = await fetch('/api/comptabilite/export/comptes', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Erreur téléchargement');
                const csvText = await response.text();
                const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'plan_comptable.csv';
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (err) {
                alert('Erreur export: ' + err.message);
              }
            }}>Export CSV</Button>
            <Button onClick={() => openModal('compte')}>+ Nouveau Compte</Button>
          </div>
          <Table
            columns={[
              { key: 'numero', label: 'N° Compte' },
              { key: 'nom', label: 'Nom du Compte' },
              { key: 'categorie', label: 'Catégorie' },
              { key: 'sousCategorie', label: 'Classe' },
              { key: 'solde', label: 'Solde', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` }
            ]}
            data={filteredComptes}
            onEdit={(item) => openModal('compte', item)}
            actions={true}
          />
        </div>
      )}

      {viewMode === 'charte' && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
            <Button variant="primary" onClick={exportCharteCSV}>📥 Exporter la Charte (CSV)</Button>
            <Button variant="secondary" onClick={loadCharteComptes}>🔄 Actualiser</Button>
            {charteData && (
              <span style={{ color: '#666', fontSize: '14px' }}>
                Généré le {new Date(charteData.dateGeneration).toLocaleDateString('fr-FR')} à {new Date(charteData.dateGeneration).toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>

          {loadingCharte ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>Chargement de la charte des comptes...</div>
          ) : charteData ? (
            <div>
              <div style={{ 
                padding: '20px', 
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', 
                borderRadius: '12px', 
                color: '#fff', 
                marginBottom: '25px' 
              }}>
                <h2 style={{ margin: '0 0 10px 0' }}>📊 CHARTE DES COMPTES</h2>
                <p style={{ margin: 0, opacity: 0.9 }}>
                  {charteData.entreprise?.nom || 'Entreprise'} | Système: {charteData.systemeComptable} | {charteData.totalComptes} comptes
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
                {(charteData.classes || []).map(classe => (
                  <div key={classe.classe} style={{ 
                    padding: '15px', 
                    background: CLASSES_SYSCOHADA[classe.classe]?.color || '#f5f5f5', 
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Classe {classe.classe}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{classe.nombreComptes} comptes</div>
                  </div>
                ))}
              </div>

              {(charteData.classes || []).map(classe => (
                <div key={classe.classe} style={{ marginBottom: '15px' }}>
                  <div 
                    onClick={() => toggleClasse(classe.classe)}
                    style={{ 
                      padding: '15px 20px', 
                      background: CLASSES_SYSCOHADA[classe.classe]?.color || '#f5f5f5',
                      borderRadius: expandedClasses[classe.classe] ? '8px 8px 0 0' : '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #e0e0e0'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '16px' }}>Classe {classe.classe} - {classe.nom}</strong>
                      <span style={{ marginLeft: '15px', color: '#666', fontSize: '14px' }}>
                        ({classe.nombreComptes} comptes) | Type: {classe.type}
                      </span>
                    </div>
                    <span style={{ fontSize: '20px' }}>{expandedClasses[classe.classe] ? '▼' : '▶'}</span>
                  </div>
                  
                  {expandedClasses[classe.classe] && (
                    <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f5f5f5' }}>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>N° Compte</th>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Intitulé</th>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Catégorie</th>
                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Solde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(classe.comptes || []).map(compte => (
                            <tr key={compte.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                              <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{compte.numero}</td>
                              <td style={{ padding: '10px' }}>{compte.nom}</td>
                              <td style={{ padding: '10px', color: '#666' }}>{compte.categorie || '-'}</td>
                              <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                                {parseFloat(compte.solde || 0).toLocaleString('fr-FR')} {compte.devise || 'FCFA'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p>Aucune donnée disponible. Cliquez sur "Actualiser" pour charger la charte des comptes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClotureExerciceTab({ api }) {
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  const loadPreview = async () => {
    setLoading(true);
    setPreview(null);
    setResult(null);
    try {
      const res = await api.get(`/comptabilite/cloture-exercice/preview?annee=${annee}`);
      setPreview(res);
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const executerCloture = async () => {
    if (!confirm(`ATTENTION: Vous allez clôturer l'exercice ${annee}.\n\nCette opération va:\n- Solder tous les comptes de charges (classe 6)\n- Solder tous les comptes de produits (classe 7)\n- Reporter le résultat sur le compte ${preview?.compteResultat}\n- Créer le bilan d'ouverture ${annee + 1}\n\nContinuer ?`)) {
      return;
    }
    setExecuting(true);
    try {
      const res = await api.post('/comptabilite/cloture-exercice', { annee });
      setResult(res);
      alert('Clôture effectuée avec succès !');
    } catch (err) {
      alert('Erreur clôture: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const formatMontant = (val) => {
    return Math.abs(parseFloat(val || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' FCFA';
  };

  return (
    <div>
      <h3 style={{ marginBottom: '20px' }}>Clôture d'Exercice Comptable</h3>

      <div style={{ 
        padding: '20px', 
        background: '#fff3e0', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #ffb74d'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#e65100' }}>Information importante</h4>
        <p style={{ margin: 0, color: '#e65100' }}>
          La clôture d'exercice est une opération irréversible qui:
        </p>
        <ul style={{ margin: '10px 0 0 0', color: '#e65100' }}>
          <li>Solde tous les comptes de résultat (classes 6 et 7)</li>
          <li>Transfère le résultat net vers le compte de bilan approprié (120 ou 129)</li>
          <li>Crée automatiquement les écritures d'ouverture du nouvel exercice</li>
        </ul>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'flex-end', 
        marginBottom: '25px',
        padding: '20px',
        background: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Exercice à clôturer</label>
          <select 
            value={annee}
            onChange={(e) => setAnnee(parseInt(e.target.value))}
            style={{ 
              padding: '10px 15px', 
              fontSize: '16px', 
              borderRadius: '6px', 
              border: '1px solid #ddd',
              minWidth: '150px'
            }}
          >
            {[2023, 2024, 2025, 2026].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <Button onClick={loadPreview} disabled={loading}>
          {loading ? 'Chargement...' : 'Générer la prévisualisation'}
        </Button>
      </div>

      {preview && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ 
            padding: '25px', 
            background: preview.typeResultat === 'benefice' ? '#e8f5e9' : '#ffebee',
            borderRadius: '12px',
            border: `2px solid ${preview.typeResultat === 'benefice' ? '#4caf50' : '#f44336'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: preview.typeResultat === 'benefice' ? '#2e7d32' : '#c62828' }}>
                  Résultat de l'exercice {annee}
                </h3>
                <p style={{ margin: '5px 0 0 0', color: '#666' }}>{preview.message}</p>
              </div>
              <div style={{ 
                fontSize: '32px', 
                fontWeight: 'bold', 
                color: preview.typeResultat === 'benefice' ? '#2e7d32' : '#c62828'
              }}>
                {preview.typeResultat === 'benefice' ? '+' : '-'}{formatMontant(preview.resultatNet)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ 
              padding: '20px', 
              background: '#fff', 
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>
                Produits (Classe 7) - Total: {formatMontant(preview.comptesResultat.totalProduits)}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Compte</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Nom</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.comptesResultat.produits.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{c.numero}</td>
                      <td style={{ padding: '8px' }}>{c.nom}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#4caf50' }}>{formatMontant(c.solde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ 
              padding: '20px', 
              background: '#fff', 
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#c62828' }}>
                Charges (Classe 6) - Total: {formatMontant(preview.comptesResultat.totalCharges)}
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Compte</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Nom</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.comptesResultat.charges.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{c.numero}</td>
                      <td style={{ padding: '8px' }}>{c.nom}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#f44336' }}>{formatMontant(c.solde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ 
            padding: '20px', 
            background: '#e3f2fd', 
            borderRadius: '8px',
            border: '1px solid #1976d2'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Écritures qui seront générées</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ padding: '15px', background: '#fff', borderRadius: '6px' }}>
                <strong>1. Écriture de clôture (CLO-{annee}-001)</strong>
                <p style={{ margin: '10px 0 0 0', color: '#666', fontSize: '14px' }}>
                  - Crédit des comptes de charges pour les solder<br/>
                  - Débit des comptes de produits pour les solder<br/>
                  - {preview.typeResultat === 'benefice' ? 'Crédit' : 'Débit'} du compte {preview.compteResultat}
                </p>
              </div>
              <div style={{ padding: '15px', background: '#fff', borderRadius: '6px' }}>
                <strong>2. Bilan d'ouverture (AN-{annee + 1}-001)</strong>
                <p style={{ margin: '10px 0 0 0', color: '#666', fontSize: '14px' }}>
                  - Report des soldes de tous les comptes de bilan<br/>
                  - Incluant le résultat de l'exercice {annee}<br/>
                  - {preview.comptesBilan.length} comptes à reporter
                </p>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Button 
              variant="danger" 
              onClick={executerCloture}
              disabled={executing}
              style={{ padding: '15px 40px', fontSize: '16px' }}
            >
              {executing ? 'Clôture en cours...' : `Exécuter la clôture de l'exercice ${annee}`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div style={{ 
          marginTop: '20px',
          padding: '20px', 
          background: '#e8f5e9', 
          borderRadius: '8px',
          border: '2px solid #4caf50'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#2e7d32' }}>Clôture effectuée avec succès</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div style={{ padding: '15px', background: '#fff', borderRadius: '6px' }}>
              <strong>Résultat</strong>
              <p style={{ margin: '5px 0 0 0', color: result.details.typeResultat === 'benefice' ? '#4caf50' : '#f44336' }}>
                {result.details.typeResultat === 'benefice' ? 'Bénéfice' : 'Perte'}: {formatMontant(result.details.resultatNet)}
              </p>
            </div>
            <div style={{ padding: '15px', background: '#fff', borderRadius: '6px' }}>
              <strong>Écriture de clôture</strong>
              <p style={{ margin: '5px 0 0 0' }}>
                {result.details.ecritureCloture.numero} ({result.details.ecritureCloture.lignes} lignes)
              </p>
            </div>
            <div style={{ padding: '15px', background: '#fff', borderRadius: '6px' }}>
              <strong>Bilan d'ouverture</strong>
              <p style={{ margin: '5px 0 0 0' }}>
                {result.details.ecritureOuverture.numero} ({result.details.ecritureOuverture.lignes} lignes)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModuleComptabilite() {
  const [activeTab, setActiveTab] = useState('plan');
  const [data, setData] = useState({
    comptes: [],
    journaux: [],
    ecritures: [],
    immobilisations: [],
    ecrituresRecurrentes: [],
    parametresComptables: null
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });
  const [rapportModal, setRapportModal] = useState({ open: false, type: null, data: null, loading: false });
  const [drillModal, setDrillModal] = useState({ open: false, title: '', data: [], loading: false });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [comptesRes, journauxRes, ecrituresRes, immosRes, recurrentesRes, parametresRes] = await Promise.allSettled([
        api.get('/comptabilite/comptes'),
        api.get('/comptabilite/journaux'),
        api.get('/comptabilite/ecritures'),
        api.get('/immobilisations/list'),
        api.get('/ecritures-recurrentes'),
        api.get('/ecritures-recurrentes/parametres/comptables')
      ]);
      
      setData({
        comptes: comptesRes.status === 'fulfilled' ? (Array.isArray(comptesRes.value) ? comptesRes.value : []) : [],
        journaux: journauxRes.status === 'fulfilled' ? (Array.isArray(journauxRes.value) ? journauxRes.value : []) : [],
        ecritures: ecrituresRes.status === 'fulfilled' ? (Array.isArray(ecrituresRes.value) ? ecrituresRes.value : []) : [],
        immobilisations: immosRes.status === 'fulfilled' ? (Array.isArray(immosRes.value) ? immosRes.value : []) : [],
        ecrituresRecurrentes: recurrentesRes.status === 'fulfilled' ? (Array.isArray(recurrentesRes.value) ? recurrentesRes.value : []) : [],
        parametresComptables: parametresRes.status === 'fulfilled' ? parametresRes.value : null
      });
    } catch (error) {
      console.error('Erreur chargement:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, item = null) => {
    setModal({ open: true, type, item });
    if (type === 'compte') {
      setForm(item || {
        numero: '', nom: '', categorie: 'Actif', sousCategorie: '', devise: 'XOF'
      });
    } else if (type === 'journal') {
      setForm(item || { code: '', nom: '', type: 'od' });
    } else if (type === 'ecriture') {
      setForm(item || {
        journalId: '', date: new Date().toISOString().split('T')[0],
        libelle: '', reference: '',
        lignes: [
          { compteId: '', libelle: '', debit: 0, credit: 0 },
          { compteId: '', libelle: '', debit: 0, credit: 0 }
        ]
      });
    } else if (type === 'recurrente') {
      const lignesModele = item?.lignesModele || [];
      const parsedLignes = typeof lignesModele === 'string' ? JSON.parse(lignesModele) : lignesModele;
      setForm(item || {
        nom: '',
        description: '',
        journalId: '',
        frequence: 'mensuel',
        jourDuMois: 1,
        moisDebut: 1,
        dateDebut: new Date().toISOString().split('T')[0],
        dateFin: '',
        montantReference: 0,
        lignesModele: parsedLignes.length > 0 ? parsedLignes : [
          { compteId: '', montant: 0, type: 'debit', description: '' },
          { compteId: '', montant: 0, type: 'credit', description: '' }
        ],
        actif: true
      });
    } else if (type === 'immobilisation') {
      setForm(item || {
        reference: '', description: '', categorieId: '',
        dateAcquisition: new Date().toISOString().split('T')[0],
        valeurAcquisition: 0
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
      
      if (type === 'compte') {
        if (item) {
          await api.put(`/comptabilite/comptes/${item.id}`, form);
        } else {
          await api.post('/comptabilite/comptes', { ...form, userId: 1, ipAddress: '127.0.0.1' });
        }
      } else if (type === 'journal') {
        if (item) {
          await api.put(`/comptabilite/journaux/${item.id}`, form);
        } else {
          await api.post('/comptabilite/journaux', form);
        }
      } else if (type === 'ecriture') {
        const totaux = calculateTotaux();
        if (totaux.difference !== 0) {
          alert('L\'écriture doit être équilibrée (Débit = Crédit)');
          return;
        }
        
        const ecritureData = {
          journalId: parseInt(form.journalId),
          dateEcriture: form.date,
          reference: form.reference,
          description: form.libelle,
          userId: 1,
          ipAddress: '127.0.0.1'
        };
        const ecritureCreated = await api.post('/comptabilite/ecritures', ecritureData);
        
        for (const ligne of form.lignes) {
          if (ligne.debit > 0) {
            await api.post('/comptabilite/lignes', {
              ecritureId: ecritureCreated.id,
              compteId: parseInt(ligne.compteId),
              montant: parseFloat(ligne.debit),
              type: 'debit',
              description: ligne.libelle
            });
          }
          if (ligne.credit > 0) {
            await api.post('/comptabilite/lignes', {
              ecritureId: ecritureCreated.id,
              compteId: parseInt(ligne.compteId),
              montant: parseFloat(ligne.credit),
              type: 'credit',
              description: ligne.libelle
            });
          }
        }
        
        await api.post(`/comptabilite/ecritures/${ecritureCreated.id}/valider`, {});
      } else if (type === 'recurrente') {
        if (item) {
          await api.put(`/ecritures-recurrentes/${item.id}`, form);
        } else {
          await api.post('/ecritures-recurrentes', form);
        }
      } else if (type === 'immobilisation') {
        await api.post('/immobilisations/create', { 
          ...form, 
          userId: 1, 
          ipAddress: '127.0.0.1' 
        });
      }
      closeModal();
      loadAllData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const addLigneEcriture = () => {
    setForm({
      ...form,
      lignes: [...(form.lignes || []), { compteId: '', libelle: '', debit: 0, credit: 0 }]
    });
  };

  const removeLigneEcriture = (index) => {
    const newLignes = form.lignes.filter((_, i) => i !== index);
    setForm({ ...form, lignes: newLignes.length > 0 ? newLignes : [{ compteId: '', libelle: '', debit: 0, credit: 0 }] });
  };

  const updateLigneEcriture = (index, field, value) => {
    const newLignes = [...form.lignes];
    newLignes[index][field] = value;
    setForm({ ...form, lignes: newLignes });
  };

  const calculateTotaux = () => {
    if (!form.lignes) return { totalDebit: 0, totalCredit: 0, difference: 0 };
    const totalDebit = form.lignes.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
    const totalCredit = form.lignes.reduce((sum, l) => sum + parseFloat(l.credit || 0), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const tabs = [
    { id: 'plan', label: '📋 Plan Comptable', icon: '📋' },
    { id: 'ecritures', label: '✍️ Écritures', icon: '✍️' },
    { id: 'recurrentes', label: '🔄 Écritures Récurrentes', icon: '🔄' },
    { id: 'grandlivre', label: '📖 Grand Livre', icon: '📖' },
    { id: 'balance', label: '⚖️ Balance', icon: '⚖️' },
    { id: 'immobilisations', label: '🏢 Immobilisations', icon: '🏢' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' },
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' }
  ];
  
  const [parametresSubTab, setParametresSubTab] = useState('journaux');

  if (loading) return <div style={{ padding: '20px' }}>Chargement...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>📖 Comptabilité Générale</h2>

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

      {activeTab === 'plan' && (
        <PlanComptableTab 
          data={data} 
          loadAllData={loadAllData} 
          openModal={openModal} 
          api={api} 
        />
      )}

      {activeTab === 'ecritures' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>✍️ Écritures Comptables</h3>
            <Button onClick={() => openModal('ecriture')}>+ Nouvelle Écriture</Button>
          </div>
          {data.ecritures.length > 0 ? (
            <Table
              columns={[
                { key: 'dateEcriture', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'reference', label: 'Référence' },
                { key: 'description', label: 'Description' },
                { key: 'totalDebit', label: 'Débit', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'totalCredit', label: 'Crédit', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'statut', label: 'Statut', render: (val) => {
                  const colors = { brouillon: '#ff9800', validée: '#4caf50' };
                  return <span style={{ color: colors[val] || '#666', fontWeight: 'bold' }}>{val?.toUpperCase()}</span>;
                }}
              ]}
              data={data.ecritures}
              onRowClick={(ecriture) => {
                setModal({ open: true, type: 'details_ecriture', item: ecriture });
              }}
              actions={false}
            />
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune écriture enregistrée</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'grandlivre' && (
        <div>
          <h3>📖 Grand Livre</h3>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>🔍 Filtres</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px', gap: '15px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Compte</label>
                <select id="grandLivreCompte" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <option value="">Tous les comptes</option>
                  {data.comptes.map(c => (
                    <option key={c.id} value={c.id}>{c.numero} - {c.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input type="date" value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input type="date" value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <Button variant="success" style={{ fontWeight: 'bold', padding: '10px 20px' }} onClick={async () => {
                const compteId = document.getElementById('grandLivreCompte').value;
                try {
                  const params = { dateDebut: periode.dateDebut, dateFin: periode.dateFin };
                  if (compteId) params.compteId = compteId;
                  const response = await api.get('/comptabilite/grand-livre', params);
                  setData(prev => ({ ...prev, grandLivreComptes: response.comptes || [], grandLivreTotaux: response.totaux }));
                } catch (err) {
                  alert('Erreur: ' + err.message);
                }
              }}>Générer</Button>
            </div>
          </div>

          {data.grandLivreComptes && data.grandLivreComptes.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }} className="no-print">
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('grandlivre-content');
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Grand Livre - ${entrepriseInfo?.nom || 'ComptaOrion'}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
                            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                            th { background-color: #f5f5f5; }
                            .compte-header { background-color: #e3f2fd; padding: 10px; margin: 15px 0 5px 0; font-weight: bold; }
                            @media print { body { margin: 0; } }
                          </style>
                        </head>
                        <body>
                          <h2>${entrepriseInfo?.nom || ''}</h2>
                          <p>${entrepriseInfo?.adresse || ''} | ${entrepriseInfo?.telephone || ''}</p>
                          <h3>Grand Livre</h3>
                          <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                          ${printContent.innerHTML}
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
                    const content = document.getElementById('grandlivre-content');
                    const htmlContent = `
                      <html>
                        <head><meta charset="utf-8"><title>Grand Livre</title>
                          <style>body { font-family: Arial; margin: 20px; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px; } th { background: #f5f5f5; }</style>
                        </head>
                        <body>
                          <h2>${entrepriseInfo?.nom || ''}</h2>
                          <h3>Grand Livre - ${periode.dateDebut} au ${periode.dateFin}</h3>
                          ${content.innerHTML}
                        </body>
                      </html>
                    `;
                    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Grand_Livre_${periode.dateDebut}_${periode.dateFin}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ⬇️ Télécharger
                </button>
              </div>
              <div id="grandlivre-content">
              {data.grandLivreComptes.map(compte => (
                <div key={compte.compteId} style={{ marginBottom: '25px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 15px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '15px' }}>{compte.numero} - {compte.nom}</strong>
                    <span style={{ color: compte.solde >= 0 ? '#388e3c' : '#d32f2f', fontWeight: 'bold' }}>
                      Solde: {compte.solde.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <Table
                    columns={[
                      { key: 'date', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                      { key: 'journal', label: 'Journal' },
                      { key: 'reference', label: 'Référence' },
                      { key: 'libelle', label: 'Libellé' },
                      { key: 'debit', label: 'Débit', render: (val) => val > 0 ? `${parseFloat(val).toLocaleString('fr-FR')} FCFA` : '-' },
                      { key: 'credit', label: 'Crédit', render: (val) => val > 0 ? `${parseFloat(val).toLocaleString('fr-FR')} FCFA` : '-' }
                    ]}
                    data={compte.lignes}
                    actions={false}
                  />
                  <div style={{ padding: '10px 15px', background: '#fafafa', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: '30px' }}>
                    <span>Total Débit: <strong>{compte.totalDebit.toLocaleString('fr-FR')} FCFA</strong></span>
                    <span>Total Crédit: <strong>{compte.totalCredit.toLocaleString('fr-FR')} FCFA</strong></span>
                  </div>
                </div>
              ))}
              {data.grandLivreTotaux && (
                <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <strong>TOTAUX GÉNÉRAUX</strong>
                  <div>
                    <span style={{ marginRight: '30px' }}>Débit: <strong>{data.grandLivreTotaux.totalDebit.toLocaleString('fr-FR')} FCFA</strong></span>
                    <span>Crédit: <strong>{data.grandLivreTotaux.totalCredit.toLocaleString('fr-FR')} FCFA</strong></span>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Sélectionnez les filtres et cliquez sur "Générer" pour afficher le grand livre</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'balance' && (
        <div>
          <h3>⚖️ Balance Générale</h3>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📅 Période</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input type="date" value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input type="date" value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>
            <Button variant="success" style={{ marginTop: '15px', fontWeight: 'bold', padding: '10px 20px' }} onClick={async () => {
              try {
                const response = await api.get('/comptabilite/balance', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                const balanceComptes = response.comptes || [];
                const balanceData = balanceComptes.map(c => ({
                  id: c.compteId,
                  numero: c.numero,
                  nom: c.nom,
                  type: c.type,
                  totalDebit: c.debit || 0,
                  totalCredit: c.credit || 0,
                  soldeDebit: c.solde > 0 ? c.solde : 0,
                  soldeCredit: c.solde < 0 ? Math.abs(c.solde) : 0
                }));
                setData(prev => ({ ...prev, balanceData, balanceTotaux: response.totaux, balanceEquilibre: response.equilibre }));
              } catch (err) {
                alert('Erreur: ' + err.message);
              }
            }}>Générer</Button>
          </div>

          {data.balanceData && data.balanceData.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }} className="no-print">
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('balance-content');
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Balance Générale - ${entrepriseInfo?.nom || 'ComptaOrion'}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
                            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                            th { background-color: #f5f5f5; }
                            @media print { body { margin: 0; } }
                          </style>
                        </head>
                        <body>
                          <h2>${entrepriseInfo?.nom || ''}</h2>
                          <p>${entrepriseInfo?.adresse || ''} | ${entrepriseInfo?.telephone || ''}</p>
                          <h3>Balance Générale</h3>
                          <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                          ${printContent.innerHTML}
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
                    const content = document.getElementById('balance-content');
                    const htmlContent = `
                      <html>
                        <head><meta charset="utf-8"><title>Balance Générale</title>
                          <style>body { font-family: Arial; margin: 20px; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 6px; } th { background: #f5f5f5; }</style>
                        </head>
                        <body>
                          <h2>${entrepriseInfo?.nom || ''}</h2>
                          <h3>Balance Générale - ${periode.dateDebut} au ${periode.dateFin}</h3>
                          ${content.innerHTML}
                        </body>
                      </html>
                    `;
                    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Balance_Generale_${periode.dateDebut}_${periode.dateFin}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ⬇️ Télécharger
                </button>
              </div>
              <div id="balance-content">
              <Table
                columns={[
                  { key: 'numero', label: 'N° Compte' },
                  { key: 'nom', label: 'Libellé' },
                  { key: 'totalDebit', label: 'Mouv. Débit', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                  { key: 'totalCredit', label: 'Mouv. Crédit', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                  { key: 'soldeDebit', label: 'Solde Débit', render: (val) => val > 0 ? `${parseFloat(val).toLocaleString('fr-FR')} FCFA` : '-' },
                  { key: 'soldeCredit', label: 'Solde Crédit', render: (val) => val > 0 ? `${parseFloat(val).toLocaleString('fr-FR')} FCFA` : '-' }
                ]}
                data={data.balanceData}
                actions={false}
              />
              {data.balanceTotaux && (
                <div style={{ marginTop: '15px', padding: '15px', background: data.balanceEquilibre ? '#e8f5e9' : '#ffebee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>TOTAUX:</strong> Débit: <strong>{parseFloat(data.balanceTotaux.totalDebit || 0).toLocaleString('fr-FR')} FCFA</strong> | Crédit: <strong>{parseFloat(data.balanceTotaux.totalCredit || 0).toLocaleString('fr-FR')} FCFA</strong>
                  </div>
                  <div style={{ color: data.balanceEquilibre ? '#388e3c' : '#d32f2f', fontWeight: 'bold' }}>
                    {data.balanceEquilibre ? '✅ Balance équilibrée' : '❌ Balance non équilibrée'}
                  </div>
                </div>
              )}
              </div>
            </>
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Sélectionnez la période et cliquez sur "Générer" pour afficher la balance</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'immobilisations' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>🏢 Gestion des Immobilisations</h3>
            <Button onClick={() => openModal('immobilisation')}>+ Nouvelle Immobilisation</Button>
          </div>
          {data.immobilisations.length > 0 ? (
            <Table
              columns={[
                { key: 'reference', label: 'Référence' },
                { key: 'description', label: 'Description' },
                { key: 'dateAcquisition', label: 'Date Acquisition', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
                { key: 'valeurAcquisition', label: 'Valeur Acquisition', render: (val) => `${parseFloat(val).toLocaleString('fr-FR')} FCFA` },
                { key: 'amortissementCumule', label: 'Amort. Cumulé', render: (val) => `${parseFloat(val || 0).toLocaleString('fr-FR')} FCFA` },
                { key: 'valeurNetteComptable', label: 'VNC', render: (val) => `${parseFloat(val).toLocaleString('fr-FR')} FCFA` },
                { key: 'statut', label: 'Statut', render: (val) => {
                  const colors = { actif: '#4caf50', 'cédée': '#ff9800', amortie: '#9e9e9e' };
                  return <span style={{ color: colors[val] || '#666', fontWeight: 'bold' }}>{val?.toUpperCase()}</span>;
                }}
              ]}
              data={data.immobilisations}
              actions={false}
            />
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune immobilisation enregistrée</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rapports' && (
        <div>
          <h3>📊 Rapports Financiers</h3>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📅 Période</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input type="date" value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input type="date" value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' }}>
            <div style={{ padding: '30px', background: '#e3f2fd', borderRadius: '8px', cursor: 'pointer' }}
              onClick={async () => {
                setRapportModal({ open: true, type: 'bilan', data: null, loading: true });
                try {
                  const bilan = await api.get('/comptabilite/rapports/bilan', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  setRapportModal({ open: true, type: 'bilan', data: bilan, loading: false });
                } catch (err) {
                  setRapportModal({ open: false, type: null, data: null, loading: false });
                  alert('Erreur génération Bilan: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>📄 Bilan Comptable</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                État des actifs et passifs à une date donnée
              </p>
            </div>

            <div style={{ padding: '30px', background: '#f3e5f5', borderRadius: '8px', cursor: 'pointer' }}
              onClick={async () => {
                setRapportModal({ open: true, type: 'resultat', data: null, loading: true });
                try {
                  const resultat = await api.get('/comptabilite/rapports/resultat', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  setRapportModal({ open: true, type: 'resultat', data: resultat, loading: false });
                } catch (err) {
                  setRapportModal({ open: false, type: null, data: null, loading: false });
                  alert('Erreur génération Compte de Résultat: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#7b1fa2' }}>📊 Compte de Résultat</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Produits et charges sur une période
              </p>
            </div>

            <div style={{ padding: '30px', background: '#fff9e6', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#f9a825' }}>📚 Rapport des Journaux</h4>
              <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px' }}>
                Sélectionnez un journal ou générez le rapport complet
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select 
                  id="rapportJournalSelect"
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Tous les journaux</option>
                  {data.journaux.map(j => (
                    <option key={j.id} value={j.id}>{j.code} - {j.nom}</option>
                  ))}
                </select>
                <Button 
                  variant="success"
                  onClick={async () => {
                    const journalId = document.getElementById('rapportJournalSelect').value;
                    setRapportModal({ open: true, type: 'journaux', data: null, loading: true });
                    try {
                      const params = { dateDebut: periode.dateDebut, dateFin: periode.dateFin };
                      if (journalId) params.journalId = journalId;
                      const rapport = await api.get('/comptabilite/rapport-journaux', params);
                      setRapportModal({ open: true, type: 'journaux', data: rapport, loading: false });
                    } catch (err) {
                      setRapportModal({ open: false, type: null, data: null, loading: false });
                      alert('Erreur génération Rapport Journaux: ' + err.message);
                    }
                  }}
                >
                  Générer
                </Button>
              </div>
            </div>

            <div style={{ padding: '30px', background: '#e8f5e9', borderRadius: '8px', cursor: 'pointer' }}
              onClick={async () => {
                setRapportModal({ open: true, type: 'flux', data: null, loading: true });
                try {
                  const rapport = await api.get('/comptabilite/rapports/flux-tresorerie', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  setRapportModal({ open: true, type: 'flux', data: rapport, loading: false });
                } catch (err) {
                  setRapportModal({ open: false, type: null, data: null, loading: false });
                  alert('Erreur génération Flux de Trésorerie: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#388e3c' }}>💰 Tableau des Flux de Trésorerie</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Mouvements de trésorerie par activité
              </p>
            </div>

            <div style={{ padding: '30px', background: '#fff3e0', borderRadius: '8px', cursor: 'pointer' }}
              onClick={async () => {
                setRapportModal({ open: true, type: 'journal-general', data: null, loading: true });
                try {
                  const rapport = await api.get('/comptabilite/rapports/journal-general', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  setRapportModal({ open: true, type: 'journal-general', data: rapport, loading: false });
                } catch (err) {
                  setRapportModal({ open: false, type: null, data: null, loading: false });
                  alert('Erreur génération Journal Général: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>📖 Journal Général</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Toutes les écritures comptables chronologiques
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recurrentes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>🔄 Écritures Récurrentes</h3>
            <Button onClick={() => openModal('recurrente')}>+ Nouvelle Écriture Récurrente</Button>
          </div>
          
          {data.ecrituresRecurrentes.length > 0 ? (
            <Table
              columns={[
                { key: 'nom', label: 'Nom' },
                { key: 'journal', label: 'Journal', render: (val) => val?.nom || 'N/A' },
                { key: 'frequence', label: 'Fréquence', render: (val) => {
                  const freq = {
                    'mensuel': '📅 Mensuel',
                    'trimestriel': '📊 Trimestriel',
                    'semestriel': '📆 Semestriel',
                    'annuel': '🗓️ Annuel'
                  };
                  return freq[val] || val;
                }},
                { key: 'prochaineDateGeneration', label: 'Prochaine Génération', render: (val) => val ? new Date(val).toLocaleDateString('fr-FR') : 'N/A' },
                { key: 'actif', label: 'Statut', render: (val) => (
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    background: val ? '#e8f5e9' : '#ffebee',
                    color: val ? '#2e7d32' : '#c62828',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {val ? 'Actif' : 'Inactif'}
                  </span>
                )}
              ]}
              data={data.ecrituresRecurrentes}
              onEdit={(item) => openModal('recurrente', item)}
              actions={true}
              extraActions={(item) => (
                <Button 
                  size="small" 
                  variant="success"
                  onClick={async () => {
                    if (confirm(`Générer une écriture depuis "${item.nom}" ?`)) {
                      try {
                        await api.post(`/ecritures-recurrentes/${item.id}/generer`, {
                          dateEcriture: new Date().toISOString().split('T')[0]
                        });
                        alert('Écriture générée avec succès !');
                        loadAllData();
                      } catch (err) {
                        alert('Erreur: ' + err.message);
                      }
                    }
                  }}
                >
                  ▶️ Générer
                </Button>
              )}
            />
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune écriture récurrente configurée</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'parametres' && (
        <div>
          <h3>⚙️ Paramètres Comptables</h3>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e1e8ed' }}>
            {[
              { id: 'journaux', label: '📚 Journaux' },
              { id: 'cloture', label: '🔒 Clôture Exercice' },
              { id: 'numerotation', label: '📝 Numérotation' },
              { id: 'validation', label: '✓ Validation' },
              { id: 'exercice', label: '📅 Exercice' },
              { id: 'affichage', label: '👁️ Affichage' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setParametresSubTab(tab.id)}
                style={{
                  padding: '10px 16px',
                  background: parametresSubTab === tab.id ? '#3498db' : '#ecf0f1',
                  color: parametresSubTab === tab.id ? '#fff' : '#34495e',
                  border: 'none',
                  borderRadius: '8px 8px 0 0',
                  fontWeight: parametresSubTab === tab.id ? 'bold' : 'normal',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {parametresSubTab === 'journaux' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h4 style={{ margin: 0 }}>📚 Journaux Comptables</h4>
                <Button onClick={() => openModal('journal')}>+ Nouveau Journal</Button>
              </div>
              <Table
                columns={[
                  { key: 'code', label: 'Code' },
                  { key: 'nom', label: 'Nom du Journal' },
                  { key: 'type', label: 'Type', render: (val) => {
                    const types = {
                      vente: '💰 Ventes',
                      achat: '🛒 Achats',
                      banque: '🏦 Banque',
                      caisse: '💵 Caisse',
                      od: '📝 Opérations Diverses'
                    };
                    return types[val] || val;
                  }}
                ]}
                data={data.journaux}
                onEdit={(item) => openModal('journal', item)}
                actions={true}
              />
            </div>
          )}

          {parametresSubTab === 'cloture' && (
            <ClotureExerciceTab api={api} />
          )}

          {parametresSubTab === 'numerotation' && (
            <div style={{ padding: '20px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: '#1976d2' }}>📝 Numérotation Automatique</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <FormField 
                  label="Préfixe des écritures" 
                  value={data.parametresComptables?.prefixeEcritures || 'EC'}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, prefixeEcritures: e.target.value };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                />
                <FormField 
                  label="Prochain numéro" 
                  type="number"
                  value={data.parametresComptables?.numeroSuivantEcriture || 1}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, numeroSuivantEcriture: parseInt(e.target.value) };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                />
                <FormField 
                  label="Format de numéro" 
                  value={data.parametresComptables?.formatNumeroEcriture || '[PREFIX]-[YEAR]-[NUM]'}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, formatNumeroEcriture: e.target.value };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                  placeholder="[PREFIX]-[YEAR]-[NUM]"
                />
              </div>
            </div>
          )}

          {parametresSubTab === 'validation' && (
            <div style={{ padding: '20px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: '#1976d2' }}>✓ Validation et Contrôle</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={data.parametresComptables?.validationAutomatique || false}
                      onChange={(e) => {
                        const updatedParams = { ...data.parametresComptables, validationAutomatique: e.target.checked };
                        setData({ ...data, parametresComptables: updatedParams });
                      }}
                    />
                    <span>Validation automatique des écritures</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={data.parametresComptables?.bloquerSiDesequilibre || true}
                      onChange={(e) => {
                        const updatedParams = { ...data.parametresComptables, bloquerSiDesequilibre: e.target.checked };
                        setData({ ...data, parametresComptables: updatedParams });
                      }}
                    />
                    <span>Bloquer si déséquilibre</span>
                  </label>
                </div>
                <FormField 
                  label="Tolérance de déséquilibre (FCFA)" 
                  type="number"
                  step="0.01"
                  value={data.parametresComptables?.toleranceDesequilibre || '0.01'}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, toleranceDesequilibre: e.target.value };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                />
              </div>
            </div>
          )}

          {parametresSubTab === 'exercice' && (
            <div style={{ padding: '20px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: '#1976d2' }}>📅 Exercice Comptable</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField 
                  label="Exercice courant" 
                  value={data.parametresComptables?.exerciceCourant || new Date().getFullYear().toString()}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, exerciceCourant: e.target.value };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                  placeholder="2025"
                />
                <FormField 
                  label="Date limite de clôture" 
                  type="date"
                  value={data.parametresComptables?.clotureDateLimite || ''}
                  onChange={(e) => {
                    const updatedParams = { ...data.parametresComptables, clotureDateLimite: e.target.value };
                    setData({ ...data, parametresComptables: updatedParams });
                  }}
                />
              </div>
            </div>
          )}

          {parametresSubTab === 'affichage' && (
            <div style={{ padding: '20px', background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: '#1976d2' }}>👁️ Options d'Affichage</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={data.parametresComptables?.afficherSoldesComptes || true}
                      onChange={(e) => {
                        const updatedParams = { ...data.parametresComptables, afficherSoldesComptes: e.target.checked };
                        setData({ ...data, parametresComptables: updatedParams });
                      }}
                    />
                    <span>Afficher les soldes des comptes</span>
                  </label>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={data.parametresComptables?.afficherCodeComplet || true}
                      onChange={(e) => {
                        const updatedParams = { ...data.parametresComptables, afficherCodeComplet: e.target.checked };
                        setData({ ...data, parametresComptables: updatedParams });
                      }}
                    />
                    <span>Afficher le code comptable complet</span>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <Button 
                  variant="success"
                  onClick={async () => {
                    try {
                      await api.put('/ecritures-recurrentes/parametres/comptables', data.parametresComptables);
                      alert('Paramètres comptables sauvegardés avec succès !');
                      loadAllData();
                    } catch (err) {
                      alert('Erreur: ' + err.message);
                    }
                  }}
                >
                  💾 Enregistrer les Paramètres
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={
          modal.type === 'compte' ? (modal.item ? 'Modifier Compte' : 'Nouveau Compte Comptable') :
          modal.type === 'journal' ? (modal.item ? 'Modifier Journal' : 'Nouveau Journal') :
          modal.type === 'ecriture' ? 'Nouvelle Écriture Comptable' :
          modal.type === 'details_ecriture' ? `Détails Écriture - ${modal.item?.reference || ''}` :
          modal.type === 'recurrente' ? (modal.item ? 'Modifier Écriture Récurrente' : 'Nouvelle Écriture Récurrente') :
          modal.type === 'immobilisation' ? (modal.item ? 'Modifier Immobilisation' : 'Nouvelle Immobilisation') : ''
        }
        size={modal.type === 'ecriture' || modal.type === 'recurrente' || modal.type === 'details_ecriture' ? 'xlarge' : 'large'}
      >
        <form onSubmit={handleSubmit}>
          {modal.type === 'compte' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Numéro de Compte" name="numero" value={form.numero}
                  onChange={(e) => setForm({...form, numero: e.target.value})} required
                  placeholder="Ex: 601000" />
                <FormField label="Nom du Compte" name="nom" value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})} required />
                <FormField label="Catégorie" name="categorie" type="select" value={form.categorie}
                  onChange={(e) => setForm({...form, categorie: e.target.value})}
                  options={[
                    { value: 'Actif', label: 'Actif' },
                    { value: 'Passif', label: 'Passif' },
                    { value: 'Capitaux propres', label: 'Capitaux Propres' },
                    { value: 'Charges', label: 'Charges' },
                    { value: 'Produits', label: 'Produits' }
                  ]} />
                <FormField label="Sous-Catégorie" name="sousCategorie" value={form.sousCategorie}
                  onChange={(e) => setForm({...form, sousCategorie: e.target.value})} />
                <FormField label="Devise" name="devise" type="select" value={form.devise}
                  onChange={(e) => setForm({...form, devise: e.target.value})}
                  options={[
                    { value: 'XOF', label: 'XOF (FCFA)' },
                    { value: 'EUR', label: 'EUR (Euro)' },
                    { value: 'USD', label: 'USD (Dollar)' }
                  ]} />
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'journal' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                <FormField label="Code" name="code" value={form.code}
                  onChange={(e) => setForm({...form, code: e.target.value})} required
                  placeholder="Ex: VE" />
                <FormField label="Nom du Journal" name="nom" value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})} required />
                <FormField label="Type" name="type" type="select" value={form.type}
                  onChange={(e) => setForm({...form, type: e.target.value})}
                  options={[
                    { value: 'vente', label: 'Ventes' },
                    { value: 'achat', label: 'Achats' },
                    { value: 'banque', label: 'Banque' },
                    { value: 'caisse', label: 'Caisse' },
                    { value: 'od', label: 'Opérations Diverses' }
                  ]} />
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'recurrente' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <FormField label="Nom" value={form.nom}
                  onChange={(e) => setForm({...form, nom: e.target.value})} required
                  placeholder="Ex: Loyer mensuel" />
                <FormField label="Journal" type="select" value={form.journalId}
                  onChange={(e) => setForm({...form, journalId: parseInt(e.target.value)})}
                  options={data.journaux.map(j => ({ value: j.id, label: `${j.code} - ${j.nom}` }))} required />
                <FormField label="Description" value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Détails supplémentaires" />
                <FormField label="Fréquence" type="select" value={form.frequence}
                  onChange={(e) => setForm({...form, frequence: e.target.value})}
                  options={[
                    { value: 'mensuel', label: '📅 Mensuel' },
                    { value: 'trimestriel', label: '📊 Trimestriel' },
                    { value: 'semestriel', label: '📆 Semestriel' },
                    { value: 'annuel', label: '🗓️ Annuel' }
                  ]} required />
                <FormField label="Jour du mois (1-31)" type="number" value={form.jourDuMois}
                  onChange={(e) => setForm({...form, jourDuMois: parseInt(e.target.value)})}
                  min="1" max="31" />
                <FormField label="Mois de début (pour annuel)" type="number" value={form.moisDebut}
                  onChange={(e) => setForm({...form, moisDebut: parseInt(e.target.value)})}
                  min="1" max="12" />
                <FormField label="Date de début" type="date" value={form.dateDebut}
                  onChange={(e) => setForm({...form, dateDebut: e.target.value})} required />
                <FormField label="Date de fin (optionnel)" type="date" value={form.dateFin}
                  onChange={(e) => setForm({...form, dateFin: e.target.value})} />
              </div>

              <h4>Lignes du Modèle</h4>
              {(form.lignesModele || []).map((ligne, index) => (
                <div key={index} style={{ 
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 60px', gap: '10px', 
                  marginBottom: '10px', alignItems: 'end', padding: '10px', background: '#f8f9fa', borderRadius: '4px'
                }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#666' }}>Compte</label>
                    <select value={ligne.compteId}
                      onChange={(e) => {
                        const newLignes = [...form.lignesModele];
                        newLignes[index].compteId = parseInt(e.target.value);
                        setForm({...form, lignesModele: newLignes});
                      }}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      required>
                      <option value="">Sélectionner</option>
                      {data.comptes.map(c => (
                        <option key={c.id} value={c.id}>{c.numero} - {c.nom}</option>
                      ))}
                    </select>
                  </div>
                  <FormField label="Description" value={ligne.description}
                    onChange={(e) => {
                      const newLignes = [...form.lignesModele];
                      newLignes[index].description = e.target.value;
                      setForm({...form, lignesModele: newLignes});
                    }} />
                  <FormField label="Type" type="select" value={ligne.type}
                    onChange={(e) => {
                      const newLignes = [...form.lignesModele];
                      newLignes[index].type = e.target.value;
                      setForm({...form, lignesModele: newLignes});
                    }}
                    options={[
                      { value: 'debit', label: 'Débit' },
                      { value: 'credit', label: 'Crédit' }
                    ]} required />
                  <FormField label="Montant" type="number" value={ligne.montant}
                    onChange={(e) => {
                      const newLignes = [...form.lignesModele];
                      newLignes[index].montant = parseFloat(e.target.value) || 0;
                      setForm({...form, lignesModele: newLignes});
                    }} />
                  <Button type="button" variant="danger" size="small" 
                    onClick={() => {
                      const newLignes = form.lignesModele.filter((_, i) => i !== index);
                      setForm({...form, lignesModele: newLignes.length > 0 ? newLignes : [{ compteId: '', montant: 0, type: 'debit', description: '' }]});
                    }}
                    disabled={form.lignesModele.length <= 2} style={{ marginTop: '20px' }}>×</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="small" onClick={() => {
                setForm({
                  ...form,
                  lignesModele: [...(form.lignesModele || []), { compteId: '', montant: 0, type: 'debit', description: '' }]
                });
              }}>
                + Ajouter une ligne
              </Button>

              {(() => {
                const totalDebit = (form.lignesModele || []).filter(l => l.type === 'debit').reduce((sum, l) => sum + parseFloat(l.montant || 0), 0);
                const totalCredit = (form.lignesModele || []).filter(l => l.type === 'credit').reduce((sum, l) => sum + parseFloat(l.montant || 0), 0);
                const difference = totalDebit - totalCredit;
                return (
                  <div style={{ marginTop: '20px', padding: '15px', background: difference === 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>TOTAL DÉBIT</p>
                        <h3 style={{ margin: '5px 0 0 0', color: '#1976d2' }}>{totalDebit.toLocaleString('fr-FR')} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>TOTAL CRÉDIT</p>
                        <h3 style={{ margin: '5px 0 0 0', color: '#7b1fa2' }}>{totalCredit.toLocaleString('fr-FR')} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>DIFFÉRENCE</p>
                        <h3 style={{ margin: '5px 0 0 0', color: difference === 0 ? '#388e3c' : '#d32f2f' }}>
                          {difference.toLocaleString('fr-FR')} FCFA {difference === 0 ? '✓' : '✗'}
                        </h3>
                      </div>
                    </div>
                    {difference !== 0 && (
                      <p style={{ margin: '10px 0 0 0', color: '#d32f2f', fontSize: '12px' }}>
                        ⚠️ L'écriture doit être équilibrée (Débit = Crédit)
                      </p>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'ecriture' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <FormField label="Journal" name="journalId" type="select" value={form.journalId}
                  onChange={(e) => setForm({...form, journalId: e.target.value})}
                  options={data.journaux.map(j => ({ value: j.id, label: `${j.code} - ${j.nom}` }))} required />
                <FormField label="Date" name="date" type="date" value={form.date}
                  onChange={(e) => setForm({...form, date: e.target.value})} required />
                <FormField label="Libellé" name="libelle" value={form.libelle}
                  onChange={(e) => setForm({...form, libelle: e.target.value})} required />
                <FormField label="Référence" name="reference" value={form.reference}
                  onChange={(e) => setForm({...form, reference: e.target.value})}
                  placeholder="N° pièce justificative" />
              </div>

              <h4>Lignes d'Écriture</h4>
              {(form.lignes || []).map((ligne, index) => (
                <div key={index} style={{ 
                  display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 60px', gap: '10px', 
                  marginBottom: '10px', alignItems: 'end', padding: '10px', background: '#f8f9fa', borderRadius: '4px'
                }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#666' }}>Compte</label>
                    <select value={ligne.compteId}
                      onChange={(e) => updateLigneEcriture(index, 'compteId', e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                      required>
                      <option value="">Sélectionner</option>
                      {data.comptes.map(c => (
                        <option key={c.id} value={c.id}>{c.numero} - {c.nom}</option>
                      ))}
                    </select>
                  </div>
                  <FormField label="Libellé" value={ligne.libelle}
                    onChange={(e) => updateLigneEcriture(index, 'libelle', e.target.value)} />
                  <FormField label="Débit" type="number" value={ligne.debit}
                    onChange={(e) => updateLigneEcriture(index, 'debit', parseFloat(e.target.value) || 0)} />
                  <FormField label="Crédit" type="number" value={ligne.credit}
                    onChange={(e) => updateLigneEcriture(index, 'credit', parseFloat(e.target.value) || 0)} />
                  <Button type="button" variant="danger" size="small" onClick={() => removeLigneEcriture(index)}
                    disabled={form.lignes.length <= 2} style={{ marginTop: '20px' }}>×</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="small" onClick={addLigneEcriture}>
                + Ajouter une ligne
              </Button>

              {(() => {
                const { totalDebit, totalCredit, difference } = calculateTotaux();
                return (
                  <div style={{ marginTop: '20px', padding: '15px', background: difference === 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>TOTAL DÉBIT</p>
                        <h3 style={{ margin: '5px 0 0 0', color: '#1976d2' }}>{totalDebit.toLocaleString('fr-FR')} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>TOTAL CRÉDIT</p>
                        <h3 style={{ margin: '5px 0 0 0', color: '#7b1fa2' }}>{totalCredit.toLocaleString('fr-FR')} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>DIFFÉRENCE</p>
                        <h3 style={{ margin: '5px 0 0 0', color: difference === 0 ? '#388e3c' : '#d32f2f' }}>
                          {difference.toLocaleString('fr-FR')} FCFA {difference === 0 ? '✓' : '✗'}
                        </h3>
                      </div>
                    </div>
                    {difference !== 0 && (
                      <p style={{ margin: '10px 0 0 0', color: '#d32f2f', fontSize: '12px' }}>
                        ⚠️ L'écriture doit être équilibrée (Débit = Crédit)
                      </p>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success" disabled={calculateTotaux().difference !== 0}>
                  Enregistrer l'Écriture
                </Button>
              </div>
            </>
          )}

          {modal.type === 'immobilisation' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Référence" name="reference" value={form.reference}
                  onChange={(e) => setForm({...form, reference: e.target.value})} required />
                <FormField label="Description" name="description" value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})} required />
                <FormField label="Catégorie ID (temporaire)" name="categorieId" type="number" value={form.categorieId}
                  onChange={(e) => setForm({...form, categorieId: parseInt(e.target.value)})} required
                  placeholder="1" />
                <FormField label="Date d'Acquisition" name="dateAcquisition" type="date" value={form.dateAcquisition}
                  onChange={(e) => setForm({...form, dateAcquisition: e.target.value})} required />
                <FormField label="Valeur d'Acquisition (FCFA)" name="valeurAcquisition" type="number" value={form.valeurAcquisition}
                  onChange={(e) => setForm({...form, valeurAcquisition: parseFloat(e.target.value)})} required />
              </div>
              <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#856404' }}>
                  💡 <strong>Note:</strong> Les catégories et calcul d'amortissement automatique seront ajoutés prochainement.
                </p>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">{modal.item ? 'Mettre à jour' : 'Créer'}</Button>
              </div>
            </>
          )}

          {modal.type === 'details_ecriture' && modal.item && (
            <div style={{ padding: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Informations Générales</h4>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Date:</strong> {new Date(modal.item.dateEcriture).toLocaleDateString('fr-FR')}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Référence:</strong> {modal.item.reference || '-'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Description:</strong> {modal.item.description || '-'}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Statut:</strong> <span style={{ 
                      color: modal.item.statut === 'validée' ? '#4caf50' : '#ff9800', 
                      fontWeight: 'bold' 
                    }}>{modal.item.statut?.toUpperCase() || '-'}</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Totaux</h4>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Total Débit:</strong> {parseFloat(modal.item.totalDebit || 0).toLocaleString('fr-FR')} FCFA
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Total Crédit:</strong> {parseFloat(modal.item.totalCredit || 0).toLocaleString('fr-FR')} FCFA
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Équilibre:</strong> {
                      parseFloat(modal.item.totalDebit || 0) === parseFloat(modal.item.totalCredit || 0) 
                        ? <span style={{ color: '#4caf50' }}>✓ Équilibré</span>
                        : <span style={{ color: '#d32f2f' }}>✗ Non équilibré</span>
                    }
                  </div>
                </div>
              </div>

              {modal.item.lignes && modal.item.lignes.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Lignes d'Écriture</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Compte</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Débit</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Crédit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.item.lignes.map((ligne, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '10px' }}>
                            {ligne.compte ? `${ligne.compte.numero} - ${ligne.compte.nom}` : '-'}
                          </td>
                          <td style={{ padding: '10px' }}>{ligne.description || '-'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#1976d2', fontWeight: 'bold' }}>
                            {ligne.type === 'debit' ? `${parseFloat(ligne.montant).toLocaleString('fr-FR')} FCFA` : '-'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#7b1fa2', fontWeight: 'bold' }}>
                            {ligne.type === 'credit' ? `${parseFloat(ligne.montant).toLocaleString('fr-FR')} FCFA` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal Rapport Bilan/Résultat */}
      {rapportModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '95%', maxWidth: '1100px',
            maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: rapportModal.type === 'bilan' ? '#e3f2fd' : rapportModal.type === 'resultat' ? '#f3e5f5' : rapportModal.type === 'journaux' ? '#fff9e6' : rapportModal.type === 'flux' ? '#e8f5e9' : '#fff3e0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {rapportModal.data?.entreprise?.logo && (
                  <img src={rapportModal.data.entreprise.logo} alt="Logo" 
                    style={{ height: '50px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: rapportModal.type === 'bilan' ? '#1976d2' : rapportModal.type === 'resultat' ? '#7b1fa2' : rapportModal.type === 'journaux' ? '#f9a825' : rapportModal.type === 'flux' ? '#388e3c' : '#f57c00' }}>
                    {rapportModal.type === 'bilan' ? '📄 Bilan Comptable' : 
                     rapportModal.type === 'resultat' ? '📊 Compte de Résultat' :
                     rapportModal.type === 'journaux' ? '📚 Rapport des Journaux' :
                     rapportModal.type === 'flux' ? '💰 Tableau des Flux de Trésorerie' :
                     '📖 Journal Général'}
                  </h3>
                  {rapportModal.data?.entreprise?.nom && (
                    <div style={{ fontSize: '14px', color: '#333', marginTop: '3px', fontWeight: 'bold' }}>
                      {rapportModal.data.entreprise.nom}
                    </div>
                  )}
                  {rapportModal.data?.entreprise && (rapportModal.data.entreprise.adresse || rapportModal.data.entreprise.telephone || rapportModal.data.entreprise.rccm) && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      {[rapportModal.data.entreprise.adresse, rapportModal.data.entreprise.telephone, rapportModal.data.entreprise.rccm ? `RCCM: ${rapportModal.data.entreprise.rccm}` : null, rapportModal.data.entreprise.ifu ? `IFU: ${rapportModal.data.entreprise.ifu}` : null].filter(Boolean).join(' | ')}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#888', background: '#f5f5f5', padding: '4px 10px', borderRadius: '4px' }}>
                  {periode.dateDebut} au {periode.dateFin}
                </span>
                <button onClick={() => setRapportModal({ open: false, type: null, data: null, loading: false })} style={{
                  background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666'
                }}>&times;</button>
              </div>
            </div>
            <div id="rapport-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {rapportModal.loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>Chargement du rapport...</div>
              ) : rapportModal.type === 'bilan' && rapportModal.data ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* ACTIF */}
                    <div style={{ border: '1px solid #bbdefb', borderRadius: '8px', overflow: 'hidden' }}>
                      <h4 style={{ color: 'white', backgroundColor: '#1976d2', padding: '12px 16px', margin: 0, textAlign: 'center', fontSize: '16px' }}>ACTIF</h4>
                      
                      <div style={{ padding: '15px' }}>
                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: '#1976d2', marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #e3f2fd', paddingBottom: '5px' }}>ACTIF IMMOBILISÉ</h5>
                          {(rapportModal.data.actif?.immobilise || []).map((c, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                              <span style={{ color: '#333' }}>{c.numero} - {c.nom}</span>
                              <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round(c.solde).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          ))}
                          {(rapportModal.data.actif?.amortissements || []).length > 0 && (
                            <>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', marginBottom: '5px', fontStyle: 'italic' }}>Amortissements (en déduction)</div>
                              {(rapportModal.data.actif?.amortissements || []).map((c, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #f5f5f5', fontSize: '13px', backgroundColor: '#fff3e0' }}>
                                  <span style={{ color: '#666' }}>{c.numero} - {c.nom}</span>
                                  <span style={{ fontWeight: 'bold', color: '#e65100' }}>-{Math.round(c.solde).toLocaleString('fr-FR')} FCFA</span>
                                </div>
                              ))}
                            </>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#e3f2fd', fontWeight: 'bold', marginTop: '8px', borderRadius: '4px', fontSize: '13px' }}>
                            <span>Sous-total Immobilisations nettes</span>
                            <span>{Math.round((rapportModal.data.actif?.immobilise || []).reduce((s,c) => s + (c.solde || 0), 0) - (rapportModal.data.actif?.amortissements || []).reduce((s,c) => s + (c.solde || 0), 0)).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: '#1976d2', marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #e3f2fd', paddingBottom: '5px' }}>ACTIF CIRCULANT</h5>
                          {(rapportModal.data.actif?.circulant || []).map((c, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                              <span style={{ color: '#333' }}>{c.numero} - {c.nom}</span>
                              <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round(c.solde).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#e3f2fd', fontWeight: 'bold', marginTop: '8px', borderRadius: '4px', fontSize: '13px' }}>
                            <span>Sous-total Actif Circulant</span>
                            <span>{Math.round((rapportModal.data.actif?.circulant || []).reduce((s,c) => s + (c.solde || 0), 0)).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: '#1976d2', marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #e3f2fd', paddingBottom: '5px' }}>TRÉSORERIE ACTIF</h5>
                          {(rapportModal.data.actif?.tresorerie || []).map((c, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                              <span style={{ color: '#333' }}>{c.numero} - {c.nom}</span>
                              <span style={{ fontWeight: 'bold', color: '#1976d2' }}>{Math.round(c.solde).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#e3f2fd', fontWeight: 'bold', marginTop: '8px', borderRadius: '4px', fontSize: '13px' }}>
                            <span>Sous-total Trésorerie</span>
                            <span>{Math.round((rapportModal.data.actif?.tresorerie || []).reduce((s,c) => s + (c.solde || 0), 0)).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#1565c0', color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                        <span>TOTAL ACTIF</span>
                        <span>{Math.round(rapportModal.data.actif?.total || 0).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>

                    {/* PASSIF */}
                    <div style={{ border: '1px solid #e1bee7', borderRadius: '8px', overflow: 'hidden' }}>
                      <h4 style={{ color: 'white', backgroundColor: '#7b1fa2', padding: '12px 16px', margin: 0, textAlign: 'center', fontSize: '16px' }}>PASSIF</h4>
                      
                      <div style={{ padding: '15px' }}>
                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: '#7b1fa2', marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #f3e5f5', paddingBottom: '5px' }}>CAPITAUX PROPRES</h5>
                          {(rapportModal.data.passif?.capitaux || []).map((c, i) => (
                            <div key={i} style={{ 
                              display: 'flex', justifyContent: 'space-between', padding: '6px 8px', 
                              borderBottom: '1px solid #f5f5f5', fontSize: '13px',
                              backgroundColor: c.isResultat ? (c.isPerte ? '#ffebee' : '#e8f5e9') : 'transparent'
                            }}>
                              <span style={{ color: c.isResultat ? (c.isPerte ? '#c62828' : '#2e7d32') : '#333', fontWeight: c.isResultat ? 'bold' : 'normal' }}>
                                {c.numero} - {c.nom}
                              </span>
                              <span style={{ fontWeight: 'bold', color: c.isResultat ? (c.isPerte ? '#c62828' : '#2e7d32') : '#7b1fa2' }}>
                                {c.isPerte ? '-' : ''}{Math.round(c.solde).toLocaleString('fr-FR')} FCFA
                              </span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#f3e5f5', fontWeight: 'bold', marginTop: '8px', borderRadius: '4px', fontSize: '13px' }}>
                            <span>Sous-total Capitaux Propres</span>
                            <span>{Math.round((rapportModal.data.passif?.capitaux || []).reduce((s,c) => s + (c.isPerte ? -(c.solde || 0) : (c.solde || 0)), 0)).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: '#7b1fa2', marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #f3e5f5', paddingBottom: '5px' }}>DETTES</h5>
                          {(rapportModal.data.passif?.dettes || []).map((c, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                              <span style={{ color: '#333' }}>{c.numero} - {c.nom}</span>
                              <span style={{ fontWeight: 'bold', color: '#7b1fa2' }}>{Math.round(c.solde).toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: '#f3e5f5', fontWeight: 'bold', marginTop: '8px', borderRadius: '4px', fontSize: '13px' }}>
                            <span>Sous-total Dettes</span>
                            <span>{Math.round((rapportModal.data.passif?.dettes || []).reduce((s,c) => s + (c.solde || 0), 0)).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#6a1b9a', color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                        <span>TOTAL PASSIF</span>
                        <span>{Math.round(rapportModal.data.passif?.total || 0).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Vérification équilibre */}
                  <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    <div style={{ padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Actif</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976d2' }}>{Math.round(rapportModal.data.actif?.total || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                    <div style={{ padding: '15px', backgroundColor: rapportModal.data.equilibre ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                      {rapportModal.data.equilibre 
                        ? <div style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: '16px' }}>✅ BILAN ÉQUILIBRÉ</div>
                        : <div>
                            <div style={{ color: '#c62828', fontWeight: 'bold' }}>⚠️ ÉCART</div>
                            <div style={{ color: '#c62828', fontSize: '14px' }}>{Math.round(Math.abs(rapportModal.data.actif?.total - rapportModal.data.passif?.total)).toLocaleString('fr-FR')} FCFA</div>
                          </div>
                      }
                    </div>
                    <div style={{ padding: '15px', backgroundColor: '#f3e5f5', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Total Passif</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b1fa2' }}>{Math.round(rapportModal.data.passif?.total || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                  </div>

                  {/* Résultat de l'exercice */}
                  {rapportModal.data.resultatNet !== undefined && (
                    <div style={{ marginTop: '15px', padding: '15px', backgroundColor: rapportModal.data.resultatNet >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Résultat de l'exercice</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.resultatNet >= 0 ? '#2e7d32' : '#c62828' }}>
                        {rapportModal.data.resultatNet >= 0 ? 'BÉNÉFICE: ' : 'PERTE: '}
                        {Math.round(Math.abs(rapportModal.data.resultatNet)).toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  )}
                </div>
              ) : rapportModal.type === 'resultat' && rapportModal.data ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* PRODUITS */}
                    <div>
                      <h4 style={{ color: '#2e7d32', borderBottom: '2px solid #2e7d32', paddingBottom: '10px' }}>PRODUITS</h4>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <h5 style={{ color: '#666', marginBottom: '10px' }}>Exploitation</h5>
                        {(rapportModal.data.produits?.exploitation || []).map((c, i) => (
                          <div key={i} onClick={async () => {
                            setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: [], loading: true });
                            try {
                              const ecritures = await api.get(`/comptabilite/compte/${c.id}/ecritures`, { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                              setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: ecritures || [], loading: false });
                            } catch (e) { setDrillModal(prev => ({ ...prev, loading: false })); }
                          }} style={{ 
                            display: 'flex', justifyContent: 'space-between', padding: '8px 12px', 
                            borderBottom: '1px solid #eee', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f5e9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <span>{c.compte}</span>
                            <span style={{ fontWeight: 'bold', color: '#2e7d32' }}>{parseFloat(c.montant).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <h5 style={{ color: '#666', marginBottom: '10px' }}>Financiers</h5>
                        {(rapportModal.data.produits?.financiers || []).map((c, i) => (
                          <div key={i} onClick={async () => {
                            setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: [], loading: true });
                            try {
                              const ecritures = await api.get(`/comptabilite/compte/${c.id}/ecritures`, { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                              setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: ecritures || [], loading: false });
                            } catch (e) { setDrillModal(prev => ({ ...prev, loading: false })); }
                          }} style={{ 
                            display: 'flex', justifyContent: 'space-between', padding: '8px 12px', 
                            borderBottom: '1px solid #eee', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f5e9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <span>{c.compte}</span>
                            <span style={{ fontWeight: 'bold', color: '#2e7d32' }}>{parseFloat(c.montant).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#2e7d32', color: 'white', fontWeight: 'bold', borderRadius: '4px' }}>
                        <span>TOTAL PRODUITS</span>
                        <span>{parseFloat(rapportModal.data.produits?.total || 0).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>

                    {/* CHARGES */}
                    <div>
                      <h4 style={{ color: '#c62828', borderBottom: '2px solid #c62828', paddingBottom: '10px' }}>CHARGES</h4>
                      
                      <div style={{ marginBottom: '20px' }}>
                        <h5 style={{ color: '#666', marginBottom: '10px' }}>Exploitation</h5>
                        {(rapportModal.data.charges?.exploitation || []).map((c, i) => (
                          <div key={i} onClick={async () => {
                            setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: [], loading: true });
                            try {
                              const ecritures = await api.get(`/comptabilite/compte/${c.id}/ecritures`, { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                              setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: ecritures || [], loading: false });
                            } catch (e) { setDrillModal(prev => ({ ...prev, loading: false })); }
                          }} style={{ 
                            display: 'flex', justifyContent: 'space-between', padding: '8px 12px', 
                            borderBottom: '1px solid #eee', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <span>{c.compte}</span>
                            <span style={{ fontWeight: 'bold', color: '#c62828' }}>{parseFloat(c.montant).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <h5 style={{ color: '#666', marginBottom: '10px' }}>Financières</h5>
                        {(rapportModal.data.charges?.financieres || []).map((c, i) => (
                          <div key={i} onClick={async () => {
                            setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: [], loading: true });
                            try {
                              const ecritures = await api.get(`/comptabilite/compte/${c.id}/ecritures`, { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                              setDrillModal({ open: true, title: `Détail: ${c.compte}`, data: ecritures || [], loading: false });
                            } catch (e) { setDrillModal(prev => ({ ...prev, loading: false })); }
                          }} style={{ 
                            display: 'flex', justifyContent: 'space-between', padding: '8px 12px', 
                            borderBottom: '1px solid #eee', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                            <span>{c.compte}</span>
                            <span style={{ fontWeight: 'bold', color: '#c62828' }}>{parseFloat(c.montant).toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#c62828', color: 'white', fontWeight: 'bold', borderRadius: '4px' }}>
                        <span>TOTAL CHARGES</span>
                        <span>{parseFloat(rapportModal.data.charges?.total || 0).toLocaleString('fr-FR')} FCFA</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>Résultats</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                      <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Résultat Exploitation</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.resultatExploitation >= 0 ? '#2e7d32' : '#c62828' }}>
                          {parseFloat(rapportModal.data.resultatExploitation || 0).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Résultat Financier</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.resultatFinancier >= 0 ? '#2e7d32' : '#c62828' }}>
                          {parseFloat(rapportModal.data.resultatFinancier || 0).toLocaleString('fr-FR')} FCFA
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '15px', backgroundColor: rapportModal.data.benefice ? '#e8f5e9' : '#ffebee', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Résultat Net</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: rapportModal.data.benefice ? '#2e7d32' : '#c62828' }}>
                          {parseFloat(rapportModal.data.resultatNet || 0).toLocaleString('fr-FR')} FCFA
                        </div>
                        <div style={{ fontSize: '12px', marginTop: '5px' }}>
                          {rapportModal.data.benefice ? '✅ Bénéfice' : '❌ Perte'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : rapportModal.type === 'journaux' && rapportModal.data ? (
                <div>
                  {/* Totaux généraux */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Journaux actifs</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f9a825' }}>{rapportModal.data.journaux?.length || 0}</div>
                    </div>
                    <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Écritures</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{rapportModal.data.totaux?.nombreEcritures || 0}</div>
                    </div>
                    <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Débit</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976d2' }}>{(rapportModal.data.totaux?.debit || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                    <div style={{ padding: '15px', background: '#f3e5f5', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Crédit</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b1fa2' }}>{(rapportModal.data.totaux?.credit || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                  </div>
                  
                  {/* Liste des journaux */}
                  {(rapportModal.data.journaux || []).map((journal, idx) => (
                    <div key={idx} style={{ marginBottom: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 15px', background: '#fff9e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#f9a825' }}>{journal.code}</span>
                          <span style={{ marginLeft: '10px', color: '#333' }}>{journal.nom}</span>
                          <span style={{ marginLeft: '10px', fontSize: '12px', color: '#666', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>{journal.type}</span>
                        </div>
                        <span style={{ fontSize: '13px', color: '#666' }}>{journal.nombreEcritures} écriture(s)</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee', fontSize: '12px' }}>Date</th>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee', fontSize: '12px' }}>Référence</th>
                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #eee', fontSize: '12px' }}>Libellé</th>
                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #eee', fontSize: '12px' }}>Débit</th>
                            <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid #eee', fontSize: '12px' }}>Crédit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(journal.ecritures || []).map((e, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '-'}</td>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{e.reference || '-'}</td>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{e.libelle || '-'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#1976d2' }}>{e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '-'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#7b1fa2' }}>{e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#fff9e6', fontWeight: 'bold' }}>
                            <td colSpan="3" style={{ padding: '10px' }}>Total {journal.code}</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#1976d2' }}>{(journal.debit || 0).toLocaleString('fr-FR')} FCFA</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#7b1fa2' }}>{(journal.credit || 0).toLocaleString('fr-FR')} FCFA</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                  
                  {/* Équilibre */}
                  <div style={{ marginTop: '15px', padding: '15px', background: rapportModal.data.totaux?.equilibre ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                    {rapportModal.data.totaux?.equilibre 
                      ? <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Tous les journaux sont équilibrés</span>
                      : <span style={{ color: '#c62828', fontWeight: 'bold' }}>⚠️ Écart détecté entre débits et crédits</span>
                    }
                  </div>
                </div>
              ) : rapportModal.type === 'flux' && rapportModal.data ? (
                <div>
                  {/* Flux d'exploitation */}
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ color: '#388e3c', borderBottom: '2px solid #388e3c', paddingBottom: '10px' }}>Flux de Trésorerie liés à l'Exploitation</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                      <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Encaissements</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>{(rapportModal.data.fluxExploitation?.encaissements || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Décaissements</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c62828' }}>{(rapportModal.data.fluxExploitation?.decaissements || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: rapportModal.data.fluxExploitation?.net >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Flux Net Exploitation</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.fluxExploitation?.net >= 0 ? '#2e7d32' : '#c62828' }}>{(rapportModal.data.fluxExploitation?.net || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                    </div>
                  </div>

                  {/* Flux d'investissement */}
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ color: '#1976d2', borderBottom: '2px solid #1976d2', paddingBottom: '10px' }}>Flux de Trésorerie liés aux Investissements</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ padding: '20px', background: '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Acquisitions</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c62828' }}>{(rapportModal.data.fluxInvestissement?.acquisitions || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Cessions</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>{(rapportModal.data.fluxInvestissement?.cessions || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: rapportModal.data.fluxInvestissement?.net >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Flux Net Investissement</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.fluxInvestissement?.net >= 0 ? '#2e7d32' : '#c62828' }}>{(rapportModal.data.fluxInvestissement?.net || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                    </div>
                    {(rapportModal.data.fluxInvestissement?.details || []).length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                          <tr style={{ background: '#e3f2fd' }}>
                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Compte</th>
                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Libellé</th>
                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Acquisitions</th>
                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Cessions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rapportModal.data.fluxInvestissement?.details || []).map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{d.compte}</td>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{d.nom}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>{d.acquisitions > 0 ? d.acquisitions.toLocaleString('fr-FR') : '-'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#2e7d32' }}>{d.cessions > 0 ? d.cessions.toLocaleString('fr-FR') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Flux de financement */}
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ color: '#f57c00', borderBottom: '2px solid #f57c00', paddingBottom: '10px' }}>Flux de Trésorerie liés au Financement</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Apports (Capital, Emprunts)</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2e7d32' }}>{(rapportModal.data.fluxFinancement?.apports || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Remboursements</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c62828' }}>{(rapportModal.data.fluxFinancement?.remboursements || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                      <div style={{ padding: '20px', background: rapportModal.data.fluxFinancement?.net >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>Flux Net Financement</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: rapportModal.data.fluxFinancement?.net >= 0 ? '#2e7d32' : '#c62828' }}>{(rapportModal.data.fluxFinancement?.net || 0).toLocaleString('fr-FR')} FCFA</div>
                      </div>
                    </div>
                    {(rapportModal.data.fluxFinancement?.details || []).length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                          <tr style={{ background: '#fff3e0' }}>
                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Compte</th>
                            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Libellé</th>
                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Apports</th>
                            <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Remboursements</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(rapportModal.data.fluxFinancement?.details || []).map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{d.compte}</td>
                              <td style={{ padding: '8px 10px', fontSize: '13px' }}>{d.nom}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#2e7d32' }}>{d.apports > 0 ? d.apports.toLocaleString('fr-FR') : '-'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>{d.remboursements > 0 ? d.remboursements.toLocaleString('fr-FR') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Comptes de Trésorerie */}
                  <div style={{ marginBottom: '25px' }}>
                    <h4 style={{ color: '#7b1fa2', borderBottom: '2px solid #7b1fa2', paddingBottom: '10px' }}>Mouvements des Comptes de Trésorerie</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f3e5f5' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Compte</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Libellé</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Entrées</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Sorties</th>
                          <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Solde</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rapportModal.data.fluxTresorerie?.comptes || []).map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 10px', fontSize: '13px' }}>{c.numero}</td>
                            <td style={{ padding: '8px 10px', fontSize: '13px' }}>{c.nom}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#2e7d32' }}>{c.entrees > 0 ? c.entrees.toLocaleString('fr-FR') : '-'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>{c.sorties > 0 ? c.sorties.toLocaleString('fr-FR') : '-'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold', color: c.solde >= 0 ? '#2e7d32' : '#c62828' }}>{c.solde.toLocaleString('fr-FR')} FCFA</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f3e5f5', fontWeight: 'bold' }}>
                          <td colSpan="2" style={{ padding: '10px' }}>TOTAL</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#2e7d32' }}>{(rapportModal.data.fluxTresorerie?.totalEntrees || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#c62828' }}>{(rapportModal.data.fluxTresorerie?.totalSorties || 0).toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: (rapportModal.data.fluxTresorerie?.variationNette || 0) >= 0 ? '#2e7d32' : '#c62828' }}>{(rapportModal.data.fluxTresorerie?.variationNette || 0).toLocaleString('fr-FR')} FCFA</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Variation nette */}
                  <div style={{ padding: '20px', background: (rapportModal.data.fluxTresorerie?.variationNette || 0) >= 0 ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>Variation Nette de Trésorerie</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: (rapportModal.data.fluxTresorerie?.variationNette || 0) >= 0 ? '#2e7d32' : '#c62828' }}>
                      {(rapportModal.data.fluxTresorerie?.variationNette || 0).toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                </div>
              ) : rapportModal.type === 'journal-general' && rapportModal.data ? (
                <div>
                  {/* Statistiques */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Nombre d'écritures</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>{rapportModal.data.totaux?.nombreEcritures || 0}</div>
                    </div>
                    <div style={{ padding: '15px', background: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Débit</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976d2' }}>{(rapportModal.data.totaux?.debit || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                    <div style={{ padding: '15px', background: '#f3e5f5', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Total Crédit</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b1fa2' }}>{(rapportModal.data.totaux?.credit || 0).toLocaleString('fr-FR')} FCFA</div>
                    </div>
                    <div style={{ padding: '15px', background: rapportModal.data.totaux?.equilibre ? '#e8f5e9' : '#ffebee', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Équilibre</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: rapportModal.data.totaux?.equilibre ? '#2e7d32' : '#c62828' }}>
                        {rapportModal.data.totaux?.equilibre ? '✅ Oui' : '❌ Non'}
                      </div>
                    </div>
                  </div>

                  {/* Liste des écritures */}
                  {(rapportModal.data.ecritures || []).map((ecriture, idx) => (
                    <div key={idx} style={{ marginBottom: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 15px', background: '#fff3e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#f57c00' }}>{ecriture.reference || `ECR-${ecriture.id}`}</span>
                          <span style={{ marginLeft: '15px', color: '#333' }}>{ecriture.libelle}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#666', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>{ecriture.journal?.code}</span>
                          <span style={{ fontSize: '13px', color: '#666' }}>{ecriture.date ? new Date(ecriture.date).toLocaleDateString('fr-FR') : '-'}</span>
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px', borderBottom: '1px solid #eee' }}>Compte</th>
                            <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px', borderBottom: '1px solid #eee' }}>Libellé</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', borderBottom: '1px solid #eee' }}>Débit</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '12px', borderBottom: '1px solid #eee' }}>Crédit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(ecriture.lignes || []).map((ligne, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '6px 10px', fontSize: '13px' }}>{ligne.compte} - {ligne.nomCompte}</td>
                              <td style={{ padding: '6px 10px', fontSize: '13px' }}>{ligne.libelle}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '13px', color: '#1976d2', fontWeight: ligne.debit > 0 ? 'bold' : 'normal' }}>{ligne.debit > 0 ? ligne.debit.toLocaleString('fr-FR') : '-'}</td>
                              <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '13px', color: '#7b1fa2', fontWeight: ligne.credit > 0 ? 'bold' : 'normal' }}>{ligne.credit > 0 ? ligne.credit.toLocaleString('fr-FR') : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {(rapportModal.data.ecritures || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '8px', color: '#666' }}>
                      Aucune écriture trouvée pour cette période
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('rapport-content');
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${rapportModal.type === 'bilan' ? 'Bilan Comptable' : rapportModal.type === 'resultat' ? 'Compte de Résultat' : rapportModal.type === 'journaux' ? 'Rapport des Journaux' : rapportModal.type === 'flux' ? 'Flux de Trésorerie' : 'Journal Général'} - ${rapportModal.data?.entreprise?.nom || 'ComptaOrion'}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                            h3, h4 { color: #333; }
                            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f5f5f5; }
                            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                            .logo { max-height: 60px; }
                            .company-info { text-align: right; }
                            .totals { background-color: #f5f5f5; font-weight: bold; }
                            .debit { color: #1976d2; }
                            .credit { color: #7b1fa2; }
                            @media print { body { margin: 0; } }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <div>
                              ${rapportModal.data?.entreprise?.logo ? `<img src="${rapportModal.data.entreprise.logo}" class="logo" />` : ''}
                              <h2 style="margin: 5px 0;">${rapportModal.data?.entreprise?.nom || ''}</h2>
                            </div>
                            <div class="company-info">
                              <div>${rapportModal.data?.entreprise?.adresse || ''}</div>
                              <div>${rapportModal.data?.entreprise?.telephone || ''} ${rapportModal.data?.entreprise?.email ? '| ' + rapportModal.data.entreprise.email : ''}</div>
                              <div>${rapportModal.data?.entreprise?.rccm ? 'RCCM: ' + rapportModal.data.entreprise.rccm : ''} ${rapportModal.data?.entreprise?.ifu ? '| IFU: ' + rapportModal.data.entreprise.ifu : ''}</div>
                            </div>
                          </div>
                          <h3>${rapportModal.type === 'bilan' ? 'Bilan Comptable' : rapportModal.type === 'resultat' ? 'Compte de Résultat' : rapportModal.type === 'journaux' ? 'Rapport des Journaux' : rapportModal.type === 'flux' ? 'Tableau des Flux de Trésorerie' : 'Journal Général'}</h3>
                          <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                          ${printContent.innerHTML}
                          <div style="margin-top: 30px; text-align: center; color: #666; font-size: 10px;">
                            Document généré par ComptaOrion le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
                          </div>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  🖨️ Imprimer
                </button>
                <button 
                  onClick={() => {
                    const content = document.getElementById('rapport-content');
                    const reportTitle = rapportModal.type === 'bilan' ? 'Bilan_Comptable' : rapportModal.type === 'resultat' ? 'Compte_Resultat' : rapportModal.type === 'journaux' ? 'Rapport_Journaux' : rapportModal.type === 'flux' ? 'Flux_Tresorerie' : 'Journal_General';
                    const htmlContent = `
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <title>${reportTitle}</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background-color: #f5f5f5; }
                          </style>
                        </head>
                        <body>
                          <h2>${rapportModal.data?.entreprise?.nom || 'ComptaOrion'}</h2>
                          <p>${rapportModal.data?.entreprise?.adresse || ''} | ${rapportModal.data?.entreprise?.telephone || ''}</p>
                          <h3>${reportTitle.replace(/_/g, ' ')}</h3>
                          <p>Période: ${periode.dateDebut} au ${periode.dateFin}</p>
                          ${content.innerHTML}
                        </body>
                      </html>
                    `;
                    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${reportTitle}_${rapportModal.data?.entreprise?.nom?.replace(/\s+/g, '_') || 'rapport'}_${periode.dateDebut}_${periode.dateFin}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  ⬇️ Télécharger
                </button>
              </div>
              <Button variant="secondary" onClick={() => setRapportModal({ open: false, type: null, data: null, loading: false })}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Drill-Down Écritures d'un compte */}
      {drillModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '95%', maxWidth: '1100px',
            maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f5f5f5'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>{drillModal.title}</h3>
              <button onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false })} style={{
                background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666'
              }}>&times;</button>
            </div>
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {drillModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
              ) : drillModal.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Aucune écriture trouvée pour cette période</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Journal</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Réf.</th>
                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Libellé</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Débit</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Crédit</th>
                      <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Solde Cumul.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillModal.data.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px' }}>{e.date || '-'}</td>
                        <td style={{ padding: '8px' }}>{e.journal || '-'}</td>
                        <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>{e.reference || '-'}</td>
                        <td style={{ padding: '8px' }}>{e.libelle || e.description || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#1976d2', fontWeight: e.debit > 0 ? 'bold' : 'normal' }}>
                          {e.debit > 0 ? Math.round(e.debit).toLocaleString('fr-FR') + ' FCFA' : '-'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#7b1fa2', fontWeight: e.credit > 0 ? 'bold' : 'normal' }}>
                          {e.credit > 0 ? Math.round(e.credit).toLocaleString('fr-FR') + ' FCFA' : '-'}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: (e.soldeCumule || e.soldeCumul || 0) >= 0 ? '#388e3c' : '#d32f2f' }}>
                          {Math.round(e.soldeCumule || e.soldeCumul || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#e3f2fd', fontWeight: 'bold' }}>
                      <td colSpan="4" style={{ padding: '10px' }}>TOTAL</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#1976d2' }}>
                        {Math.round(drillModal.totaux?.totalDebit || drillModal.data.reduce((s, e) => s + parseFloat(e.debit || 0), 0)).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#7b1fa2' }}>
                        {Math.round(drillModal.totaux?.totalCredit || drillModal.data.reduce((s, e) => s + parseFloat(e.credit || 0), 0)).toLocaleString('fr-FR')} FCFA
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: (drillModal.totaux?.solde || 0) >= 0 ? '#388e3c' : '#d32f2f' }}>
                        {Math.round(drillModal.totaux?.solde || 0).toLocaleString('fr-FR')} FCFA
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '13px' }}>{drillModal.data.length} mouvement(s)</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => {
                    const headers = ['Date', 'Journal', 'Référence', 'Libellé', 'Débit', 'Crédit', 'Solde Cumulé'];
                    const rows = drillModal.data.map(e => [
                      e.date || '',
                      e.journal || '',
                      e.reference || '',
                      (e.libelle || '').replace(/"/g, '""'),
                      e.debit || 0,
                      e.credit || 0,
                      e.soldeCumule || e.soldeCumul || 0
                    ]);
                    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Mouvements_${drillModal.compte || 'compte'}_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ⬇️ Export CSV
                </button>
                <Button variant="secondary" onClick={() => setDrillModal({ open: false, title: '', data: [], loading: false })}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
