import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().trim().max(20).allow('', null),
  tenantId: Joi.string().uuid().optional(), // fallback when no tenant context resolved
  // Week 22.4 — GDPR consent checkbox; when true, consentGivenAt is stamped server-side.
  consent: Joi.boolean().optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  tenantId: Joi.string().uuid().optional(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().min(32).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
});

/**
 * Validates request body against a Joi schema.
 * Throws a structured error handled by the global error handler.
 */
export function validateBody<T>(schema: Joi.ObjectSchema<T>, body: unknown): T {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    const validationError = new Error(details.map((d) => `${d.field}: ${d.message}`).join('; '));
    (validationError as any).statusCode = 400;
    (validationError as any).code = 'VALIDATION_ERROR';
    (validationError as any).details = details;
    throw validationError;
  }

  return value;
}

/** Query-string variant of validateBody (same envelope semantics). */
export function validateQuery<T>(schema: Joi.ObjectSchema<T>, query: unknown): T {
  return validateBody(schema, query);
}

/** Route-parameter variant of validateBody. */
export function validateParams<T>(schema: Joi.ObjectSchema<T>, params: unknown): T {
  return validateBody(schema, params);
}

// ── Menu domain schemas ────────────────────────────────────────────────────────

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeString = Joi.string().pattern(HH_MM).message('"{{#label}}" must be a 24h "HH:mm" time');
const daysOfWeek = Joi.array()
  .items(Joi.number().integer().min(0).max(6))
  .max(7)
  .unique();

const uuid = Joi.string().uuid();

export const createMenuSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(500),
});

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  description: Joi.string().trim().max(500),
  icon: Joi.string().trim().max(16),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  /** When present, places the category under a parent (subcategory). */
  parentId: uuid.allow(null),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  description: Joi.string().trim().max(500).allow(null),
  icon: Joi.string().trim().max(16).allow(null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  parentId: uuid.allow(null),
}).min(1);

export const createMenuItemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000),
  price: Joi.number().greater(0).precision(2).required(),
  categoryId: uuid.required(),
  image: Joi.string().trim().max(2048).allow(null),
  preparationTime: Joi.number().integer().min(0).max(480),
  calories: Joi.number().integer().min(0),
  protein: Joi.number().min(0).precision(1),
  carbs: Joi.number().min(0).precision(1),
  fat: Joi.number().min(0).precision(1),
  isAvailable: Joi.boolean().default(true),
  isVegetarian: Joi.boolean().default(false),
  isVegan: Joi.boolean().default(false),
  isGlutenFree: Joi.boolean().default(false),
});

export const updateMenuItemSchema = createMenuItemSchema.fork(
  ['name', 'price', 'categoryId'],
  (field) => field.optional(),
);

export const menuItemQuerySchema = Joi.object({
  q: Joi.string().trim().max(200),
  categoryId: uuid,
  available: Joi.boolean(),
  vegetarian: Joi.boolean(),
  vegan: Joi.boolean(),
  glutenFree: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sort: Joi.string().valid('name', 'price_asc', 'price_desc', 'newest').default('newest'),
});

