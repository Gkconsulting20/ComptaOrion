import React from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
const isLite = window.location.pathname.startsWith('/lite');
Promise.all([
  isLite ? import('./LiteApp.jsx') : import('./App.jsx'),
  ...(isLite ? [] : [import('./app.css')]),
]).then(([{ default: App }]) => {
  root.render(<App />);
});
