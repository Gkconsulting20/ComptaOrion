import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function EmployesModule() {
  const [employes, setEmployes] = useState([]);
  const [avances, setAvances] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employes');
  const [showModal, setShowModal] = useState(false);
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [editingEmploye, setEditingEmploye] = useState(null);
  const [selectedEmployeId, setSelectedEmployeId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    dateEmbauche: new Date().toISOString().split('T')[0],
    poste: '',
    departement: '',
    salaire: 0,
  });
  const [avanceFormData, setAvanceFormData] = useState({
    montant: 0,
    motif: '',
    modaliteRemboursement: '',
  });
  const [absenceFormData, setAbsenceFormData] = useState({
    type: 'conge',
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    motif: '',
  });

  useEffect(() => {
    loadEmployes();
  }, []);

  useEffect(() => {
    if (activeTab === 'avances') loadAvances();
    if (activeTab === 'absences') loadAbsences();
    if (activeTab === 'notifications') loadNotifications();
  }, [activeTab]);

  const loadEmployes = async () => {
    try {
      const data = await api.get('/employes/list');
      setEmployes(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvances = async () => {
    try {
      const data = await api.get('/employes/avances/list');
      setAvances(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadAbsences = async () => {
    try {
      const data = await api.get('/employes/absences/list');
      setAbsences(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await api.get('/employes/notifications');
      setNotifications(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmploye) {
        await api.put(`/employes/${editingEmploye.id}`, { 
          ...formData, 
          userId: 1, 
          ipAddress: '127.0.0.1' 
        });
      } else {
        await api.post('/employes/create', { 
          ...formData, 
          userId: 1, 
          ipAddress: '127.0.0.1' 
        });
      }
      setShowModal(false);
      setEditingEmploye(null);
      resetForm();
      loadEmployes();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleAvanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employes/avances/create', {
        employeId: selectedEmployeId,
        ...avanceFormData,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      setShowAvanceModal(false);
      setAvanceFormData({ montant: 0, motif: '', modaliteRemboursement: '' });
      loadAvances();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleAbsenceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employes/absences/create', {
        employeId: selectedEmployeId,
        ...absenceFormData,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      setShowAbsenceModal(false);
      setAbsenceFormData({ type: 'conge', dateDebut: new Date().toISOString().split('T')[0], dateFin: '', motif: '' });
      loadAbsences();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleAvanceApproval = async (avanceId, statut) => {
    try {
      await api.post('/employes/avances/approve', {
        avanceId,
        statut,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      loadAvances();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleAbsenceApproval = async (absenceId, statut) => {
    try {
      await api.post('/employes/absences/approve', {
        absenceId,
        statut,
        userId: 1,
        ipAddress: '127.0.0.1'
      });
      loadAbsences();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEdit = (employe) => {
    setEditingEmploye(employe);
    setFormData({ ...employe });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      dateEmbauche: new Date().toISOString().split('T')[0],
      poste: '',
      departement: '',
      salaire: 0,
    });
  };

  const employeColumns = [
    { key: 'id', label: 'ID' },
    { key: 'prenom', label: 'Prénom' },
    { key: 'nom', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'poste', label: 'Poste' },
    { key: 'departement', label: 'Département' },
    { key: 'salaire', label: 'Salaire', render: (val) => `${val} FCFA` },
  ];

  const avanceColumns = [
    { key: 'id', label: 'ID' },
    { key: 'employeId', label: 'Employé ID' },
    { key: 'montant', label: 'Montant', render: (val) => `${val} FCFA` },
    { key: 'motif', label: 'Motif' },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = { en_attente: '#f39c12', approuve: '#27ae60', rejete: '#e74c3c' };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px',
        }}>{val}</span>;
      }
    },
  ];

  const absenceColumns = [
    { key: 'id', label: 'ID' },
    { key: 'employeId', label: 'Employé ID' },
    { key: 'type', label: 'Type' },
    { key: 'dateDebut', label: 'Début', render: (val) => val?.split('T')[0] },
    { key: 'dateFin', label: 'Fin', render: (val) => val?.split('T')[0] },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (val) => {
        const colors = { en_attente: '#f39c12', approuve: '#27ae60', rejete: '#e74c3c' };
        return <span style={{ 
          padding: '4px 8px', 
          borderRadius: '4px', 
          backgroundColor: colors[val] || '#999',
          color: 'white',
          fontSize: '11px',
        }}>{val}</span>;
      }
    },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>👤 Employés (ORION HR LITE)</h2>
        {activeTab === 'employes' && (
          <Button onClick={() => { resetForm(); setEditingEmploye(null); setShowModal(true); }}>
            + Nouvel Employé
          </Button>
        )}
        {activeTab === 'avances' && (
          <Button onClick={() => { setSelectedEmployeId(employes[0]?.id); setShowAvanceModal(true); }}>
            + Demande d'Avance
          </Button>
        )}
        {activeTab === 'absences' && (
          <Button onClick={() => { setSelectedEmployeId(employes[0]?.id); setShowAbsenceModal(true); }}>
            + Demande d'Absence
          </Button>
        )}
      </div>

      <div style={{ borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('employes')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'employes' ? '#3498db' : 'transparent',
              color: activeTab === 'employes' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: '500',
            }}
          >
            Employés
          </button>
          <button
            onClick={() => setActiveTab('avances')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'avances' ? '#3498db' : 'transparent',
              color: activeTab === 'avances' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: '500',
            }}
          >
            Avances Salaire
          </button>
          <button
            onClick={() => setActiveTab('absences')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'absences' ? '#3498db' : 'transparent',
              color: activeTab === 'absences' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: '500',
            }}
          >
            Absences
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeTab === 'notifications' ? '#3498db' : 'transparent',
              color: activeTab === 'notifications' ? 'white' : '#333',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: '500',
            }}
          >
            Notifications RH
          </button>
        </div>
      </div>

      {activeTab === 'employes' && (
        <Table 
          columns={employeColumns} 
          data={employes} 
          onEdit={handleEdit}
          actions={true}
        />
      )}

      {activeTab === 'avances' && (
        <Table 
          columns={avanceColumns} 
          data={avances}
          onEdit={(avance) => handleAvanceApproval(avance.id, 'approuve')}
          actions={true}
        />
      )}

      {activeTab === 'absences' && (
        <Table 
          columns={absenceColumns} 
          data={absences}
          onEdit={(absence) => handleAbsenceApproval(absence.id, 'approuve')}
          actions={true}
        />
      )}

      {activeTab === 'notifications' && (
        <div>
          {notifications.length === 0 ? (
            <p style={{ color: '#999', padding: '40px', textAlign: 'center' }}>Aucune notification</p>
          ) : (
            notifications.map((notif, index) => (
              <div key={index} style={{
                padding: '15px',
                backgroundColor: '#fff3cd',
                borderLeft: '4px solid #f39c12',
                marginBottom: '10px',
                borderRadius: '4px'
              }}>
                <strong>{notif.type}</strong> - {notif.message}
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingEmploye(null); resetForm(); }}
        title={editingEmploye ? 'Modifier Employé' : 'Nouvel Employé'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <FormField
              label="Prénom"
              name="prenom"
              value={formData.prenom}
              onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
              required
            />
            <FormField
              label="Nom"
              name="nom"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              required
            />
            <FormField
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <FormField
              label="Téléphone"
              name="telephone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
            />
            <FormField
              label="Date d'Embauche"
              name="dateEmbauche"
              type="date"
              value={formData.dateEmbauche}
              onChange={(e) => setFormData({ ...formData, dateEmbauche: e.target.value })}
              required
            />
            <FormField
              label="Poste"
              name="poste"
              value={formData.poste}
              onChange={(e) => setFormData({ ...formData, poste: e.target.value })}
              required
            />
            <FormField
              label="Département"
              name="departement"
              value={formData.departement}
              onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
            />
            <FormField
              label="Salaire (FCFA)"
              name="salaire"
              type="number"
              value={formData.salaire}
              onChange={(e) => setFormData({ ...formData, salaire: parseFloat(e.target.value) })}
              required
            />
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              {editingEmploye ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAvanceModal}
        onClose={() => setShowAvanceModal(false)}
        title="Nouvelle Demande d'Avance Salaire"
        size="medium"
      >
        <form onSubmit={handleAvanceSubmit}>
          <FormField
            label="Employé"
            type="select"
            value={selectedEmployeId}
            onChange={(e) => setSelectedEmployeId(e.target.value)}
            options={employes.map(emp => ({ value: emp.id, label: `${emp.prenom} ${emp.nom}` }))}
            required
          />
          <FormField
            label="Montant (FCFA)"
            type="number"
            value={avanceFormData.montant}
            onChange={(e) => setAvanceFormData({ ...avanceFormData, montant: parseFloat(e.target.value) })}
            required
          />
          <FormField
            label="Motif"
            type="textarea"
            value={avanceFormData.motif}
            onChange={(e) => setAvanceFormData({ ...avanceFormData, motif: e.target.value })}
            required
          />
          <FormField
            label="Modalité de Remboursement"
            value={avanceFormData.modaliteRemboursement}
            onChange={(e) => setAvanceFormData({ ...avanceFormData, modaliteRemboursement: e.target.value })}
            placeholder="Ex: 3 mensualités"
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowAvanceModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Soumettre Demande
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showAbsenceModal}
        onClose={() => setShowAbsenceModal(false)}
        title="Nouvelle Demande d'Absence"
        size="medium"
      >
        <form onSubmit={handleAbsenceSubmit}>
          <FormField
            label="Employé"
            type="select"
            value={selectedEmployeId}
            onChange={(e) => setSelectedEmployeId(e.target.value)}
            options={employes.map(emp => ({ value: emp.id, label: `${emp.prenom} ${emp.nom}` }))}
            required
          />
          <FormField
            label="Type d'Absence"
            type="select"
            value={absenceFormData.type}
            onChange={(e) => setAbsenceFormData({ ...absenceFormData, type: e.target.value })}
            options={[
              { value: 'conge', label: 'Congé' },
              { value: 'maladie', label: 'Maladie' },
              { value: 'permission', label: 'Permission' },
              { value: 'formation', label: 'Formation' },
            ]}
          />
          <FormField
            label="Date Début"
            type="date"
            value={absenceFormData.dateDebut}
            onChange={(e) => setAbsenceFormData({ ...absenceFormData, dateDebut: e.target.value })}
            required
          />
          <FormField
            label="Date Fin"
            type="date"
            value={absenceFormData.dateFin}
            onChange={(e) => setAbsenceFormData({ ...absenceFormData, dateFin: e.target.value })}
            required
          />
          <FormField
            label="Motif"
            type="textarea"
            value={absenceFormData.motif}
            onChange={(e) => setAbsenceFormData({ ...absenceFormData, motif: e.target.value })}
          />
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setShowAbsenceModal(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="success">
              Soumettre Demande
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