export const pricingRuleSchema = Joi.object({
  adjustmentType: Joi.string().valid('PERCENT_DISCOUNT', 'FIXED_PRICE').required(),
  amount: Joi.when('adjustmentType', [
    // Percent off must land in (0..100]; fixed prices are any positive amount.
    { is: 'PERCENT_DISCOUNT', then: Joi.number().greater(0).max(100).required() },
    { is: 'FIXED_PRICE', then: Joi.number().greater(0).max(1_000_000).required() },
  ]),
  name: Joi.string().trim().max(120),
  daysOfWeek: daysOfWeek.default([]),
  startTime: timeString.allow(null),
  endTime: timeString.allow(null),
  priority: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

export const updatePricingRuleSchema = pricingRuleSchema.fork(
  ['adjustmentType', 'amount'],
  (field) => field.optional(),
);

export const availabilityWindowSchema = Joi.object({
  name: Joi.string().trim().max(120),
  daysOfWeek: daysOfWeek.default([]),
  startTime: timeString.allow(null),
  endTime: timeString.allow(null),
  isActive: Joi.boolean().default(true),
});

export const updateAvailabilityWindowSchema = availabilityWindowSchema.min(1);

export const availabilityToggleSchema = Joi.object({
  isAvailable: Joi.boolean().required(),
});

export const effectiveAtQuerySchema = Joi.object({
  at: Joi.date().iso(),
});

// ── Menu domain param schemas ─────────────────────────────────────────────────

export const menuIdParamSchema = Joi.object({ menuId: uuid.required() });
export const idParamSchema = Joi.object({ id: uuid.required() });
export const itemWithRuleIdParamSchema = Joi.object({
  id: uuid.required(),
  ruleId: uuid.required(),
});
export const itemWithWindowIdParamSchema = Joi.object({
  id: uuid.required(),
  windowId: uuid.required(),
});
export const windowIdInBodySchema = Joi.object({ windowId: uuid });

// ── Inventory domain schemas (Week 8) ─────────────────────────────────────────

const INVENTORY_UNITS = ['KG', 'G', 'L', 'ML', 'UNIT', 'BOX'] as const;
const TRANSACTION_TYPES = ['RESTOCK', 'USAGE', 'ADJUSTMENT', 'RETURN'] as const;

export const createInventoryItemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  sku: Joi.string().trim().min(1).max(64).required(),
  currentStock: Joi.number().min(0).precision(3).default(0),
  minStock: Joi.number().min(0).precision(3).required(),
  maxStock: Joi.number().min(0).precision(3).allow(null),
  unit: Joi.string()
    .valid(...INVENTORY_UNITS)
    .default('UNIT'),
  costPrice: Joi.number().min(0).precision(2).allow(null),
  sellingPrice: Joi.number().min(0).precision(2).allow(null),
  supplierId: uuid.allow(null),
  isActive: Joi.boolean().default(true),
});

export const updateInventoryItemSchema = createInventoryItemSchema.fork(
  ['name', 'sku', 'minStock'],
  (field) => field.optional(),
);

/**
 * Phase 5 S3.1 — CSV inventory import rows.
 *
 * Server-side schema: accepts tolerant input (legacy imports often include a
 * header row exported from spreadsheets) and coerces supplier names to IDs.
 * Returns per-row errors instead of failing the whole batch.
 */

// Matches the canonical Week-8 unit enum exactly — see INVENTORY_UNITS above.
export const inventoryImportRowSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  sku: Joi.string().trim().min(1).max(64).required(),
  currentStock: Joi.number().min(0).precision(3).default(0),
  minStock: Joi.number().min(0).precision(3).required(),
  maxStock: Joi.number().min(0).precision(3).allow(null),
  unit: Joi.string().trim().uppercase().valid(...INVENTORY_UNITS).default('UNIT'),
  costPrice: Joi.number().min(0).precision(2).allow(null),
  sellingPrice: Joi.number().min(0).precision(2).allow(null),
  supplierName: Joi.string().trim().max(200).allow(null, ''),
});

/** Request body for POST /api/inventory/items/import (S3.1). */
export const inventoryImportBodySchema = Joi.object({
  format: Joi.string().valid('csv').default('csv'),
  /** Preview-only: validate and count, don't write anything. */
  dryRun: Joi.boolean().default(false),
  data: Joi.string().min(1).max(2_000_000).required(),
});

export const inventoryItemQuerySchema = Joi.object({
  q: Joi.string().trim().max(200),
  supplierId: uuid,
  lowStock: Joi.boolean(),
  isActive: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('name', 'stock_asc', 'stock_desc', 'newest').default('newest'),
});

/** USAGE/RESTOCK/RETURN take a positive delta; ADJUSTMENT is a stock-take (absolute level ≥ 0). */
export const stockTransactionSchema = Joi.object({
  transactionType: Joi.string()
    .valid(...TRANSACTION_TYPES)
    .required(),
  quantity: Joi.when('transactionType', {
    is: 'ADJUSTMENT',
    then: Joi.number().min(0).precision(3).required(),
    otherwise: Joi.number().greater(0).precision(3).required(),
  }),
  unitCost: Joi.number().min(0).precision(2).allow(null),
  reference: Joi.string().trim().max(120).allow(null),
  notes: Joi.string().trim().max(500).allow(null),
});

