import React from 'react';

export function Modal({ isOpen, onClose, title, children, size = 'medium' }) {
  if (!isOpen) return null;

  const sizes = {
    small: '400px',
    medium: '600px',
    large: '800px',
    xlarge: '1000px',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: sizes[size],
        maxWidth: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#999',
          }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
