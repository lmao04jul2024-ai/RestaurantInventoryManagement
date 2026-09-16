'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import { usePlatformTenants } from '@/hooks/use-platform';

/**
 * Phase 5 S2.4 — operator console: every workspace, its commercial state and
 * usage at a glance. Read-only: changes happen on the tenant detail page so
 * each one is audit-logged with intent.
 *
 * Manual billing: this screen replaces a billing dashboard — the operator
 * reconciles payments offline and records the outcome here.
 */

const LIMIT = 20;

/** A suspended or lapsed workspace is the operator's attention list. */
function needsAttention(tenant: { isActive: boolean; subscriptionStatus: string }): boolean {
  return (
    !tenant.isActive ||
    tenant.subscriptionStatus === 'PAST_DUE' ||
    tenant.subscriptionStatus === 'CANCELLED'
  );
}

export default function PlatformTenantsPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = usePlatformTenants({
    page,
    limit: LIMIT,
    ...(applied ? { search: applied } : {}),
  });

  const tenants = data?.data ?? [];
  const pagination = data?.pagination;
  const flagged = tenants.filter(needsAttention);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setApplied(search.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="mt-1 text-sm text-content-muted">
          Every restaurant on the platform. Plans, status and seat limits are managed here and
          audited.
        </p>
      </div>

      <Card className="space-y-4">
        <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-72">
            <Input
              label="Search"
              placeholder="Name or slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {applied && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch('');
                setApplied('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {isError && <Alert tone="error">Could not load workspaces</Alert>}

        {flagged.length > 0 && (
          <Alert tone="warning" title="Needs attention">
            {flagged.length} workspace{flagged.length === 1 ? '' : 's'} on this page{' '}
            {flagged.length === 1 ? 'is' : 'are'} suspended or lapsed:{' '}
            {flagged.map((t) => t.name).join(', ')}
          </Alert>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
              <tr>
                <th scope="col" className="py-2 pr-4">Workspace</th>
                <th scope="col" className="py-2 pr-4">Plan</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Seats</th>
                <th scope="col" className="py-2">Usage</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-content-muted">
                    Loading workspaces…
                  </td>
                </tr>
              )}
              {!isLoading && tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-content-muted">
                    No workspaces match this search.
                  </td>
                </tr>
              )}
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/platform/tenants/${tenant.id}`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {tenant.name}
                    </Link>
                    <p className="text-xs text-content-muted">/{tenant.slug}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-700">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        tenant.subscriptionStatus === 'ACTIVE'
                          ? 'text-green-700'
                          : tenant.subscriptionStatus === 'PAST_DUE'
                            ? 'text-amber-700'
                            : 'text-content-muted'
                      }
                    >
                      {tenant.subscriptionStatus}
                    </span>
                    {!tenant.isActive && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {tenant._count?.users ?? 0} / {tenant.seatsLimit}
                  </td>
                  <td className="py-3 pr-4 text-content-muted">
                    {tenant._count?.orders ?? 0} orders · {tenant._count?.menus ?? 0} menus ·{' '}
                    {tenant._count?.inventory ?? 0} items
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/platform/tenants/${tenant.id}`}
                      className="text-sm font-medium text-primary-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <p className="text-content-muted">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} workspaces
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

