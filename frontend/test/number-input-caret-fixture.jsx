import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NumberInput } from '../src/components/NumberInput.jsx';

function Harness() {
  const [value, setValue] = useState('1234.56');
  return (
    <div>
      <NumberInput
        aria-label="Montant à tester"
        value={value}
        step="0.01"
        onChange={(event) => setValue(event.target.value)}
      />
      <output id="stored-value">{value}</output>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
