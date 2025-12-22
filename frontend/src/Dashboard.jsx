import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from './api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value || 0);
}

export function DashboardView() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [ventesMensuelles, setVentesMensuelles] = useState([]);
  const [depensesCategories, setDepensesCategories] = useState([]);
  const [periode, setPeriode] = useState('mois');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [kpisRes, ventesRes, depensesRes] = await Promise.all([
        api.get('/dashboard/global'),
        api.get('/dashboard/ventes-mensuelles'),
        api.get('/dashboard/depenses-categories')
      ]);
      
      setKpis(kpisRes);
      setVentesMensuelles(ventesRes || []);
      setDepensesCategories(depensesRes || []);
    } catch (error) {
      console.error('Erreur dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>Chargement...</div>
          <div style={{ color: '#666' }}>Veuillez patienter</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>Tableau de bord</h1>
        <button 
          onClick={loadDashboard}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Actualiser
        </button>
      </div>

      {/* KPIs Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard 
          title="Ventes du mois" 
          value={formatMoney(kpis?.ventesMois)} 
          color="#28a745"
          icon="📈"
        />
        <KpiCard 
          title="Dépenses du mois" 
          value={formatMoney(kpis?.depensesMois)} 
          color="#dc3545"
          icon="📉"
        />
        <KpiCard 
          title="Marge brute" 
          value={`${kpis?.margeBrute || 0}%`} 
          color="#17a2b8"
          icon="💹"
        />
        <KpiCard 
          title="Cashflow" 
          value={formatMoney(kpis?.cashflow)} 
          color={parseFloat(kpis?.cashflow) >= 0 ? '#28a745' : '#dc3545'}
          icon="💰"
        />
        <KpiCard 
          title="Factures en retard" 
          value={`${kpis?.facturesEnRetard?.nombre || 0}`} 
          subtitle={formatMoney(kpis?.facturesEnRetard?.montant)}
          color="#ffc107"
          icon="⚠️"
        />
        <KpiCard 
          title="Stock faible" 
          value={`${kpis?.stockFaible?.nombre || 0} produits`} 
          color="#6c757d"
          icon="📦"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Ventes mensuelles */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>Évolution des ventes (12 mois)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ventesMensuelles}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Bar dataKey="ventes" fill="#007bff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition dépenses */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>Répartition des dépenses</h3>
          {depensesCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={depensesCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="montant"
                  nameKey="categorie"
                >
                  {depensesCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              Aucune donnée disponible
            </div>
          )}
        </div>
      </div>

      {/* Alertes */}
      {(kpis?.facturesEnRetard?.nombre > 0 || kpis?.stockFaible?.nombre > 0) && (
        <div style={{ marginTop: '20px', backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>Alertes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {kpis?.facturesEnRetard?.nombre > 0 && (
              <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', borderLeft: '4px solid #ffc107' }}>
                <strong>Factures en retard:</strong> {kpis.facturesEnRetard.nombre} facture(s) pour un montant de {formatMoney(kpis.facturesEnRetard.montant)}
              </div>
            )}
            {kpis?.stockFaible?.nombre > 0 && (
              <div style={{ padding: '12px', backgroundColor: '#f8d7da', borderRadius: '4px', borderLeft: '4px solid #dc3545' }}>
                <strong>Stock faible:</strong> {kpis.stockFaible.nombre} produit(s) en dessous du seuil minimum
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                  {kpis.stockFaible.produits?.slice(0, 3).map((p, i) => (
                    <li key={i}>{p.nom || p.reference} - Quantité: {p.quantite}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, subtitle, color, icon }) {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '8px', 
      padding: '20px', 
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{title}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>{value}</div>
          {subtitle && <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: '28px' }}>{icon}</div>
      </div>
    </div>
  );
}

export default DashboardView;