export const transactionQuerySchema = Joi.object({
  type: Joi.string().valid(...TRANSACTION_TYPES),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const consumptionQuerySchema = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
});

// ── Supplier schemas ──────────────────────────────────────────────────────────

export const createSupplierSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  contactName: Joi.string().trim().max(120).allow(null),
  email: Joi.string().email().max(255).allow(null),
  phone: Joi.string().trim().max(20).allow(null),
  address: Joi.string().trim().max(500).allow(null),
  isActive: Joi.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema.fork(
  ['name'],
  (field) => field.optional(),
);

export const supplierQuerySchema = Joi.object({
  q: Joi.string().trim().max(200),
  isActive: Joi.boolean(),
});

// ── Purchase-order schemas ────────────────────────────────────────────────────

const PO_STATUSES = ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const;

const poLineSchema = Joi.object({
  inventoryItemId: uuid.required(),
  quantityOrdered: Joi.number().greater(0).precision(3).required(),
  unitCost: Joi.number().min(0).precision(2).allow(null),
});

export const createPurchaseOrderSchema = Joi.object({
  supplierId: uuid.required(),
  orderNumber: Joi.string().trim().min(1).max(40),
  expectedAt: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(500).allow(null),
  items: Joi.array().items(poLineSchema).min(1).max(100).required(),
});

export const updatePurchaseOrderSchema = Joi.object({
  supplierId: uuid,
  expectedAt: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(500).allow(null),
  items: Joi.array().items(poLineSchema).min(1).max(100),
}).min(1);

export const purchaseOrderQuerySchema = Joi.object({
  status: Joi.string().valid(...PO_STATUSES),
  supplierId: uuid,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const receivePurchaseOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        itemId: uuid.required(), // PurchaseOrderItem id
        quantity: Joi.number().greater(0).precision(3).required(),
        unitCost: Joi.number().min(0).precision(2).allow(null),
      }),
    )
    .min(1)
    .max(100)
    .required(),
});

// ── Inventory domain param schemas ────────────────────────────────────────────

export const itemWithPoItemIdParamSchema = Joi.object({
  id: uuid.required(),
  itemId: uuid.required(),
});

export const poIdParamSchema = Joi.object({ id: uuid.required() });

// ── Order domain schemas (Week 9) ─────────────────────────────────────────────

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const;
export const PAYMENT_METHODS = ['CASH', 'CARD', 'ONLINE'] as const;

const orderLineSchema = Joi.object({
  menuItemId: uuid.required(),
  quantity: Joi.number().integer().min(1).max(99).required(),
  specialInstructions: Joi.string().trim().max(300).allow(null),
});

export const createOrderSchema = Joi.object({
  customerId: uuid.allow(null),
  tableId: uuid.allow(null),
  specialRequests: Joi.string().trim().max(500).allow(null),
  items: Joi.array().items(orderLineSchema).min(1).max(50).required(),
  // Week 20.1 — optional future fulfillment time (bounded at the controller).
  scheduledFor: Joi.date().iso().greater('now').allow(null),
  // Week 20.4 — promo code validated against the snapshotted subtotal.
  promoCode: Joi.string().trim().max(32).allow(null),
  // Week 20.3 — loyalty points to redeem (balance-checked server-side).
  loyaltyPoints: Joi.number().integer().min(1).allow(null),
});

// ── Advanced ordering schemas (Week 20) ──────────────────────────────────────

/** 20.2 — contribute lines to somebody else's group order. */
export const groupOrderItemSchema = Joi.object({
  menuItemId: uuid.required(),
  quantity: Joi.number().integer().min(1).max(50).required(),
  specialInstructions: Joi.string().trim().max(255).allow(null),
});

export const groupOrderCodeParamSchema = Joi.object({
  code: Joi.string().trim().min(4).max(12).uppercase().required(),
});

