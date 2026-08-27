/**
 * Pure, platform-agnostic rules engine for menu item availability and pricing.
 *
 * Consumed by the API (`/api/menus/items/:id/effective`) and available to any
 * TypeScript client. Time semantics are RESTAURANT-LOCAL: callers pass a Date
 * and this module interprets it with local-time accessors (getDay/getHours),
 * so evaluate with the restaurant's timezone context on the server.
 */

/** 0 = Sunday … 6 = Saturday (matches Date#getDay). */
export type DayOfWeek = number;

/** Common shape for anything scoped by weekday + a time-of-day range. */
export interface TimeWindowSpec {
  /** Weekdays the window applies to. Empty/omitted array = every day. */
  daysOfWeek?: DayOfWeek[];
  /** Inclusive "HH:mm" local start time. */
  startTime?: string | null;
  /**
   * Exclusive "HH:mm" local end time. If earlier than startTime the window
   * wraps past midnight (e.g. 22:00 → 02:00).
   */
  endTime?: string | null;
}

export type PricingAdjustmentType = 'PERCENT_DISCOUNT' | 'FIXED_PRICE';

export interface PricingRuleSpec extends TimeWindowSpec {
  id: string;
  adjustmentType: PricingAdjustmentType;
  /**
   * PERCENT_DISCOUNT → percent off the base price, clamped to (0..100].
   * FIXED_PRICE → absolute replacement price (> 0).
   */
  amount: number;
  /** When several rules match simultaneously the highest priority wins. Default 0. */
  priority?: number;
  isActive?: boolean;
}

export interface AvailabilityWindowSpec extends TimeWindowSpec {
  /** Present when the spec wraps a persisted row (used by clients as list keys). */
  id?: string;
  isActive?: boolean;
}

export interface PriceComputation {
  basePrice: number;
  effectivePrice: number;
  discountAmount: number;
  appliedRuleIds: string[];
}

const MINUTES_PER_HOUR = 60;

function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * MINUTES_PER_HOUR + minutes;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

/** True when the given local date/time falls inside this time window. */
export function windowMatchesAt(window: TimeWindowSpec, at: Date): boolean {
  const days = window.daysOfWeek ?? [];
  if (days.length > 0 && !days.includes(at.getDay())) {
    return false;
  }

  const start = parseHhMm(window.startTime ?? undefined);
  const end = parseHhMm(window.endTime ?? undefined);

  // No time bounds → all-day restriction on the matched weekdays only.
  if (start === null && end === null) return true;

  const current = minutesOfDay(at);

  if (start !== null && end !== null) {
    if (start <= end) {
      return current >= start && current < end;
    }
    // Overnight wrap: 22:00 → 02:00 covers [22:00,24:00) ∪ [00:00,02:00).
    return current >= start || current < end;
  }

  if (start !== null) return current >= start; // open-ended from start
  return current < (end as number); // until-only bound
}

/**
 * Whether an item can be ordered at the given instant.
 * - Hard toggle first: `isAvailable === false` always blocks.
 * - With NO active windows defined, the global toggle alone decides.
 * - With active windows, at least one must match the instant.
 */
export function isMenuItemAvailableNow(
  item: { isAvailable: boolean },
  windows: AvailabilityWindowSpec[] | null | undefined,
  at: Date = new Date(),
): boolean {
  if (!item.isAvailable) return false;

  const activeWindows = (windows ?? []).filter((w) => w.isActive !== false);
  if (activeWindows.length === 0) return true;

  return activeWindows.some((w) => windowMatchesAt(w, at));
}

function applyRule(basePrice: number, rule: PricingRuleSpec): number {
  if (rule.adjustmentType === 'FIXED_PRICE') {
    return Math.max(0, rule.amount);
  }
  const pct = Math.min(100, Math.max(0, rule.amount));
  return Math.max(0, basePrice * (1 - pct / 100));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Resolves the customer-facing price at an instant.
 *
 * Semantics (deliberately deterministic):
 * 1. Only ACTIVE rules whose time window matches are candidates.
 * 2. Exactly ONE rule applies — highest `priority`; ties broken by whichever
 *    yields the greater reduction; further ties keep the earliest declared rule.
 * 3. Result never drops below 0 and is rounded to 2 decimal places.
 */
export function computeEffectivePrice(
  basePrice: number,
  rules: PricingRuleSpec[] | null | undefined,
  at: Date = new Date(),
): PriceComputation {
  const candidates = (rules ?? []).filter(
    (r) => r.isActive !== false && windowMatchesAt(r, at),
  );

  if (candidates.length === 0) {
    return {
      basePrice,
      effectivePrice: round2(basePrice),
      discountAmount: 0,
      appliedRuleIds: [],
    };
  }

  let best = candidates[0];
  let bestReduction = basePrice - applyRule(basePrice, best);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const reduction = basePrice - applyRule(basePrice, candidate);
    const bestPriority = best.priority ?? 0;
    const candidatePriority = candidate.priority ?? 0;

    if (
      candidatePriority > bestPriority ||
      (candidatePriority === bestPriority && reduction > bestReduction)
    ) {
      best = candidate;
      bestReduction = reduction;
    }
  }

  const effectivePrice = Math.max(0, round2(applyRule(basePrice, best)));
  return {
    basePrice,
    effectivePrice,
    discountAmount: Math.max(0, round2(basePrice - effectivePrice)),
    appliedRuleIds: [best.id],
  };
}