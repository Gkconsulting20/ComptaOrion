import React from 'react';

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, size = 'medium' }) {
  const variants = {
    primary: {
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
    },
    secondary: {
      backgroundColor: '#95a5a6',
      color: 'white',
      border: 'none',
    },
    danger: {
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
    },
    success: {
      backgroundColor: '#27ae60',
      color: 'white',
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: '#3498db',
      border: '1px solid #3498db',
    },
  };

  const sizes = {
    small: { padding: '6px 12px', fontSize: '12px' },
    medium: { padding: '10px 20px', fontSize: '14px' },
    large: { padding: '14px 28px', fontSize: '16px' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontWeight: '500',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}