/** 20.3 — loyalty redemption request shape (integer ≥ 1). */
export const loyaltyRedeemSchema = Joi.object({
  points: Joi.number().integer().min(1).required(),
});

/** 20.4 — promotional codes. Percent values are 0 < v ≤ 100. */
export const promoTypeValues = ['PERCENT', 'FIXED'] as const;

export const promoCodeCreateSchema = Joi.object({
  code: Joi.string().trim().min(2).max(32).uppercase().required(),
  type: Joi.string().valid(...promoTypeValues).required(),
  value: Joi.number().positive().max(100).when('type', {
    is: 'PERCENT',
    then: Joi.number().positive().max(100),
    otherwise: Joi.number().positive().max(1_000_000),
  }).required(),
  minSubtotal: Joi.number().min(0).allow(null),
  maxRedemptions: Joi.number().integer().min(1).allow(null),
  startsAt: Joi.date().iso().allow(null),
  endsAt: Joi.date().iso().greater(Joi.ref('startsAt')).allow(null),
  isActive: Joi.boolean(),
});

export const promoCodeUpdateSchema = Joi.object({
  code: Joi.string().trim().min(2).max(32).uppercase(),
  type: Joi.string().valid(...promoTypeValues),
  value: Joi.number().positive().max(1_000_000),
  minSubtotal: Joi.number().min(0).allow(null),
  maxRedemptions: Joi.number().integer().min(1).allow(null),
  startsAt: Joi.date().iso().allow(null),
  endsAt: Joi.date().iso().allow(null),
  isActive: Joi.boolean(),
}).min(1);

export const promoValidateSchema = Joi.object({
  code: Joi.string().trim().min(2).max(32).required(),
  subtotal: Joi.number().min(0).required(),
});

export const recurrenceValues = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

const recurringItemSchema = Joi.object({
  menuItemId: uuid.required(),
  quantity: Joi.number().integer().min(1).max(20).required(),
  specialInstructions: Joi.string().trim().max(255).allow(null),
});

/** 20.6 — subscription baskets. */
export const recurringOrderCreateSchema = Joi.object({
  items: Joi.array().items(recurringItemSchema).min(1).max(20).required(),
  recurrence: Joi.string().valid(...recurrenceValues).required(),
  startAt: Joi.date().iso().optional(),
});

export const recurringOrderUpdateSchema = Joi.object({
  items: Joi.array().items(recurringItemSchema).min(1).max(20),
  recurrence: Joi.string().valid(...recurrenceValues),
  nextRunAt: Joi.date().iso().greater('now').allow(null),
  isActive: Joi.boolean(),
}).min(1);

export const updateOrderSchema = Joi.object({
  specialRequests: Joi.string().trim().max(500).allow(null),
  tableId: uuid.allow(null),
}).min(1);

export const orderQuerySchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES),
  tableId: uuid,
  customerId: uuid,
  mine: Joi.boolean(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const orderStatusSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES).required(),
});

/** Week 21.2 — staff assignment on orders (kitchen+). */
export const orderAssignSchema = Joi.object({
  staffId: uuid.required(),
});

/** Week 21.2 — optional live-status filter for the kitchen queue. */
export const kitchenQueueQuerySchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES).optional(),
});

/** Week 21.3 — prep-time analytics window (days looked back). */
export const kitchenAnalyticsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(30).default(1),
});

/**
 * Week 21.4/21.5 — kitchen tuning knobs (MANAGER+ writable), persisted under
 * `Tenant.settings.kitchen`. capacity 0 explicitly disables the soft cap.
 */
export const kitchenSettingsSchema = Joi.object({
  prepTimeTargetMinutes: Joi.number().integer().min(1).max(240),
  capacity: Joi.number().integer().min(0).max(999),
}).min(1);

/** Kitchen line progress only ever advances PREPARING or READY. */
export const orderItemStatusSchema = Joi.object({
  status: Joi.string().valid('PREPARING', 'READY').required(),
});

