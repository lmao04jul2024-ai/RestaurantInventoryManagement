'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/order.service';
import { usePrefsStore } from '@/store/prefs.store';
import type { Order, OrderStatus } from '@/types/order';

const ACTIVE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];
const SEEN_KEY = 'rms-order-notified';
const POLL_MS = 15_000;
const TOAST_MS = 6_000;

export interface StatusToast {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
}

/** Orders the diner still cares about (everything not finished/cancelled). */
export function activeOrders(orders: Order[]): Order[] {
  return orders.filter((o) => ACTIVE.includes(o.status));
}

/**
 * Pure diff used by the poller (unit-tested): returns one toast per order
 * whose status advanced since `seen` (unknown orders count as advanced).
 */
export function diffOrderStatuses(
  seen: Record<string, OrderStatus>,
  orders: Order[],
): StatusToast[] {
  return activeOrders(orders)
    .filter((o) => seen[o.id] !== o.status)
    .map((o) => ({
      id: `${o.id}:${o.status}`,
      orderId: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
    }));
}

function loadSeen(): Record<string, OrderStatus> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, OrderStatus>;
  } catch {
    return {};
  }
}

/**
 * Week 11.2 — order status notifications. Polls the diner's orders every 15s,
 * diffs statuses against a persisted `rms-order-notified` map and raises a
 * toast for each advance (CONFIRMED → PREPARING → …). Gated by the account
 * preference toggle (11.6). Toasts are self-dismissing; the seen-map persists
 * so a refresh doesn't replay history.
 */
export default function OrderNotifications() {
  const enabled = usePrefsStore((s) => s.statusNotifications);
  const [toasts, setToasts] = useState<StatusToast[]>([]);
  const seenRef = useRef<Record<string, OrderStatus>>({});

  useEffect(() => {
    seenRef.current = loadSeen();
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const { data } = useQuery({
    queryKey: ['orders', 'notifications'],
    queryFn: () => orderService.listOrders({}),
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!data) return;
    const fresh = diffOrderStatuses(seenRef.current, data.data);
    if (fresh.length === 0) return;
    setToasts((ts) => [...ts, ...fresh.filter((f) => !ts.some((t) => t.id === f.id))].slice(-3));
    const nextSeen = { ...seenRef.current };
    for (const o of activeOrders(data.data)) nextSeen[o.id] = o.status;
    seenRef.current = nextSeen;
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen));
    } catch {
      /* storage full/blocked — notifications still work in-session */
    }
  }, [data]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="rounded-card border border-gray-200 bg-surface p-3 shadow-card"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-content-default">
              Order {t.orderNumber}
            </p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="text-content-muted hover:text-content-default"
            >
              ×
            </button>
          </div>
          <p className="mt-0.5 text-sm text-content-muted">
            Status update: <strong>{t.status.toLowerCase()}</strong>
          </p>
          <StatusTimer id={t.id} onExpire={dismiss} />
        </div>
      ))}
    </div>
  );
}

/** Self-dismiss countdown kept out of the toast body to avoid re-render loops. */
function StatusTimer({ id, onExpire }: { id: string; onExpire: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, onExpire]);
  return null;
}
