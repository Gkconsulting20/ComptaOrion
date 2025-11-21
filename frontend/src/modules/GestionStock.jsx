import React, { useState, useEffect } from 'react';
import api from '../api';
import { Table } from '../components/Table';
import { Button } from '../components/Button';

export function GestionStockModule() {
  const [activeTab, setActiveTab] = useState('produits');
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/produits')
      .then(res => setProduits(res.data || []))
      .catch(() => setProduits([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>📦 Stock & Inventaire</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('produits')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'produits' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'produits' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'produits' ? 'bold' : 'normal',
          }}
        >
          📦 Produits
        </button>
        <button
          onClick={() => setActiveTab('mouvements')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'mouvements' ? '#3498db' : '#ecf0f1',
            color: activeTab === 'mouvements' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: activeTab === 'mouvements' ? 'bold' : 'normal',
          }}
        >
          🔄 Mouvements
        </button>
      </div>

      {activeTab === 'produits' && (
        <div>
          <h3>Liste des Produits</h3>
          <p>Total: {produits.length} produits</p>
          <Table
            columns={[
              { key: 'reference', label: 'Référence' },
              { key: 'nom', label: 'Nom' },
              { key: 'quantite', label: 'Stock' },
              { key: 'prixVente', label: 'Prix', render: (val) => `${val || 0} FCFA` },
            ]}
            data={produits}
          />
        </div>
      )}

      {activeTab === 'mouvements' && (
        <div>
          <h3>Mouvements de Stock</h3>
          <p style={{ padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
            Les mouvements sont générés automatiquement depuis les factures.
          </p>
        </div>
      )}
    </div>
  );
}
