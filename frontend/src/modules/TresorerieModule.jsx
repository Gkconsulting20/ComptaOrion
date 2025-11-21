import React, { useState, useEffect } from 'react';
import { Table } from '../components/Table';
import api from '../api';

export function TresorerieModule() {
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComptes();
  }, []);

  const loadComptes = async () => {
    try {
      const data = await api.get('/tresorerie');
      setComptes(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'nomCompte', label: 'Nom du Compte' },
    { key: 'typeCompte', label: 'Type' },
    { key: 'devise', label: 'Devise' },
    { key: 'soldeActuel', label: 'Solde', render: (val) => `${val || 0} FCFA` },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>💰 Trésorerie</h2>
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#e3f2fd', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #90caf9'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
          Total Trésorerie: {comptes.reduce((sum, c) => sum + parseFloat(c.soldeActuel || 0), 0).toFixed(2)} FCFA
        </h3>
      </div>
      <Table 
        columns={columns} 
        data={comptes} 
        actions={false}
      />
    </div>
  );
}
