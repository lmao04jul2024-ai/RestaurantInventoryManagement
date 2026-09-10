'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

export interface SidebarSection {
  title?: string;
  items: Array<{ label: string; href: string; icon?: ReactNode; roles?: UserRole[] }>;
}

/** Admin/staff navigation. Items can be role-gated per the RBAC matrix. */
const NAV: SidebarSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      {
        label: 'Menu',
        href: '/dashboard/menu',
        icon: '📋',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Inventory',
        href: '/dashboard/inventory',
        icon: '📦',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Orders',
        href: '/dashboard/orders',
        icon: '🧾',
        roles: ['ADMIN', 'MANAGER', 'SERVER'],
      },
      {
        label: 'Analytics',
        href: '/dashboard/analytics',
        icon: '📈',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Reviews',
        href: '/dashboard/reviews',
        icon: '⭐',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Feature Flags',
        href: '/dashboard/features',
        icon: '🎛️',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Customize',
        href: '/dashboard/customize',
        icon: '🎨',
        roles: ['ADMIN'],
      },
      {
        label: 'Settings',
        href: '/dashboard/tenants',
        icon: '⚙️',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Staff',
        href: '/dashboard/staff',
        icon: '👥',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        label: 'Audit Log',
        href: '/dashboard/audit',
        icon: '📋',
        roles: ['ADMIN'],
      },
      {
        label: 'Security',
        href: '/dashboard/security',
        icon: '🛡️',
        roles: ['ADMIN'],
      },
      {
        label: 'Kitchen Display',
        href: '/dashboard/kitchen',
        icon: '👨‍🍳',
        roles: ['ADMIN', 'MANAGER', 'KITCHEN'],
      },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-100 bg-surface lg:block">
      <nav className="sticky top-16 space-y-6 p-4" aria-label="Main navigation">
        {NAV.map((section, i) => (
          <ul key={i} className="space-y-1">
            {section.title && (
              <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
                {section.title}
              </li>
            )}
            <SidebarItems items={section.items} />
          </ul>
        ))}
      </nav>
    </aside>
  );
}

function SidebarItems({
  items,
}: {
  items: SidebarSection['items'];
}) {
  const pathname = usePathname();
  // Client-side filtering is UX-only convenience — the API's RBAC middleware
  // remains the actual access-control boundary.
  const userRole = useAuthStore((s) => s.user?.role);

  return (
    <>
      {items
        .filter((item) => !item.roles || !userRole || item.roles.includes(userRole))
        .map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors
                  ${active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-content-default hover:bg-surface-muted'}`}
              >
                {item.icon && <span aria-hidden>{item.icon}</span>}
                {item.label}
              </Link>
            </li>
          );
        })}
    </>
  );
}
