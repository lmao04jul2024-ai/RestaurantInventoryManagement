'use client';

import { useState } from 'react';
import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { useSecurityEvents, useSecurityHealth } from '@/hooks/use-security';
import { getApiErrorMessage } from '@/lib/api';

const PAGE_SIZE = 20;

/** Week 22.6 — ADMIN security monitoring: control-objectives health + live event rollup. */
export default function SecurityPage() {
  const [page, setPage] = useState(1);
  const health = useSecurityHealth();
  const events = useSecurityEvents({ page, limit: PAGE_SIZE });

  const anyError = health.isError || events.isError;
  const errorMessage = health.error
    ? getApiErrorMessage(health.error)
    : events.error
      ? getApiErrorMessage(events.error)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Security &amp; compliance</h2>
        <span className="text-xs text-content-muted">Alert surface fed by the immutable audit trail.</span>
      </div>

      {anyError && (
        <Alert tone="error" title="Could not load the security surface">
          {errorMessage ?? 'Check the API connection and your ADMIN role.'}
        </Alert>
      )}

      {/* Control objectives board */}
      <Card>
        <h3 className="font-semibold">Controls</h3>
        {health.isLoading && <p className="mt-2 text-sm text-content-muted">Checking controls…</p>}
        {health.data && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="health-checks">
            {Object.entries(health.data.checks).map(([name, check]) => (
              <li key={name} className="flex items-start gap-2 rounded border border-gray-100 px-3 py-2">
                <span aria-hidden>{check.ok ? '✅' : '⚠️'}</span>
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-content-muted">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 24h rollup */}
      <Card>
        <h3 className="font-semibold">Last 24 hours</h3>
        {events.isLoading && <p className="mt-2 text-sm text-content-muted">Loading events…</p>}
        {events.data && (
          <>
            <p className="mt-1 text-sm" data-testid="last24h-count">
              {events.data.summary.last24h} security events
            </p>
            <ul className="mt-2 space-y-1" data-testid="rollup-list">
              {Object.entries(events.data.summary.byAction).map(([action, count]) => (
                <li key={action} className="flex justify-between gap-2 text-sm">
                  <span className="font-mono text-xs text-content-muted">{action}</span>
                  <span>{count}</span>
                </li>
              ))}
              {Object.keys(events.data.summary.byAction).length === 0 && (
                <li className="text-sm text-content-muted">Quiet — no security events in the window.</li>
              )}
            </ul>
          </>
        )}
      </Card>

      {/* Recent events */}
      <Card>
        <h3 className="font-semibold">Recent events</h3>
        {events.data && (
          <>
            <ul className="mt-2 space-y-1">
              {events.data.data.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 text-sm" data-testid="event-row">
                  <span className="font-mono text-xs text-content-muted">{row.action}</span>
                  <span className="text-xs text-content-muted">{new Date(row.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={events.isFetching || page >= (events.data.meta.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}