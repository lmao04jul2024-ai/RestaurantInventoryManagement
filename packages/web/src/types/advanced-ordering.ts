/** Week 20 — advanced ordering contracts (mirrors packages/api/src/routes/*.routes.ts). */

// 20.2 — group orders

export type GroupOrderStatus = 'OPEN' | 'CONVERTED' | 'CANCELLED';

export interface GroupOrder {
  id: string;
  code: string;
  status: GroupOrderStatus;
  hostCustomerId: string;
  tenantId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: GroupOrderItem[];
  /** Host user object included on convert. */
  host?: { id: string; firstName: string; lastName: string };
}

export interface GroupOrderItem {
  id: string;
  groupOrderId: string;
  participantId: string;
  menuItemId: string;
  quantity: number;
  specialInstructions: string | null;
  participant?: { id: string; firstName: string; lastName: string };
  menuItem?: { id: string; name: string; price: number };
}

// 20.3 — loyalty

export interface LoyaltySummary {
  balance: number;
  history: Array<{
    id: string;
    points: number;
    reason: string;
    orderId: string | null;
    createdAt: string;
  }>;
}

// 20.4 — promo codes

export interface PromoCode {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotal: number | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export interface PromoValidation {
  valid: boolean;
  message: string;
  discount: number;
}

// 20.5 — recommendations

export interface Recommendation {
  itemId: string;
  name: string;
  price: number;
  image: string | null;
  reason: 'favorite' | 'popular';
}

export interface RecommendationResponse {
  favorites: Recommendation[];
  popular: Recommendation[];
}

// 20.6 — subscriptions

export type Recurrence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface RecurringOrder {
  id: string;
  recurrence: Recurrence;
  items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string | null }>;
  nextRunAt: string;
  lastRunAt: string | null;
  isActive: boolean;
  createdAt: string;
}
