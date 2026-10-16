import React from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';

const root = createRoot(document.getElementById('root'));
import('./App.jsx').then(({ default: App }) => {
  root.render(<App />);
});

// Retirer uniquement l'ancien cache Lite de CETTE origine, jamais les données
// IndexedDB ni les sessions : Lite est désormais hébergé dans un autre projet.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async registrations => {
    for (const registration of registrations) {
      const worker = registration.active || registration.waiting || registration.installing;
      if (worker && new URL(worker.scriptURL).pathname === '/sw.js') {
        await registration.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('orion-lite-shell-'))
        .map(key => caches.delete(key)));
    }
  }).catch(error => console.warn('Nettoyage du cache Lite non terminé:', error));
}
