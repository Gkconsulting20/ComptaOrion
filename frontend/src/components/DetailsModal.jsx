import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export function DetailsModal({ 
  isOpen, 
  onClose, 
  title, 
  sections = [], 
  tables = [],
  actions = []
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="large">
      <div style={{ padding: '10px' }}>
        {sections.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: sections.length > 1 ? `repeat(${Math.min(sections.length, 2)}, 1fr)` : '1fr',
            gap: '20px', 
            marginBottom: '20px' 
          }}>
            {sections.map((section, idx) => (
              <div key={idx}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>{section.title}</h4>
                {section.fields.map((field, fieldIdx) => (
                  <div key={fieldIdx} style={{ marginBottom: '10px' }}>
                    <strong>{field.label}:</strong> {field.value || '-'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tables.map((table, tableIdx) => (
          <div key={tableIdx} style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '15px', color: '#3498db' }}>{table.title}</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  {table.columns.map((col, colIdx) => (
                    <th key={colIdx} style={{ 
                      padding: '10px', 
                      textAlign: col.align || 'left',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.data && table.data.length > 0 ? (
                  table.data.map((row, rowIdx) => (
                    <tr key={rowIdx} style={{ borderBottom: '1px solid #dee2e6' }}>
                      {table.columns.map((col, colIdx) => (
                        <td key={colIdx} style={{ 
                          padding: '10px',
                          textAlign: col.align || 'left',
                          color: col.color || '#495057',
                          fontWeight: col.bold ? 'bold' : 'normal'
                        }}>
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={table.columns.length} style={{ 
                      padding: '20px', 
                      textAlign: 'center', 
                      color: '#999' 
                    }}>
                      Aucune donnée disponible
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {actions.map((action, idx) => (
            <Button 
              key={idx}
              variant={action.variant || 'primary'}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
