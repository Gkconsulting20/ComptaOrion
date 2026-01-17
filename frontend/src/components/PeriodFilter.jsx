import React, { useState, useEffect } from 'react';
import api from '../api';

const PERIODES_CALENDAIRES = [
  { id: 'mois', label: 'Mois courant', group: 'calendaire' },
  { id: 'mois_precedent', label: 'Mois précédent', group: 'calendaire' },
  { id: 'trimestre', label: 'Trimestre courant', group: 'calendaire' },
  { id: 'trimestre_precedent', label: 'Trimestre précédent', group: 'calendaire' },
  { id: 'annee', label: 'Année courante', group: 'calendaire' },
];

const PERIODES_FISCALES = [
  { id: 'fiscal_courant', label: 'Année fiscale courante', group: 'fiscal' },
  { id: 'fiscal_precedent', label: 'Année fiscale précédente', group: 'fiscal' },
  { id: 'trimestre_fiscal', label: 'Trimestre fiscal courant', group: 'fiscal' },
  { id: 'trimestre_fiscal_precedent', label: 'Trimestre fiscal précédent', group: 'fiscal' },
];

export function getPeriodeDates(type, fiscalStart = null) {
  const now = new Date();
  let debut, fin;
  
  // Par défaut: année fiscale = année calendaire (1er janvier)
  const fiscalMonth = fiscalStart ? new Date(fiscalStart).getMonth() : 0;
  const fiscalDay = fiscalStart ? new Date(fiscalStart).getDate() : 1;
  
  // Fonction helper pour calculer le dernier jour du mois précédent une date
  const getLastDayBefore = (year, month, day) => {
    if (day === 1) {
      // Si le jour de début est le 1er, fin = dernier jour du mois précédent
      return new Date(year, month, 0);
    } else {
      // Sinon, fin = jour précédent dans le même mois
      return new Date(year, month, day - 1);
    }
  };
  
  switch(type) {
    case 'mois':
      debut = new Date(now.getFullYear(), now.getMonth(), 1);
      fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'mois_precedent':
      debut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      fin = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'trimestre':
      const trimestre = Math.floor(now.getMonth() / 3);
      debut = new Date(now.getFullYear(), trimestre * 3, 1);
      fin = new Date(now.getFullYear(), (trimestre + 1) * 3, 0);
      break;
    case 'trimestre_precedent':
      const trimestrePrev = Math.floor(now.getMonth() / 3) - 1;
      const yearPrev = trimestrePrev < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const trimestreAdj = trimestrePrev < 0 ? 3 : trimestrePrev;
      debut = new Date(yearPrev, trimestreAdj * 3, 1);
      fin = new Date(yearPrev, (trimestreAdj + 1) * 3, 0);
      break;
    case 'annee':
      debut = new Date(now.getFullYear(), 0, 1);
      fin = new Date(now.getFullYear(), 11, 31);
      break;
    case 'fiscal_courant':
      // Déterminer l'année de début de l'exercice fiscal courant
      let fiscalYearStart;
      if (now.getMonth() > fiscalMonth || 
          (now.getMonth() === fiscalMonth && now.getDate() >= fiscalDay)) {
        fiscalYearStart = now.getFullYear();
      } else {
        fiscalYearStart = now.getFullYear() - 1;
      }
      debut = new Date(fiscalYearStart, fiscalMonth, fiscalDay);
      fin = getLastDayBefore(fiscalYearStart + 1, fiscalMonth, fiscalDay);
      break;
    case 'fiscal_precedent':
      // Exercice fiscal précédent
      let prevFiscalYearStart;
      if (now.getMonth() > fiscalMonth || 
          (now.getMonth() === fiscalMonth && now.getDate() >= fiscalDay)) {
        prevFiscalYearStart = now.getFullYear() - 1;
      } else {
        prevFiscalYearStart = now.getFullYear() - 2;
      }
      debut = new Date(prevFiscalYearStart, fiscalMonth, fiscalDay);
      fin = getLastDayBefore(prevFiscalYearStart + 1, fiscalMonth, fiscalDay);
      break;
    case 'trimestre_fiscal':
      // Trimestre fiscal courant
      let currentFiscalYearStart;
      if (now.getMonth() > fiscalMonth || 
          (now.getMonth() === fiscalMonth && now.getDate() >= fiscalDay)) {
        currentFiscalYearStart = now.getFullYear();
      } else {
        currentFiscalYearStart = now.getFullYear() - 1;
      }
      const fiscalStartDate = new Date(currentFiscalYearStart, fiscalMonth, fiscalDay);
      
      // Calculer les mois écoulés depuis le début de l'exercice
      let monthsElapsed = (now.getFullYear() - currentFiscalYearStart) * 12 + 
                          (now.getMonth() - fiscalMonth);
      if (now.getDate() < fiscalDay) monthsElapsed--;
      
      const currentQuarter = Math.max(0, Math.floor(monthsElapsed / 3));
      
      // Début du trimestre courant
      debut = new Date(currentFiscalYearStart, fiscalMonth + currentQuarter * 3, fiscalDay);
      // Fin = 3 mois après, jour précédent
      fin = new Date(currentFiscalYearStart, fiscalMonth + (currentQuarter + 1) * 3, fiscalDay - 1);
      if (fiscalDay === 1) {
        fin = new Date(currentFiscalYearStart, fiscalMonth + (currentQuarter + 1) * 3, 0);
      }
      break;
    case 'trimestre_fiscal_precedent':
      // Trimestre fiscal précédent
      let tfpFiscalYearStart;
      if (now.getMonth() > fiscalMonth || 
          (now.getMonth() === fiscalMonth && now.getDate() >= fiscalDay)) {
        tfpFiscalYearStart = now.getFullYear();
      } else {
        tfpFiscalYearStart = now.getFullYear() - 1;
      }
      
      let tfpMonthsElapsed = (now.getFullYear() - tfpFiscalYearStart) * 12 + 
                             (now.getMonth() - fiscalMonth);
      if (now.getDate() < fiscalDay) tfpMonthsElapsed--;
      
      let prevQuarter = Math.floor(tfpMonthsElapsed / 3) - 1;
      
      if (prevQuarter < 0) {
        // Q4 de l'exercice précédent
        tfpFiscalYearStart--;
        prevQuarter = 3;
      }
      
      debut = new Date(tfpFiscalYearStart, fiscalMonth + prevQuarter * 3, fiscalDay);
      fin = new Date(tfpFiscalYearStart, fiscalMonth + (prevQuarter + 1) * 3, fiscalDay - 1);
      if (fiscalDay === 1) {
        fin = new Date(tfpFiscalYearStart, fiscalMonth + (prevQuarter + 1) * 3, 0);
      }
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
  compact = false,
  showFiscalPeriods = true
}) {
  const [periodeActive, setPeriodeActive] = useState('fiscal_courant');
  const [fiscalStart, setFiscalStart] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadFiscalYear = async () => {
      try {
        const entrepriseId = localStorage.getItem('entrepriseId');
        if (entrepriseId) {
          const response = await api.get('/parametres/entreprise');
          if (response && response.debutAnneeFiscale) {
            setFiscalStart(response.debutAnneeFiscale);
          }
        }
      } catch (error) {
        console.error('Erreur chargement année fiscale:', error);
      }
    };
    loadFiscalYear();
  }, []);

  const handlePeriodeClick = (type) => {
    const dates = getPeriodeDates(type, fiscalStart);
    onDateDebutChange(dates.dateDebut);
    onDateFinChange(dates.dateFin);
    setPeriodeActive(type);
    if (onApply) {
      setTimeout(() => onApply(), 100);
    }
  };

  const handleDateChange = (type, value) => {
    if (type === 'debut') {
      onDateDebutChange(value);
    } else {
      onDateFinChange(value);
    }
    setPeriodeActive('custom');
  };

  const allPeriodes = showFiscalPeriods 
    ? [...PERIODES_CALENDAIRES, ...PERIODES_FISCALES]
    : PERIODES_CALENDAIRES;

  const displayedPeriodes = compact && !expanded 
    ? allPeriodes.slice(0, 4) 
    : allPeriodes;

  const containerStyle = compact ? {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    marginBottom: '15px'
  } : {
    marginBottom: '20px'
  };

  const buttonStyle = (isActive, group) => ({
    padding: compact ? '5px 10px' : '7px 14px',
    backgroundColor: isActive ? (group === 'fiscal' ? '#28a745' : '#007bff') : '#fff',
    color: isActive ? '#fff' : '#333',
    border: `1px solid ${isActive ? (group === 'fiscal' ? '#28a745' : '#007bff') : '#ddd'}`,
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: compact ? '11px' : '12px',
    fontWeight: isActive ? 'bold' : 'normal',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  });

  return (
    <div style={containerStyle}>
      {showTitle && !compact && (
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Période: <strong>{formatPeriodeDisplay(dateDebut, dateFin)}</strong>
          </span>
          {fiscalStart && (
            <span style={{ fontSize: '12px', color: '#28a745', fontStyle: 'italic' }}>
              📅 Année fiscale: {new Date(fiscalStart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}

      {showFiscalPeriods && !compact && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#007bff', fontWeight: 'bold' }}>● Périodes calendaires</span>
            <span style={{ fontSize: '11px', color: '#28a745', fontWeight: 'bold' }}>● Périodes fiscales</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: compact ? '10px' : '12px' }}>
        {displayedPeriodes.map(p => (
          <button
            key={p.id}
            onClick={() => handlePeriodeClick(p.id)}
            style={buttonStyle(periodeActive === p.id, p.group)}
          >
            {p.label}
          </button>
        ))}
        {compact && allPeriodes.length > 4 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '5px 10px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            {expanded ? '▲ Moins' : '▼ Plus...'}
          </button>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        padding: compact ? '0' : '12px',
        backgroundColor: compact ? 'transparent' : '#fff',
        borderRadius: compact ? '0' : '8px',
        border: compact ? 'none' : '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Du:</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => handleDateChange('debut', e.target.value)}
            style={{ 
              padding: compact ? '5px 8px' : '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              fontSize: '12px' 
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Au:</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => handleDateChange('fin', e.target.value)}
            style={{ 
              padding: compact ? '5px 8px' : '8px 12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              fontSize: '12px' 
            }}
          />
        </div>
        <button 
          onClick={onApply}
          disabled={loading}
          style={{ 
            padding: compact ? '6px 14px' : '10px 20px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: loading ? 0.7 : 1,
            fontSize: compact ? '11px' : '13px'
          }}
        >
          {loading ? '...' : 'Appliquer'}
        </button>
      </div>
    </div>
  );
}
