import { useState, useEffect } from 'react';
import axios from 'axios';

const RapportsClientsModule = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [periodeActive, setPeriodeActive] = useState('tout');

  useEffect(() => {
    fetchComptesARecevoir();
  }, []);

  const fetchComptesARecevoir = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/clients/comptes-a-recevoir', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement comptes à recevoir:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMontant = (montant) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(montant || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
  };

  const getStatutBadge = (joursAvantEcheance) => {
    if (joursAvantEcheance < 0) {
      return { couleur: '#dc3545', texte: `En retard (${Math.abs(joursAvantEcheance)}j)` };
    } else if (joursAvantEcheance <= 7) {
      return { couleur: '#ffc107', texte: `${joursAvantEcheance}j restants` };
    } else if (joursAvantEcheance <= 30) {
      return { couleur: '#17a2b8', texte: `${joursAvantEcheance}j restants` };
    } else {
      return { couleur: '#28a745', texte: `${joursAvantEcheance}j restants` };
    }
  };

  const renderCarteResume = (titre, montant, couleur, icone) => (
    <div style={{
      flex: 1,
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${couleur}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>{titre}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
            {formatMontant(montant)} XOF
          </div>
        </div>
        <div style={{ fontSize: '32px' }}>{icone}</div>
      </div>
    </div>
  );

  const renderTableauFactures = (factures, titre) => {
    if (!factures || factures.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
          Aucune facture dans cette période
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>N° Facture</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Client</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date facture</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Échéance</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Montant TTC</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Payé</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Solde restant</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {factures.map(facture => {
              const badge = getStatutBadge(facture.joursAvantEcheance);
              return (
                <tr key={facture.factureId} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{facture.numeroFacture}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '500' }}>{facture.clientNom}</div>
                    {facture.clientEmail && (
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>{facture.clientEmail}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>{formatDate(facture.dateFacture)}</td>
                  <td style={{ padding: '12px' }}>{formatDate(facture.dateEcheance)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{formatMontant(facture.totalTTC)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{formatMontant(facture.montantPaye)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatMontant(facture.soldeRestant)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: badge.couleur + '20',
                      color: badge.couleur
                    }}>
                      {badge.texte}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Chargement des rapports...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
        Erreur lors du chargement des données
      </div>
    );
  }

  const { totaux, facturesParPeriode, resume } = data;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: 0, marginBottom: '8px' }}>Comptes à Recevoir</h2>
        <p style={{ color: '#6c757d', margin: 0 }}>
          Suivi des factures impayées et échéances par période
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
        {renderCarteResume('Total à recevoir', totaux.total, '#007bff', '💰')}
        {renderCarteResume('En retard', totaux.enRetard, '#dc3545', '⚠️')}
        {renderCarteResume('7 prochains jours', totaux.prochains7jours, '#ffc107', '📅')}
        {renderCarteResume('30 prochains jours', totaux.prochains30jours, '#17a2b8', '📆')}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { key: 'enRetard', label: `En retard (${facturesParPeriode.enRetard.length})` },
            { key: 'prochains7jours', label: `7 jours (${facturesParPeriode.prochains7jours.length})` },
            { key: 'prochains30jours', label: `30 jours (${facturesParPeriode.prochains30jours.length})` },
            { key: 'prochains90jours', label: `90 jours (${facturesParPeriode.prochains90jours.length})` },
            { key: 'auDela90jours', label: `+90 jours (${facturesParPeriode.auDela90jours.length})` },
            { key: 'tout', label: 'Toutes' }
          ].map(periode => (
            <button
              key={periode.key}
              onClick={() => setPeriodeActive(periode.key)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                backgroundColor: periodeActive === periode.key ? '#007bff' : '#f8f9fa',
                color: periodeActive === periode.key ? 'white' : '#333',
                transition: 'all 0.2s'
              }}
            >
              {periode.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6' }}>
          <h3 style={{ margin: 0 }}>
            {periodeActive === 'tout' ? 'Toutes les factures impayées' :
             periodeActive === 'enRetard' ? 'Factures en retard' :
             periodeActive === 'prochains7jours' ? 'Échéances - 7 prochains jours' :
             periodeActive === 'prochains30jours' ? 'Échéances - 30 prochains jours' :
             periodeActive === 'prochains90jours' ? 'Échéances - 90 prochains jours' :
             'Échéances - Au-delà de 90 jours'}
          </h3>
        </div>
        
        {periodeActive === 'tout' ? (
          <>
            {facturesParPeriode.enRetard.length > 0 && (
              <div>
                <div style={{ padding: '15px 20px', backgroundColor: '#fff3cd', borderBottom: '1px solid #dee2e6' }}>
                  <strong>En retard ({facturesParPeriode.enRetard.length})</strong> - {formatMontant(totaux.enRetard)} XOF
                </div>
                {renderTableauFactures(facturesParPeriode.enRetard)}
              </div>
            )}
            {facturesParPeriode.prochains7jours.length > 0 && (
              <div>
                <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                  <strong>7 prochains jours ({facturesParPeriode.prochains7jours.length})</strong> - {formatMontant(totaux.prochains7jours)} XOF
                </div>
                {renderTableauFactures(facturesParPeriode.prochains7jours)}
              </div>
            )}
            {facturesParPeriode.prochains30jours.length > 0 && (
              <div>
                <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                  <strong>30 prochains jours ({facturesParPeriode.prochains30jours.length})</strong> - {formatMontant(totaux.prochains30jours)} XOF
                </div>
                {renderTableauFactures(facturesParPeriode.prochains30jours)}
              </div>
            )}
            {facturesParPeriode.prochains90jours.length > 0 && (
              <div>
                <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                  <strong>90 prochains jours ({facturesParPeriode.prochains90jours.length})</strong> - {formatMontant(totaux.prochains90jours)} XOF
                </div>
                {renderTableauFactures(facturesParPeriode.prochains90jours)}
              </div>
            )}
            {facturesParPeriode.auDela90jours.length > 0 && (
              <div>
                <div style={{ padding: '15px 20px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                  <strong>Au-delà de 90 jours ({facturesParPeriode.auDela90jours.length})</strong> - {formatMontant(totaux.auDela90jours)} XOF
                </div>
                {renderTableauFactures(facturesParPeriode.auDela90jours)}
              </div>
            )}
          </>
        ) : (
          renderTableauFactures(facturesParPeriode[periodeActive])
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div>
            <strong>Résumé :</strong> {resume.nombreFacturesImpayees} factures impayées pour un montant total de {formatMontant(resume.montantTotal)} XOF
          </div>
        </div>
      </div>
    </div>
  );
};

export default RapportsClientsModule;
