import React, { useState, useEffect } from 'react';
import api from '../api';

const ENTREPRISE_ID = 1;

const TYPES_CONTRAT = ['CDI', 'CDD', 'Journalier', 'Stagiaire', 'Consultant'];

export function PaieModule() {
  const [activeTab, setActiveTab] = useState('employes');

  const tabs = [
    { id: 'employes', label: '👥 Employés', icon: '👥' },
    { id: 'fiches', label: '📄 Fiches de Paie', icon: '📄' },
    { id: 'avances', label: '💵 Avances', icon: '💵' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ];

  return (
    <div>
      <h2>💼 Module Paie & RH</h2>
      
      <div style={{
        display: 'flex',
        gap: '10px',
        borderBottom: '2px solid #e0e0e0',
        marginBottom: '20px',
        marginTop: '20px'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #3498db' : '3px solid transparent',
              background: activeTab === tab.id ? '#f0f8ff' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? '#3498db' : '#666',
              transition: 'all 0.2s',
              fontSize: '14px'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'employes' && <EmployesTab />}
        {activeTab === 'fiches' && <FichesPaieTab />}
        {activeTab === 'avances' && <AvancesTab />}
        {activeTab === 'rapports' && <RapportsTab />}
      </div>
    </div>
  );
}

function EmployesTab() {
  const [employes, setEmployes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    matricule: '',
    nom: '',
    prenom: '',
    numeroCNPS: '',
    dateNaissance: '',
    lieuNaissance: '',
    nationalite: 'Sénégalaise',
    telephone: '',
    email: '',
    adresse: '',
    poste: '',
    departement: '',
    typeContrat: 'CDI',
    dateEmbauche: '',
    dateFinContrat: '',
    salaireBase: '',
    indemnitesRegulieresTransport: '0',
    indemnitesRegulieresLogement: '0',
    indemnitesRegulieresAutres: '0',
    avantagesNatureLogement: '0',
    avantagesNatureVehicule: '0',
    avantagesNatureAutres: '0',
    documentsCNI: '',
    documentsContrat: '',
    documentsCV: '',
    documentsAutres: '',
    actif: true
  });

  useEffect(() => {
    loadEmployes();
  }, []);

  const loadEmployes = async () => {
    const data = await api.get(`/paie/employes?entrepriseId=${ENTREPRISE_ID}`);
    setEmployes(data.data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/paie/employes/${editingId}?entrepriseId=${ENTREPRISE_ID}`, formData);
      } else {
        await api.post(`/paie/employes?entrepriseId=${ENTREPRISE_ID}`, formData);
      }
      loadEmployes();
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (employe) => {
    setFormData(employe);
    setEditingId(employe.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet employé ?')) return;
    await api.delete(`/paie/employes/${id}?entrepriseId=${ENTREPRISE_ID}`);
    loadEmployes();
  };

  const resetForm = () => {
    setFormData({
      matricule: '',
      nom: '',
      prenom: '',
      numeroCNPS: '',
      dateNaissance: '',
      lieuNaissance: '',
      nationalite: 'Sénégalaise',
      telephone: '',
      email: '',
      adresse: '',
      poste: '',
      departement: '',
      typeContrat: 'CDI',
      dateEmbauche: '',
      dateFinContrat: '',
      salaireBase: '',
      indemnitesRegulieresTransport: '0',
      indemnitesRegulieresLogement: '0',
      indemnitesRegulieresAutres: '0',
      avantagesNatureLogement: '0',
      avantagesNatureVehicule: '0',
      avantagesNatureAutres: '0',
      documentsCNI: '',
      documentsContrat: '',
      documentsCV: '',
      documentsAutres: '',
      actif: true
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>👥 Liste des Employés</h3>
        <button onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
          ➕ Nouvel Employé
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ddd'
        }}>
          <h4>{editingId ? 'Modifier' : 'Nouveau'} Employé</h4>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Matricule *</label>
                <input type="text" value={formData.matricule}
                  onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom *</label>
                <input type="text" value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Prénom *</label>
                <input type="text" value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Numéro CNPS</label>
                <input type="text" value={formData.numeroCNPS}
                  onChange={(e) => setFormData({ ...formData, numeroCNPS: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date de naissance</label>
                <input type="date" value={formData.dateNaissance}
                  onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Téléphone</label>
                <input type="text" value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Poste</label>
                <input type="text" value={formData.poste}
                  onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Type de contrat *</label>
                <select value={formData.typeContrat}
                  onChange={(e) => setFormData({ ...formData, typeContrat: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  {TYPES_CONTRAT.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Date d'embauche</label>
                <input type="date" value={formData.dateEmbauche}
                  onChange={(e) => setFormData({ ...formData, dateEmbauche: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Salaire de base (FCFA) *</label>
                <input type="number" value={formData.salaireBase}
                  onChange={(e) => setFormData({ ...formData, salaireBase: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Indemnité transport (FCFA)</label>
                <input type="number" value={formData.indemnitesRegulieresTransport}
                  onChange={(e) => setFormData({ ...formData, indemnitesRegulieresTransport: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Indemnité logement (FCFA)</label>
                <input type="number" value={formData.indemnitesRegulieresLogement}
                  onChange={(e) => setFormData({ ...formData, indemnitesRegulieresLogement: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Avantage nature logement (FCFA)</label>
                <input type="number" value={formData.avantagesNatureLogement}
                  onChange={(e) => setFormData({ ...formData, avantagesNatureLogement: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Avantage nature véhicule (FCFA)</label>
                <input type="number" value={formData.avantagesNatureVehicule}
                  onChange={(e) => setFormData({ ...formData, avantagesNatureVehicule: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={{
                padding: '10px 20px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}>
                {editingId ? 'Mettre à jour' : 'Créer'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#34495e', color: 'white' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Matricule</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Nom</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Prénom</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Poste</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Type Contrat</th>
            <th style={{ padding: '12px', textAlign: 'right' }}>Salaire Base</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employes.map((emp, idx) => (
            <tr key={emp.id} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>{emp.matricule}</td>
              <td style={{ padding: '10px' }}>{emp.nom}</td>
              <td style={{ padding: '10px' }}>{emp.prenom}</td>
              <td style={{ padding: '10px' }}>{emp.poste}</td>
              <td style={{ padding: '10px' }}>{emp.typeContrat}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{parseFloat(emp.salaireBase || 0).toLocaleString()} FCFA</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>
                <button onClick={() => handleEdit(emp)} style={{
                  marginRight: '5px',
                  padding: '5px 10px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}>✏️</button>
                <button onClick={() => handleDelete(emp.id)} style={{
                  padding: '5px 10px',
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FichesPaieTab() {
  const [fiches, setFiches] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeId: '',
    mois: '',
    salaireBase: '',
    indemnitesTransport: '0',
    indemnitesLogement: '0',
    indemnitesAutres: '0',
    avantagesNature: '0',
    heuresSupplementaires: '0',
    primes: '0',
    cotisationsCNPS: '0',
    cotisationsIPRES: '0',
    impotSurRevenu: '0',
    autresRetenues: '0',
    avancesSalaire: '0',
    genererEcriture: true,
    statut: 'brouillon',
    notes: ''
  });

  useEffect(() => {
    loadFiches();
    loadEmployes();
  }, []);

  const loadFiches = async () => {
    const data = await api.get(`/paie/fiches-paie?entrepriseId=${ENTREPRISE_ID}`);
    setFiches(data.data || []);
  };

  const loadEmployes = async () => {
    const data = await api.get(`/paie/employes?entrepriseId=${ENTREPRISE_ID}`);
    setEmployes(data.data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/paie/fiches-paie?entrepriseId=${ENTREPRISE_ID}`, formData);
      loadFiches();
      setShowForm(false);
      resetForm();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      employeId: '',
      mois: '',
      salaireBase: '',
      indemnitesTransport: '0',
      indemnitesLogement: '0',
      indemnitesAutres: '0',
      avantagesNature: '0',
      heuresSupplementaires: '0',
      primes: '0',
      cotisationsCNPS: '0',
      cotisationsIPRES: '0',
      impotSurRevenu: '0',
      autresRetenues: '0',
      avancesSalaire: '0',
      genererEcriture: true,
      statut: 'brouillon',
      notes: ''
    });
  };

  const calculerSalaireBrut = () => {
    return parseFloat(formData.salaireBase || 0) +
      parseFloat(formData.indemnitesTransport || 0) +
      parseFloat(formData.indemnitesLogement || 0) +
      parseFloat(formData.indemnitesAutres || 0) +
      parseFloat(formData.avantagesNature || 0) +
      parseFloat(formData.heuresSupplementaires || 0) +
      parseFloat(formData.primes || 0);
  };

  const calculerSalaireNet = () => {
    const brut = calculerSalaireBrut();
    const retenues = parseFloat(formData.cotisationsCNPS || 0) +
      parseFloat(formData.cotisationsIPRES || 0) +
      parseFloat(formData.impotSurRevenu || 0) +
      parseFloat(formData.autresRetenues || 0) +
      parseFloat(formData.avancesSalaire || 0);
    return brut - retenues;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h3>📄 Fiches de Paie</h3>
        <button onClick={() => setShowForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
          ➕ Nouvelle Fiche de Paie
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ddd'
        }}>
          <h4>Nouvelle Fiche de Paie</h4>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Employé *</label>
                <select value={formData.employeId}
                  onChange={(e) => setFormData({ ...formData, employeId: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  <option value="">-- Sélectionner --</option>
                  {employes.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nom} {emp.prenom} ({emp.matricule})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mois (AAAA-MM) *</label>
                <input type="month" value={formData.mois}
                  onChange={(e) => setFormData({ ...formData, mois: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Salaire de base *</label>
                <input type="number" value={formData.salaireBase}
                  onChange={(e) => setFormData({ ...formData, salaireBase: e.target.value })}
                  required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Indemnités transport</label>
                <input type="number" value={formData.indemnitesTransport}
                  onChange={(e) => setFormData({ ...formData, indemnitesTransport: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Primes</label>
                <input type="number" value={formData.primes}
                  onChange={(e) => setFormData({ ...formData, primes: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cotisations CNPS</label>
                <input type="number" value={formData.cotisationsCNPS}
                  onChange={(e) => setFormData({ ...formData, cotisationsCNPS: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Impôt sur revenu</label>
                <input type="number" value={formData.impotSurRevenu}
                  onChange={(e) => setFormData({ ...formData, impotSurRevenu: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Avances sur salaire</label>
                <input type="number" value={formData.avancesSalaire}
                  onChange={(e) => setFormData({ ...formData, avancesSalaire: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
              </div>
            </div>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#e8f5e9',
              borderRadius: '5px'
            }}>
              <p><strong>Salaire Brut:</strong> {calculerSalaireBrut().toLocaleString()} FCFA</p>
              <p><strong>Salaire Net:</strong> {calculerSalaireNet().toLocaleString()} FCFA</p>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label>
                <input type="checkbox" checked={formData.genererEcriture}
                  onChange={(e) => setFormData({ ...formData, genererEcriture: e.target.checked })} />
                {' '}Générer l'écriture comptable automatiquement
              </label>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button type="submit" style={{
                padding: '10px 20px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}>
                Créer la fiche
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#34495e', color: 'white' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Mois</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Employé</th>
            <th style={{ padding: '12px', textAlign: 'right' }}>Salaire Brut</th>
            <th style={{ padding: '12px', textAlign: 'right' }}>Salaire Net</th>
            <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {fiches.map((fiche, idx) => (
            <tr key={fiche.fiche.id} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>{fiche.fiche.mois}</td>
              <td style={{ padding: '10px' }}>{fiche.employe?.nom} {fiche.employe?.prenom}</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{parseFloat(fiche.fiche.salaireBrut || 0).toLocaleString()} FCFA</td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{parseFloat(fiche.fiche.salaireNet || 0).toLocaleString()} FCFA</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  backgroundColor: fiche.fiche.statut === 'validée' ? '#27ae60' : '#f39c12',
                  color: 'white',
                  fontSize: '12px'
                }}>{fiche.fiche.statut}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AvancesTab() {
  return (
    <div>
      <h3>💵 Avances sur Salaire</h3>
      <p>Gestion des avances sur salaire (à venir)</p>
    </div>
  );
}

function RapportsTab() {
  return (
    <div>
      <h3>📊 Rapports de Paie</h3>
      <p>Rapports et statistiques de paie (à venir)</p>
    </div>
  );
}
