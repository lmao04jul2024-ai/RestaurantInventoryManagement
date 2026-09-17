'use client';

import Link from 'next/link';
import Card from '@/components/ui/card';
import Alert from '@/components/ui/alert';
import { usePlatformAttention } from '@/hooks/use-platform';
import type { PlatformAttentionItem } from '@/types/platform';

/**
 * Phase 5 S3.4 — the operator attention queue.
 *
 * Every workspace that currently needs a human decision (suspended, past due,
 * cancelled, trial ending or trial expired), derived server-side by
 * GET /api/platform/attention so the console never disagrees with the API
 * about who needs action. Manual billing: each row is a prompt to reach out
 * and record the outcome on the tenant detail page (audit-logged).
 */

const REASON_LABELS: Record<string, string> = {
  SUSPENDED: 'Suspended',
  PAST_DUE: 'Past due',
  CANCELLED: 'Cancelled',
  TRIAL_ENDING: 'Trial ending',
  TRIAL_EXPIRED: 'Trial expired',
};

const REASON_TONES: Record<string, string> = {
  SUSPENDED: 'bg-red-50 text-red-700',
  PAST_DUE: 'bg-amber-50 text-amber-700',
  CANCELLED: 'bg-stone-100 text-stone-600',
  TRIAL_ENDING: 'bg-amber-50 text-amber-700',
  TRIAL_EXPIRED: 'bg-red-50 text-red-700',
};

function ReasonBadge({ reason }: { reason: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        REASON_TONES[reason] ?? 'bg-stone-100 text-stone-600'
      }`}
    >
      {REASON_LABELS[reason] ?? reason}
    </span>
  );
}

export default function PlatformAttentionQueue() {
  const { data, isLoading, isError } = usePlatformAttention();
  const queue: PlatformAttentionItem[] = data?.data ?? [];

  if (isLoading || (isError && queue.length === 0)) {
    return null; // the workspace table below still renders its own state
  }

  if (queue.length === 0) {
    return (
      <Alert tone="success" title="All clear">
        No workspaces need action right now.
      </Alert>
    );
  }

  return (
    <Card className="space-y-3" data-testid="attention-queue">
      <div>
        <h2 className="text-lg font-bold">Needs attention</h2>
        <p className="text-sm text-content-muted">
          {queue.length} workspace{queue.length === 1 ? '' : 's'} need
          {queue.length === 1 ? 's' : ''} a manual billing decision. Reach out, then record the
          outcome on the workspace page.
        </p>
      </div>
      <ul className="divide-y divide-gray-100">
        {queue.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <Link
              href={`/platform/tenants/${t.id}`}
              className="font-medium text-primary-700 hover:underline"
            >
              {t.name}
            </Link>
            <span className="text-xs text-content-muted">/{t.slug}</span>
            {t.reasons.map((r) => (
              <ReasonBadge key={r} reason={r} />
            ))}
            {t.email && <span className="ml-auto text-xs text-content-muted">{t.email}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
