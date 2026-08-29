'use client';

import type { OrderStatus, PaymentStatus } from '@/types/order';

/** Tailwind classes per order lifecycle stage. */
const STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-indigo-50 text-indigo-700',
  READY: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-700',
};

const PAYMENT_CLASSES: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}>
      {status}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PAYMENT_CLASSES[status]}`}>
      {status}
    </span>
  );
}
