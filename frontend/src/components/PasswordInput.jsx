import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import {
  getPasswordValidationErrors,
  PASSWORD_REQUIREMENTS_TEXT,
  formatPasswordErrors,
} from '../utils/passwordUtils';

/**
 * Password field with show/hide toggle, requirements hint, and inline validation errors.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
  showRequirements = true,
  showValidation = true,
  className = '',
  id,
  name,
  required = false,
  disabled = false,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);
  const errors = showValidation && value ? getPasswordValidationErrors(value) : [];

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:bg-gray-50 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </div>
      {showRequirements && (
        <p className="text-xs text-gray-600">{PASSWORD_REQUIREMENTS_TEXT}</p>
      )}
      {showValidation && value && errors.length > 0 && (
        <p className="text-xs text-red-600">{formatPasswordErrors(errors)}</p>
      )}
    </div>
  );
}
