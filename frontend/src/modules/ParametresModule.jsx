import React, { useState, useEffect } from 'react';
import { Table } from '../components/Table';
import api from '../api';

export function ParametresModule() {
  const [devises, setDevises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParametres();
  }, []);

  const loadParametres = async () => {
    try {
      const data = await api.get('/parametres/devises');
      setDevises(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'nom', label: 'Nom' },
    { key: 'symbole', label: 'Symbole' },
  ];

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h2>⚙️ Paramètres</h2>
      <h3 style={{ marginTop: '20px' }}>Devises Disponibles</h3>
      <Table 
        columns={columns} 
        data={devises} 
        actions={false}
      />
      
      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h4>Système Comptable: SYSCOHADA</h4>
        <p>Standard comptable pour l'Afrique de l'Ouest et Centrale</p>
      </div>
    </div>
  );
}
