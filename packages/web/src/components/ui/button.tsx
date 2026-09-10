'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-sm shadow-primary-600/25 hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/25 focus-visible:ring-primary-500',
  secondary:
    'bg-secondary-600 text-white shadow-sm shadow-secondary-600/25 hover:bg-secondary-700 hover:shadow-md hover:shadow-secondary-600/25 focus-visible:ring-secondary-500',
  outline:
    'border border-gray-200 bg-surface text-content-default shadow-sm hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700 focus-visible:ring-primary-400',
  ghost:
    'bg-transparent text-content-default hover:bg-gray-100 hover:text-primary-700 focus-visible:ring-gray-400',
  danger:
    'bg-red-600 text-white shadow-sm shadow-red-600/25 hover:bg-red-700 hover:shadow-md hover:shadow-red-600/25 focus-visible:ring-red-500',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = '', variant = 'primary', size = 'md', isLoading, disabled, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
export default Button;
