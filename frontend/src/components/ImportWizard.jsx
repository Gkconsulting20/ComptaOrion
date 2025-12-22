import React, { useState, useEffect } from 'react';
import api from '../api';

const Button = ({ children, onClick, variant = 'primary', disabled, style = {} }) => {
  const baseStyle = {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    opacity: disabled ? 0.6 : 1,
    ...style
  };
  const variants = {
    primary: { backgroundColor: '#667eea', color: 'white' },
    success: { backgroundColor: '#27ae60', color: 'white' },
    danger: { backgroundColor: '#e74c3c', color: 'white' },
    secondary: { backgroundColor: '#95a5a6', color: 'white' },
    warning: { backgroundColor: '#f39c12', color: 'white' }
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variants[variant] }}>
      {children}
    </button>
  );
};

const SOURCES = [
  { id: 'quickbooks', name: 'QuickBooks', icon: '📗', description: 'Import depuis QuickBooks Desktop ou Online' },
  { id: 'sage100', name: 'Sage 100', icon: '📘', description: 'Import depuis Sage 100 ou Sage Compta' },
  { id: 'excel', name: 'Excel / CSV', icon: '📊', description: 'Import depuis un fichier Excel ou CSV générique' }
];

const ENTITY_TYPES = [
  { id: 'clients', name: 'Clients', icon: '👥' },
  { id: 'fournisseurs', name: 'Fournisseurs', icon: '🏭' },
  { id: 'plan_comptable', name: 'Plan Comptable', icon: '📖' },
  { id: 'produits', name: 'Produits/Services', icon: '📦' }
];

const FIELD_LABELS = {
  clients: {
    nom: 'Nom du client',
    email: 'Email',
    telephone: 'Téléphone',
    adresse: 'Adresse',
    ville: 'Ville',
    pays: 'Pays',
    numeroTva: 'N° TVA'
  },
  fournisseurs: {
    raisonSociale: 'Raison sociale',
    email: 'Email',
    telephone: 'Téléphone',
    adresse: 'Adresse',
    ville: 'Ville',
    pays: 'Pays'
  },
  plan_comptable: {
    numeroCompte: 'N° de compte',
    libelle: 'Libellé',
    typeCompte: 'Type de compte',
    classe: 'Classe'
  },
  produits: {
    nom: 'Nom du produit',
    description: 'Description',
    prixVente: 'Prix de vente',
    prixAchat: 'Prix d\'achat',
    tva: 'Taux TVA (%)',
    reference: 'Référence'
  }
};

