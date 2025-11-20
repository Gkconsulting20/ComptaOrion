import { useState, useEffect } from 'react';

function App() {
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBackend = () => {
      fetch('/api/health')
        .then(res => {
          if (!res.ok) throw new Error('Backend responded with error');
          return res.json();
        })
        .then(data => {
          setBackendStatus(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Backend connection error:', err);
          setTimeout(checkBackend, 2000);
        });
    };
    
    setTimeout(checkBackend, 1000);
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

export default App;
