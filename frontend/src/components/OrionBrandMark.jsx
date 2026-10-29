import React from 'react';

export default function OrionBrandMark({ size = 54, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 42 42"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="40" height="40" rx="12" fill="#f6f2e8" />
      <path d="M12 11.5h13.5M12 17h8.5M12 22.5h13.5M12 28h8.5" stroke="#173d62" strokeWidth="2" strokeLinecap="round" />
      <path d="M28.5 11.5v16.8M28.5 19.8h4.7" stroke="#d8ad58" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="28.5" cy="11.5" r="2.4" fill="#e5bb69" />
      <circle cx="28.5" cy="28.3" r="2.4" fill="#e5bb69" />
      <circle cx="33.2" cy="19.8" r="1.5" fill="#173d62" />
    </svg>
  );
}
