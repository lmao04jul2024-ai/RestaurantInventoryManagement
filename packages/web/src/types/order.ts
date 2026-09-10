/**
 * Order domain types mirroring the Week-9 API contract
 * (see packages/api/src/controllers/order.controller.ts + prisma schema).
 */

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
/** Mirrors PAYMENT_METHODS in packages/api/src/utils/validation.ts (Week 10). */
export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE';

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  specialInstructions: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  menuItem?: Pick<MenuItemLite, 'id' | 'name' | 'price' | 'image'>;
}

/** Minimal menu shape embedded in order lines. */
export interface MenuItemLite {
  id: string;
  name: string;
  price: number;
  image: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  /** Prisma Payment.transactionId (was mistakenly typed transactionRef). */
  transactionId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  tableNumber: string | null;
  specialRequests: string | null;
  /** Week 20.1 — future fulfillment time for scheduled orders (null = ASAP). */
  scheduledFor: string | null;
  customerId: string;
  tenantId: string;
  tableId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  customer?: Pick<CustomerLite, 'id' | 'firstName' | 'lastName'> | null;
  table?: { id: string; label: string } | null;
  payment?: Payment | null;
  items: OrderItem[];
  /** Review attached to this order (at most one). Week 11 — for post-order rating. */
  reviews?: ReviewLite[];
}

export interface CustomerLite {
  id: string;
  firstName: string;
  lastName: string;
}

/** Minimal review shape embedded in order responses (Week 11). */
export interface ReviewLite {
  id: string;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  /** Staff list includes order + customer relations. */
  order?: { id: string; orderNumber: string };
  customer?: { id: string; firstName: string; lastName: string };
}

/** Full review with relations (staff dashboard, Week 11.4). */
export interface Review extends ReviewLite {
  order: { id: string; orderNumber: string };
  customer: { id: string; firstName: string; lastName: string };
  updatedAt: string;
}

export interface OrderListQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  page?: number;
  limit?: number;
}

export interface CreateOrderPayload {
  customerId?: string;
  tableId?: string | null;
  specialRequests?: string | null;
  items: OrderLineInput[];
  /** Week 20.1 — future fulfillment ISO time; Week 20.4 promo code; Week 20.3 loyalty points. */
  scheduledFor?: string | null;
  promoCode?: string | null;
  loyaltyPoints?: number | null;
}

/** Split kitchen response: live queue + scheduled-future tickets (Week 20.1). */
export type KitchenQueuePayload = Order[] | { live: Order[]; scheduled: Order[] };

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string | null;
}

export type UpdateOrderPayload = Partial<Pick<CreateOrderPayload, 'tableId' | 'specialRequests'>>;

export interface OrderStatusPayload {
  status: OrderStatus;
}

export interface PayOrderPayload {
  method: PaymentMethod;
  amount?: number;
  /** API schema key is `transactionId` (payOrderSchema) — Week 10 fix. */
  transactionId?: string | null;
}

/** Week 21.2 — `{ id, name }` projection of an order's assigned staff member. */
export interface AssignedStaff {
  id: string;
  name: string;
}

/** Week 21.6 — kitchen queue row enriched with assignment + prep-timing data. */
export interface KitchenQueueEntry extends Order {
  assignedStaff?: AssignedStaff | null;
  /** Minutes since preparationStartedAt (null when prep has not started). */
  prepElapsedMinutes?: number | null;
  /** Did finished prep beat the tenant's target? null until the order is READY. */
  prepTargetMet?: boolean | null;
}

/** Week 21 — the kitchen queue always returns the split shape. */
export interface KitchenQueueResponse {
  live: KitchenQueueEntry[];
  scheduled: KitchenQueueEntry[];
}

/** Week 21.2 — assign/unassign payload (kitchen+ endpoints). */
export interface AssignStaffPayload {
  staffId: string;
}

/** Week 21.3 — prep-time analytics for the kitchen window. */
export interface KitchenAnalytics {
  windowDays: number;
  completedCount: number;
  avgPrepMinutes: number;
  prepTimeTargetMinutes: number;
  targetMetPct: number;
  throughputPerHour: number;
  countsByStatus: Partial<Record<OrderStatus, number>>;
}

/** Week 21.4/21.5 — kitchen tuning knobs (Tenant.settings.kitchen). */
export interface KitchenSettings {
  prepTimeTargetMinutes: number;
  capacity: number;
}

/** Week 21.2 — `/api/orders/:id/assign` / unassign response shape: an order plus the assignment label. */
export interface AssignedOrder extends Order {
  /** Server-computed `{ id, name }` label (null after unassign). */
  assignedStaff: AssignedStaff | null;
}

export interface KitchenSummary {
  windowDays: number;
  totalOrders: number;
  countsByStatus: Partial<Record<OrderStatus, number>>;
  paidRevenue: number;
  averageOrderValue: number;
}
