import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import api from '../api';

export function GestionFournisseurs() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [data, setData] = useState({
    fournisseurs: [],
    commandes: [],
    receptions: [],
    factures: [],
    paiements: []
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null, item: null });
  const [form, setForm] = useState({});
  const [periode, setPeriode] = useState({
    dateDebut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateFin: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fournisseursRes, commandesRes] = await Promise.all([
        api.get('/fournisseurs'),
        api.get('/commandes-achat')
      ]);
      setData({
        fournisseurs: fournisseursRes.data || [],
        commandes: commandesRes.data || [],
        receptions: [],
        factures: [],
        paiements: []
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
      }
      closeModal();
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
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' },
    { id: 'commandes', label: '📦 Commandes Achat', icon: '📦' },
    { id: 'receptions', label: '📥 Réceptions', icon: '📥' },
    { id: 'factures', label: '🧾 Factures', icon: '🧾' },
    { id: 'paiements', label: '💰 Paiements', icon: '💰' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>⚙️ Paramètres Fournisseurs</h3>
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
            onEdit={(item) => openModal('fournisseur', item)}
            onDelete={(item) => handleDelete('fournisseur', item.id)}
          />
        </div>
      )}

      {activeTab === 'commandes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📦 Commandes d'Achat</h3>
            <Button onClick={() => openModal('commande')}>+ Nouvelle Commande</Button>
          </div>
          <Table
            columns={[
              { key: 'numeroCommande', label: 'N° Commande', render: (_, row) => row.commande?.numeroCommande || '-' },
              { key: 'fournisseur', label: 'Fournisseur', render: (_, row) => row.fournisseur?.nom || '-' },
              { key: 'dateCommande', label: 'Date', render: (_, row) => row.commande?.dateCommande?.split('T')[0] || '-' },
              { key: 'totalHT', label: 'Total HT', render: (_, row) => `${row.commande?.totalHT || 0} FCFA` },
              { key: 'statut', label: 'Statut', render: (_, row) => {
                const statut = row.commande?.statut || 'brouillon';
                const colors = { brouillon: '#95a5a6', validee: '#3498db', recue: '#27ae60', annulee: '#e74c3c' };
                return <span style={{ 
                  padding: '4px 8px', borderRadius: '4px', backgroundColor: colors[statut] || '#999',
                  color: 'white', fontSize: '11px'
                }}>{statut}</span>;
              }}
            ]}
            data={data.commandes}
            actions={false}
          />
        </div>
      )}

      {activeTab === 'receptions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>📥 Réceptions de Marchandises</h3>
            <Button onClick={() => openModal('reception')}>+ Nouvelle Réception</Button>
          </div>
          <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#7f8c8d', margin: 0 }}>Aucune réception enregistrée</p>
          </div>
        </div>
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
            <Button onClick={() => openModal('paiement')}>+ Nouveau Paiement</Button>
          </div>
          <div style={{ padding: '50px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ color: '#7f8c8d', margin: 0 }}>Aucun paiement enregistré</p>
          </div>
        </div>
      )}

      {activeTab === 'rapports' && (
        <div>
          <h3>📊 Rapports Fournisseurs</h3>

          <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📅 Filtrer par Période</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Début</label>
                <input
                  type="date"
                  value={periode.dateDebut}
                  onChange={(e) => setPeriode({...periode, dateDebut: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#666' }}>Date Fin</label>
                <input
                  type="date"
                  value={periode.dateFin}
                  onChange={(e) => setPeriode({...periode, dateFin: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL FOURNISSEURS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{data.fournisseurs.length}</h2>
            </div>
            <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL ACHATS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#f57c00' }}>{totalAchats.toLocaleString()} FCFA</h2>
            </div>
            <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PAIEMENTS</p>
              <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{totalPaiements.toLocaleString()} FCFA</h2>
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
                  return `${total.toLocaleString()} FCFA`;
                }},
                { key: 'evaluation', label: 'Évaluation', render: (val) => '⭐'.repeat(val || 3) }
              ]}
              data={data.fournisseurs}
              actions={false}
            />
          </div>
        </div>
      )}

      <Modal isOpen={modal.open} onClose={closeModal}
        title={
          modal.type === 'fournisseur' ? (modal.item ? 'Modifier Fournisseur' : 'Nouveau Fournisseur') :
          modal.type === 'commande' ? 'Nouvelle Commande d\'Achat' :
          modal.type === 'reception' ? 'Nouvelle Réception' :
          modal.type === 'facture' ? 'Nouvelle Facture Fournisseur' :
          modal.type === 'paiement' ? 'Nouveau Paiement' : ''
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <FormField label="Fournisseur" name="fournisseurId" type="select" value={form.fournisseurId}
                  onChange={(e) => setForm({...form, fournisseurId: e.target.value})}
                  options={data.fournisseurs.map(f => ({ value: f.id, label: f.nom }))} required />
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
              <FormField label="Notes" name="notes" value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})} />
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button type="button" variant="secondary" onClick={closeModal}>Annuler</Button>
                <Button type="submit" variant="success">Enregistrer</Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
