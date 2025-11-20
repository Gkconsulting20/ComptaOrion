import React from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';

function App() {
  const [backendStatus, setBackendStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setBackendStatus(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Backend connection error:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>ComptaOrion</h1>
        <p>Accounting Application</p>
      </header>
      <main className="main">
        <div className="status-card">
          <h2>System Status</h2>
          {loading ? (
            <p>Checking backend connection...</p>
          ) : backendStatus ? (
            <div className="status-ok">
              <p>✓ Backend: {backendStatus.message}</p>
            </div>
          ) : (
            <div className="status-error">
              <p>✗ Backend connection failed</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
