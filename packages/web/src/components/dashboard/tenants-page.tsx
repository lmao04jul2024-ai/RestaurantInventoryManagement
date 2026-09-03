'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/button';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { useTenant, useTenantAnalytics, useUpdateTenant } from '@/hooks/use-tenant';
import { getApiErrorMessage } from '@/lib/api';
import type { OperatingHours, PlanTier, SubscriptionStatus, TenantProfile } from '@/types/tenant';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = (typeof DAYS)[number];

const PLANS: PlanTier[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
const STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'];
const WINDOWS = [7, 30, 90] as const;

const SELECT_CLS =
  'block w-full rounded border border-gray-300 bg-surface px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';
const TIME_CLS = 'rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50';

interface HoursRow {
  open: string;
  close: string;
  closed: boolean;
}

interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  timezone: string;
  currency: string;
  taxRate: string;
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  isActive: boolean;
  hours: Record<Day, HoursRow>;
}

/** A missing day means closed; unset times fall back to the house default. */
function toForm(tenant: TenantProfile): ProfileForm {
  const hours = {} as Record<Day, HoursRow>;
  for (const day of DAYS) {
    const row = tenant.operatingHours?.[day];
    hours[day] = { open: row?.open ?? '09:00', close: row?.close ?? '22:00', closed: !row };
  }
  return {
    name: tenant.name,
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    timezone: tenant.timezone,
    currency: tenant.currency,
    taxRate: String(tenant.taxRate),
    plan: tenant.plan,
    subscriptionStatus: tenant.subscriptionStatus,
    isActive: tenant.isActive,
    hours,
  };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-gray-100 bg-surface p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-content-default">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-content-muted">{sub}</p>}
    </div>
  );
}

