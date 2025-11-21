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
    { id: 'pays', label: '🌍 Pays & Régions', icon: '🌍' },
    { id: 'taxes', label: '💰 Taxes (TVA)', icon: '💰' }
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
    formeJuridique: initialData?.formeJuridique || 'SARL'
  });

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

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}
