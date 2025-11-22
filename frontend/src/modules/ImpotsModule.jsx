import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadData();
  }, [activeTab]);

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
    try {
      setLoading(true);
      await api.post('/impots/parametres', parametres);
      alert('Paramètres fiscaux enregistrés avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de l\'enregistrement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const testerConnexion = async () => {
    try {
      setLoading(true);
      const res = await api.post('/impots/parametres/tester-connexion');
      alert(res.message || 'Connexion réussie !');
      loadData();
    } catch (error) {
      console.error('Erreur test connexion:', error);
      alert('Erreur lors du test de connexion');
    } finally {
      setLoading(false);
    }
  };

  const declarerTVA = async (periode) => {
    if (!periode) {
      alert('Veuillez sélectionner une période');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/impots/declarations/tva', { periode });
      alert(res.message || 'Déclaration TVA créée avec succès !');
      setActiveTab('declarations');
      loadData();
    } catch (error) {
      console.error('Erreur déclaration TVA:', error);
      alert(error.response?.data?.message || 'Erreur lors de la déclaration TVA');
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
        <button
          style={{
            padding: '10px 20px',
            backgroundColor: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          + Nouvelle Déclaration
        </button>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#e8f4f8', borderRadius: '8px', marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>📢 Module en Construction</h4>
        <p style={{ margin: 0, color: '#34495e' }}>
          Ce module permettra de gérer vos obligations fiscales : TVA, Impôt sur les Sociétés, 
          Impôt sur le Revenu, et autres taxes conformément aux réglementations en vigueur.
        </p>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
            <th style={{ padding: '12px', textAlign: 'left' }}>Période</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Montant</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
            <th style={{ padding: '12px', textAlign: 'left' }}>Échéance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
              Aucune déclaration enregistrée
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderTVA = () => {
    const [periodeDeclaration, setPeriodeDeclaration] = useState(new Date().toISOString().slice(0, 7));

    return (
      <div>
        <h3 style={{ marginBottom: '20px' }}>Gestion de la TVA</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', backgroundColor: '#3498db', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>TVA Collectée</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>0 XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Sur ventes</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#e74c3c', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>TVA Déductible</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>0 XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Sur achats</div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>TVA à Décaisser</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>0 XOF</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Collectée - Déductible</div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginTop: '20px' }}>
          <h4 style={{ marginTop: 0 }}>📤 Télédéclaration TVA</h4>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Déclarez votre TVA directement auprès de l'administration fiscale configurée dans les paramètres.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Période de déclaration</label>
            <input
              type="month"
              value={periodeDeclaration}
              onChange={(e) => setPeriodeDeclaration(e.target.value)}
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
            onClick={() => declarerTVA(periodeDeclaration)}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#95a5a6' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {loading ? 'Traitement...' : '📤 Soumettre la déclaration TVA'}
          </button>

          <p style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '6px', color: '#856404', marginTop: '15px' }}>
            ℹ️ Les montants de TVA seront calculés automatiquement à partir de vos factures et écritures comptables.
          </p>
        </div>
      </div>
    );
  };

  const renderIS = () => (
    <div>
      <h3 style={{ marginBottom: '20px' }}>Impôt sur les Sociétés</h3>
      
      <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h4 style={{ marginTop: 0 }}>Calcul de l'IS</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Résultat comptable</label>
            <input
              type="number"
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              disabled
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Taux d'imposition (%)</label>
            <input
              type="number"
              placeholder="25"
              defaultValue="25"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Impôt sur les Sociétés estimé :</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c3e50' }}>0 XOF</span>
          </div>
        </div>

        <p style={{ marginTop: '15px', color: '#7f8c8d', fontSize: '13px' }}>
          ℹ️ Le résultat comptable sera calculé automatiquement à partir de votre compte de résultat.
        </p>
      </div>
    </div>
  );

  const renderParametres = () => (
    <div>
      <h3 style={{ marginBottom: '20px' }}>Paramètres Fiscaux</h3>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
        <h4 style={{ marginTop: 0 }}>Informations Fiscales</h4>
        
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
          style={{
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Enregistrer les paramètres
        </button>
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h4 style={{ marginTop: 0 }}>🌐 Connexion API Administration Fiscale</h4>
        <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
          Connectez-vous directement à l'administration fiscale de votre pays pour déclarer vos impôts en ligne.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Pays</label>
          <select
            value={parametres.pays}
            onChange={(e) => setParametres({...parametres, pays: e.target.value})}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <option value="">Sélectionner un pays</option>
            <option value="benin">Bénin (e-Tax)</option>
            <option value="senegal">Sénégal (SIGTAS)</option>
            <option value="cotedivoire">Côte d'Ivoire (e-Impôts)</option>
            <option value="togo">Togo (OTR)</option>
            <option value="mali">Mali (DGI)</option>
            <option value="burkina">Burkina Faso</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>URL API</label>
          <input
            type="text"
            value={parametres.apiUrl}
            onChange={(e) => setParametres({...parametres, apiUrl: e.target.value})}
            placeholder="https://api.administration-fiscale.gouv"
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
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Identifiant API / NIF</label>
          <input
            type="text"
            value={parametres.apiIdentifiant}
            onChange={(e) => setParametres({...parametres, apiIdentifiant: e.target.value})}
            placeholder="Votre identifiant sur le portail fiscal"
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
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Clé API / Mot de passe</label>
          <input
            type="password"
            value={parametres.apiCleSecrete}
            onChange={(e) => setParametres({...parametres, apiCleSecrete: e.target.value})}
            placeholder="Clé secrète fournie par l'administration"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '6px', marginBottom: '15px' }}>
          <strong>ℹ️ Information :</strong> Cette connexion permettra la télédéclaration automatique de vos impôts et taxes.
          Consultez le portail de votre administration fiscale pour obtenir vos identifiants API.
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={testerConnexion}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#95a5a6' : '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {loading ? 'Test...' : 'Tester la connexion'}
          </button>
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
            {loading ? 'Enregistrement...' : 'Enregistrer la configuration'}
          </button>
        </div>
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
        <p style={{ margin: 0, color: '#7f8c8d' }}>Gérez vos obligations fiscales et déclarations</p>
      </div>

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
    </div>
  );
}
