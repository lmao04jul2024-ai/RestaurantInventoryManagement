'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Accessible labeled input with error display.
 * Pairs with react-hook-form via register() spread.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? `input-${generatedId}`;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-content-default">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`block w-full rounded border bg-surface px-3.5 py-2.5 text-sm shadow-sm
            placeholder:text-gray-400 transition-colors
            focus:outline-none focus:ring-4
            ${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15'
              : 'border-gray-200 hover:border-gray-300 focus:border-primary-500 focus:ring-primary-500/15'}
            ${className}`}
          {...props}
        />
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-content-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
