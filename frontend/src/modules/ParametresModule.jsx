import React, { useState, useEffect } from 'react';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import api from '../api';

export function ParametresModule() {
  const [activeTab, setActiveTab] = useState('entreprise');
  const [data, setData] = useState({
    entreprise: null,
    devises: [],
    systemes: [],
    pays: [],
    tauxTva: {}
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [entreprise, devises, systemes, pays, tauxTva] = await Promise.all([
        api.get('/parametres/entreprise').then(r => r.data).catch(() => null),
        api.get('/parametres/devises').then(r => r.data).catch(() => []),
        api.get('/parametres/systemes-comptables').then(r => r.data).catch(() => []),
        api.get('/parametres/pays').then(r => r.data).catch(() => []),
        api.get('/parametres/taux-tva').then(r => r.data).catch(() => {})
      ]);

      setData({ entreprise, devises, systemes, pays, tauxTva });
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEntreprise = async (formData) => {
    try {
      await api.put('/parametres/entreprise', formData);
      alert('Paramètres entreprise enregistrés avec succès');
      loadAllData();
      setModal({ open: false, type: null });
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const tabs = [
    { id: 'entreprise', label: '🏢 Entreprise', icon: '🏢' },
    { id: 'comptabilite', label: '📊 Système Comptable', icon: '📊' },
    { id: 'devises', label: '💱 Devises', icon: '💱' },
    { id: 'tauxChange', label: '📈 Taux de Change', icon: '📈' },
    { id: 'pays', label: '🌍 Pays & Régions', icon: '🌍' },
    { id: 'taxes', label: '💰 Taxes (TVA)', icon: '💰' },
    { id: 'audit', label: '📋 Historique Audit', icon: '📋' }
  ];

  if (loading) return <p>Chargement des paramètres...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>⚙️ Paramètres Système</h2>
      </div>

      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #2c3e50' : '3px solid transparent',
              background: activeTab === tab.id ? '#ecf0f1' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              transition: 'all 0.3s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'entreprise' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>🏢 Informations Entreprise</h3>
            <Button onClick={() => setModal({ open: true, type: 'entreprise' })}>
              ✏️ Modifier
            </Button>
          </div>

          {data.entreprise ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <InfoCard label="Nom" value={data.entreprise.nom} />
              <InfoCard label="Raison Sociale" value={data.entreprise.raisonSociale} />
              <InfoCard label="SIRET" value={data.entreprise.numeroSiret} />
              <InfoCard label="Téléphone" value={data.entreprise.telephone} />
              <InfoCard label="Email" value={data.entreprise.email} />
              <InfoCard label="Pays" value={data.entreprise.pays} />
              <InfoCard label="Ville" value={data.entreprise.ville} />
              <InfoCard label="Adresse" value={data.entreprise.adresse} />
              <InfoCard label="Devise" value={`${data.entreprise.devise} (${data.entreprise.symboleDevise})`} />
              <InfoCard label="Système Comptable" value={data.entreprise.systemeComptable} />
              <InfoCard label="Année Fiscale" value={`${data.entreprise.debutAnneeFiscale} → ${data.entreprise.finAnneeFiscale}`} />
              <InfoCard label="Forme Juridique" value={data.entreprise.formeJuridique} />
            </div>
          ) : (
            <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune entreprise configurée</p>
              <Button onClick={() => setModal({ open: true, type: 'entreprise' })} style={{ marginTop: '15px' }}>
                Configurer l'entreprise
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'comptabilite' && (
        <div>
          <h3>📊 Systèmes Comptables Disponibles</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
            {data.systemes.map(sys => (
              <div key={sys.code} style={{
                padding: '20px',
                background: data.entreprise?.systemeComptable === sys.code ? '#d4edda' : '#f8f9fa',
                borderRadius: '8px',
                border: data.entreprise?.systemeComptable === sys.code ? '2px solid #28a745' : '1px solid #ddd'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{sys.code}</h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>{sys.nom}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>{sys.region}</p>
                {data.entreprise?.systemeComptable === sys.code && (
                  <span style={{ display: 'inline-block', marginTop: '10px', padding: '4px 8px', background: '#28a745', color: '#fff', borderRadius: '4px', fontSize: '12px' }}>
                    ✓ Actif
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'devises' && (
        <div>
          <h3>💱 Devises Supportées</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Liste des devises disponibles dans ComptaOrion</p>
          <Table
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'nom', label: 'Nom' },
              { key: 'symbole', label: 'Symbole' },
              { key: 'region', label: 'Région' }
            ]}
            data={data.devises}
            actions={false}
          />
        </div>
      )}

      {activeTab === 'tauxChange' && (
        <TauxChangeTab entreprise={data.entreprise} />
      )}

      {activeTab === 'pays' && (
        <div>
          <h3>🌍 Pays & Régions</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Configuration des pays supportés avec leur système comptable par défaut</p>
          <Table
            columns={[
              { key: 'nom', label: 'Pays' },
              { key: 'code', label: 'Code' },
              { key: 'region', label: 'Région' },
              { key: 'devise', label: 'Devise' },
              { key: 'systeme', label: 'Système Comptable' }
            ]}
            data={data.pays}
            actions={false}
          />
        </div>
      )}

      {activeTab === 'taxes' && (
        <div>
          <h3>💰 Taux de TVA par Pays</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>Configuration des taux de TVA standards par pays</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', marginTop: '20px' }}>
            {Object.entries(data.tauxTva).map(([pays, taux]) => (
              <div key={pays} style={{
                padding: '15px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #ddd'
              }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>{pays.toUpperCase()}</h4>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#3498db' }}>{taux}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && <AuditLogTab />}

      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, type: null })}
        title="Modifier Paramètres Entreprise"
      >
        <EntrepriseForm
          initialData={data.entreprise}
          devises={data.devises}
          systemes={data.systemes}
          pays={data.pays}
          onSave={saveEntreprise}
          onCancel={() => setModal({ open: false, type: null })}
        />
      </Modal>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7f8c8d', fontWeight: '600' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '16px', color: '#2c3e50' }}>{value || '-'}</p>
    </div>
  );
}

function EntrepriseForm({ initialData, devises, systemes, pays, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    nom: initialData?.nom || '',
    raisonSociale: initialData?.raisonSociale || '',
    numeroSiret: initialData?.numeroSiret || '',
    adresse: initialData?.adresse || '',
    ville: initialData?.ville || '',
    pays: initialData?.pays || 'Sénégal',
    telephone: initialData?.telephone || '',
    email: initialData?.email || '',
    devise: initialData?.devise || 'XOF',
    symboleDevise: initialData?.symboleDevise || 'FCFA',
    tauxTva: initialData?.tauxTva || 18,
    systemeComptable: initialData?.systemeComptable || 'SYSCOHADA',
    debutAnneeFiscale: initialData?.debutAnneeFiscale || '2025-01-01',
    finAnneeFiscale: initialData?.finAnneeFiscale || '2025-12-31',
    numeroTva: initialData?.numeroTva || '',
    registreCommerce: initialData?.registreCommerce || '',
    formeJuridique: initialData?.formeJuridique || 'SARL',
    logoUrl: initialData?.logoUrl || '',
    factureFooterText: initialData?.factureFooterText || '',
    factureMentionsLegales: initialData?.factureMentionsLegales || '',
    factureCouleurPrincipale: initialData?.factureCouleurPrincipale || '#3498db',
    factureAfficherLogo: initialData?.factureAfficherLogo !== undefined ? initialData.factureAfficherLogo : true
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('logo', file);

    setUploadingLogo(true);
    try {
      const response = await api.post('/upload/logo', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setFormData({ ...formData, logoUrl: response.data.logoUrl });
      alert('Logo uploadé avec succès!');
    } catch (error) {
      alert('Erreur lors de l\'upload: ' + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm('Supprimer le logo actuel?')) return;
    
    try {
      await api.delete('/upload/logo');
      setFormData({ ...formData, logoUrl: '' });
      alert('Logo supprimé avec succès!');
    } catch (error) {
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Nom</label>
          <input
            type="text"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Raison Sociale</label>
          <input
            type="text"
            value={formData.raisonSociale}
            onChange={(e) => setFormData({ ...formData, raisonSociale: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>SIRET</label>
          <input
            type="text"
            value={formData.numeroSiret}
            onChange={(e) => setFormData({ ...formData, numeroSiret: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Forme Juridique</label>
          <select
            value={formData.formeJuridique}
            onChange={(e) => setFormData({ ...formData, formeJuridique: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="SARL">SARL</option>
            <option value="SA">SA</option>
            <option value="SAS">SAS</option>
            <option value="EI">Entreprise Individuelle</option>
            <option value="EURL">EURL</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Adresse</label>
        <input
          type="text"
          value={formData.adresse}
          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Ville</label>
          <input
            type="text"
            value={formData.ville}
            onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Pays</label>
          <select
            value={formData.pays}
            onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            {pays.map(p => (
              <option key={p.code} value={p.nom}>{p.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Téléphone</label>
          <input
            type="tel"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Devise</label>
          <select
            value={formData.devise}
            onChange={(e) => {
              const devise = devises.find(d => d.code === e.target.value);
              setFormData({ 
                ...formData, 
                devise: e.target.value,
                symboleDevise: devise?.symbole || ''
              });
            }}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            {devises.map(d => (
              <option key={d.code} value={d.code}>{d.code} - {d.nom} ({d.symbole})</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Système Comptable</label>
          <select
            value={formData.systemeComptable}
            onChange={(e) => setFormData({ ...formData, systemeComptable: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            {systemes.map(s => (
              <option key={s.code} value={s.code}>{s.code} - {s.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Taux TVA (%)</label>
          <input
            type="number"
            step="0.01"
            value={formData.tauxTva}
            onChange={(e) => setFormData({ ...formData, tauxTva: parseFloat(e.target.value) })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Début Année Fiscale</label>
          <input
            type="date"
            value={formData.debutAnneeFiscale}
            onChange={(e) => setFormData({ ...formData, debutAnneeFiscale: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Fin Année Fiscale</label>
          <input
            type="date"
            value={formData.finAnneeFiscale}
            onChange={(e) => setFormData({ ...formData, finAnneeFiscale: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ 
        padding: '20px', 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        border: '1px solid #e0e0e0',
        marginTop: '20px'
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🎨 Personnalisation des Factures</h4>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Logo de l'entreprise</label>
          {formData.logoUrl && (
            <div style={{ marginBottom: '10px' }}>
              <img 
                src={formData.logoUrl} 
                alt="Logo" 
                style={{ maxWidth: '200px', maxHeight: '100px', border: '1px solid #ddd', borderRadius: '4px' }} 
              />
              <Button 
                variant="secondary" 
                size="small" 
                onClick={handleDeleteLogo}
                style={{ marginLeft: '10px' }}
              >
                🗑️ Supprimer
              </Button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={uploadingLogo}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          {uploadingLogo && <span style={{ marginLeft: '10px' }}>⏳ Upload en cours...</span>}
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.factureAfficherLogo}
              onChange={(e) => setFormData({ ...formData, factureAfficherLogo: e.target.checked })}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Afficher le logo sur les factures</span>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>
            Couleur principale des factures
          </label>
          <input
            type="color"
            value={formData.factureCouleurPrincipale}
            onChange={(e) => setFormData({ ...formData, factureCouleurPrincipale: e.target.value })}
            style={{ padding: '5px', width: '100px', height: '40px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <span style={{ marginLeft: '10px', fontSize: '14px' }}>{formData.factureCouleurPrincipale}</span>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>
            Texte de pied de page (factures)
          </label>
          <textarea
            value={formData.factureFooterText}
            onChange={(e) => setFormData({ ...formData, factureFooterText: e.target.value })}
            placeholder="Ex: Merci de votre confiance..."
            rows={2}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>
            Mentions légales (factures)
          </label>
          <textarea
            value={formData.factureMentionsLegales}
            onChange={(e) => setFormData({ ...formData, factureMentionsLegales: e.target.value })}
            placeholder="Ex: Entreprise immatriculée au RC de..., TVA: ..."
            rows={3}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    table: '',
    dateDebut: '',
    dateFin: ''
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(filters.action && { action: filters.action }),
        ...(filters.table && { table: filters.table }),
        ...(filters.dateDebut && { dateDebut: filters.dateDebut }),
        ...(filters.dateFin && { dateFin: filters.dateFin })
      });

      const response = await api.get(`/audit-logs?${params}`);
      setLogs(response.data || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Erreur chargement logs audit:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    const styles = {
      CREATE: { bg: '#d4edda', color: '#155724' },
      UPDATE: { bg: '#fff3cd', color: '#856404' },
      DELETE: { bg: '#f8d7da', color: '#721c24' }
    };
    const style = styles[action] || { bg: '#e2e3e5', color: '#383d41' };
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        background: style.bg,
        color: style.color
      }}>
        {action}
      </span>
    );
  };

  return (
    <div>
      <h3>📋 Historique des Opérations</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Suivi complet de toutes les opérations effectuées dans le système
      </p>

      {/* Filtres */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
        marginBottom: '20px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Action</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Toutes</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Table</label>
          <select
            value={filters.table}
            onChange={(e) => setFilters({ ...filters, table: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Toutes</option>
            <option value="clients">Clients</option>
            <option value="fournisseurs">Fournisseurs</option>
            <option value="produits">Produits</option>
            <option value="categories_stock">Catégories Stock</option>
            <option value="entrepots">Entrepôts</option>
            <option value="mouvements_stock">Mouvements Stock</option>
            <option value="entreprises">Paramètres Entreprise</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Date Début</label>
          <input
            type="date"
            value={filters.dateDebut}
            onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '600' }}>Date Fin</label>
          <input
            type="date"
            value={filters.dateFin}
            onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>

      {/* Liste des logs */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement des logs...</p>
      ) : logs.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun log d'audit trouvé</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Date/Heure</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Action</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Table</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Utilisateur</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.id || index} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {getActionBadge(log.action)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}>
                      {log.tableName}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      {log.description}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>
                      User #{log.userId}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: page === 1 ? '#f8f9fa' : '#fff',
                  cursor: page === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: '14px', color: '#666' }}>
                Page {page} / {pagination.pages} ({pagination.total} entrées)
              </span>
              <button
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={page === pagination.pages}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: page === pagination.pages ? '#f8f9fa' : '#fff',
                  cursor: page === pagination.pages ? 'not-allowed' : 'pointer'
                }}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TauxChangeTab({ entreprise }) {
  const [tauxList, setTauxList] = useState([]);
  const [devisesList, setDevisesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    deviseSource: 'EUR',
    deviseCible: 'USD',
    taux: '',
    dateEffet: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [converteur, setConverteur] = useState({
    montant: 1000,
    deviseSource: 'EUR',
    deviseCible: 'XOF',
    resultat: null
  });

  const deviseMaison = entreprise?.devise || 'XOF';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, deviseCible: deviseMaison }));
    setConverteur(prev => ({ ...prev, deviseCible: deviseMaison }));
  }, [deviseMaison]);

  const loadData = async () => {
    try {
      const [tauxRes, devisesRes] = await Promise.all([
        api.get('/devises/taux').catch(() => ({ data: [] })),
        api.get('/devises/devises').catch(() => ({ data: [] }))
      ]);
      setTauxList(Array.isArray(tauxRes) ? tauxRes : (tauxRes.data || []));
      setDevisesList(Array.isArray(devisesRes) ? devisesRes : (devisesRes.data || []));
    } catch (error) {
      console.error('Erreur chargement taux:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.deviseSource === formData.deviseCible) {
      alert('Les devises source et cible doivent être différentes');
      return;
    }
    try {
      await api.post('/devises/taux', formData);
      alert('Taux de change ajouté avec succès');
      setShowForm(false);
      setFormData({
        deviseSource: 'EUR',
        deviseCible: deviseMaison,
        taux: '',
        dateEffet: new Date().toISOString().split('T')[0],
        notes: ''
      });
      loadData();
    } catch (error) {
      alert('Erreur: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce taux de change ?')) return;
    try {
      await api.delete(`/devises/taux/${id}`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleConversion = async () => {
    if (converteur.deviseSource === converteur.deviseCible) {
      alert('Les devises doivent être différentes');
      return;
    }
    try {
      const response = await api.post('/devises/convertir', {
        montant: converteur.montant,
        deviseSource: converteur.deviseSource,
        deviseCible: converteur.deviseCible
      });
      const data = response.data || response;
      setConverteur({ ...converteur, resultat: data });
    } catch (error) {
      alert('Erreur: ' + (error.response?.data?.message || error.message));
    }
  };

  const formatMoney = (val, decimals = 0) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0 }}>📈 Taux de Change</h3>
          <p style={{ margin: '5px 0 0', color: '#666', fontSize: '14px' }}>
            Devise de base: <strong>{deviseMaison}</strong>
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Fermer' : '+ Nouveau Taux'}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>🔄 Convertisseur Rapide</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number"
              value={converteur.montant}
              onChange={(e) => setConverteur({ ...converteur, montant: e.target.value, resultat: null })}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', width: '120px' }}
            />
            <select
              value={converteur.deviseSource}
              onChange={(e) => setConverteur({ ...converteur, deviseSource: e.target.value, resultat: null })}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              {devises.filter(d => d.code !== deviseMaison).map(d => (
                <option key={d.code} value={d.code}>{d.code} - {d.nom}</option>
              ))}
            </select>
            <span style={{ fontSize: '16px' }}>→</span>
            <span style={{ fontWeight: 'bold' }}>{deviseMaison}</span>
            <Button onClick={handleConversion}>Convertir</Button>
          </div>
          {converteur.resultat && (
            <div style={{ marginTop: '15px', padding: '15px', background: '#d4edda', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                {formatMoney(converteur.resultat.montantOriginal, 2)} {converteur.resultat.deviseSource} = {formatMoney(converteur.resultat.montantConverti)} {converteur.resultat.deviseCible}
              </p>
              <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#155724' }}>
                Taux: 1 {converteur.resultat.deviseSource} = {formatMoney(converteur.resultat.tauxUtilise, 4)} {converteur.resultat.deviseCible} (au {converteur.resultat.dateEffet})
              </p>
            </div>
          )}
        </div>

        <div style={{ padding: '20px', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>💡 Taux Fixes (Zone FCFA)</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
            <strong>1 EUR = 655,957 XOF</strong> (Taux fixe BCE/BCEAO)
          </p>
          <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#856404' }}>
            Les pays de la zone FCFA ont un taux de change fixe avec l'Euro, garanti par le Trésor français.
          </p>
        </div>
      </div>

      {showForm && (
        <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Ajouter un taux de change</h4>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Devise source</label>
              <select
                value={formData.deviseSource}
                onChange={(e) => setFormData({ ...formData, deviseSource: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              >
                {devises.filter(d => d.code !== deviseMaison).map(d => (
                  <option key={d.code} value={d.code}>{d.code} - {d.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Devise cible</label>
              <input
                type="text"
                value={deviseMaison}
                disabled
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', background: '#e9ecef' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Taux (1 {formData.deviseSource} = X {deviseMaison})</label>
              <input
                type="number"
                step="0.0001"
                value={formData.taux}
                onChange={(e) => setFormData({ ...formData, taux: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="Ex: 655.957"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Date d'effet</label>
              <input
                type="date"
                value={formData.dateEffet}
                onChange={(e) => setFormData({ ...formData, dateEffet: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Notes (optionnel)</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="Ex: Taux BCE du jour"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </div>
      )}

      <h4 style={{ margin: '20px 0 15px' }}>Historique des taux</h4>
      {tauxList.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>Aucun taux de change enregistré. Ajoutez-en un pour commencer.</p>
      ) : (
        <Table
          columns={[
            { key: 'deviseSource', label: 'Devise' },
            { key: 'deviseCible', label: 'Vers' },
            { key: 'taux', label: 'Taux', render: (row) => formatMoney(row.taux, 4) },
            { key: 'dateEffet', label: 'Date d\'effet' },
            { key: 'source', label: 'Source' },
            { key: 'notes', label: 'Notes' }
          ]}
          data={tauxList}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
