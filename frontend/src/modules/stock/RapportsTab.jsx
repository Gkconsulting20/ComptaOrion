import React from 'react';

export function RapportsTab({ produits }) {
  const totalStock = produits.reduce((sum, p) => sum + parseFloat(p.quantite || 0), 0);
  const valorisationTotale = produits.reduce((sum, p) => sum + (parseFloat(p.quantite || 0) * parseFloat(p.prixAchat || 0)), 0);

  return (
    <div>
      <h3>📊 Rapports & Statistiques</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>TOTAL PRODUITS</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#1976d2' }}>{produits.length}</h2>
        </div>
        <div style={{ padding: '20px', background: '#f3e5f5', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>QUANTITÉ TOTALE</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#7b1fa2' }}>{totalStock.toFixed(0)}</h2>
        </div>
        <div style={{ padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>VALORISATION STOCK</p>
          <h2 style={{ margin: '10px 0 0 0', color: '#388e3c' }}>{valorisationTotale.toLocaleString()} FCFA</h2>
        </div>
      </div>
    </div>
  );
}
