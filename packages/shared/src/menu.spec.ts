import { computeEffectivePrice, isMenuItemAvailableNow } from './menu';
import type { AvailabilityWindowSpec, PricingRuleSpec } from './menu';

/**
 * Deterministic fixture dates — February 2026 starts on a Sunday.
 * All dates constructed with local components so assertions are TZ-independent.
 */
const SUNDAY = (h: number, m = 0) => new Date(2026, 1, 1, h, m);
const MONDAY = (h: number, m = 0) => new Date(2026, 1, 2, h, m);
const SATURDAY = (h: number, m = 0) => new Date(2026, 1, 7, h, m);

const rule = (over: Partial<PricingRuleSpec>): PricingRuleSpec => ({
  id: 'r1',
  adjustmentType: 'PERCENT_DISCOUNT',
  amount: 10,
  daysOfWeek: [],
  ...over,
});

const win = (over: Partial<AvailabilityWindowSpec>): AvailabilityWindowSpec => ({
  id: 'w1',
  daysOfWeek: [],
  ...over,
});

describe('computeEffectivePrice', () => {
  it('returns the base price untouched when no rules apply', () => {
    const result = computeEffectivePrice(19.99, [], MONDAY(12));
    expect(result).toEqual({
      basePrice: 19.99,
      effectivePrice: 19.99,
      discountAmount: 0,
      appliedRuleIds: [],
    });
  });

  it('treats undefined/null rule lists as no rules', () => {
    expect(computeEffectivePrice(8.5, null, MONDAY(12)).effectivePrice).toBe(8.5);
    expect(computeEffectivePrice(8.5, undefined, MONDAY(12)).appliedRuleIds).toEqual([]);
  });

  it('applies percentage discounts with cent rounding', () => {
    // 19.99 - 15% = 16.9915 → rounds to 16.99
    const result = computeEffectivePrice(
      19.99,
      [rule({ amount: 15 })],
      MONDAY(12),
    );
    expect(result.effectivePrice).toBe(16.99);
    expect(result.discountAmount).toBe(3);
    expect(result.appliedRuleIds).toEqual(['r1']);
  });

  it('clamps runaway percentages defensively to 100%', () => {
    expect(
      computeEffectivePrice(24, [rule({ amount: 150 })], MONDAY(12)).effectivePrice,
    ).toBe(0);
  });

  it('FIXED_PRICE replaces the price outright', () => {
    const result = computeEffectivePrice(
      12.5,
      [rule({ adjustmentType: 'FIXED_PRICE', amount: 9.99 })],
      MONDAY(12),
    );
    expect(result.effectivePrice).toBe(9.99);
    expect(result.discountAmount).toBe(2.51);
  });

  it('highest priority wins even when another rule discounts more', () => {
    const result = computeEffectivePrice(
      100,
      [
        rule({ id: 'deep-cut', amount: 50 }), // 50.00 reduction
        rule({ id: 'tiny-priority', amount: 5, priority: 9 }), // 5.00 reduction
      ],
      MONDAY(12),
    );
    expect(result.appliedRuleIds).toEqual(['tiny-priority']);
    expect(result.effectivePrice).toBe(95);
  });

  it('breaks priority ties by the greater reduction', () => {
    const result = computeEffectivePrice(
      100,
      [
        rule({ id: 'small', amount: 10 }),
        rule({ id: 'big', amount: 20 }),
      ],
      MONDAY(12),
    );
    expect(result.appliedRuleIds).toEqual(['big']);
  });

  it('skips inactive rules entirely', () => {
    const result = computeEffectivePrice(
      100,
      [rule({ amount: 50, isActive: false })],
      MONDAY(12),
    );
    expect(result.effectivePrice).toBe(100);
    expect(result.appliedRuleIds).toEqual([]);
  });

  it('only considers rules whose weekday matches the instant', () => {
    const saturdayOnly = rule({ amount: 30, daysOfWeek: [6] }); // 6 = Saturday
    expect(
      computeEffectivePrice(50, [saturdayOnly], SATURDAY(12)).effectivePrice,
    ).toBe(35);
    expect(
      computeEffectivePrice(50, [saturdayOnly], MONDAY(12)).effectivePrice,
    ).toBe(50);
  });

  it('end time is exclusive (item reverts exactly at closing minute)', () => {
    const untilFive = rule({ amount: 25, startTime: '09:00', endTime: '17:00' });
    expect(
      computeEffectivePrice(40, [untilFive], MONDAY(16, 59)).effectivePrice,
    ).toBe(30);
    expect(
      computeEffectivePrice(40, [untilFive], MONDAY(17)).effectivePrice,
    ).toBe(40);
  });

  it('supports overnight windows wrapping past midnight', () => {
    const lateNight = rule({
      adjustmentType: 'FIXED_PRICE',
      amount: 6,
      startTime: '22:00',
      endTime: '02:00',
    });
    // 23:59 Sunday ✓ (within [22:00, 24:00))
    expect(
      computeEffectivePrice(11, [lateNight], SUNDAY(23, 59)).appliedRuleIds,
    ).toEqual(['r1']);
    // 01:00 Monday ✓ ([00:00, 02:00) side of the wrap)
    expect(computeEffectivePrice(11, [lateNight], MONDAY(1)).effectivePrice).toBe(6);
    // 03:00 ✗
    expect(computeEffectivePrice(11, [lateNight], MONDAY(3)).effectivePrice).toBe(11);
  });

  it('open-ended windows bind from the start time onward', () => {
    const fromOpen = rule({ amount: 10, startTime: '14:00' });
    expect(computeEffectivePrice(30, [fromOpen], MONDAY(13)).effectivePrice).toBe(30);
    expect(computeEffectivePrice(30, [fromOpen], MONDAY(14)).effectivePrice).toBe(27);
    expect(computeEffectivePrice(30, [fromOpen], MONDAY(23)).effectivePrice).toBe(27);
  });
});

