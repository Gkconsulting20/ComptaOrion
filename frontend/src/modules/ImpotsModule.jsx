import React, { useState, useEffect } from 'react';
import PeriodFilter, { getPeriodeDates } from '../components/PeriodFilter';
import api from '../api';

export function ImpotsModule() {
  const [activeTab, setActiveTab] = useState('declarations');
  const [loading, setLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [parametres, setParametres] = useState({
    pays: '',
    administrationNom: '',
    numeroIFU: '',
    numeroNIF: '',
    centreImpots: '',
    regimeImposition: 'reel-normal',
    apiUrl: '',
    apiIdentifiant: '',
    apiCleSecrete: ''
  });
  const [tvaResume, setTvaResume] = useState({
    tvaCollectee: 0,
    tvaDeductible: 0,
    tvaADecaisser: 0,
    creditTVA: 0,
    comptesCollectee: [],
    comptesDeductible: []
  });
  const [resultatIS, setResultatIS] = useState({ produits: 0, charges: 0, resultatComptable: 0 });
  const [taxFeedback, setTaxFeedback] = useState({ type: '', message: '' });
  const [periodeTVA, setPeriodeTVA] = useState({
    dateDebut: getPeriodeDates('annee').dateDebut,
    dateFin: getPeriodeDates('annee').dateFin
  });
  const [drillModal, setDrillModal] = useState({ open: false, title: '', data: [], totaux: null, loading: false, compte: '' });

  const loadDrillDown = async (type, title) => {
    setDrillModal({ open: true, title, data: [], totaux: null, loading: true, compte: type });
    try {
      const response = await api.get('/impots/tva/mouvements', {
        type,
        dateDebut: periodeTVA.dateDebut,
        dateFin: periodeTVA.dateFin
      });
      setDrillModal({
        open: true,
        title,
        data: response.mouvements || [],
        totaux: response.totaux || null,
        loading: false,
        compte: type
      });
    } catch (err) {
      alert('Erreur: ' + err.message);
      setDrillModal({ open: false, title: '', data: [], totaux: null, loading: false, compte: '' });
    }
  };

  const exportDrillDownCSV = () => {
    if (!drillModal.data.length) return;
    let csv = `Compte: ${drillModal.title}\nPériode: ${periodeTVA.dateDebut} au ${periodeTVA.dateFin}\n\n`;
    csv += 'Date;Journal;Référence;Compte;Libellé;Débit;Crédit;Solde Cumulé\n';
    drillModal.data.forEach(m => {
      csv += `${m.date};${m.journal};${m.reference};${m.compteNumero} ${m.compteNom || ''};${m.libelle};${Math.round(m.debit || 0)};${Math.round(m.credit || 0)};${Math.round(m.soldeCumule || 0)}\n`;
    });
    if (drillModal.totaux) {
      csv += `\nTOTAUX;;;${Math.round(drillModal.totaux.totalDebit || 0)};${Math.round(drillModal.totaux.totalCredit || 0)};${Math.round(drillModal.totaux.solde || 0)}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
      a.download = `Detail_TVA_${drillModal.compte}_${periodeTVA.dateDebut}_${periodeTVA.dateFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'tva') {
      loadTVAResume();
    } else if (activeTab === 'is') {
      loadISResume();
    }
  }, [activeTab, periodeTVA.dateDebut, periodeTVA.dateFin]);

  const loadTVAResume = async () => {
    try {
      const res = await api.get('/impots/tva/resume', { 
        dateDebut: periodeTVA.dateDebut, 
        dateFin: periodeTVA.dateFin 
      });
      setTvaResume({
        tvaCollectee: res.tvaCollectee || 0,
        tvaDeductible: res.tvaDeductible || 0,
        tvaADecaisser: res.tvaADecaisser || 0,
        creditTVA: res.creditTVA || 0,
        comptesCollectee: res.comptesCollectee || [],
        comptesDeductible: res.comptesDeductible || []
      });
    } catch (error) {
      console.error('Erreur chargement TVA:', error);
    }
  };

  const loadISResume = async () => {
    try {
      const res = await api.get('/impots/is/resultat', {
        dateDebut: periodeTVA.dateDebut,
        dateFin: periodeTVA.dateFin
      });
      setResultatIS({
        produits: res.produits || 0,
        charges: res.charges || 0,
        resultatComptable: res.resultatComptable || 0
      });
    } catch (error) {
      console.error('Erreur chargement résultat comptable:', error);
      setTaxFeedback({ type: 'error', message: error.message || 'Impossible de calculer le résultat comptable.' });
    }
  };

  const preparerDeclarationTVA = async () => {
    setTaxFeedback({ type: '', message: '' });
    setLoading(true);
    try {
      const response = await api.post('/impots/declarations/tva', {
        dateDebut: periodeTVA.dateDebut,
        dateFin: periodeTVA.dateFin
      });
      setTaxFeedback({ type: 'success', message: response.message || 'Brouillon TVA enregistré.' });
      const declarationsRes = await api.get('/impots/declarations');
      setDeclarations(declarationsRes.data || []);
    } catch (error) {
      setTaxFeedback({ type: 'error', message: error.message || 'Impossible de créer le brouillon TVA.' });
    } finally {
      setLoading(false);
    }
  };

  const enregistrerDepotManuel = async (declaration) => {
    const numeroDeclaration = window.prompt('Référence de dépôt fournie par l’OTR :');
    if (!numeroDeclaration?.trim()) return;
    const dateDeclaration = window.prompt('Date réelle du dépôt (AAAA-MM-JJ) :', new Date().toISOString().slice(0, 10));
    if (!dateDeclaration) return;

    setTaxFeedback({ type: '', message: '' });
    setLoading(true);
    try {
      const response = await api.post(`/impots/declarations/${declaration.id}/depot-manuel`, {
        numeroDeclaration,
        dateDeclaration
      });
      setTaxFeedback({ type: 'success', message: response.message || 'Dépôt manuel enregistré.' });
      const declarationsRes = await api.get('/impots/declarations');
      setDeclarations(declarationsRes.data || []);
    } catch (error) {
      setTaxFeedback({ type: 'error', message: error.message || 'Impossible d’enregistrer le dépôt manuel.' });
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'declarations') {
        const res = await api.get('/impots/declarations');
        setDeclarations(res.data || []);
      } else if (activeTab === 'parametres') {
        const res = await api.get('/impots/parametres');
        if (res.data) {
          setParametres({
            ...parametres,
            ...res.data
          });
        }
      }
    } catch (error) {
      console.error('Erreur chargement impôts:', error);
    } finally {
      setLoading(false);
    }
  };

  const sauvegarderParametres = async () => {
    if (!parametres.pays) {
      alert('Veuillez sélectionner le pays.');
      return;
    }
    try {
      setLoading(true);
      const {
        pays,
        administrationNom,
        numeroIFU,
        numeroNIF,
        centreImpots,
        regimeImposition
      } = parametres;
      await api.post('/impots/parametres', {
        pays,
        administrationNom,
        numeroIFU,
        numeroNIF,
        centreImpots,
        regimeImposition
      });
      alert('Paramètres fiscaux enregistrés avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de l\'enregistrement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'declarations', label: '📋 Déclarations' },
    { id: 'tva', label: '💳 TVA' },
    { id: 'is', label: '🏢 Impôt sur Sociétés' },
    { id: 'parametres', label: '⚙️ Paramètres' }
  ];

  const renderDeclarations = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Déclarations Fiscales</h3>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Période</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Montant</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Référence</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Enregistrée le</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {declarations.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
                Aucune déclaration enregistrée
              </td>
            </tr>
          ) : declarations.map(declaration => (
            <tr key={declaration.id}>
              <td style={{ padding: '12px' }}>
                {String(declaration.periode || '—').replace('..', ' au ')}
              </td>
              <td style={{ padding: '12px' }}>{String(declaration.type || '—').toUpperCase()}</td>
              <td style={{ padding: '12px' }}>
                {Number(declaration.montant || 0) < 0
                  ? `Crédit ${Math.abs(Number(declaration.montant)).toLocaleString('fr-FR')} XOF`
                  : `${Number(declaration.montant || 0).toLocaleString('fr-FR')} XOF`}
              </td>
              <td style={{ padding: '12px' }}>{declaration.statut || '—'}</td>
              <td style={{ padding: '12px' }}>{declaration.numeroDeclaration || '—'}</td>
              <td style={{ padding: '12px' }}>
                {declaration.createdAt ? new Date(declaration.createdAt).toLocaleDateString('fr-FR') : '—'}
              </td>
              <td style={{ padding: '12px' }}>
                {declaration.type === 'tva' && declaration.statut === 'brouillon' && (
                  <button type="button" onClick={() => enregistrerDepotManuel(declaration)} disabled={loading}
                    style={{ padding: '7px 10px', border: 0, borderRadius: 5, background: '#1976d2', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    Confirmer dépôt OTR
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTVA = () => {
    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Suivi indicatif de la TVA</h3>
        
        <PeriodFilter
          dateDebut={periodeTVA.dateDebut}
          dateFin={periodeTVA.dateFin}
          onDateDebutChange={(val) => setPeriodeTVA({...periodeTVA, dateDebut: val})}
          onDateFinChange={(val) => setPeriodeTVA({...periodeTVA, dateFin: val})}
          onApply={loadTVAResume}
        />
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }} className="no-print">
          <button
            type="button"
            onClick={preparerDeclarationTVA}
            disabled={loading}
            style={{ padding: '8px 16px', backgroundColor: loading ? '#95a5a6' : '#6c5ce7', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Enregistrement…' : 'Créer un brouillon TVA'}
          </button>
          <button 
            onClick={() => {
              const printWindow = window.open('', '_blank');
              printWindow.document.write(`
                <html>
                  <head>
                    <title>Résumé TVA - ComptaOrion</title>
                    <style>
                      body { font-family: Arial, sans-serif; margin: 20px; }
                      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                      th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                      th { background-color: #f5f5f5; }
                      .total { font-weight: bold; font-size: 18px; }
                      @media print { body { margin: 0; } }
                    </style>
                  </head>
                  <body>
                    <h2>Résumé TVA</h2>
                    <p>Période: ${periodeTVA.dateDebut} au ${periodeTVA.dateFin}</p>
                    <table>
                      <tr><th>Type</th><th>Montant</th></tr>
                      <tr><td>TVA facturée (comptes 443*, hors 4434)</td><td>${tvaResume.tvaCollectee.toLocaleString('fr-FR')} FCFA</td></tr>
                      <tr><td>TVA récupérable (comptes 445*)</td><td>${tvaResume.tvaDeductible.toLocaleString('fr-FR')} FCFA</td></tr>
                      <tr class="total"><td>${tvaResume.tvaADecaisser >= 0 ? 'TVA à Décaisser' : 'Crédit de TVA'}</td><td>${Math.abs(tvaResume.tvaADecaisser).toLocaleString('fr-FR')} FCFA</td></tr>
                    </table>
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
              const htmlContent = `
                <html>
                  <head><meta charset="utf-8"><title>Résumé TVA</title>
                    <style>body { font-family: Arial; margin: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 10px; } th { background: #f5f5f5; }</style>
                  </head>
                  <body>
                    <h2>Résumé TVA</h2>
                    <p>Période: ${periodeTVA.dateDebut} au ${periodeTVA.dateFin}</p>
                    <table>
                      <tr><th>Type</th><th>Montant</th></tr>
                      <tr><td>TVA facturée (comptes 443*, hors 4434)</td><td>${tvaResume.tvaCollectee.toLocaleString('fr-FR')} FCFA</td></tr>
                      <tr><td>TVA récupérable (comptes 445*)</td><td>${tvaResume.tvaDeductible.toLocaleString('fr-FR')} FCFA</td></tr>
                      <tr><td><strong>${tvaResume.tvaADecaisser >= 0 ? 'TVA à Décaisser' : 'Crédit de TVA'}</strong></td><td><strong>${Math.abs(tvaResume.tvaADecaisser).toLocaleString('fr-FR')} FCFA</strong></td></tr>
                    </table>
                  </body>
                </html>
              `;
              const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Resume_TVA_${periodeTVA.dateDebut}_${periodeTVA.dateFin}.html`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ⬇️ Télécharger
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div 
            onClick={() => loadDrillDown('collectee', 'Mouvements de TVA facturée')}
            style={{ padding: '20px', backgroundColor: '#3498db', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)'; }}
          >
            <div style={{ fontSize: '14px', opacity: 0.9 }}>TVA Collectée</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '10px 0' }}>{tvaResume.tvaCollectee.toLocaleString('fr-FR')} FCFA</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Comptes 443* hors 4434 · Voir les lignes</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: 7 }}>
              Comptes retenus : {tvaResume.comptesCollectee.length ? tvaResume.comptesCollectee.map((account) => account.numero).join(', ') : 'aucun compte mouvementé'}
            </div>
          </div>

          <div 
            onClick={() => loadDrillDown('deductible', 'Mouvements de TVA récupérable')}
            style={{ padding: '20px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)'; }}
          >
            <div style={{ fontSize: '14px', opacity: 0.9 }}>TVA Déductible</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '10px 0' }}>{tvaResume.tvaDeductible.toLocaleString('fr-FR')} FCFA</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Comptes 445* · Voir les lignes</div>
            <div style={{ fontSize: '11px', opacity: 0.8, marginTop: 7 }}>
              Comptes retenus : {tvaResume.comptesDeductible.length ? tvaResume.comptesDeductible.map((account) => account.numero).join(', ') : 'aucun compte mouvementé'}
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: tvaResume.tvaADecaisser >= 0 ? '#27ae60' : '#9b59b6', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>{tvaResume.tvaADecaisser >= 0 ? 'TVA à Décaisser' : 'Crédit de TVA'}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '10px 0' }}>{Math.abs(tvaResume.tvaADecaisser).toLocaleString('fr-FR')} FCFA</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{tvaResume.tvaADecaisser >= 0 ? 'Collectée - Déductible' : 'À reporter'}</div>
          </div>
        </div>

        <div role="status" style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', marginTop: '20px', color: '#735515' }}>
          <h4 style={{ marginTop: 0 }}>Dossier TVA calculé — dépôt manuel uniquement</h4>
          <p style={{ marginBottom: 0 }}>
            Le calcul reprend les écritures validées des comptes 443* (hors 4434) et 445* pour la période choisie. Vérifiez les comptes, les pièces et le régime fiscal avec votre comptable avant tout dépôt sur le portail de l’OTR. ComptaOrion ne transmet pas la déclaration et n’effectue pas le paiement.
          </p>
          <p style={{ margin: '10px 0 0' }}>
            <a href="https://new.otr.tg/documentation#fiscalite" target="_blank" rel="noreferrer">
              Consulter les documents fiscaux de l’OTR
            </a>
            {' · '}
            <a href="https://new.otr.tg/impots" target="_blank" rel="noreferrer">
              Accéder aux démarches fiscales OTR
            </a>
          </p>
        </div>
      </div>
    );
  };

  const renderIS = () => (
    <div>
      <h3 style={{ marginBottom: '8px' }}>Résultat comptable pour l’Impôt sur les Sociétés</h3>
      <p style={{ marginTop: 0, color: '#52606d' }}>
        Ce relevé présente le résultat comptable de la période. Il ne calcule pas le bénéfice imposable ni l’impôt dû.
      </p>
      <PeriodFilter
        dateDebut={periodeTVA.dateDebut}
        dateFin={periodeTVA.dateFin}
        onDateDebutChange={(val) => setPeriodeTVA({...periodeTVA, dateDebut: val})}
        onDateFinChange={(val) => setPeriodeTVA({...periodeTVA, dateFin: val})}
        onApply={loadISResume}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, margin: '20px 0' }}>
        {[
          { title: 'Produits comptabilisés', value: resultatIS.produits, color: '#3498db' },
          { title: 'Charges comptabilisées', value: resultatIS.charges, color: '#e67e22' },
          { title: 'Résultat comptable avant retraitements', value: resultatIS.resultatComptable, color: resultatIS.resultatComptable >= 0 ? '#27ae60' : '#c0392b' }
        ].map(card => (
          <div key={card.title} style={{ padding: 18, borderRadius: 8, color: '#fff', background: card.color }}>
            <div style={{ fontSize: 13 }}>{card.title}</div>
            <strong style={{ display: 'block', marginTop: 8, fontSize: 22 }}>
              {Number(card.value || 0).toLocaleString('fr-FR')} XOF
            </strong>
          </div>
        ))}
      </div>
      <div role="status" style={{ padding: 18, backgroundColor: '#fff3cd', borderRadius: 8, color: '#735515' }}>
        <strong>Pas de calcul d’impôt automatique.</strong>
        <p style={{ marginBottom: 0 }}>
          Le résultat doit être retraité selon la forme juridique, le régime fiscal et les règles en vigueur. Aucun taux n’est présumé et aucun montant n’est à déposer tel quel. Faites valider la liasse par un professionnel fiscal avant tout dépôt.
        </p>
      </div>
      <p style={{ marginTop: 12 }}>
          <a href="https://new.otr.tg/documentation#fiscalite" target="_blank" rel="noreferrer">
            Documents fiscaux officiels de l’OTR
        </a>
      </p>
    </div>
  );

  const renderParametres = () => (
    <div>
      <h3 style={{ marginBottom: '20px' }}>Paramètres Fiscaux</h3>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <h4 style={{ marginTop: 0 }}>Informations Fiscales</h4>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Pays *</label>
          <select
            value={parametres.pays}
            onChange={(e) => setParametres({ ...parametres, pays: e.target.value })}
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
          >
            <option value="">Sélectionner un pays</option>
            <option value="benin">Bénin</option>
            <option value="senegal">Sénégal</option>
            <option value="cotedivoire">Côte d'Ivoire</option>
            <option value="togo">Togo</option>
            <option value="mali">Mali</option>
            <option value="burkina">Burkina Faso</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Administration fiscale</label>
          <input
            type="text"
            value={parametres.administrationNom}
            onChange={(e) => setParametres({ ...parametres, administrationNom: e.target.value })}
            placeholder="Ex. OTR, DGI"
            style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Régime d'imposition</label>
          <select
            value={parametres.regimeImposition}
            onChange={(e) => setParametres({...parametres, regimeImposition: e.target.value})}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="reel-normal">Régime Réel Normal</option>
            <option value="reel-simplifie">Régime Réel Simplifié</option>
            <option value="micro">Micro-entreprise</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Numéro IFU</label>
          <input
            type="text"
            value={parametres.numeroIFU}
            onChange={(e) => setParametres({...parametres, numeroIFU: e.target.value})}
            placeholder="Ex: 1234567890123"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Centre des Impôts</label>
          <input
            type="text"
            value={parametres.centreImpots}
            onChange={(e) => setParametres({...parametres, centreImpots: e.target.value})}
            placeholder="Ex: CDI Cotonou"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <button
          onClick={sauvegarderParametres}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#95a5a6' : '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '500'
          }}
        >
          {loading ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </button>
      </div>

      <div role="status" style={{ backgroundColor: '#fff3cd', padding: '16px', borderRadius: '8px', color: '#735515' }}>
        <h4 style={{ marginTop: 0 }}>🌐 Connexion API Administration Fiscale</h4>
        <p style={{ marginBottom: 0 }}>
          La connexion directe aux administrations fiscales n’est pas intégrée. N’entrez pas ici de mot de passe ni de clé API fiscale.
        </p>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'declarations': return renderDeclarations();
      case 'tva': return renderTVA();
      case 'is': return renderIS();
      case 'parametres': return renderParametres();
      default: return renderDeclarations();
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>🏛️ Gestion des Impôts et Taxes</h2>
        <p style={{ margin: 0, color: '#7f8c8d' }}>Suivi fiscal par période</p>
      </div>

      <div role="alert" style={{ backgroundColor: '#fff3cd', border: '1px solid #f0d58a', padding: '16px', borderRadius: '8px', marginBottom: '20px', color: '#735515' }}>
        <strong>Calculs fiscaux disponibles — aucun envoi ni paiement automatique.</strong>
        <p style={{ margin: '6px 0 0' }}>
          Les montants sont calculés à partir des écritures comptables et doivent être vérifiés avant dépôt. Les déclarations sont à transmettre manuellement sur le portail de l’OTR. Les anciennes déclarations peuvent provenir d’une simulation.
        </p>
      </div>
      {taxFeedback.message && (
        <div
          role={taxFeedback.type === 'error' ? 'alert' : 'status'}
          style={{
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 20,
            color: taxFeedback.type === 'error' ? '#842029' : '#0f5132',
            background: taxFeedback.type === 'error' ? '#f8d7da' : '#d1e7dd'
          }}
        >
          {taxFeedback.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #ecf0f1', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#3498db' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#7f8c8d',
              borderBottom: activeTab === tab.id ? '3px solid #3498db' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.3s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Chargement...</div>
        </div>
      ) : (
        renderContent()
      )}

      {drillModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '95%', maxWidth: '1100px', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
              <h3 style={{ margin: 0 }}>📊 {drillModal.title}</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={exportDrillDownCSV} style={{ padding: '8px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  📥 Export CSV
                </button>
                <button onClick={() => setDrillModal({ open: false, title: '', data: [], totaux: null, loading: false, compte: '' })} style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  ✕ Fermer
                </button>
              </div>
            </div>
            <div style={{ padding: '20px', maxHeight: 'calc(85vh - 140px)', overflowY: 'auto' }}>
              {drillModal.loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Chargement des mouvements...</div>
              ) : drillModal.data.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#7f8c8d' }}>Aucun mouvement pour cette période</div>
              ) : (
                <>
                  <p style={{ marginBottom: '15px', color: '#666' }}>Période: {periodeTVA.dateDebut} au {periodeTVA.dateFin} - {drillModal.data.length} mouvement(s)</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Journal</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Réf.</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Compte</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'left' }}>Libellé</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Débit</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Crédit</th>
                        <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>Solde Cumul.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillModal.data.map((m, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{m.date}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{m.journal}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{m.reference}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{m.compteNumero} {m.compteNom}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{m.libelle}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{m.debit > 0 ? `${Math.round(m.debit).toLocaleString('fr-FR')} FCFA` : '-'}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'right' }}>{m.credit > 0 ? `${Math.round(m.credit).toLocaleString('fr-FR')} FCFA` : '-'}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'right', fontWeight: '500' }}>{Math.round(m.soldeCumule).toLocaleString('fr-FR')} FCFA</td>
                        </tr>
                      ))}
                      {drillModal.totaux && (
                        <tr style={{ backgroundColor: '#e8f4f8', fontWeight: 'bold' }}>
                          <td colSpan="5" style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>TOTAUX</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>{Math.round(drillModal.totaux.totalDebit).toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>{Math.round(drillModal.totaux.totalCredit).toLocaleString('fr-FR')} FCFA</td>
                          <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>{Math.round(drillModal.totaux.solde).toLocaleString('fr-FR')} FCFA</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