/** Week 15.5/15.6 — tenant self-service: profile/config editor, plan usage, analytics. */
export default function TenantsPage() {
  const { data: tenant, isLoading, isError, error } = useTenant();
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);
  const { data: analytics } = useTenantAnalytics(days);
  const save = useUpdateTenant();
  const [form, setForm] = useState<ProfileForm | null>(null);

  useEffect(() => {
    if (tenant) setForm(toForm(tenant));
  }, [tenant]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <span className="sr-only">Loading tenant settings…</span>
      </div>
    );
  }

  if (isError || !tenant || !form) {
    return (
      <Alert tone="error" title="Could not load tenant settings">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const setHours = (day: Day, patch: Partial<HoursRow>) =>
    setForm((f) => (f ? { ...f, hours: { ...f.hours, [day]: { ...f.hours[day], ...patch } } } : f));

  const handleSave = async () => {
    const operatingHours: OperatingHours = {};
    for (const day of DAYS) {
      const row = form.hours[day];
      if (!row.closed && row.open && row.close) operatingHours[day] = { open: row.open, close: row.close };
    }
    const taxRate = Number(form.taxRate);
    try {
      await save.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        timezone: form.timezone.trim(),
        currency: form.currency.trim().toUpperCase(),
        taxRate: Number.isFinite(taxRate) ? Math.round(taxRate * 100) / 100 : undefined,
        plan: form.plan,
        subscriptionStatus: form.subscriptionStatus,
        isActive: form.isActive,
        operatingHours,
      });
    } catch (err) {
      window.alert(getApiErrorMessage(err));
    }
  };

  const billing = analytics?.billing;
  const seatsPct =
    billing && billing.seatsLimit > 0 ? Math.min(100, Math.round((billing.seatsUsed / billing.seatsLimit) * 100)) : 0;
  const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: tenant.currency, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Restaurant Settings</h1>
          <p className="mt-1 text-sm text-content-muted">
            Profile, configuration and billing for <span className="font-medium">{tenant.name}</span>
            <code className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">/{tenant.slug}</code>
          </p>
        </div>
        {!tenant.isActive && <Alert tone="warning">This workspace is currently inactive.</Alert>}
      </div>

      {/* 15.6 — plan, subscription and seat usage */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-content-default">Plan &amp; billing</p>
            <p className="mt-0.5 text-sm text-content-muted">
              <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-700">
                {billing?.plan ?? tenant.plan}
              </span>{' '}
              · subscription {billing?.subscriptionStatus ?? tenant.subscriptionStatus}
            </p>
          </div>
          <p className="text-sm text-content-muted">
            Seats:{' '}
            <span className="font-semibold text-content-default">
              {billing?.seatsUsed ?? tenant._count?.users ?? 0}
            </span>{' '}
            / {billing?.seatsLimit ?? tenant.seatsLimit}
          </p>
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

      {/* 15.2/15.3 — profile & configuration editor */}
      <Card className="space-y-4">
        <p className="text-sm font-medium text-content-default">Profile &amp; configuration</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Restaurant name" value={form.name} onChange={(e) => set('name', e.target.value)} disabled={save.isPending} />
          <Input label="Contact email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={save.isPending} />
          <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={save.isPending} />
          <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} disabled={save.isPending} />
          <Input label="Timezone" placeholder="America/New_York" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} disabled={save.isPending} />
          <Input label="Currency" hint="ISO 4217, e.g. USD" value={form.currency} onChange={(e) => set('currency', e.target.value)} disabled={save.isPending} />
          <Input label="Tax rate (%)" type="number" min={0} max={100} step="0.01" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} disabled={save.isPending} />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">Plan</span>
            <select
              value={form.plan}
              onChange={(e) => set('plan', e.target.value as PlanTier)}
              disabled={save.isPending}
              className={SELECT_CLS}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>{p}</option>
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
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
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

        <fieldset className="rounded border border-gray-100 p-4">
          <legend className="px-1 text-sm font-medium text-content-default">Operating hours</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-2 text-sm capitalize">
                <span className="w-24 shrink-0 text-content-muted">{day}</span>
                <input
                  type="time"
                  aria-label={`${day} opens at`}
                  value={form.hours[day].open}
                  onChange={(e) => setHours(day, { open: e.target.value })}
                  disabled={save.isPending || form.hours[day].closed}
                  className={TIME_CLS}
                />
                <span aria-hidden>–</span>
                <input
                  type="time"
                  aria-label={`${day} closes at`}
                  value={form.hours[day].close}
                  onChange={(e) => setHours(day, { close: e.target.value })}
                  disabled={save.isPending || form.hours[day].closed}
                  className={TIME_CLS}
                />
                <label className="ml-auto flex items-center gap-1 text-xs text-content-muted">
                  <input
                    type="checkbox"
                    aria-label={`Closed on ${day}`}
                    checked={form.hours[day].closed}
                    onChange={(e) => setHours(day, { closed: e.target.checked })}
                    disabled={save.isPending}
                    className="h-3.5 w-3.5 accent-primary-600"
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button onClick={() => void handleSave()} isLoading={save.isPending} disabled={save.isPending}>
            Save changes
          </Button>
          {save.isSuccess && <span className="text-sm font-medium text-green-700">Saved ✓</span>}
        </div>
      </Card>

      {/* 15.6 — usage analytics with selectable window */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Usage</h2>
          <div role="group" aria-label="Analytics window" className="flex gap-1 rounded border border-gray-200 p-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                aria-pressed={days === w}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  days === w ? 'bg-primary-600 text-white' : 'text-content-muted hover:bg-surface-muted'
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Orders"
            value={String(analytics?.orders.total ?? '—')}
            sub={analytics ? `${analytics.orders.inWindow} in last ${days}d · ${analytics.orders.active} active` : undefined}
          />
          <Stat
            label="Revenue (paid)"
            value={analytics ? money(analytics.revenue.total) : '—'}
            sub={analytics ? `${money(analytics.revenue.inWindow)} in last ${days}d` : undefined}
          />
          <Stat
            label="Customers"
            value={String(analytics?.customers.total ?? '—')}
            sub={analytics ? `+${analytics.customers.newInWindow} new in last ${days}d` : undefined}
          />
          <Stat label="Menu" value={analytics ? `${analytics.menu.available}/${analytics.menu.items}` : '—'} sub="available / total items" />
          <Stat label="Low stock" value={analytics ? String(analytics.inventory.lowStock) : '—'} sub="items at or below minimum" />
          <Stat
            label="Reviews"
            value={analytics ? `${analytics.reviews.avgRating || 0} ★` : '—'}
            sub={analytics ? `${analytics.reviews.total} total` : undefined}
          />
        </div>
      </div>
    </div>
  );
}



