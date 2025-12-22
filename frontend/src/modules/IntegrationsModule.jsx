import React, { useState, useEffect } from 'react';
import { api } from '../api';

const Button = ({ children, onClick, variant = 'primary', disabled, style = {} }) => {
  const baseStyle = {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    opacity: disabled ? 0.6 : 1,
    ...style
  };
  const variants = {
    primary: { backgroundColor: '#667eea', color: 'white' },
    success: { backgroundColor: '#27ae60', color: 'white' },
    danger: { backgroundColor: '#e74c3c', color: 'white' },
    secondary: { backgroundColor: '#95a5a6', color: 'white' },
    warning: { backgroundColor: '#f39c12', color: 'white' }
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...baseStyle, ...variants[variant] }}>
      {children}
    </button>
  );
};

export default function IntegrationsModule() {
  const [activeTab, setActiveTab] = useState('exports');
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [exportDomains, setExportDomains] = useState([]);
  const [exportHistory, setExportHistory] = useState([]);
  const [backupConfigs, setBackupConfigs] = useState([]);
  const [backupJobs, setBackupJobs] = useState([]);
  
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState(null);
  
  const [formApiKey, setFormApiKey] = useState({ nom: '', permissions: ['read'] });
  const [formWebhook, setFormWebhook] = useState({ nom: '', url: '', evenements: [] });
  const [formBackup, setFormBackup] = useState({
    nom: '', destination: 'url', configDestination: { url: '' },
    format: 'json', frequence: 'weekly', domainesInclus: ['all']
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'exports') {
        const [domainsRes, historyRes] = await Promise.all([
          api.get('/integrations/export/domains'),
          api.get('/integrations/export-history')
        ]);
        setExportDomains(domainsRes.data || []);
        setExportHistory(historyRes.data || []);
      } else if (activeTab === 'api-keys') {
        const res = await api.get('/integrations/api-keys');
        setApiKeys(res.data || []);
      } else if (activeTab === 'webhooks') {
        const res = await api.get('/integrations/webhooks');
        setWebhooks(res.data || []);
        setAvailableEvents(res.availableEvents || []);
      } else if (activeTab === 'backups') {
        const [configsRes, jobsRes] = await Promise.all([
          api.get('/integrations/backup-configs'),
          api.get('/integrations/backup-jobs')
        ]);
        setBackupConfigs(configsRes.data || []);
        setBackupJobs(jobsRes.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement intégrations:', error);
    }
    setLoading(false);
  };

  const handleExport = async (domain, format = 'json') => {
    try {
      const response = await api.get(`/integrations/export/${domain}?format=${format}`);
      const blob = new Blob([format === 'csv' ? response : JSON.stringify(response, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${domain}_export_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      loadData();
    } catch (error) {
      alert('Erreur export: ' + error.message);
    }
  };

  const handleExportAll = async () => {
    try {
      const response = await api.get('/integrations/export-all');
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comptaorion_backup_complet_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      loadData();
    } catch (error) {
      alert('Erreur export complet: ' + error.message);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const res = await api.post('/integrations/api-keys', formApiKey);
      setNewApiKey(res.data);
      setFormApiKey({ nom: '', permissions: ['read'] });
      loadData();
    } catch (error) {
      alert('Erreur création clé API: ' + error.message);
    }
  };

  const handleDeleteApiKey = async (id) => {
    if (!confirm('Supprimer cette clé API ?')) return;
    try {
      await api.delete(`/integrations/api-keys/${id}`);
      loadData();
    } catch (error) {
      alert('Erreur suppression: ' + error.message);
    }
  };

  const handleToggleApiKey = async (id) => {
    try {
      await api.put(`/integrations/api-keys/${id}/toggle`);
      loadData();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const res = await api.post('/integrations/webhooks', formWebhook);
      setNewWebhookSecret(res.data);
      setFormWebhook({ nom: '', url: '', evenements: [] });
      loadData();
    } catch (error) {
      alert('Erreur création webhook: ' + error.message);
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
      await api.delete(`/integrations/webhooks/${id}`);
      loadData();
    } catch (error) {
      alert('Erreur suppression: ' + error.message);
    }
  };

  const handleTestWebhook = async (id) => {
    try {
      const res = await api.post(`/integrations/webhooks/${id}/test`);
      alert(res.success ? `Test réussi! (${res.data.durationMs}ms)` : `Échec: ${res.data.responseStatus}`);
    } catch (error) {
      alert('Erreur test: ' + error.message);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await api.post('/integrations/backup-configs', formBackup);
      setShowBackupModal(false);
      setFormBackup({
        nom: '', destination: 'url', configDestination: { url: '' },
        format: 'json', frequence: 'weekly', domainesInclus: ['all']
      });
      loadData();
    } catch (error) {
      alert('Erreur création config backup: ' + error.message);
    }
  };

  const tabs = [
    { id: 'exports', label: 'Exports de Données', icon: '📥' },
    { id: 'api-keys', label: 'Clés API', icon: '🔑' },
    { id: 'webhooks', label: 'Webhooks', icon: '🔔' },
    { id: 'backups', label: 'Sauvegardes Programmées', icon: '💾' }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '10px' }}>🔗 Intégrations & Connectivité</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Exportez vos données, connectez des applications externes et configurez des sauvegardes automatiques vers vos propres serveurs.
      </p>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '5px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#667eea' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>}

      {!loading && activeTab === 'exports' && (
        <div>
          <div style={{ marginBottom: '20px', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Sauvegarde Complète</h4>
            <p style={{ margin: '0 0 15px 0', color: '#666' }}>
              Téléchargez toutes vos données en un seul fichier JSON pour les sauvegarder sur votre propre serveur.
            </p>
            <Button variant="success" onClick={handleExportAll}>
              Télécharger Backup Complet
            </Button>
          </div>

          <h4>Exports par Domaine</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            {exportDomains.map(domain => (
              <div key={domain.id} style={{ padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                <h5 style={{ margin: '0 0 10px 0' }}>{domain.name}</h5>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="primary" onClick={() => handleExport(domain.id, 'json')} style={{ fontSize: '12px', padding: '6px 12px' }}>
                    JSON
                  </Button>
                  <Button variant="secondary" onClick={() => handleExport(domain.id, 'csv')} style={{ fontSize: '12px', padding: '6px 12px' }}>
                    CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <h4>Historique des Exports</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Domaine</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Format</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>Enregistrements</th>
              </tr>
            </thead>
            <tbody>
              {exportHistory.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{new Date(exp.createdAt).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '10px' }}>{exp.domaine}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{exp.format?.toUpperCase()}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{exp.nombreEnregistrements}</td>
                </tr>
              ))}
              {exportHistory.length === 0 && (
                <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucun export effectué</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'api-keys' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ margin: 0 }}>Clés API</h4>
              <p style={{ color: '#666', margin: '5px 0 0 0' }}>Permettez à des applications externes d'accéder à vos données de manière sécurisée.</p>
            </div>
            <Button onClick={() => setShowApiKeyModal(true)}>+ Nouvelle Clé API</Button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Nom</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Préfixe</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Permissions</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Dernier usage</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map(key => (
                <tr key={key.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{key.nom}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', color: '#666' }}>{key.keyPrefix}...</td>
                  <td style={{ padding: '10px' }}>
                    {(Array.isArray(key.permissions) ? key.permissions : JSON.parse(key.permissions || '[]')).join(', ')}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                      background: key.actif ? '#e8f5e9' : '#ffebee',
                      color: key.actif ? '#2e7d32' : '#c62828'
                    }}>
                      {key.actif ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', color: '#666' }}>
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('fr-FR') : 'Jamais'}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <Button variant={key.actif ? 'warning' : 'success'} onClick={() => handleToggleApiKey(key.id)} style={{ marginRight: '8px', fontSize: '12px', padding: '4px 8px' }}>
                      {key.actif ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button variant="danger" onClick={() => handleDeleteApiKey(key.id)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                      Supprimer
                    </Button>
                  </td>
                </tr>
              ))}
              {apiKeys.length === 0 && (
                <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Aucune clé API créée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'webhooks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ margin: 0 }}>Webhooks</h4>
              <p style={{ color: '#666', margin: '5px 0 0 0' }}>Recevez des notifications automatiques sur votre serveur lorsque des événements se produisent.</p>
            </div>
            <Button onClick={() => setShowWebhookModal(true)}>+ Nouveau Webhook</Button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Nom</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>URL</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Événements</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map(wh => (
                <tr key={wh.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{wh.nom}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>{wh.url}</td>
                  <td style={{ padding: '10px', fontSize: '12px' }}>
                    {(Array.isArray(wh.evenements) ? wh.evenements : JSON.parse(wh.evenements || '[]')).slice(0, 3).join(', ')}
                    {(Array.isArray(wh.evenements) ? wh.evenements : JSON.parse(wh.evenements || '[]')).length > 3 && '...'}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                      background: wh.actif ? '#e8f5e9' : '#ffebee',
                      color: wh.actif ? '#2e7d32' : '#c62828'
                    }}>
                      {wh.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <Button variant="secondary" onClick={() => handleTestWebhook(wh.id)} style={{ marginRight: '8px', fontSize: '12px', padding: '4px 8px' }}>
                      Tester
                    </Button>
                    <Button variant="danger" onClick={() => handleDeleteWebhook(wh.id)} style={{ fontSize: '12px', padding: '4px 8px' }}>
                      Supprimer
                    </Button>
                  </td>
                </tr>
              ))}
              {webhooks.length === 0 && (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#999' }}>Aucun webhook configuré</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'backups' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ margin: 0 }}>Sauvegardes Programmées</h4>
              <p style={{ color: '#666', margin: '5px 0 0 0' }}>Configurez des sauvegardes automatiques vers votre propre serveur.</p>
            </div>
            <Button onClick={() => setShowBackupModal(true)}>+ Nouvelle Configuration</Button>
          </div>

          {backupConfigs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#999', margin: 0 }}>Aucune configuration de sauvegarde. Cliquez sur "+ Nouvelle Configuration" pour commencer.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px', marginBottom: '30px' }}>
              {backupConfigs.map(config => (
                <div key={config.id} style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <h5 style={{ margin: '0 0 5px 0' }}>{config.nom}</h5>
                      <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                        {config.destination} | {config.format?.toUpperCase()} | {config.frequence}
                      </p>
                    </div>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', height: 'fit-content',
                      background: config.actif ? '#e8f5e9' : '#ffebee',
                      color: config.actif ? '#2e7d32' : '#c62828'
                    }}>
                      {config.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  {config.dernierBackup && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#999' }}>
                      Dernier backup: {new Date(config.dernierBackup).toLocaleString('fr-FR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <h4>Historique des Sauvegardes</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Format</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {backupJobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{new Date(job.createdAt).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '10px' }}>{job.type}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{job.format?.toUpperCase()}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px',
                      background: job.statut === 'completed' ? '#e8f5e9' : job.statut === 'failed' ? '#ffebee' : '#fff3e0',
                      color: job.statut === 'completed' ? '#2e7d32' : job.statut === 'failed' ? '#c62828' : '#f57c00'
                    }}>
                      {job.statut}
                    </span>
                  </td>
                </tr>
              ))}
              {backupJobs.length === 0 && (
                <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Aucun backup effectué</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showApiKeyModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '90%', maxWidth: '500px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Nouvelle Clé API</h3>
            
            {newApiKey ? (
              <div>
                <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px', marginBottom: '20px' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#f57c00' }}>Clé générée avec succès!</p>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Copiez cette clé maintenant, elle ne sera plus affichée.</p>
                  <code style={{ display: 'block', padding: '10px', background: '#f5f5f5', borderRadius: '4px', wordBreak: 'break-all', fontSize: '13px' }}>
                    {newApiKey.apiKey}
                  </code>
                </div>
                <Button onClick={() => { setShowApiKeyModal(false); setNewApiKey(null); }}>Fermer</Button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom de la clé</label>
                  <input
                    type="text"
                    value={formApiKey.nom}
                    onChange={e => setFormApiKey({ ...formApiKey, nom: e.target.value })}
                    placeholder="Ex: Application mobile, ERP externe..."
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Permissions</label>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="checkbox"
                        checked={formApiKey.permissions.includes('read')}
                        onChange={e => {
                          const perms = e.target.checked
                            ? [...formApiKey.permissions, 'read']
                            : formApiKey.permissions.filter(p => p !== 'read');
                          setFormApiKey({ ...formApiKey, permissions: perms });
                        }}
                      />
                      Lecture
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="checkbox"
                        checked={formApiKey.permissions.includes('write')}
                        onChange={e => {
                          const perms = e.target.checked
                            ? [...formApiKey.permissions, 'write']
                            : formApiKey.permissions.filter(p => p !== 'write');
                          setFormApiKey({ ...formApiKey, permissions: perms });
                        }}
                      />
                      Écriture
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setShowApiKeyModal(false)}>Annuler</Button>
                  <Button onClick={handleCreateApiKey} disabled={!formApiKey.nom}>Créer</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showWebhookModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '90%', maxWidth: '600px', padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Nouveau Webhook</h3>
            
            {newWebhookSecret ? (
              <div>
                <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px', marginBottom: '20px' }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#f57c00' }}>Webhook créé avec succès!</p>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>Utilisez ce secret pour vérifier les signatures HMAC:</p>
                  <code style={{ display: 'block', padding: '10px', background: '#f5f5f5', borderRadius: '4px', wordBreak: 'break-all', fontSize: '13px' }}>
                    {newWebhookSecret.secret}
                  </code>
                </div>
                <Button onClick={() => { setShowWebhookModal(false); setNewWebhookSecret(null); }}>Fermer</Button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom</label>
                  <input
                    type="text"
                    value={formWebhook.nom}
                    onChange={e => setFormWebhook({ ...formWebhook, nom: e.target.value })}
                    placeholder="Ex: Mon serveur de backup"
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>URL de destination</label>
                  <input
                    type="url"
                    value={formWebhook.url}
                    onChange={e => setFormWebhook({ ...formWebhook, url: e.target.value })}
                    placeholder="https://votre-serveur.com/webhook"
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Événements à recevoir</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {availableEvents.map(event => (
                      <label key={event} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                        <input
                          type="checkbox"
                          checked={formWebhook.evenements.includes(event)}
                          onChange={e => {
                            const events = e.target.checked
                              ? [...formWebhook.evenements, event]
                              : formWebhook.evenements.filter(ev => ev !== event);
                            setFormWebhook({ ...formWebhook, evenements: events });
                          }}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setShowWebhookModal(false)}>Annuler</Button>
                  <Button onClick={handleCreateWebhook} disabled={!formWebhook.nom || !formWebhook.url}>Créer</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showBackupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '8px', width: '90%', maxWidth: '500px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Configuration de Sauvegarde</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nom</label>
              <input
                type="text"
                value={formBackup.nom}
                onChange={e => setFormBackup({ ...formBackup, nom: e.target.value })}
                placeholder="Ex: Backup quotidien"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Destination</label>
              <select
                value={formBackup.destination}
                onChange={e => setFormBackup({ ...formBackup, destination: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="url">URL (Webhook POST)</option>
                <option value="sftp">SFTP</option>
                <option value="s3">Amazon S3</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>URL / Endpoint</label>
              <input
                type="text"
                value={formBackup.configDestination.url || ''}
                onChange={e => setFormBackup({ ...formBackup, configDestination: { ...formBackup.configDestination, url: e.target.value } })}
                placeholder="https://votre-serveur.com/backup"
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Format</label>
                <select
                  value={formBackup.format}
                  onChange={e => setFormBackup({ ...formBackup, format: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fréquence</label>
                <select
                  value={formBackup.frequence}
                  onChange={e => setFormBackup({ ...formBackup, frequence: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowBackupModal(false)}>Annuler</Button>
              <Button onClick={handleCreateBackup} disabled={!formBackup.nom || !formBackup.configDestination.url}>Créer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
