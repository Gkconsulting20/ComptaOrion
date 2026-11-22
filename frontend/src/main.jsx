import React from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';

const root = createRoot(document.getElementById('root'));
import('./App.jsx').then(({ default: App }) => {
  root.render(<App />);
});
