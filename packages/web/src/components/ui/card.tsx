import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds standard padding inside the card (default true) */
  padded?: boolean;
  /** Adds an interactive hover lift (for clickable cards) */
  hoverable?: boolean;
}

/** Surface card using the theme's radius/shadow tokens */
export default function Card({
  padded = true,
  hoverable = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-card shadow-card border border-gray-100 bg-surface
        ${hoverable
          ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg'
          : ''}
        ${padded ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
