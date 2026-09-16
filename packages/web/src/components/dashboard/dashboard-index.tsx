'use client';

import Link from 'next/link';
import Card from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types';

interface QuickLink {
  label: string;
  desc: string;
  href: string;
  icon: string;
}

/**
 * Week 16.1/16.2 — role-specific quick links (the API RBAC matrix stays the boundary).
 * Phase 5 S2.1 — PLATFORM_ADMIN is a cross-tenant operator role: its links point
 * at the operator console rather than any single tenant's dashboard.
 */
const ROLE_LINKS: Record<UserRole, QuickLink[]> = {
  PLATFORM_ADMIN: [
    { label: 'Tenants', desc: 'All workspaces, plans & usage', href: '/platform/tenants', icon: '🏢' },
  ],
  ADMIN: [
    { label: 'Menu', desc: 'Categories, items & pricing', href: '/dashboard/menu', icon: '📋' },
    { label: 'Inventory', desc: 'Stock, suppliers & purchase orders', href: '/dashboard/inventory', icon: '📦' },
    { label: 'Orders', desc: 'Live order workflow & payments', href: '/dashboard/orders', icon: '🧾' },
    { label: 'Staff', desc: 'Team, roles & permission overrides', href: '/dashboard/staff', icon: '👥' },
    { label: 'Feature Flags', desc: 'Per-restaurant feature toggles', href: '/dashboard/features', icon: '🎛️' },
    { label: 'Analytics', desc: 'Sales, inventory & customer reports', href: '/dashboard/analytics', icon: '📈' },
    { label: 'Customize', desc: 'Theme, branding & live preview', href: '/dashboard/customize', icon: '🎨' },
    { label: 'Settings', desc: 'Profile, config & billing', href: '/dashboard/tenants', icon: '⚙️' },
    { label: 'Audit Log', desc: 'Permission & role change trail', href: '/dashboard/audit', icon: '📜' },
    { label: 'Kitchen Display', desc: 'Live queue for the pass', href: '/dashboard/kitchen', icon: '👨‍🍳' },
  ],
  MANAGER: [
    { label: 'Menu', desc: 'Categories, items & pricing', href: '/dashboard/menu', icon: '📋' },
    { label: 'Inventory', desc: 'Stock, suppliers & purchase orders', href: '/dashboard/inventory', icon: '📦' },
    { label: 'Orders', desc: 'Live order workflow & payments', href: '/dashboard/orders', icon: '🧾' },
    { label: 'Staff', desc: 'Team directory & onboarding', href: '/dashboard/staff', icon: '👥' },
    { label: 'Feature Flags', desc: 'Per-restaurant feature toggles', href: '/dashboard/features', icon: '🎛️' },
    { label: 'Analytics', desc: 'Sales, inventory & customer reports', href: '/dashboard/analytics', icon: '📈' },
    { label: 'Settings', desc: 'Profile, config & billing', href: '/dashboard/tenants', icon: '⚙️' },
  ],
  SERVER: [
    { label: 'Orders', desc: 'Take & track table orders', href: '/dashboard/orders', icon: '🧾' },
    { label: 'Kitchen Display', desc: 'Live queue for the pass', href: '/dashboard/kitchen', icon: '👨‍🍳' },
  ],
  KITCHEN: [
    { label: 'Kitchen Display', desc: 'Live queue for the pass', href: '/dashboard/kitchen', icon: '👨‍🍳' },
    { label: 'Inventory', desc: 'Stock levels & adjustments', href: '/dashboard/inventory', icon: '📦' },
  ],
  CUSTOMER: [
    { label: 'Menu', desc: 'Browse & order online', href: '/menu', icon: '🍽️' },
    { label: 'My Orders', desc: 'Track your orders', href: '/orders', icon: '🧾' },
  ],
};

export default function DashboardIndex() {
  const { user } = useAuth();
  const role = user?.role ?? 'SERVER';
  const links = ROLE_LINKS[role] ?? [];

  return (
    <div className="space-y-8">
      {/* Warm hero band */}
      <section
        className="relative overflow-hidden rounded-card shadow-lg animate-slide-up bg-primary-600"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 85% 15%, white 0%, transparent 45%)' }}
        />
        <div className="relative px-6 py-10 text-white sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider opacity-80">Restaurant Manager</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Good day, {user?.firstName ?? 'there'} 👋</h1>
          <p className="mt-2 max-w-lg opacity-90">
            Your {role.toLowerCase()} workspace — quick links below are tailored to your role.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {links.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-card animate-slide-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
          >
            <Card hoverable>
              <span
                aria-hidden
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-xl transition-transform duration-200 group-hover:scale-110"
              >
                {link.icon}
              </span>
              <h2 className="mt-3 font-semibold text-content-default">{link.label}</h2>
              <p className="mt-1 text-sm text-content-muted">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
