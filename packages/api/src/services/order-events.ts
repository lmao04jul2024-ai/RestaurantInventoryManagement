import { EventEmitter } from 'events';

/**
 * Week 9 — real-time order notifications (9.4).
 *
 * Tenant-keyed in-memory pub/sub backing the `/api/orders/stream` SSE endpoint.
 * Events carry identifiers only (`orderId`, `status`) — the web layer refetches
 * the aggregate, so no sensitive payload ever touches a broadcast channel.
 * Multi-tenant isolation is structural: subscribers only ever hear their own
 * tenant's key. Single-process only; a Redis adapter can replace the emitter
 * body without changing call sites when horizontal scaling arrives.
 */

export type OrderEvent =
  | { type: 'order:created'; orderId: string; status: string }
  | { type: 'order:updated'; orderId: string; status: string }
  | { type: 'order:item:updated'; orderId: string; itemId: string; status: string }
  | { type: 'order:paid'; orderId: string };

const emitter = new EventEmitter();
// Long-lived SSE connections aggregate; disable the default 10-listener cap.
emitter.setMaxListeners(0);

export function publishOrderEvent(tenantId: string, event: OrderEvent): void {
  emitter.emit(tenantId, event);
}

/** Returns an unsubscribe function. SSE handlers call it on socket close. */
export function subscribeOrderEvents(
  tenantId: string,
  handler: (event: OrderEvent) => void,
): () => void {
  emitter.on(tenantId, handler);
  return () => {
    emitter.off(tenantId, handler);
  };
}