import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function ModuleComptabilite() {
  const [activeTab, setActiveTab] = useState('plan');
  const [data, setData] = useState({
    comptes: [],
    journaux: [],
    ecritures: [],
    immobilisations: []
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const comptesRes = await api.get('/comptabilite/comptes');
      const journauxRes = await api.get('/comptabilite/journaux');
      const ecrituresRes = await api.get('/comptabilite/ecritures');
      const immosRes = await api.get('/immobilisations/list');
      
      setData({
        comptes: comptesRes || [],
        journaux: journauxRes || [],
        ecritures: ecrituresRes || [],
        immobilisations: immosRes || []
      });
    } catch (error) {
      console.error('Erreur chargement:', error);
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
    { id: 'journaux', label: '📚 Journaux', icon: '📚' },
    { id: 'ecritures', label: '✍️ Écritures', icon: '✍️' },
    { id: 'grandlivre', label: '📖 Grand Livre', icon: '📖' },
    { id: 'balance', label: '⚖️ Balance', icon: '⚖️' },
    { id: 'immobilisations', label: '🏢 Immobilisations', icon: '🏢' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ];

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
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📋 Plan Comptable</h3>
            <Button onClick={() => openModal('compte')}>+ Nouveau Compte</Button>
          </div>
          <Table
            columns={[
              { key: 'numero', label: 'N° Compte' },
              { key: 'nom', label: 'Nom du Compte' },
              { key: 'categorie', label: 'Catégorie' },
              { key: 'sousCategorie', label: 'Sous-Catégorie' },
              { key: 'solde', label: 'Solde', render: (val) => `${val || 0} FCFA` }
            ]}
            data={data.comptes}
            onEdit={(item) => openModal('compte', item)}
            actions={true}
          />
        </div>
      )}

      {activeTab === 'journaux' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📚 Journaux Comptables</h3>
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
                { key: 'totalDebit', label: 'Débit', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
                { key: 'totalCredit', label: 'Crédit', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
                { key: 'statut', label: 'Statut', render: (val) => {
                  const colors = { brouillon: '#ff9800', validée: '#4caf50' };
                  return <span style={{ color: colors[val] || '#666', fontWeight: 'bold' }}>{val?.toUpperCase()}</span>;
                }}
              ]}
              data={data.ecritures}
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
              <Button variant="primary" onClick={async () => {
                const compteId = document.getElementById('grandLivreCompte').value;
                try {
                  const params = { dateDebut: periode.dateDebut, dateFin: periode.dateFin };
                  if (compteId) params.compteId = compteId;
                  const lignes = await api.get('/comptabilite/grand-livre', params);
                  alert(`Grand Livre chargé: ${lignes.length} lignes`);
                } catch (err) {
                  alert('Erreur: ' + err.message);
                }
              }}>Charger</Button>
            </div>
          </div>

          <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#7f8c8d', margin: 0 }}>Sélectionnez les filtres et cliquez sur "Charger" pour afficher le grand livre</p>
          </div>
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
            <Button variant="primary" style={{ marginTop: '15px' }} onClick={async () => {
              try {
                const balance = await api.get('/comptabilite/balance');
                const balanceData = data.comptes.map(c => {
                  const soldes = balance[c.id] || { debit: 0, credit: 0 };
                  return {
                    ...c,
                    debit: soldes.debit,
                    credit: soldes.credit,
                    solde: soldes.debit - soldes.credit
                  };
                });
                alert(`Balance générée: ${balanceData.length} comptes`);
              } catch (err) {
                alert('Erreur: ' + err.message);
              }
            }}>Générer Balance</Button>
          </div>

          <Table
            columns={[
              { key: 'numero', label: 'N° Compte' },
              { key: 'nom', label: 'Libellé' },
              { key: 'categorie', label: 'Catégorie' },
              { key: 'solde', label: 'Solde', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` }
            ]}
            data={data.comptes}
            actions={false}
          />
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
                { key: 'valeurAcquisition', label: 'Valeur Acquisition', render: (val) => `${parseFloat(val).toLocaleString()} FCFA` },
                { key: 'amortissementCumule', label: 'Amort. Cumulé', render: (val) => `${parseFloat(val || 0).toLocaleString()} FCFA` },
                { key: 'valeurNetteComptable', label: 'VNC', render: (val) => `${parseFloat(val).toLocaleString()} FCFA` },
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
                try {
                  const bilan = await api.get('/comptabilite/bilan', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  alert(`Bilan généré:\nActif Total: ${bilan.actif.total.toLocaleString()} FCFA\nPassif Total: ${bilan.passif.total.toLocaleString()} FCFA`);
                } catch (err) {
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
                try {
                  const resultat = await api.get('/comptabilite/compte-resultat', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  alert(`Compte de Résultat:\nProduits: ${resultat.produits.total.toLocaleString()} FCFA\nCharges: ${resultat.charges.total.toLocaleString()} FCFA\nRésultat Net: ${resultat.resultatNet.toLocaleString()} FCFA`);
                } catch (err) {
                  alert('Erreur génération Compte de Résultat: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#7b1fa2' }}>📊 Compte de Résultat</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Produits et charges sur une période
              </p>
            </div>

            <div style={{ padding: '30px', background: '#fff9e6', borderRadius: '8px', cursor: 'pointer' }}
              onClick={async () => {
                try {
                  const rapport = await api.get('/comptabilite/rapport-journaux', { dateDebut: periode.dateDebut, dateFin: periode.dateFin });
                  let message = `📚 Rapport des Journaux\n\n`;
                  message += `Total général: ${rapport.totaux.nombreEcritures} écritures\n`;
                  message += `Débit: ${rapport.totaux.debit.toLocaleString()} FCFA\n`;
                  message += `Crédit: ${rapport.totaux.credit.toLocaleString()} FCFA\n\n`;
                  rapport.journaux.forEach(j => {
                    if (j.nombreEcritures > 0) {
                      message += `${j.code} - ${j.nom}:\n`;
                      message += `  ${j.nombreEcritures} écritures, Débit: ${j.totalDebit.toLocaleString()} FCFA\n`;
                    }
                  });
                  alert(message);
                } catch (err) {
                  alert('Erreur génération Rapport Journaux: ' + err.message);
                }
              }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#f9a825' }}>📚 Rapport des Journaux</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Synthèse des écritures par journal comptable
              </p>
            </div>

            <div style={{ padding: '30px', background: '#e8f5e9', borderRadius: '8px', cursor: 'pointer' }}
              onClick={() => alert('Tableau des Flux de Trésorerie (à venir)')}>
              <h4 style={{ margin: '0 0 10px 0', color: '#388e3c' }}>💰 Tableau des Flux de Trésorerie</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Mouvements de trésorerie par activité
              </p>
            </div>

            <div style={{ padding: '30px', background: '#fff3e0', borderRadius: '8px', cursor: 'pointer' }}
              onClick={() => alert('Journal Général: utilisez l\'onglet Écritures pour voir toutes les écritures')}>
              <h4 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>📖 Journal Général</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                Toutes les écritures comptables chronologiques
              </p>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={
          modal.type === 'compte' ? (modal.item ? 'Modifier Compte' : 'Nouveau Compte Comptable') :
          modal.type === 'journal' ? (modal.item ? 'Modifier Journal' : 'Nouveau Journal') :
          modal.type === 'ecriture' ? 'Nouvelle Écriture Comptable' :
          modal.type === 'immobilisation' ? (modal.item ? 'Modifier Immobilisation' : 'Nouvelle Immobilisation') : ''
        }
        size={modal.type === 'ecriture' ? 'xlarge' : 'large'}
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
                        <h3 style={{ margin: '5px 0 0 0', color: '#1976d2' }}>{totalDebit.toLocaleString()} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>TOTAL CRÉDIT</p>
                        <h3 style={{ margin: '5px 0 0 0', color: '#7b1fa2' }}>{totalCredit.toLocaleString()} FCFA</h3>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>DIFFÉRENCE</p>
                        <h3 style={{ margin: '5px 0 0 0', color: difference === 0 ? '#388e3c' : '#d32f2f' }}>
                          {difference.toLocaleString()} FCFA {difference === 0 ? '✓' : '✗'}
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
        </form>
      </Modal>
    </div>
  );
}
