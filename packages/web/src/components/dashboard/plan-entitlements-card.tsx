'use client';

import Card from '@/components/ui/card';
import type { PlanTier } from '@/types/tenant';

/**
 * Phase 5 S3.5 — what your plan includes vs what you've consumed.
 *
 * Manual billing: plans are operator-assigned (no self-serve checkout), so
 * this card is informational — it tells the workspace what its tier covers
 * and pairs each countable entitlement with the live consumption from
 * GET /api/tenants/me/analytics. Seats are the one hard-enforced ceiling
 * (S2.5): over the limit, invites fail with SEATS_LIMIT_REACHED.
 */

interface PlanCopy {
  label: string;
  blurb: string;
  includes: string[];
}

export const PLAN_COPY: Record<PlanTier, PlanCopy> = {
  TRIAL: {
    label: 'Trial',
    blurb: 'Everything you need to evaluate the platform.',
    includes: [
      'Full inventory, menu and order management',
      'Customer ordering and reviews',
      'Team seats limited by your workspace cap',
      '30 days from signup',
    ],
  },
  BASIC: {
    label: 'Basic',
    blurb: 'Core operations for a single-location restaurant.',
    includes: [
      'Inventory with supplier tracking',
      'Menu management and availability windows',
      'Customer ordering and order tracking',
      'Team seats limited by your workspace cap',
    ],
  },
  PRO: {
    label: 'Pro',
    blurb: 'Growing teams that need analytics and automation.',
    includes: [
      'Everything in Basic',
      'Usage analytics and reporting',
      'Recurring orders and kitchen fulfillment',
      'CSV import/export of your data',
    ],
  },
  ENTERPRISE: {
    label: 'Enterprise',
    blurb: 'Multi-location groups with bespoke needs.',
    includes: [
      'Everything in Pro',
      'Priority operator support',
      'Custom seat ceilings and onboarding assistance',
      'Tailored data-retention arrangements',
    ],
  },
};

function Meter({
  label,
  used,
  limit,
  enforced,
}: {
  label: string;
  used: number;
  limit?: number;
  enforced?: boolean;
}) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-content-default">{label}</span>
        <span className="text-content-muted">
          {used}
          {limit !== undefined ? ` / ${limit}` : ''}
          {enforced && limit !== undefined && used >= limit ? (
            <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
              Limit reached
            </span>
          ) : null}
        </span>
      </div>
      {limit !== undefined && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            role="progressbar"
            aria-label={`${label} usage`}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-primary-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function PlanEntitlementsCard({
  plan,
  seatsUsed,
  seatsLimit,
  menuItems,
  orders,
  customers,
}: {
  plan: PlanTier;
  seatsUsed: number;
  seatsLimit?: number;
  menuItems?: number;
  orders?: number;
  customers?: number;
}) {
  const copy = PLAN_COPY[plan] ?? PLAN_COPY.TRIAL;

  return (
    <Card className="space-y-4" data-testid="plan-entitlements">
      <div>
        <p className="text-sm font-medium text-content-default">
          Your plan:{' '}
          <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary-700">
            {copy.label}
          </span>
        </p>
        <p className="mt-1 text-sm text-content-muted">{copy.blurb}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
            What&apos;s included
          </p>
          <ul className="space-y-1 text-sm text-content-default">
            {copy.includes.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden className="text-primary-600">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            Your usage
          </p>
          <Meter label="Team seats" used={seatsUsed} limit={seatsLimit} enforced />
          {menuItems !== undefined && <Meter label="Menu items" used={menuItems} />}
          {orders !== undefined && <Meter label="Orders (total)" used={orders} />}
          {customers !== undefined && <Meter label="Customers" used={customers} />}
        </div>
      </div>
    </Card>
  );
}
