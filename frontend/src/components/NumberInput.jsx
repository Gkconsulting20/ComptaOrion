import React, { useEffect, useRef, useState } from 'react';
import {
  formatLocalizedNumber,
  normalizeLocalizedNumber,
  numberForEditing,
} from '../utils/localizedNumber.js';

function makeValueEvent(event, value) {
  return {
    target: {
      name: event.currentTarget.name,
      value,
    },
    currentTarget: event.currentTarget,
  };
}

export function NumberInput({
  value,
  onChange,
  onFocus,
  onBlur,
  min,
  max,
  step,
  minimumFractionDigits,
  maximumFractionDigits,
  inputMode = 'decimal',
  ...inputProps
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() =>
    formatLocalizedNumber(value, { step, minimumFractionDigits, maximumFractionDigits }),
  );

  useEffect(() => {
    if (!focused) {
      setDraft(formatLocalizedNumber(value, { step, minimumFractionDigits, maximumFractionDigits }));
    }
  }, [value, focused, step, minimumFractionDigits, maximumFractionDigits]);

  const updateValidity = (normalized) => {
    const input = inputRef.current;
    if (!input) return true;
    if (normalized == null || normalized === '' || normalized === '-') {
      input.setCustomValidity('');
      return true;
    }

    const number = Number(normalized);
    let message = '';
    if (Number.isFinite(number) && min != null && number < Number(min)) {
      message = `La valeur doit être au moins ${min}.`;
    } else if (Number.isFinite(number) && max != null && number > Number(max)) {
      message = `La valeur doit être au plus ${max}.`;
    } else if (Number.isFinite(number) && step != null && step !== 'any' && Number(step) > 0) {
      const base = min == null ? 0 : Number(min);
      const quotient = (number - base) / Number(step);
      if (Math.abs(quotient - Math.round(quotient)) > 1e-7) {
        message = `Utilisez un multiple de ${step}.`;
      }
    }
    input.setCustomValidity(message);
    return !message;
  };

  const handleChange = (event) => {
    const nextDraft = event.currentTarget.value;
    const normalized = normalizeLocalizedNumber(nextDraft);
    setDraft(nextDraft);
    updateValidity(normalized);
    if (normalized != null) onChange?.(makeValueEvent(event, normalized));
  };

  const handleFocus = (event) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    const normalized = normalizeLocalizedNumber(event.currentTarget.value);
    const valueIsValid = updateValidity(normalized);
    setDraft(normalized == null
      ? formatLocalizedNumber(value, { step, minimumFractionDigits, maximumFractionDigits })
      : valueIsValid
        ? formatLocalizedNumber(normalized, { step, minimumFractionDigits, maximumFractionDigits })
        : numberForEditing(normalized));
    setFocused(false);
    onBlur?.(normalized == null ? event : makeValueEvent(event, normalized));
  };

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      autoComplete={inputProps.autoComplete || 'off'}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