export default function ImportWizard({ onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [source, setSource] = useState(null);
  const [entityType, setEntityType] = useState(null);
  const [file, setFile] = useState(null);
  
  const [batchId, setBatchId] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  
  const [batches, setBatches] = useState([]);
  
  useEffect(() => {
    loadBatches();
  }, []);
  
  const loadBatches = async () => {
    try {
      const res = await api.get('/import/batches');
      let data = res.data || res;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        data = data.batches || [];
      }
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur chargement batches:', err);
    }
  };
  
  const handleFileUpload = async () => {
    if (!file || !source || !entityType) {
      setError('Veuillez sélectionner une source, un type de données et un fichier');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceLogiciel', source);
      formData.append('typeEntite', entityType);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const res = await response.json();
      
      if (!response.ok || !res.success) {
        throw new Error(res.error || 'Erreur lors du téléchargement');
      }
      
      const uploadData = res.data;
      setBatchId(uploadData.batchId);
      setHeaders(uploadData.headers);
      setPreviewRows(uploadData.previewRows);
      setTotalRows(uploadData.totalRows);
      
      const initialMapping = {};
      uploadData.headers.forEach(h => {
        const normalized = h.toLowerCase().replace(/[^a-z]/g, '');
        const fields = Object.keys(FIELD_LABELS[entityType] || {});
        const match = fields.find(f => f.toLowerCase() === normalized);
        if (match) initialMapping[h] = match;
      });
      setMapping(initialMapping);
      
      setStep(3);
    } catch (err) {
      setError(err.message || 'Erreur lors du téléchargement');
    }
    setLoading(false);
  };
  
  const handleValidate = async () => {
    if (!batchId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await api.post(`/import/batches/${batchId}/mapping`, {
        mappingColonnes: mapping,
        optionsImport: {}
      });
      
      const res = await api.post(`/import/batches/${batchId}/validate`);
      setValidationResult(res.data || res);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Erreur lors de la validation');
    }
    setLoading(false);
  };
  
  const handleCommit = async () => {
    if (!batchId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.post(`/import/batches/${batchId}/commit`);
      setCommitResult(res.data || res);
      setStep(5);
      loadBatches();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'import');
    }
    setLoading(false);
  };
  
  const handleDeleteBatch = async (id) => {
    if (!confirm('Supprimer cet import ?')) return;
    try {
      await api.delete(`/import/batches/${id}`);
      loadBatches();
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };
  
  const resetWizard = () => {
    setStep(1);
    setSource(null);
    setEntityType(null);
    setFile(null);
    setBatchId(null);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setValidationResult(null);
    setCommitResult(null);
    setError(null);
  };
  
  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  };
  
  const stepIndicatorStyle = (stepNum) => ({
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: step >= stepNum ? '#667eea' : '#e0e0e0',
    color: step >= stepNum ? 'white' : '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px'
  });
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {[1, 2, 3, 4, 5].map(s => (
            <React.Fragment key={s}>
              <div style={stepIndicatorStyle(s)}>{s}</div>
              {s < 5 && <div style={{ width: '40px', height: '2px', backgroundColor: step > s ? '#667eea' : '#e0e0e0' }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {step === 1 && 'Source et type de données'}
          {step === 2 && 'Téléchargement du fichier'}
          {step === 3 && 'Mapping des colonnes'}
          {step === 4 && 'Validation et prévisualisation'}
          {step === 5 && 'Résultat de l\'import'}
        </div>
      </div>
      
      {error && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}
      
      {step === 1 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>1. Sélectionnez la source des données</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {SOURCES.map(s => (
              <div 
                key={s.id}
                onClick={() => setSource(s.id)}
                style={{
                  padding: '20px',
                  border: source === s.id ? '2px solid #667eea' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: source === s.id ? '#f0f4ff' : 'white',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{s.icon}</div>
                <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>{s.description}</div>
              </div>
            ))}
          </div>
          
          <h3>2. Type de données à importer</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {ENTITY_TYPES.map(e => (
              <div 
                key={e.id}
                onClick={() => setEntityType(e.id)}
                style={{
                  padding: '15px',
                  border: entityType === e.id ? '2px solid #667eea' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: entityType === e.id ? '#f0f4ff' : 'white',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '24px' }}>{e.icon}</div>
                <div style={{ fontWeight: 'bold', marginTop: '5px' }}>{e.name}</div>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setStep(2)} disabled={!source || !entityType}>
              Continuer →
            </Button>
          </div>
        </div>
      )}
      
      {step === 2 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Téléchargez votre fichier</h3>
          <p style={{ color: '#666' }}>
            Formats acceptés : CSV, Excel (.xlsx), ou fichier IIF (QuickBooks)
          </p>
          
          <div style={{ 
            border: '2px dashed #e0e0e0', 
            borderRadius: '8px', 
            padding: '40px', 
            textAlign: 'center',
            backgroundColor: file ? '#f0f4ff' : '#fafafa',
            marginBottom: '20px'
          }}>
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls,.iif"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
              {file ? (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
                  <div style={{ fontWeight: 'bold' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {(file.size / 1024).toFixed(1)} Ko - Cliquez pour changer
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '10px' }}>📁</div>
                  <div style={{ fontWeight: 'bold' }}>Cliquez pour sélectionner un fichier</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    ou glissez-déposez votre fichier ici
                  </div>
                </>
              )}
            </label>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep(1)}>← Retour</Button>
            <Button onClick={handleFileUpload} disabled={!file || loading}>
              {loading ? 'Analyse en cours...' : 'Analyser le fichier →'}
            </Button>
          </div>
        </div>
      )}
      
      {step === 3 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Mapping des colonnes</h3>
          <p style={{ color: '#666' }}>
            Associez les colonnes de votre fichier aux champs ComptaOrion. 
            <strong> {totalRows} lignes</strong> détectées.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 1fr', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', color: '#666' }}>Colonne du fichier</div>
            <div></div>
            <div style={{ fontWeight: 'bold', color: '#666' }}>Champ ComptaOrion</div>
            
            {headers.map(h => (
              <React.Fragment key={h}>
                <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>{h}</div>
                <div style={{ textAlign: 'center' }}>→</div>
                <select
                  value={mapping[h] || ''}
                  onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                  style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}
                >
                  <option value="">-- Ne pas importer --</option>
                  {Object.entries(FIELD_LABELS[entityType] || {}).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </React.Fragment>
            ))}
          </div>
          
          {previewRows.length > 0 && (
            <>
              <h4>Aperçu des données</h4>
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>Ligne</th>
                      {headers.filter(h => mapping[h]).map(h => (
                        <th key={h} style={{ padding: '8px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>
                          {FIELD_LABELS[entityType]?.[mapping[h]] || mapping[h]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{row.ligne}</td>
                        {headers.filter(h => mapping[h]).map(h => (
                          <td key={h} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                            {row.data[h] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep(2)}>← Retour</Button>
            <Button onClick={handleValidate} disabled={loading || Object.values(mapping).filter(v => v).length === 0}>
              {loading ? 'Validation...' : 'Valider les données →'}
            </Button>
          </div>
        </div>
      )}
      
      {step === 4 && validationResult && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Résultat de la validation</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#27ae60' }}>{validationResult.valides}</div>
              <div style={{ color: '#666' }}>Lignes valides</div>
            </div>
            <div style={{ padding: '20px', backgroundColor: validationResult.erreurs > 0 ? '#ffebee' : '#e0e0e0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: validationResult.erreurs > 0 ? '#e74c3c' : '#666' }}>{validationResult.erreurs}</div>
              <div style={{ color: '#666' }}>Lignes en erreur</div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>{validationResult.total}</div>
              <div style={{ color: '#666' }}>Total lignes</div>
            </div>
          </div>
          
          {validationResult.erreurs > 0 && (
            <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <strong>Attention :</strong> {validationResult.erreurs} lignes contiennent des erreurs et ne seront pas importées. 
              Les lignes valides seront importées normalement.
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep(3)}>← Modifier le mapping</Button>
            <Button variant="success" onClick={handleCommit} disabled={loading || validationResult.valides === 0}>
              {loading ? 'Import en cours...' : `Importer ${validationResult.valides} lignes ✓`}
            </Button>
          </div>
        </div>
      )}
      
      {step === 5 && commitResult && (
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              {commitResult.importes > 0 ? '🎉' : '❌'}
            </div>
            <h2 style={{ color: commitResult.importes > 0 ? '#27ae60' : '#e74c3c' }}>
              {commitResult.importes > 0 ? 'Import terminé avec succès !' : 'Échec de l\'import'}
            </h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#27ae60' }}>{commitResult.importes}</div>
              <div style={{ color: '#666' }}>Enregistrements importés</div>
            </div>
            <div style={{ padding: '20px', backgroundColor: commitResult.erreurs?.length > 0 ? '#ffebee' : '#e0e0e0', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: commitResult.erreurs?.length > 0 ? '#e74c3c' : '#666' }}>
                {commitResult.erreurs?.length || 0}
              </div>
              <div style={{ color: '#666' }}>Erreurs</div>
            </div>
          </div>
          
          {commitResult.erreurs?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4>Détail des erreurs :</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                {commitResult.erreurs.slice(0, 10).map((err, idx) => (
                  <div key={idx} style={{ marginBottom: '5px', fontSize: '12px' }}>
                    <strong>Ligne {err.ligne}:</strong> {err.erreur}
                  </div>
                ))}
                {commitResult.erreurs.length > 10 && (
                  <div style={{ color: '#666', fontStyle: 'italic' }}>
                    ... et {commitResult.erreurs.length - 10} autres erreurs
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div style={{ textAlign: 'center' }}>
            <Button onClick={resetWizard}>Nouvel import</Button>
          </div>
        </div>
      )}
      
      {batches.length > 0 && step === 1 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Historique des imports</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>Source</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'left' }}>Fichier</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'center' }}>Lignes</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '10px', borderBottom: '2px solid #667eea', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{b.sourceLogiciel}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{b.typeEntite}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{b.nomFichier}</td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                    {b.nombreLignesImportees || 0}/{b.nombreLignesTotal}
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: b.statut === 'termine' ? '#e8f5e9' : 
                                       b.statut === 'echec' ? '#ffebee' : '#fff3e0',
                      color: b.statut === 'termine' ? '#27ae60' : 
                             b.statut === 'echec' ? '#e74c3c' : '#f39c12'
                    }}>
                      {b.statut}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDeleteBatch(b.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
