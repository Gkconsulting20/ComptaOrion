import React from 'react';

export function FormField({ label, name, type = 'text', value, onChange, required = false, options = [], placeholder = '' }) {
  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
    marginTop: '5px',
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{
        display: 'block',
        fontWeight: '500',
        fontSize: '14px',
        marginBottom: '5px',
        color: '#495057',
      }}>
        {label} {required && <span style={{ color: '#e74c3c' }}>*</span>}
      </label>
      
      {type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          style={inputStyle}
        >
          <option value="">-- Sélectionner --</option>
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          rows={4}
          style={inputStyle}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}
    </div>
  );
}
