'use client';

import Link from 'next/link';
import Card from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/types';

const PLACEHOLDERS: Array<{ title: string; desc: string; href?: string }> = [
  { title: 'Menu Management', desc: 'Create categories & items — arrives Week 7.', href: '/dashboard/menu' },
  { title: 'Inventory', desc: 'Stock levels, suppliers & transactions — Week 7–8.' },
  { title: 'Kitchen Display', desc: 'Live order queue for the pass — Week 8.', href: '/dashboard/kitchen' },
  { title: 'Reports', desc: 'Sales & waste analytics — Phase 3.' },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Good day, {user?.firstName ?? 'there'} 👋
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Signed in as <RoleBadge role={user?.role} /> · Workspace {user?.tenantId?.slice(0, 8)}…
        </p>
      </div>

      <Card>
        <h2 className="font-semibold">System status</h2>
        <ul className="mt-2 space-y-1 text-sm text-content-muted">
          <li>✅ Authentication live (login, refresh rotation, RBAC)</li>
          <li>🚧 Feature modules arrive from Week 7 onward</li>
        </ul>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLACEHOLDERS.map((p) => {
          const body = (
            <>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-content-muted">{p.desc}</p>
            </>
          );
          return p.href ? (
            <Link key={p.title} href={p.href} className="transition-shadow hover:shadow-card">
              <Card>{body}</Card>
            </Link>
          ) : (
            <Card key={p.title} className="opacity-70">{body}</Card>
          );
        })}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role?: UserRole }) {
  return (
    <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700">
      {role ?? '—'}
    </span>
  );
}
