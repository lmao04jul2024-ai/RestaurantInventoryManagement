'use client';

import Alert from '@/components/ui/alert';
import Button from '@/components/ui/button';
import Card from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useStaff } from '@/hooks/use-staff';
import {
  useAssignOrderStaff,
  useKitchenQueue,
  useKitchenSettings,
  useUnassignOrderStaff,
  useUpdateOrderItemStatus,
} from '@/hooks/use-orders';
import type { KitchenQueueEntry, OrderItem, OrderStatus } from '@/types/order';

/** Next KDS stage for a line. */
const NEXT_ITEM_ACTION: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  PENDING: { label: 'Start', status: 'PREPARING' },
  PREPARING: { label: 'Done', status: 'READY' },
};

/**
 * Week 9 — kitchen display (9.3). Live queue of accepted orders with
 * per-line progression; refreshes by polling every 10s.
 *
 * Week 21 — the queue rows now carry the kitchen-hardening enrichment
 * (21.2 assignedStaff, 21.3 prepElapsedMinutes, 21.4 prepTargetMet) and the
 * board renders them, plus a 21.5 capacity indicator driven by the tenant's
 * kitchen settings. Assignment controls are gated to kitchen+ (the API's
 * `order:assign` permission: KITCHEN/MANAGER/ADMIN).
 */
export default function KitchenBoard() {
  const { data, isLoading, isError, dataUpdatedAt } = useKitchenQueue();
  // Week 20.1 — the queue endpoint splits live vs. scheduled-future tickets.
  const live = data?.live ?? [];
  const scheduled = data?.scheduled ?? [];
  const moveItem = useUpdateOrderItemStatus();
  const error = moveItem.error ? getApiErrorMessage(moveItem.error) : null;

  // Week 21.2 — staff assignment (kitchen+ only; the API enforces the same gate).
  const { hasRole } = useAuth();
  const canAssign = hasRole('KITCHEN', 'MANAGER', 'ADMIN');
  const { data: staffPage } = useStaff(canAssign ? { limit: 100 } : {});
  const staff = staffPage?.data ?? [];
  const assignStaff = useAssignOrderStaff();
  const unassignStaff = useUnassignOrderStaff();
  const assignError = [assignStaff.error, unassignStaff.error]
    .filter(Boolean)
    .map((e) => getApiErrorMessage(e!))
    .join(' · ') || null;

  // Week 21.5 — capacity soft cap from the tenant's kitchen settings.
  const { data: settings } = useKitchenSettings();
  const capacity = settings?.capacity ?? 0;
  const capacityPct = capacity > 0 ? Math.round((live.length / capacity) * 100) : 0;

  const advance = (order: KitchenQueueEntry, item: OrderItem) => {
    const next = NEXT_ITEM_ACTION[item.status];
    if (!next) return;
    moveItem.mutate({ orderId: order.id, itemId: item.id, status: next.status });
  };

  const ageMinutes = (iso: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Kitchen queue</h2>
        <div className="flex items-center gap-3 text-xs text-content-muted">
          {/* Week 21.5 — capacity indicator: amber near the cap, red at/over it. */}
          {capacity > 0 && (
            <span
              data-testid="capacity-indicator"
              className={`rounded px-1.5 py-0.5 font-semibold ${
                capacityPct >= 100
                  ? 'bg-red-50 text-red-700'
                  : capacityPct >= 80
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {live.length}/{capacity} active
            </span>
          )}
          <span>
            Auto-refreshes every 10s · updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {isError && <Alert tone="error" title="Could not load the kitchen queue">Check the API connection.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {assignError && <Alert tone="error">{assignError}</Alert>}
      {isLoading && <p className="text-sm text-content-muted">Loading queue…</p>}

      {!isLoading && live.length === 0 && (
        <Card>
          <p className="text-sm text-content-muted">All caught up — no orders in the queue. 🎉</p>
        </Card>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {live.map((order) => (
          <li key={order.id}>
            <Card className={ageMinutes(order.createdAt) >= 15 ? 'border-red-300' : undefined}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-content-muted">{order.orderNumber}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    ageMinutes(order.createdAt) >= 15 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ageMinutes(order.createdAt)}m
                </span>
              </div>

              {/* Week 21.2 — assignment row: chip when assigned, dropdown + clear for kitchen+. */}
              {(canAssign || order.assignedStaff) && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  {order.assignedStaff ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      👨‍🍳 {order.assignedStaff.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-content-muted">Unassigned</span>
                  )}
                  {canAssign && (
                    <div className="flex items-center gap-1">
                      {!order.assignedStaff && (
                        <select
                          aria-label={`Assign staff to ${order.orderNumber}`}
                          className="max-w-36 rounded border border-gray-200 px-1 py-0.5 text-xs"
                          defaultValue=""
                          disabled={assignStaff.isPending}
                          onChange={(e) => {
                            const staffId = e.target.value;
                            e.target.value = '';
                            if (staffId) assignStaff.mutate({ id: order.id, staffId });
                          }}
                        >
                          <option value="" disabled>Assign…</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                      {order.assignedStaff && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unassignStaff.mutate(order.id)}
                          disabled={unassignStaff.isPending}
                        >
                          Unassign
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Week 21.3/21.4 — prep elapsed, colored by the target outcome. */}
              {order.prepElapsedMinutes !== null && order.prepElapsedMinutes !== undefined && (
                <p
                  data-testid={`prep-elapsed-${order.id}`}
                  className={`mt-1 text-xs font-medium ${
                    order.prepTargetMet === false
                      ? 'text-red-600'
                      : order.prepTargetMet === true
                        ? 'text-emerald-600'
                        : 'text-content-muted'
                  }`}
                >
                  Prep {order.prepElapsedMinutes}m
                  {order.prepTargetMet === false && ' · over target'}
                  {order.prepTargetMet === true && ' · within target'}
                </p>
              )}

              <ul className="mt-3 space-y-2">
                {order.items.map((item) => {
                  const next = NEXT_ITEM_ACTION[item.status];
                  return (
                    <li key={item.id} className="rounded border border-gray-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium">
                          {item.quantity}× {item.menuItem?.name ?? 'item'}
                        </p>
                        {next ? (
                          <Button
                            size="sm"
                            variant={item.status === 'PREPARING' ? 'secondary' : 'primary'}
                            onClick={() => advance(order, item)}
                            disabled={moveItem.isPending}
                          >
                            {next.label}
                          </Button>
                        ) : (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Ready
                          </span>
                        )}
                      </div>
                      {item.specialInstructions && (
                        <p className="mt-1 text-xs italic text-amber-700">“{item.specialInstructions}”</p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {order.specialRequests && (
                <p className="mt-3 text-xs text-content-muted">Order note: {order.specialRequests}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {scheduled.length > 0 && (
        <Card>
          <h3 className="font-semibold">Scheduled ahead</h3>
          <ul className="mt-2 space-y-1">
            {scheduled.map((order) => (
              <li key={order.id} className="flex justify-between gap-2 text-sm">
                <span className="font-mono text-xs text-content-muted">{order.orderNumber}</span>
                <span className="text-content-muted">
                  {order.scheduledFor ? new Date(order.scheduledFor).toLocaleString() : '—'} ·{' '}
                  {(order.items ?? []).reduce((sum, i) => sum + i.quantity, 0)} items
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