export const payOrderSchema = Joi.object({
  method: Joi.string().valid(...PAYMENT_METHODS).required(),
  amount: Joi.number().positive().precision(2),
  transactionId: Joi.string().trim().max(120).allow(null),
});

export const orderWithItemIdParamSchema = Joi.object({
  id: uuid.required(),
  itemId: uuid.required(),
});

export const orderSummaryQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
});

// ── Review domain schemas (Week 11) ───────────────────────────────────────────

export const createReviewSchema = Joi.object({
  orderId: uuid.required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow(null),
});

export const reviewQuerySchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  isVisible: Joi.boolean(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const reviewVisibilitySchema = Joi.object({
  isVisible: Joi.boolean().required(),
});

// ── User profile schemas (Week 11) ────────────────────────────────────────────

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().min(1).max(100),
  phone: Joi.string().trim().max(20).allow(null),
}).min(1);

// ── Feature flag domain schemas (Week 14) ─────────────────────────────────────

const flagName = Joi.string()
  .trim()
  .min(2)
  .max(64)
  .pattern(/^[a-z0-9_]+$/)
  .message('Flag name must be 2-64 characters using only lowercase letters, digits, and underscores');

export const createFeatureFlagSchema = Joi.object({
  name: flagName.required(),
  description: Joi.string().trim().max(500).allow(null),
  isEnabled: Joi.boolean().default(false),
});

export const updateFeatureFlagSchema = Joi.object({
  name: flagName,
  description: Joi.string().trim().max(500).allow(null),
  isEnabled: Joi.boolean(),
}).min(1);

export const featureFlagIdParamSchema = Joi.object({ id: uuid.required() });

/** Per-tenant overrides: `{ flagName: boolean | null }` — null clears an override. */
export const updateFeatureConfigSchema = Joi.object({
  overrides: Joi.object()
    .pattern(flagName, Joi.boolean().allow(null))
    .max(200)
    .required(),
});

// ── Tenant domain schemas (Week 15) ───────────────────────────────────────────

const currencyCode = Joi.string().trim().uppercase().length(3);

/** Opens a brand-new restaurant account through onboarding (15.4). */
export const onboardingSchema = Joi.object({
  restaurantName: Joi.string().trim().min(2).max(120).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
  timezone: Joi.string().trim().max(64),
  currency: currencyCode,
  taxRate: Joi.number().min(0).max(100).precision(2),
});

// ── Tenant branding & theme schema (Week 17) ─────────────────────────────────

const HEX_COLOR = Joi.string()
  .pattern(/^#[0-9a-fA-F]{6}$/)
  .message('must be a 6-digit hex color like #DC2626');

/**
 * Week 17 — the `Tenant.theme` JSON document: brand palette defaults plus
 * branding assets. Mirrors packages/web/src/lib/theme.ts (ThemePrefs) and
 * types/tenant.ts (TenantTheme) — keep the three unions in sync.
 * `logoUrl` is https-only to prevent mixed-content injection on the storefront.
 */
export const tenantThemeSchema = Joi.object({
  preset: Joi.string().valid('classic', 'emerald', 'sunset', 'custom').required(),
  mode: Joi.string().valid('light', 'dark', 'system').required(),
  custom: Joi.object({
    primary: HEX_COLOR.required(),
    secondary: HEX_COLOR.required(),
  }).allow(null),
  branding: Joi.object({
    logoUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow(null),
    fontFamily: Joi.string().valid('inter', 'georgia', 'trebuchet', 'mono').allow(null),
  }).allow(null),
}).allow(null);

/** Self-service tenant profile/config update (15.2/15.3). Slug is immutable.
 * S2.6 (manual billing): plan / subscriptionStatus / isActive are NO LONGER
 * self-service — the operator manages all commercial state via the audited
 * /api/platform surface. A tenant must never be able to lift its own
 * suspension (that would bypass the manual lapse flow entirely). */
export const updateTenantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  email: Joi.string().email().max(255).allow(null),
  phone: Joi.string().trim().max(20).allow(null),
  address: Joi.string().trim().max(500).allow(null),
  timezone: Joi.string().trim().max(64),
  currency: currencyCode,
  taxRate: Joi.number().min(0).max(100).precision(2),
  operatingHours: Joi.object().pattern(Joi.string(), Joi.object().pattern(Joi.string(), Joi.string())).allow(null),
  // Week 17.2/17.5 — tenant-wide theme & branding document.
  theme: tenantThemeSchema,
}).min(1);

