import React from 'react';
import { Table } from '../../components/Table';

export function AlertesTab({ produits }) {
  const produitsEnAlerte = produits.filter(p => parseFloat(p.quantite || 0) < parseFloat(p.stockMinimum || 0));
  
  return (
    <div>
      <h3>⚠️ Alertes de Stock Faible</h3>
      {produitsEnAlerte.length === 0 ? (
        <div style={{ padding: '20px', background: '#d4edda', borderRadius: '8px', color: '#155724', marginTop: '20px' }}>
          ✅ Aucune alerte - Tous les stocks sont au-dessus du seuil minimum
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <div style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', marginBottom: '20px' }}>
            ⚠️ {produitsEnAlerte.length} produit(s) sous le seuil minimum
          </div>
          <Table 
            columns={[
              { key: 'reference', label: 'Référence' },
              { key: 'nom', label: 'Produit' },
              { key: 'quantite', label: 'Stock Actuel', render: (val, row) => (
                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                  {val || 0} {row.uniteMesure || 'pièce'}
                </span>
              )},
              { key: 'stockMinimum', label: 'Seuil Min', render: (val) => val || 0 },
            ]}
            data={produitsEnAlerte}
          />
        </div>
      )}
    </div>
  );
}
