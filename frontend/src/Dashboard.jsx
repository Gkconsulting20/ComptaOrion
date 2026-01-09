import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from './api';
import PeriodFilter, { getPeriodeDates, formatPeriodeDisplay, getPeriodeLabel } from './components/PeriodFilter';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
}

function DrillDownModal({ isOpen, onClose, title, loading, data, columns, renderRow }) {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '900px',
        maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666'
          }}>&times;</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
          ) : data?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Aucune donnée</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  {columns.map((col, i) => (
                    <th key={i} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontSize: '13px' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map((item, index) => renderRow(item, index))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', textAlign: 'right' }}>
          <span style={{ color: '#666', fontSize: '13px' }}>{data?.length || 0} élément(s)</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardView() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [ventesMensuelles, setVentesMensuelles] = useState([]);
  const [depensesCategories, setDepensesCategories] = useState([]);
  
  // Filtres de période - utiliser année fiscale par défaut
  const initialDates = getPeriodeDates('fiscal_courant');
  const [dateDebut, setDateDebut] = useState(initialDates.dateDebut);
  const [dateFin, setDateFin] = useState(initialDates.dateFin);
  
  const [drillDown, setDrillDown] = useState({ open: false, type: null, title: '', data: [], loading: false });

  // Label dynamique selon la période
  const getDynamicPeriodeLabel = () => {
    return getPeriodeLabel(dateDebut, dateFin);
  };

  const formatPeriodeDisplayLocal = () => {
    const d1 = new Date(dateDebut);
    const d2 = new Date(dateFin);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${d1.toLocaleDateString('fr-FR', options)} - ${d2.toLocaleDateString('fr-FR', options)}`;
  };

  useEffect(() => {
    // Charger automatiquement quand les dates changent
    loadDashboard();
  }, [dateDebut, dateFin]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = `?dateDebut=${dateDebut}&dateFin=${dateFin}`;
      const [kpisRes, ventesRes, depensesRes] = await Promise.all([
        api.get(`/dashboard/global${params}`),
        api.get(`/dashboard/ventes-mensuelles${params}`),
        api.get(`/dashboard/depenses-categories${params}`)
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

  const openDrillDown = async (type, title) => {
    setDrillDown({ open: true, type, title, data: [], loading: true });
    try {
      const params = `?dateDebut=${dateDebut}&dateFin=${dateFin}`;
      const data = await api.get(`/dashboard/detail/${type}${params}`);
      setDrillDown(prev => ({ ...prev, data: data || [], loading: false }));
    } catch (error) {
      console.error('Erreur drill-down:', error);
      setDrillDown(prev => ({ ...prev, data: [], loading: false }));
    }
  };

  const closeDrillDown = () => {
    setDrillDown({ open: false, type: null, title: '', data: [], loading: false });
  };

  const getDrillDownConfig = () => {
    switch (drillDown.type) {
      case 'ventes':
        return {
          columns: ['Date', 'N° Facture', 'Client', 'Montant TTC', 'Statut'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.dateFacture)}</td>
              <td style={{ padding: '10px' }}>{item.numero}</td>
              <td style={{ padding: '10px' }}>{item.clientNom || '-'}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#28a745' }}>{formatMoney(item.montantTTC)}</td>
              <td style={{ padding: '10px' }}>
                <span style={{
                  padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                  backgroundColor: item.statut === 'payee' ? '#d4edda' : item.statut === 'partielle' ? '#fff3cd' : '#f8d7da',
                  color: item.statut === 'payee' ? '#155724' : item.statut === 'partielle' ? '#856404' : '#721c24'
                }}>{item.statut}</span>
              </td>
            </tr>
          )
        };
      case 'depenses':
        return {
          columns: ['Date', 'Description', 'Catégorie', 'Montant'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.date)}</td>
              <td style={{ padding: '10px' }}>{item.description}</td>
              <td style={{ padding: '10px' }}>{item.categorie || '-'}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#dc3545' }}>{formatMoney(item.montant)}</td>
            </tr>
          )
        };
      case 'factures-retard':
        return {
          columns: ['Date', 'N° Facture', 'Client', 'Échéance', 'Jours retard', 'Solde restant'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.dateFacture)}</td>
              <td style={{ padding: '10px' }}>{item.numero}</td>
              <td style={{ padding: '10px' }}>{item.clientNom || '-'}</td>
              <td style={{ padding: '10px', color: '#dc3545' }}>{formatDate(item.dateEcheance)}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#dc3545' }}>{item.joursRetard}j</td>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{formatMoney(item.soldeRestant)}</td>
            </tr>
          )
        };
      case 'stock-faible':
        return {
          columns: ['Référence', 'Nom', 'Quantité actuelle', 'Seuil minimum', 'Entrepôt'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{item.reference}</td>
              <td style={{ padding: '10px' }}>{item.nom}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#dc3545' }}>{item.quantite}</td>
              <td style={{ padding: '10px' }}>{item.seuilMin || '-'}</td>
              <td style={{ padding: '10px' }}>{item.entrepot || '-'}</td>
            </tr>
          )
        };
      case 'cashflow':
        return {
          columns: ['Date', 'Type', 'Description', 'Entrée', 'Sortie', 'Solde'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.date)}</td>
              <td style={{ padding: '10px' }}>{item.type}</td>
              <td style={{ padding: '10px' }}>{item.description}</td>
              <td style={{ padding: '10px', color: '#28a745' }}>{item.entree ? formatMoney(item.entree) : '-'}</td>
              <td style={{ padding: '10px', color: '#dc3545' }}>{item.sortie ? formatMoney(item.sortie) : '-'}</td>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{formatMoney(item.solde)}</td>
            </tr>
          )
        };
      case 'marge':
        return {
          columns: ['Type', 'Description', 'Montant', 'Impact'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{item.type}</td>
              <td style={{ padding: '10px' }}>{item.description}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: item.montant >= 0 ? '#28a745' : '#dc3545' }}>{formatMoney(item.montant)}</td>
              <td style={{ padding: '10px' }}>{item.impact}</td>
            </tr>
          )
        };
      case 'ventes-mois':
        return {
          columns: ['Date', 'N° Facture', 'Client', 'Montant TTC', 'Statut'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.dateFacture)}</td>
              <td style={{ padding: '10px' }}>{item.numero}</td>
              <td style={{ padding: '10px' }}>{item.clientNom || '-'}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#28a745' }}>{formatMoney(item.montantTTC)}</td>
              <td style={{ padding: '10px' }}>
                <span style={{
                  padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                  backgroundColor: item.statut === 'payee' ? '#d4edda' : item.statut === 'partielle' ? '#fff3cd' : '#f8d7da',
                  color: item.statut === 'payee' ? '#155724' : item.statut === 'partielle' ? '#856404' : '#721c24'
                }}>{item.statut}</span>
              </td>
            </tr>
          )
        };
      case 'depenses-categorie':
        return {
          columns: ['Date', 'Description', 'Catégorie', 'Montant'],
          renderRow: (item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{formatDate(item.date)}</td>
              <td style={{ padding: '10px' }}>{item.description}</td>
              <td style={{ padding: '10px' }}>{item.categorie || '-'}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: '#dc3545' }}>{formatMoney(item.montant)}</td>
            </tr>
          )
        };
      default:
        return { columns: [], renderRow: () => null };
    }
  };

  const handleBarClick = async (data) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const mois = data.activePayload[0].payload.mois;
      setDrillDown({ open: true, type: 'ventes-mois', title: `Ventes - ${mois}`, data: [], loading: true });
      try {
        const result = await api.get(`/dashboard/detail/ventes-mois?mois=${encodeURIComponent(mois)}`);
        setDrillDown(prev => ({ ...prev, data: result || [], loading: false }));
      } catch (error) {
        console.error('Erreur drill-down mois:', error);
        setDrillDown(prev => ({ ...prev, data: [], loading: false }));
      }
    }
  };

  const handlePieClick = async (data) => {
    if (data && data.categorie) {
      setDrillDown({ open: true, type: 'depenses-categorie', title: `Dépenses - ${data.categorie}`, data: [], loading: true });
      try {
        const result = await api.get(`/dashboard/detail/depenses-categorie?categorie=${encodeURIComponent(data.categorie)}`);
        setDrillDown(prev => ({ ...prev, data: result || [], loading: false }));
      } catch (error) {
        console.error('Erreur drill-down catégorie:', error);
        setDrillDown(prev => ({ ...prev, data: [], loading: false }));
      }
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

  const config = getDrillDownConfig();

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>Tableau de bord</h1>
            <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#666' }}>
              Période: <strong>{formatPeriodeDisplayLocal()}</strong>
            </p>
          </div>
        </div>
        
        {/* Composant PeriodFilter avec toutes les périodes fiscales */}
        <PeriodFilter
          dateDebut={dateDebut}
          dateFin={dateFin}
          onDateDebutChange={setDateDebut}
          onDateFinChange={setDateFin}
          onApply={loadDashboard}
          loading={loading}
          showFiscalPeriods={true}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <KpiCard 
          title={`Ventes ${getDynamicPeriodeLabel()}`}
          value={formatMoney(kpis?.ventesMois)} 
          color="#28a745"
          icon="📈"
          onClick={() => openDrillDown('ventes', `Détail des ventes ${getDynamicPeriodeLabel()}`)}
        />
        <KpiCard 
          title={`Dépenses ${getDynamicPeriodeLabel()}`}
          value={formatMoney(kpis?.depensesMois)} 
          color="#dc3545"
          icon="📉"
          onClick={() => openDrillDown('depenses', `Détail des dépenses ${getDynamicPeriodeLabel()}`)}
        />
        <KpiCard 
          title="Marge brute" 
          value={kpis?.margeBrute !== null && kpis?.margeBrute !== undefined ? `${kpis.margeBrute}%` : 'N/A'} 
          color="#17a2b8"
          icon="💹"
          subtitle={kpis?.ventesHT ? `CA: ${formatMoney(kpis.ventesHT)} | CMV: ${formatMoney(kpis.cmv)}` : null}
          onClick={() => openDrillDown('marge', 'Détail de la marge brute')}
        />
        <KpiCard 
          title="Cashflow" 
          value={formatMoney(kpis?.cashflow)} 
          color={parseFloat(kpis?.cashflow) >= 0 ? '#28a745' : '#dc3545'}
          icon="💰"
          onClick={() => openDrillDown('cashflow', 'Détail du cashflow')}
        />
        <KpiCard 
          title="Factures en retard" 
          value={`${kpis?.facturesEnRetard?.nombre || 0}`} 
          subtitle={formatMoney(kpis?.facturesEnRetard?.montant)}
          color="#ffc107"
          icon="⚠️"
          onClick={() => openDrillDown('factures-retard', 'Factures en retard de paiement')}
        />
        <KpiCard 
          title="Stock faible" 
          value={`${kpis?.stockFaible?.nombre || 0} produits`} 
          color="#6c757d"
          icon="📦"
          onClick={() => openDrillDown('stock-faible', 'Produits en stock faible')}
        />
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#666' }}>Cycle de Trésorerie</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <KpiCard 
            title="Délai paiement clients (DSO)" 
            value={`${kpis?.dso || 0} jours`} 
            color="#6f42c1"
            icon="📅"
            small
          />
          <KpiCard 
            title="Délai paiement fournisseurs (DPO)" 
            value={`${kpis?.dpo || 0} jours`} 
            color="#20c997"
            icon="🏭"
            small
          />
          <KpiCard 
            title="Rotation stock (DIO)" 
            value={`${kpis?.dio || 0} jours`} 
            color="#fd7e14"
            icon="📦"
            small
          />
          <KpiCard 
            title="Cycle conversion tréso (CCC)" 
            value={`${kpis?.ccc || 0} jours`} 
            color={kpis?.ccc > 60 ? '#dc3545' : kpis?.ccc > 30 ? '#ffc107' : '#28a745'}
            icon="🔄"
            small
          />
          <KpiCard 
            title="Valeur stock" 
            value={formatMoney(kpis?.valeurStock)} 
            color="#17a2b8"
            icon="📊"
            small
          />
          <KpiCard 
            title="CMV (Coût Marchandises)" 
            value={formatMoney(kpis?.cmv)} 
            color="#6c757d"
            icon="💵"
            small
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>
            Évolution des ventes (12 mois)
            <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal', marginLeft: '10px' }}>Cliquer sur une barre pour détails</span>
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ventesMensuelles} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mois" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Bar dataKey="ventes" fill="#007bff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>
            Répartition des dépenses
            <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal', marginLeft: '10px' }}>Cliquer sur une tranche pour détails</span>
          </h3>
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
                  onClick={handlePieClick}
                  style={{ cursor: 'pointer' }}
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

      {(kpis?.facturesEnRetard?.nombre > 0 || kpis?.stockFaible?.nombre > 0) && (
        <div style={{ marginTop: '20px', backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#333' }}>Alertes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {kpis?.facturesEnRetard?.nombre > 0 && (
              <div 
                onClick={() => openDrillDown('factures-retard', 'Factures en retard de paiement')}
                style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', borderLeft: '4px solid #ffc107', cursor: 'pointer' }}
              >
                <strong>Factures en retard:</strong> {kpis.facturesEnRetard.nombre} facture(s) pour un montant de {formatMoney(kpis.facturesEnRetard.montant)}
                <span style={{ float: 'right', color: '#856404' }}>Voir détail →</span>
              </div>
            )}
            {kpis?.stockFaible?.nombre > 0 && (
              <div 
                onClick={() => openDrillDown('stock-faible', 'Produits en stock faible')}
                style={{ padding: '12px', backgroundColor: '#f8d7da', borderRadius: '4px', borderLeft: '4px solid #dc3545', cursor: 'pointer' }}
              >
                <strong>Stock faible:</strong> {kpis.stockFaible.nombre} produit(s) en dessous du seuil minimum
                <span style={{ float: 'right', color: '#721c24' }}>Voir détail →</span>
              </div>
            )}
          </div>
        </div>
      )}

      <DrillDownModal
        isOpen={drillDown.open}
        onClose={closeDrillDown}
        title={drillDown.title}
        loading={drillDown.loading}
        data={drillDown.data}
        columns={config.columns}
        renderRow={config.renderRow}
      />
    </div>
  );
}

function KpiCard({ title, value, subtitle, color, icon, onClick, small }) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        padding: small ? '12px 16px' : '20px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: small ? '11px' : '14px', color: '#666', marginBottom: small ? '4px' : '8px' }}>{title}</div>
          <div style={{ fontSize: small ? '18px' : '24px', fontWeight: 'bold', color: color }}>{value}</div>
          {subtitle && <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: small ? '20px' : '28px' }}>{icon}</div>
      </div>
      {onClick && !small && <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>Cliquer pour détails</div>}
    </div>
  );
}

export default DashboardView;
