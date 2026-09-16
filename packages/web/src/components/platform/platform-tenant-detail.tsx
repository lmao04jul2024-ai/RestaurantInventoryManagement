'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Alert from '@/components/ui/alert';
import { usePlatformTenant, useUpdatePlatformTenant } from '@/hooks/use-platform';
import { getApiErrorMessage } from '@/lib/api';
import type { PlanTier, PlatformTenantUpdatePayload, SubscriptionStatus } from '@/types/platform';

/**
 * Phase 5 S2.4 — operator console: one workspace's usage and commercial state.
 *
 * Manual billing: the operator records the outcome of an offline payment here
 * (plan, subscription status, seat limit, suspension). Every change is
 * audit-logged server-side and replayed below in the change history, so a
 * billing dispute is settled from our own immutable records.
 */

const PLANS: PlanTier[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
const STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'];

const SELECT_CLS =
  'block w-full rounded border border-gray-300 bg-surface px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';

/** Human labels for the fields the audit trail can contain. */
const FIELD_LABELS: Record<string, string> = {
  plan: 'Plan',
  subscriptionStatus: 'Subscription',
  seatsLimit: 'Seat limit',
  isActive: 'Workspace active',
};

interface CommercialForm {
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  seatsLimit: string;
  isActive: boolean;
}

export default function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const { data: tenant, isLoading, isError } = usePlatformTenant(tenantId);
  const save = useUpdatePlatformTenant(tenantId);
  const [form, setForm] = useState<CommercialForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The query owns the source of truth: re-seed the editor whenever a save (or
  // a background refetch) returns fresh commercial state.
  useEffect(() => {
    if (!tenant) return;
    setForm({
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      seatsLimit: String(tenant.seatsLimit),
      isActive: tenant.isActive,
    });
  }, [tenant]);

  const set = <K extends keyof CommercialForm>(key: K, value: CommercialForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };

  if (isLoading) return <p className="text-sm text-content-muted">Loading workspace…</p>;

  if (isError || !tenant || !form) {
    return (
      <div className="space-y-4">
        <Alert tone="error">Could not load this workspace</Alert>
        <Link href="/platform/tenants" className="text-sm text-primary-600 hover:underline">
          ← Back to workspaces
        </Link>
      </div>
    );
  }

  const seatsUsed = tenant.billing.seatsUsed;
  const seatsLimit = tenant.billing.seatsLimit;
  const seatsPct = seatsLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatsLimit) * 100)) : 0;

  // Only CHANGED fields are sent — the API audits a diff, so a no-op save would
  // write nothing (and the button is disabled for it anyway).
  const payload: PlatformTenantUpdatePayload = {};
  if (form.plan !== tenant.plan) payload.plan = form.plan;
  if (form.subscriptionStatus !== tenant.subscriptionStatus) {
    payload.subscriptionStatus = form.subscriptionStatus;
  }
  const seats = Number(form.seatsLimit);
  if (Number.isInteger(seats) && seats !== tenant.seatsLimit) payload.seatsLimit = seats;
  if (form.isActive !== tenant.isActive) payload.isActive = form.isActive;
  const dirty = Object.keys(payload).length > 0;

  const onSave = async () => {
    setNotice(null);
    setError(null);
    if (!dirty) return;
    try {
      await save.mutateAsync(payload);
      setNotice('Saved — the change is recorded in the change history below.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/platform/tenants" className="text-sm text-primary-600 hover:underline">
            ← All workspaces
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{tenant.name}</h1>
          <p className="text-sm text-content-muted">
            /{tenant.slug} · {tenant.email ?? 'no contact email'} · joined{' '}
            {new Date(tenant.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            tenant.isActive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {tenant.isActive ? 'Active' : 'Suspended'}
        </span>
      </div>

      {!tenant.isActive && (
        <Alert tone="warning" title="Workspace suspended">
          Members can still sign in and open settings, but every other surface returns{' '}
          <code>403 WORKSPACE_INACTIVE</code>.
        </Alert>
      )}

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {/* Usage — the numbers the operator bills and seats against. */}
      <Card className="space-y-4">
        <p className="text-sm font-medium text-content-default">Usage</p>
        <div className="grid gap-4 text-sm sm:grid-cols-5">
          <div>
            <p className="text-content-muted">Seats</p>
            <p className="text-lg font-semibold">
              {seatsUsed} / {seatsLimit}
            </p>
          </div>
          <div>
            <p className="text-content-muted">Orders</p>
            <p className="text-lg font-semibold">{tenant._count?.orders ?? 0}</p>
          </div>
          <div>
            <p className="text-content-muted">Menus</p>
            <p className="text-lg font-semibold">{tenant._count?.menus ?? 0}</p>
          </div>
          <div>
            <p className="text-content-muted">Inventory items</p>
            <p className="text-lg font-semibold">{tenant._count?.inventory ?? 0}</p>
          </div>
          <div>
            <p className="text-content-muted">Suppliers</p>
            <p className="text-lg font-semibold">{tenant._count?.suppliers ?? 0}</p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            role="progressbar"
            aria-label="Seat usage"
            aria-valuenow={seatsPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-full rounded-full ${seatsPct >= 100 ? 'bg-red-500' : 'bg-primary-600'}`}
            style={{ width: `${seatsPct}%` }}
          />
        </div>
      </Card>

      {/* Commercial state — operator-only (manual billing: no processor). */}
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium text-content-default">Plan &amp; billing</p>
          <p className="mt-0.5 text-xs text-content-muted">
            Payments are collected offline. Record the outcome here — every change is written to the
            workspace&apos;s audit trail.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">Plan</span>
            <select
              value={form.plan}
              onChange={(e) => set('plan', e.target.value as PlanTier)}
              disabled={save.isPending}
              className={SELECT_CLS}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">Subscription status</span>
            <select
              value={form.subscriptionStatus}
              onChange={(e) => set('subscriptionStatus', e.target.value as SubscriptionStatus)}
              disabled={save.isPending}
              className={SELECT_CLS}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Seat limit"
            type="number"
            min={seatsUsed}
            value={form.seatsLimit}
            hint={`${seatsUsed} in use — the limit cannot go below current usage`}
            onChange={(e) => set('seatsLimit', e.target.value)}
            disabled={save.isPending}
          />
          <label className="flex items-end gap-2 pb-2.5 text-sm text-content-default">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              disabled={save.isPending}
              className="h-4 w-4 accent-primary-600"
            />
            Workspace active
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => void onSave()} isLoading={save.isPending} disabled={!dirty}>
            Save changes
          </Button>
          {!dirty && <span className="text-xs text-content-muted">No changes to save</span>}
        </div>
      </Card>

      {/* Change history — the manual-billing ledger, straight from the audit log. */}
      <Card className="space-y-3">
        <div>
          <p className="text-sm font-medium text-content-default">Change history</p>
          <p className="mt-0.5 text-xs text-content-muted">
            The last {tenant.recentChanges.length} operator change
            {tenant.recentChanges.length === 1 ? '' : 's'} to this workspace, newest first.
          </p>
        </div>
        {tenant.recentChanges.length === 0 ? (
          <p className="text-sm text-content-muted">No operator changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50 text-sm">
            {tenant.recentChanges.map((entry) => (
              <li key={entry.id} className="py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {Object.keys(entry.metadata?.changes ?? {})
                      .map((field) => FIELD_LABELS[field] ?? field)
                      .join(', ') || 'Workspace updated'}
                  </p>
                  <time dateTime={entry.createdAt} className="text-xs text-content-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-content-muted">
                  {Object.entries(entry.metadata?.changes ?? {}).map(([field, change]) => (
                    <li key={field}>
                      {FIELD_LABELS[field] ?? field}:{' '}
                      <span className="font-medium text-content-default">
                        {`${String(change.from)} → ${String(change.to)}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-content-muted">by {entry.actorId}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
