import React, { useState } from 'react';
import './app.css';
import { DashboardView } from './Dashboard.jsx';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">
          <h1>🌟 ComptaOrion</h1>
        </div>
        <nav className="nav-menu">
          <div className="nav-item active">
            📊 Tableau de Bord
          </div>
        </nav>
        <div className="status-bar">
          <span className={`status-indicator ${backendStatus === 'connected' ? 'connected' : 'disconnected'}`}></span>
          <span>{backendStatus === 'connected' ? 'Connecté' : 'Déconnecté'}</span>
        </div>
      </div>

      <main className="main-content">
        <div className="topbar">
          <h2>📊 Tableau de Bord</h2>
          <div className="user-menu">
            <span className="user-name">Admin</span>
          </div>
        </div>
        <div className="content">
          <DashboardView />
        </div>
      </main>
    </div>
  );
}
