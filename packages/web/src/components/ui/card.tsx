import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds standard padding inside the card (default true) */
  padded?: boolean;
}

/** Surface card using the theme's radius/shadow tokens */
export default function Card({ padded = true, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-card shadow-card border border-gray-100 bg-surface
        ${padded ? 'p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
