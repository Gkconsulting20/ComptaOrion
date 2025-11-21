import React from 'react';
import { Table } from '../../components/Table';

export function MouvementsTab({ mouvements }) {
  return (
    <div>
      <h3>🔄 Mouvements de Stock (Lecture Seule)</h3>
      <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
        Les mouvements sont générés automatiquement depuis les factures clients et fournisseurs validées.
      </p>
      {mouvements.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ color: '#7f8c8d' }}>Aucun mouvement de stock enregistré</p>
        </div>
      ) : (
        <Table 
          columns={[
            { key: 'createdAt', label: 'Date', render: (val) => new Date(val).toLocaleDateString('fr-FR') },
            { key: 'type', label: 'Type', render: (val) => val === 'entree' ? '📥 Entrée' : val === 'sortie' ? '📤 Sortie' : '🔄 Ajustement' },
            { key: 'reference', label: 'Référence' },
            { key: 'quantite', label: 'Quantité' },
            { key: 'notes', label: 'Notes' },
          ]}
          data={mouvements}
        />
      )}
    </div>
  );
}
