'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Alert from '@/components/ui/alert';
import Card from '@/components/ui/card';
import Input from '@/components/ui/input';
import { useAuditLogs } from '@/hooks/use-staff';
import { getApiErrorMessage } from '@/lib/api';
import type { AuditLogEntry } from '@/types/staff';

const PAGE_SIZE = 20;

const TARGET_TYPES = ['User', 'Tenant', 'MenuItem', 'Order', 'InventoryItem', 'PurchaseOrder'] as const;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function TargetCell({ entry }: { entry: AuditLogEntry }) {
  return (
    <span className="font-mono text-xs">
      {entry.targetType}:{entry.targetId.slice(0, 8)}…
    </span>
  );
}

/** Week 16.6 — immutable audit trail with action/target filters (ADMIN only per the API). */
export default function AuditPage() {
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(action.trim() ? { action: action.trim() } : {}),
    ...(targetType ? { targetType } : {}),
    ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
  };
  const { data, isLoading, isError, error, isFetching } = useAuditLogs(params);
  const meta = data?.meta;

  if (isError) {
    return (
      <Alert tone="error" title="Could not load the audit log">
        {getApiErrorMessage(error)}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-content-muted">
          Immutable trail of permission &amp; role changes — entries are created by the API and cannot be edited.
        </p>
      </div>

      <Card>
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <Input label="Action" placeholder="staff.created" value={action} onChange={(e) => setAction(e.target.value)} />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-content-default">Target type</span>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className={SELECT_CLS}>
              <option value="">Any</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <Input label="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="uuid…" />
          <div className="flex items-end">
            <Button type="submit" className="w-full">Apply filters</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            <span className="sr-only">Loading audit log…</span>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit trail entries, newest first</caption>
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-content-muted">
                <th scope="col" className="py-2 pr-4">When</th>
                <th scope="col" className="py-2 pr-4">Action</th>
                <th scope="col" className="py-2 pr-4">Actor</th>
                <th scope="col" className="py-2 pr-4">Target</th>
                <th scope="col" className="py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).map((entry) => (
                <tr key={entry.id} className="border-b border-gray-50 align-top">
                  <td className="whitespace-nowrap py-2 pr-4 text-content-muted">{fmtDate(entry.createdAt)}</td>
                  <td className="py-2 pr-4 font-medium">{entry.action}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-content-muted">{entry.actorId.slice(0, 8)}…</td>
                  <td className="py-2 pr-4"><TargetCell entry={entry} /></td>
                  <td className="max-w-[16rem] truncate py-2 font-mono text-xs text-content-muted">
                    {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-content-muted">No audit entries match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-content-muted" aria-live="polite">
            {data ? `Page ${meta?.page} of ${meta?.pages} · ${meta?.total} entries` : '—'}
            {isFetching && !isLoading ? ' · refreshing…' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" disabled={!data || page >= (meta?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>
              Next →
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const SELECT_CLS =
  'block w-full rounded border border-gray-300 bg-surface px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200';
