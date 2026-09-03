'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTenant } from '@/hooks/use-tenant';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

/** Top bar with brand + current section indicator; mobile-first.
 *  Week 17.5 — renders the tenant logo when branding is published. */
export default function Header({ right }: { right?: ReactNode }) {
  const pathname = usePathname();
  const { data: tenant } = useTenant();
  const logoUrl = tenant?.theme?.branding?.logoUrl ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-surface px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-primary-700">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-7 w-7 rounded border border-gray-200 object-contain"
            />
          ) : (
            <span aria-hidden>🍽️</span>
          )}
          Restaurant Manager
        </Link>
        <nav aria-label="Breadcrumb" className="hidden text-sm text-content-muted sm:block">
          <span aria-hidden className="mr-2">/</span>
          <span className="capitalize">{pathname.split('/').filter(Boolean)[1] ?? 'dashboard'}</span>
        </nav>
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}
