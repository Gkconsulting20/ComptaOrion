import React, { useState, useEffect } from 'react';

const PERIODES = [
  { id: 'mois', label: 'Ce mois' },
  { id: 'trimestre', label: 'Ce trimestre' },
  { id: 'annee', label: 'Cette année' },
  { id: 'exercice', label: 'Exercice complet' },
];

export function getPeriodeDates(type) {
  const now = new Date();
  let debut, fin;
  
  switch(type) {
    case 'mois':
      debut = new Date(now.getFullYear(), now.getMonth(), 1);
      fin = now;
      break;
    case 'trimestre':
      const trimestre = Math.floor(now.getMonth() / 3);
      debut = new Date(now.getFullYear(), trimestre * 3, 1);
      fin = now;
      break;
    case 'annee':
      debut = new Date(now.getFullYear(), 0, 1);
      fin = now;
      break;
    case 'exercice':
      debut = new Date(now.getFullYear(), 0, 1);
      fin = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      debut = new Date(now.getFullYear(), 0, 1);
      fin = now;
  }
  
  return {
    dateDebut: debut.toISOString().split('T')[0],
    dateFin: fin.toISOString().split('T')[0]
  };
}

export function formatPeriodeDisplay(dateDebut, dateFin) {
  const d1 = new Date(dateDebut);
  const d2 = new Date(dateFin);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${d1.toLocaleDateString('fr-FR', options)} - ${d2.toLocaleDateString('fr-FR', options)}`;
}

export function getPeriodeLabel(dateDebut, dateFin) {
  const d1 = new Date(dateDebut);
  const d2 = new Date(dateFin);
  const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 31) return 'du mois';
  if (diffDays <= 100) return 'du trimestre';
  if (diffDays <= 366) return 'de l\'année';
  return 'de la période';
}

export default function PeriodFilter({ 
  dateDebut, 
  dateFin, 
  onDateDebutChange, 
  onDateFinChange, 
  onApply,
  loading = false,
  showTitle = true,
  compact = false 
}) {
  const [periodeActive, setPeriodeActive] = useState('annee');

  const handlePeriodeClick = (type) => {
    const dates = getPeriodeDates(type);
    onDateDebutChange(dates.dateDebut);
    onDateFinChange(dates.dateFin);
    setPeriodeActive(type);
  };

  const handleDateChange = (type, value) => {
    if (type === 'debut') {
      onDateDebutChange(value);
    } else {
      onDateFinChange(value);
    }
    setPeriodeActive('custom');
  };

  const containerStyle = compact ? {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    marginBottom: '15px'
  } : {
    marginBottom: '20px'
  };

  const buttonGroupStyle = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: compact ? '0' : '12px'
  };

  const dateGroupStyle = {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: compact ? '0' : '12px',
    backgroundColor: compact ? 'transparent' : '#fff',
    borderRadius: compact ? '0' : '8px',
    border: compact ? 'none' : '1px solid #e0e0e0'
  };

  return (
    <div style={containerStyle}>
      {showTitle && !compact && (
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Période: <strong>{formatPeriodeDisplay(dateDebut, dateFin)}</strong>
          </span>
        </div>
      )}

      <div style={buttonGroupStyle}>
        {PERIODES.map(p => (
          <button
            key={p.id}
            onClick={() => handlePeriodeClick(p.id)}
            style={{
              padding: compact ? '6px 12px' : '8px 16px',
              backgroundColor: periodeActive === p.id ? '#007bff' : '#fff',
              color: periodeActive === p.id ? '#fff' : '#333',
              border: `1px solid ${periodeActive === p.id ? '#007bff' : '#ddd'}`,
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: compact ? '12px' : '13px',
              fontWeight: periodeActive === p.id ? 'bold' : 'normal',
              transition: 'all 0.2s'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={dateGroupStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '13px', color: '#666' }}>Du:</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => handleDateChange('debut', e.target.value)}
            style={{ 
              padding: compact ? '6px 10px' : '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              fontSize: '13px' 
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '13px', color: '#666' }}>Au:</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => handleDateChange('fin', e.target.value)}
            style={{ 
              padding: compact ? '6px 10px' : '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              fontSize: '13px' 
            }}
          />
        </div>
        <button 
          onClick={onApply}
          disabled={loading}
          style={{ 
            padding: compact ? '6px 16px' : '10px 20px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: loading ? 0.7 : 1,
            fontSize: compact ? '12px' : '14px'
          }}
        >
          {loading ? '...' : 'Appliquer'}
        </button>
      </div>
    </div>
  );
}
