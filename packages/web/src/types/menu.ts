/**
 * Menu domain types mirroring the API contract
 * (see packages/api/src/controllers/menu*.controller.ts + prisma schema).
 */

export type PricingAdjustmentType = 'PERCENT_DISCOUNT' | 'FIXED_PRICE';

export interface Menu {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  tenantId: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  menuId: string;
  parentId: string | null;
  children?: Category[];
}

export interface PricingRule {
  id: string;
  menuItemId: string;
  adjustmentType: PricingAdjustmentType;
  amount: number;
  name: string | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  priority: number;
  isActive: boolean;
}

export interface AvailabilityWindow {
  id: string;
  menuItemId: string;
  name: string | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  preparationTime: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  categoryId: string;
  category?: Pick<Category, 'id' | 'name' | 'menuId'>;
  pricingRules: PricingRule[];
  availabilityWindows: AvailabilityWindow[];
}

export interface MenuItemListQuery {
  q?: string;
  categoryId?: string;
  available?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  page?: number;
  limit?: number;
  sort?: 'name' | 'price_asc' | 'price_desc' | 'newest';
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MenuItemListResponse {
  data: MenuItem[];
  pagination: Pagination;
}

export interface MenuItemCreatePayload {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string | null;
  preparationTime?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
}

export type MenuItemUpdatePayload = Partial<MenuItemCreatePayload>;

export interface PricingRulePayload {
  adjustmentType: PricingAdjustmentType;
  amount: number;
  name?: string;
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface AvailabilityWindowPayload {
  name?: string;
  daysOfWeek?: number[];
  startTime?: string | null;
  endTime?: string | null;
  isActive?: boolean;
}

export interface EffectivePriceResponse {
  data: {
    basePrice: number;
    effectivePrice: number;
    discountAmount: number;
    appliedRuleIds: string[];
    orderableNow: boolean;
  };
}

/** Weekday labels in the same 0=Sunday..6=Saturday indexing the API uses. */
export const DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
