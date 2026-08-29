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
});

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