describe('isMenuItemAvailableNow', () => {
  it('global toggle false always blocks, even with matching windows', () => {
    expect(
      isMenuItemAvailableNow(
        { isAvailable: false },
        [win({ startTime: '00:00', endTime: '23:59' })],
        MONDAY(12),
      ),
    ).toBe(false);
  });

  it('no windows defined → global toggle alone decides', () => {
    expect(isMenuItemAvailableNow({ isAvailable: true }, [], MONDAY(12))).toBe(true);
    expect(isMenuItemAvailableNow({ isAvailable: true }, undefined, MONDAY(12))).toBe(
      true,
    );
  });

  it('active window outside the current time blocks ordering', () => {
    expect(
      isMenuItemAvailableNow(
        { isAvailable: true },
        [win({ daysOfWeek: [1], startTime: '18:00', endTime: '21:00' })],
        MONDAY(12),
      ),
    ).toBe(false);
  });

  it('matching active window allows ordering', () => {
    expect(
      isMenuItemAvailableNow(
        { isAvailable: true },
        [win({ daysOfWeek: [1], startTime: '11:00', endTime: '14:00' })],
        MONDAY(12),
      ),
    ).toBe(true);
  });

  it('any matching window among several is sufficient (OR semantics)', () => {
    expect(
      isMenuItemAvailableNow(
        { isAvailable: true },
        [
          win({ id: 'a', daysOfWeek: [2] }),
          win({ id: 'b', daysOfWeek: [1], endTime: '10:00' }),
        ],
        MONDAY(9),
      ),
    ).toBe(true);
  });

  it('inactive windows are ignored (fall back to global availability)', () => {
    expect(
      isMenuItemAvailableNow(
        { isAvailable: true },
        [win({ isActive: false, endTime: '06:00' })],
        MONDAY(12),
      ),
    ).toBe(true);
  });
});

