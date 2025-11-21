import React from 'react';

export function Table({ columns, data = [], onEdit, onDelete, onSendEmail, actions = true }) {
  const safeData = Array.isArray(data) ? data : [];
  
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        marginTop: '20px',
      }}>
        <thead>
          <tr style={{
            backgroundColor: '#f8f9fa',
            borderBottom: '2px solid #dee2e6',
          }}>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: '12px 15px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '13px',
                color: '#495057',
                textTransform: 'uppercase',
              }}>
                {col.label}
              </th>
            ))}
            {actions && (
              <th style={{
                padding: '12px 15px',
                textAlign: 'right',
                fontWeight: '600',
                fontSize: '13px',
                color: '#495057',
              }}>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {safeData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} style={{
                padding: '40px',
                textAlign: 'center',
                color: '#999',
              }}>
                Aucune donnée disponible
              </td>
            </tr>
          ) : (
            safeData.map((row, rowIndex) => (
              <tr key={rowIndex} style={{
                borderBottom: '1px solid #dee2e6',
                transition: 'background 0.2s',
              }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                {columns.map((col, colIndex) => (
                  <td key={colIndex} style={{
                    padding: '12px 15px',
                    fontSize: '14px',
                    color: '#495057',
                  }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                {actions && (
                  <td style={{
                    padding: '12px 15px',
                    textAlign: 'right',
                  }}>
                    {onEdit && (
                      <button onClick={() => onEdit(row)} style={{
                        padding: '6px 12px',
                        marginRight: '8px',
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}>Modifier</button>
                    )}
                    {onSendEmail && (
                      <button onClick={() => onSendEmail(row)} style={{
                        padding: '6px 12px',
                        marginRight: '8px',
                        backgroundColor: '#27ae60',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}>📧 Envoyer</button>
                    )}
                    {onDelete && (
                      <button onClick={() => onDelete(row)} style={{
                        padding: '6px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}>Supprimer</button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
