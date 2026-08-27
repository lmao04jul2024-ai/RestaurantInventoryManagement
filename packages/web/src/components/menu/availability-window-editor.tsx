'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import { useCreateAvailabilityWindow, useDeleteAvailabilityWindow } from '@/hooks/use-menu';
import { DAY_LABELS, type MenuItem } from '@/types/menu';

export default function AvailabilityWindowEditor({
  itemId,
  windows,
}: {
  itemId: string;
  windows: MenuItem['availabilityWindows'];
}) {
  const create = useCreateAvailabilityWindow();
  const del = useDeleteAvailabilityWindow();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const add = async () => {
    try {
      await create.mutateAsync({
        itemId,
        payload: {
          startTime: start || null,
          endTime: end || null,
          daysOfWeek: [],
        },
      });
      setStart('');
      setEnd('');
    } catch {
      // surfaced via invalidate on failure path; keep simple
    }
  };

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3">
      <p className="text-sm font-semibold">Serving windows (7.6)</p>
      {windows.length === 0 && (
        <p className="text-xs text-content-muted">
          No windows — the global availability toggle decides alone.
        </p>
      )}
      <ul className="space-y-1">
        {windows.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {formatWindow(w.startTime, w.endTime)} ·{' '}
              {w.daysOfWeek.length ? w.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ') : 'Every day'}
            </span>
            <button
              type="button"
              onClick={() => del.mutate({ itemId, windowId: w.id })}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="open HH:MM"
          className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-content-muted">to</span>
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="close HH:MM"
          className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <Button variant="outline" size="sm" type="button" onClick={add}>
          + Window
        </Button>
      </div>
    </div>
  );
}

function formatWindow(start: string | null, end: string | null): string {
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return '(all day)';
}
