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
}

export interface CustomerLite {
  id: string;
  firstName: string;
  lastName: string;
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
}

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

export interface KitchenSummary {
  windowDays: number;
  totalOrders: number;
  countsByStatus: Partial<Record<OrderStatus, number>>;
  paidRevenue: number;
  averageOrderValue: number;
}
