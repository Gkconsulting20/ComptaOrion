import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { ParametresTab } from './stock/ParametresTab';
import { MouvementsTab } from './stock/MouvementsTab';
import { InventairesTab } from './stock/InventairesTab';
import { AlertesTab } from './stock/AlertesTab';
import { RapportsTab } from './stock/RapportsTab';

export function StockModule() {
  const [activeTab, setActiveTab] = useState('parametres');
  const [stockData, setStockData] = useState({
    produits: [],
    categories: [],
    entrepots: [],
    mouvements: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const [produitsRes, categoriesRes, entrepotsRes, mouvementsRes] = await Promise.all([
          api.get('/produits').catch(() => ({ data: [] })),
          api.get('/stock/categories').catch(() => ({ data: [] })),
          api.get('/stock/entrepots').catch(() => ({ data: [] })),
          api.get('/stock/mouvements').catch(() => ({ data: [] }))
        ]);
        
        setStockData({
          produits: produitsRes.data || [],
          categories: categoriesRes.data || [],
          entrepots: entrepotsRes.data || [],
          mouvements: mouvementsRes.data || []
        });
      } catch (error) {
        console.error('Erreur chargement Stock:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const reloadProduits = async () => {
    const data = await api.get('/produits');
    setStockData(prev => ({ ...prev, produits: data.data || [] }));
  };

  const reloadCategories = async () => {
    const data = await api.get('/stock/categories');
    setStockData(prev => ({ ...prev, categories: data.data || [] }));
  };

  const reloadEntrepots = async () => {
    const data = await api.get('/stock/entrepots');
    setStockData(prev => ({ ...prev, entrepots: data.data || [] }));
  };

  const reloadMouvements = async () => {
    const data = await api.get('/stock/mouvements');
    setStockData(prev => ({ ...prev, mouvements: data.data || [] }));
  };

  const tabs = useMemo(() => [
    { id: 'parametres', label: '⚙️ Paramètres', icon: '⚙️' },
    { id: 'mouvements', label: '🔄 Mouvements', icon: '🔄' },
    { id: 'inventaires', label: '📋 Inventaires', icon: '📋' },
    { id: 'alertes', label: '⚠️ Alertes', icon: '⚠️' },
    { id: 'rapports', label: '📊 Rapports', icon: '📊' }
  ], []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#3498db' }}>⏳ Chargement des données...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>📦 Stock & Inventaire</h2>
      
      <div style={{ display: 'flex', borderBottom: '2px solid #e1e8ed', marginBottom: '20px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #3498db' : '3px solid transparent',
              color: activeTab === tab.id ? '#3498db' : '#7f8c8d',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'parametres' && (
        <ParametresTab 
          produits={stockData.produits}
          categories={stockData.categories}
          entrepots={stockData.entrepots}
          onReloadProduits={reloadProduits}
          onReloadCategories={reloadCategories}
          onReloadEntrepots={reloadEntrepots}
        />
      )}
      {activeTab === 'mouvements' && <MouvementsTab mouvements={stockData.mouvements} onReload={reloadMouvements} />}
      {activeTab === 'inventaires' && <InventairesTab />}
      {activeTab === 'alertes' && <AlertesTab produits={stockData.produits} />}
      {activeTab === 'rapports' && <RapportsTab produits={stockData.produits} />}
    </div>
  );
}
