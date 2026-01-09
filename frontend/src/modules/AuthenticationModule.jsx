import React, { useState, useEffect } from 'react';
import api from '../api';

export function AuthenticationModule() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    statut: '',
    dateDebut: '',
    dateFin: ''
  });

  const TABS = [
    { id: 'sessions', label: 'Sessions Actives', icon: '🔐' },
    { id: 'permissions', label: 'Permissions RBAC', icon: '🔑' },
    { id: 'audit', label: 'Audit Connexions', icon: '📋' }
  ];

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions();
    } else if (activeTab === 'permissions') {
      loadPermissions();
    } else if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.get('/auth-security/sessions');
      setSessions(Array.isArray(data) ? data : (data.sessions || []));
    } catch (error) {
      console.error('Erreur chargement sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await api.get('/auth-security/permissions');
      setPermissions(Array.isArray(data) ? data : (data.permissions || []));
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.statut) params.append('statut', filters.statut);
      if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
      if (filters.dateFin) params.append('dateFin', filters.dateFin);
      
      const data = await api.get(`/auth-security/audit?${params}`);
      setAuditLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (error) {
      console.error('Erreur chargement audit:', error);
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId) => {
    if (!confirm('Voulez-vous vraiment révoquer cette session?')) return;
    
    try {
      await api.delete(`/auth-security/sessions/${sessionId}`);
      alert('Session révoquée avec succès');
      loadSessions();
    } catch (error) {
      alert('Erreur lors de la révocation: ' + error.message);
    }
  };

  const updatePermission = async (permissionId, updates) => {
    try {
      await api.put(`/auth-security/permissions/${permissionId}`, updates);
      alert('Permission mise à jour');
      loadPermissions();
    } catch (error) {
      alert('Erreur: ' + error.message);
    }
  };

  const renderSessions = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Sessions Actives</h3>
        <button
          onClick={loadSessions}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Utilisateur</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>User Agent</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Créée le</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Expire le</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  Aucune session active
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{session.id}</td>
                  <td style={{ padding: '12px' }}>{session.userId}</td>
                  <td style={{ padding: '12px' }}>{session.ipAddress}</td>
                  <td style={{ padding: '12px', fontSize: '12px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.userAgent}
                  </td>
                  <td style={{ padding: '12px' }}>{new Date(session.createdAt).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>{new Date(session.expiresAt).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>
                    <button
                      onClick={() => revokeSession(session.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Révoquer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderPermissions = () => (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Gestion des Permissions (RBAC)</h3>
        <button
          onClick={loadPermissions}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Rôle</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Module</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Lecture</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Écriture</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Suppression</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Admin</th>
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  Aucune permission configurée
                </td>
              </tr>
            ) : (
              permissions.map((perm) => (
                <tr key={perm.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{perm.role}</td>
                  <td style={{ padding: '12px' }}>{perm.module}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={perm.canRead}
                      onChange={(e) => updatePermission(perm.id, { canRead: e.target.checked })}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={perm.canWrite}
                      onChange={(e) => updatePermission(perm.id, { canWrite: e.target.checked })}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={perm.canDelete}
                      onChange={(e) => updatePermission(perm.id, { canDelete: e.target.checked })}
                    />
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={perm.canAdmin}
                      onChange={(e) => updatePermission(perm.id, { canAdmin: e.target.checked })}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderAudit = () => (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3>Historique des Connexions</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Tous les types</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="failed_login">Tentatives échouées</option>
            <option value="token_refresh">Refresh Token</option>
          </select>

          <select
            value={filters.statut}
            onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Tous les statuts</option>
            <option value="success">Succès</option>
            <option value="failed">Échec</option>
          </select>

          <input
            type="date"
            value={filters.dateDebut}
            onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
            placeholder="Date début"
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />

          <input
            type="date"
            value={filters.dateFin}
            onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
            placeholder="Date fin"
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />

          <button
            onClick={loadAuditLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔍 Filtrer
          </button>
        </div>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date/Heure</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Utilisateur</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>IP Address</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Statut</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Raison</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                  Aucun log trouvé
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{new Date(log.createdAt).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: log.type === 'login' ? '#d4edda' : log.type === 'logout' ? '#fff3cd' : '#f8d7da',
                      color: log.type === 'login' ? '#155724' : log.type === 'logout' ? '#856404' : '#721c24'
                    }}>
                      {log.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{log.userId || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{log.ipAddress}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: log.statut === 'success' ? '#d4edda' : '#f8d7da',
                      color: log.statut === 'success' ? '#155724' : '#721c24'
                    }}>
                      {log.statut}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{log.raison || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '20px' }}>🔐 Module d'Authentification & Sécurité</h2>

      <div style={{ borderBottom: '2px solid #e0e0e0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #3498db' : '3px solid transparent',
                backgroundColor: activeTab === tab.id ? '#f8f9fa' : 'transparent',
                color: activeTab === tab.id ? '#3498db' : '#6c757d',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.3s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'sessions' && renderSessions()}
        {activeTab === 'permissions' && renderPermissions()}
        {activeTab === 'audit' && renderAudit()}
      </div>
    </div>
  );
}
