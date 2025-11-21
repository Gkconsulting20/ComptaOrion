import React, { useState, useEffect } from 'react';

export function DashboardView() {
  const [data, setData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('entrepriseId', 1);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const [globalRes, kpisRes] = await Promise.all([
        fetch(`/api/dashboard/global?${queryParams}`),
        fetch(`/api/dashboard/kpis?${queryParams}`)
      ]);

      const globalData = await globalRes.json();
      const kpisData = await kpisRes.json();

      setData(globalData || {});
      setKpis(kpisData || {});
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="view-container"><p>Chargement...</p></div>;

  return (
    <div className="view-container">
      <div className="view-header">
        <h2 className="view-title">📊 Tableau de Bord Global</h2>
        <p style={{fontSize: '14px', color: '#6c757d', marginTop: '5px'}}>Vue d'ensemble complète de votre activité</p>
      </div>

      {/* Filtres */}
      <div style={{display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px'}}>
        <input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} placeholder="Date début" />
        <input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} placeholder="Date fin" />
        <button className="btn-secondary" onClick={fetchDashboardData}>Actualiser</button>
      </div>

      {/* KPIs principaux */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px'}}>
        {/* Ventes du mois */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #3b82f6'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>VENTES DU MOIS</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.ventesMois || '0'} FCFA</h3>
        </div>

        {/* Dépenses du mois */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ef4444'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>DÉPENSES DU MOIS</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.depensesMois || '0'} FCFA</h3>
        </div>

        {/* Cashflow */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #10b981'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>CASHFLOW</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.cashflow || '0'} FCFA</h3>
        </div>

        {/* Marge brute */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f59e0b'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>MARGE BRUTE</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.margeBrute || '0'}%</h3>
        </div>

        {/* Factures en retard */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ec4899'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>FACTURES EN RETARD</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.facturesEnRetard?.nombre || 0} ({data?.facturesEnRetard?.montant || 0} FCFA)</h3>
        </div>

        {/* Stock faible */}
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #8b5cf6'}}>
          <p style={{fontSize: '12px', color: '#6c757d', margin: '0 0 5px 0'}}>STOCK FAIBLE</p>
          <h3 style={{margin: 0, fontSize: '24px', color: '#1f2937', fontWeight: 'bold'}}>{data?.stockFaible?.nombre || 0} articles</h3>
        </div>
      </div>

      {/* KPIs avancés */}
      {kpis && (
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px'}}>
          <h4 style={{margin: '0 0 15px 0', color: '#1f2937'}}>KPIs Avancés</h4>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb'}}>
              <span>Délai paiement client:</span>
              <strong>{kpis.delaiPaiementClient || 0} jours</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb'}}>
              <span>Délai paiement fournisseur:</span>
              <strong>{kpis.delaiPaiementFournisseur || 0} jours</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb'}}>
              <span>Factures en cours:</span>
              <strong>{kpis.nombreFacturesEnCours || 0}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span>Factures en retard:</span>
              <strong style={{color: '#ef4444'}}>{kpis.nombreFacturesRetard || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Stock faible détail */}
      {data?.stockFaible?.produits?.length > 0 && (
        <div style={{padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
          <h4 style={{margin: '0 0 15px 0', color: '#1f2937'}}>⚠️ Articles avec Stock Faible</h4>
          <div className="data-table">
            <table style={{width: '100%'}}>
              <thead>
                <tr style={{backgroundColor: '#f8f9fa'}}>
                  <th>Produit</th>
                  <th>Stock actuel</th>
                  <th>Seuil minimum</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {data.stockFaible.produits.map((p, i) => (
                  <tr key={i}>
                    <td>{p.nom}</td>
                    <td>{p.quantite}</td>
                    <td>{p.stockMinimum}</td>
                    <td style={{color: '#ef4444', fontWeight: 'bold'}}>{p.quantite - p.stockMinimum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
