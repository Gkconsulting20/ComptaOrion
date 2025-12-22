import React from 'react';
import Button from './Button';

const DrillDownModal = ({ 
  open, 
  onClose, 
  title, 
  data = [], 
  loading = false, 
  columns = [],
  totalField = 'montant',
  totalLabel = 'TOTAL',
  emptyMessage = 'Aucune donnée disponible'
}) => {
  if (!open) return null;

  const total = data.reduce((sum, item) => {
    const value = parseFloat(item[totalField] || 0);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const formatValue = (value, column) => {
    if (value === null || value === undefined) return '-';
    
    if (column.type === 'currency') {
      return `${parseFloat(value || 0).toLocaleString()} FCFA`;
    }
    if (column.type === 'date') {
      return value ? new Date(value).toLocaleDateString('fr-FR') : '-';
    }
    if (column.type === 'number') {
      return parseFloat(value || 0).toLocaleString();
    }
    if (column.type === 'status') {
      const statusColors = {
        payee: { bg: '#d4edda', text: '#155724' },
        envoyee: { bg: '#fff3cd', text: '#856404' },
        brouillon: { bg: '#f8d7da', text: '#721c24' },
        partielle: { bg: '#d1ecf1', text: '#0c5460' },
        validee: { bg: '#d4edda', text: '#155724' },
        annulee: { bg: '#f8d7da', text: '#721c24' },
        actif: { bg: '#d4edda', text: '#155724' },
        inactif: { bg: '#f8d7da', text: '#721c24' },
        en_cours: { bg: '#fff3cd', text: '#856404' }
      };
      const colors = statusColors[value] || { bg: '#e9ecef', text: '#495057' };
      return (
        <span style={{
          padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
          backgroundColor: colors.bg, color: colors.text
        }}>{value}</span>
      );
    }
    if (column.render) {
      return column.render(value, data);
    }
    return value;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '8px', width: '90%', maxWidth: '1000px',
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', 
            color: '#666', lineHeight: 1, padding: '0 5px'
          }}>&times;</button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              Chargement des données...
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>📭</div>
              {emptyMessage}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  {columns.map((col, idx) => (
                    <th key={idx} style={{
                      padding: '12px 10px',
                      textAlign: col.align || (col.type === 'currency' || col.type === 'number' ? 'right' : 'left'),
                      borderBottom: '2px solid #dee2e6',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#495057'
                    }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={i} style={{ 
                    borderBottom: '1px solid #eee',
                    backgroundColor: i % 2 === 0 ? 'white' : '#fafafa'
                  }}>
                    {columns.map((col, idx) => (
                      <td key={idx} style={{
                        padding: '10px',
                        textAlign: col.align || (col.type === 'currency' || col.type === 'number' ? 'right' : 'left'),
                        fontSize: '13px',
                        fontWeight: col.type === 'currency' ? '600' : 'normal',
                        color: col.color || (col.type === 'currency' ? '#3498db' : '#333')
                      }}>
                        {formatValue(item[col.key], col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {columns.some(c => c.key === totalField) && (
                <tfoot>
                  <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                    {columns.map((col, idx) => (
                      <td key={idx} style={{
                        padding: '12px 10px',
                        textAlign: col.align || (col.type === 'currency' || col.type === 'number' ? 'right' : 'left'),
                        borderTop: '2px solid #dee2e6',
                        fontSize: '14px'
                      }}>
                        {col.key === totalField ? (
                          <span style={{ color: '#2c3e50' }}>{total.toLocaleString()} FCFA</span>
                        ) : idx === 0 ? totalLabel : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        <div style={{ 
          padding: '12px 20px', borderTop: '1px solid #eee', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <span style={{ color: '#666', fontSize: '13px' }}>
            {data.length} élément{data.length > 1 ? 's' : ''}
          </span>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
