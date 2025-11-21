import React, { useState } from 'react';
import { ProduitsSubTab } from './ProduitsSubTab';
import { CategoriesSubTab } from './CategoriesSubTab';
import { EntrepotsSubTab } from './EntrepotsSubTab';

export function ParametresTab({ produits, categories, entrepots, onReloadProduits, onReloadCategories, onReloadEntrepots }) {
  const [activeSubTab, setActiveSubTab] = useState('produits');

  const subTabs = [
    { id: 'produits', label: '📦 Produits', count: produits.length },
    { id: 'categories', label: '🏷️ Catégories', count: categories.length },
    { id: 'entrepots', label: '🏭 Entrepôts', count: entrepots.length }
  ];

  return (
    <div>
      <h3>⚙️ Configuration du Stock</h3>
      <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '20px' }}>
        Gérez les données de base: produits, catégories et entrepôts
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e1e8ed' }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeSubTab === tab.id ? '#3498db' : '#ecf0f1',
              color: activeSubTab === tab.id ? '#fff' : '#34495e',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              fontWeight: activeSubTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {activeSubTab === 'produits' && <ProduitsSubTab produits={produits} categories={categories} onReload={onReloadProduits} />}
      {activeSubTab === 'categories' && <CategoriesSubTab categories={categories} onReload={onReloadCategories} />}
      {activeSubTab === 'entrepots' && <EntrepotsSubTab entrepots={entrepots} onReload={onReloadEntrepots} />}
    </div>
  );
}
