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

/** Week 16.1/16.2 — role-specific quick links (the API RBAC matrix stays the boundary). */
const ROLE_LINKS: Record<UserRole, QuickLink[]> = {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good day, {user?.firstName ?? 'there'} 👋</h1>
        <p className="mt-1 text-sm text-content-muted">
          Your {role.toLowerCase()} workspace — quick links below are tailored to your role.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="transition-shadow hover:shadow-card">
            <Card>
              <span aria-hidden className="text-xl">{link.icon}</span>
              <h2 className="mt-2 font-semibold">{link.label}</h2>
              <p className="mt-1 text-sm text-content-muted">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
