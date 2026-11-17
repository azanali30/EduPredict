import React, { InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  helperText,
  isPassword = false,
  id,
  type = 'text',
  style,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--primary-navy)',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={inputId}
          type={effectiveType}
          style={{
            width: '100%',
            padding: '0.65rem 0.85rem',
            paddingRight: isPassword ? '2.5rem' : '0.85rem',
            fontSize: '0.9rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--status-danger)' : 'var(--border-light)'}`,
            backgroundColor: '#ffffff',
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            ...style,
          }}
          onFocus={(e) => {
            if (!error) e.target.style.borderColor = 'var(--brand-blue)';
            e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)';
          }}
          onBlur={(e) => {
            if (!error) e.target.style.borderColor = 'var(--border-light)';
            e.target.style.boxShadow = 'none';
          }}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem',
            }}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--status-danger)', fontWeight: 500 }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