export const tenantAnalyticsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
});

// ── Phase 5 S2.2 — platform (super-admin) schemas ────────────────────────────

/** Operator-only commercial state changes; every write is audit-logged. */
export const platformTenantUpdateSchema = Joi.object({
  plan: Joi.string().valid('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'),
  subscriptionStatus: Joi.string().valid('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'),
  seatsLimit: Joi.number().integer().min(1).max(10_000),
  isActive: Joi.boolean(),
}).min(1);

/** S5 — operator provisions a workspace + first ADMIN in one audited call. */
export const platformTenantCreateSchema = Joi.object({
  restaurantName: Joi.string().trim().min(2).max(120).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
  plan: Joi.string().valid('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE').default('TRIAL'),
  subscriptionStatus: Joi.string().valid('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED').default('TRIAL'),
  seatsLimit: Joi.number().integer().min(1).max(10_000).default(10),
  timezone: Joi.string().trim().max(64),
  currency: currencyCode,
  taxRate: Joi.number().min(0).max(100).precision(2),
});

/** GET /api/platform/tenants list filters. */
export const platformListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').max(120),
});

// ── Staff management & audit schemas (Week 16) ───────────────────────────────

/** Week 16.5 — per-user permission overrides; null clears all overrides. */
export const permissionOverridesSchema = Joi.object()
  .pattern(
    Joi.string().trim().min(1),
    Joi.alternatives(Joi.boolean(), Joi.valid(null)),
  )
  .max(50);

/** Week 16.5 — staff creation payload (ADMIN/MANAGER; customer self-registration is separate). */
export const createStaffSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  role: Joi.string().trim().uppercase().valid('MANAGER', 'KITCHEN', 'SERVER').required(),
});

/** Week 16.5 — profile edit + role change payload. */
export const updateStaffSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100),
  lastName: Joi.string().trim().min(1).max(100),
  role: Joi.string().trim().uppercase().valid('MANAGER', 'KITCHEN', 'SERVER'),
  permissionOverrides: permissionOverridesSchema.allow(null),
}).min(1);

/** Week 16.6 — audit-trail filters. */
export const auditLogQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  action: Joi.string().trim().min(1).max(100),
  targetType: Joi.string().trim().min(1).max(50),
  targetId: Joi.string().trim().min(1).max(64),
});

/** Week 16.5 — staff directory listing filters. */
export const staffListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  role: Joi.string().trim().uppercase().valid('MANAGER', 'KITCHEN', 'SERVER', 'CUSTOMER'),
  q: Joi.string().trim().max(100),
});

// ── Analytics & reporting schemas (Week 19) ──────────────────────────────────

export const analyticsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
});

/** Week 19.4 — export a report as CSV (Excel) or PDF. */
export const analyticsExportQuerySchema = Joi.object({
  type: Joi.string().valid('sales', 'inventory', 'customers').required(),
  format: Joi.string().valid('csv', 'pdf').default('csv'),
  days: Joi.number().integer().min(1).max(365).default(30),
});

/** Week 19.6 — saved report configuration ("template"). */
export const reportTemplateConfigSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
  sections: Joi.array().items(Joi.string().trim().min(1).max(60)).max(12),
});

export const reportTemplateCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  type: Joi.string().valid('sales', 'inventory', 'customers').required(),
  config: reportTemplateConfigSchema.default({ days: 30 }),
});

/** Update allows any subset; config is NOT defaulted here so a bare rename
 *  never silently re-stamps { days: 30 } over the tenant's saved window. */
export const reportTemplateUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  type: Joi.string().valid('sales', 'inventory', 'customers'),
  config: reportTemplateConfigSchema.optional(),
}).min(1);
