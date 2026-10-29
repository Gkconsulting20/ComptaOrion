import React from 'react';

export default function OrionLogo({ variant = 'full', className = '' }) {
  return (
    <div
      className={`orion-logo orion-logo--${variant} ${className}`.trim()}
      role="img"
      aria-label="ComptaOrion"
    >
      <img src="/logo-comptaorion.png" alt="" draggable="false" />
    </div>
  );
}
