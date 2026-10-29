import React from 'react';

const ICONS = {
  dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>,
  'saas-admin': <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  clients: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.4-3.1 2.4-4.8 5.5-4.8s5.1 1.7 5.5 4.8" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17 14.5c2 .5 3.2 2 3.5 4.5" /></>,
  fournisseurs: <><path d="M3 6.5h11v11H3z" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="1.7" /><circle cx="18" cy="18" r="1.7" /></>,
  tresorerie: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M15.5 14h2" /><path d="M6 5V3.5h12V5" /></>,
  stock: <><path d="m12 3 8.5 4.6v8.8L12 21l-8.5-4.6V7.6L12 3Z" /><path d="m3.8 7.8 8.2 4.5 8.2-4.5M12 12.3V21M8 5.2l8.4 4.7" /></>,
  comptabilite: <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></>,
  associations: <><circle cx="8" cy="8" r="2.6" /><circle cx="16" cy="8" r="2.6" /><path d="M3.5 19c.3-2.8 1.8-4.2 4.5-4.2 1.7 0 3 .6 3.8 1.8M20.5 19c-.3-2.8-1.8-4.2-4.5-4.2-1.7 0-3 .6-3.8 1.8" /><path d="m10 12 2 2 2-2" /></>,
  impots: <><path d="M3 9h18L12 4 3 9ZM5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
  integrations: <><path d="m9.5 14.5 5-5M7 16.8l-1.4 1.4a3.4 3.4 0 0 1-4.8-4.8l4-4a3.4 3.4 0 0 1 4.8 0M17 7.2l1.4-1.4a3.4 3.4 0 0 1 4.8 4.8l-4 4a3.4 3.4 0 0 1-4.8 0" /></>,
  'ia-assistant': <><path d="m12 3 1.4 5.2L19 10l-5.6 1.8L12 17l-1.5-5.2L5 10l5.5-1.8L12 3ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></>,
  authentication: <><path d="M12 3 19 6v5.1c0 4.4-2.8 7.9-7 9.9-4.2-2-7-5.5-7-9.9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  parametres: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="7" cy="18" r="2" fill="white" /></>,
  'trend-up': <><path d="m4 16 5-5 4 3 7-8" /><path d="M14 6h6v6" /></>,
  'trend-down': <><path d="m4 8 5 5 4-3 7 8" /><path d="M14 18h6v-6" /></>,
  chart: <><path d="M4 20V5M4 20h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
  wallet: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M15.5 14h2" /></>,
  invoice: <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
  rotation: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></>,
  inventory: <><path d="M4 19V5M4 19h16" /><rect x="7" y="12" width="3" height="5" rx=".5" /><rect x="12" y="9" width="3" height="8" rx=".5" /><rect x="17" y="6" width="3" height="11" rx=".5" /></>,
  cost: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h2M7 14h1M16 12h1" /><circle cx="12" cy="12" r="2.5" /></>,
  supplier: <><path d="M3 6.5h11v11H3z" /><path d="M14 10h4l3 3v4h-7z" /><circle cx="7" cy="18" r="1.7" /><circle cx="18" cy="18" r="1.7" /></>
};

export default function OrionIcon({ name, size = 17, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
