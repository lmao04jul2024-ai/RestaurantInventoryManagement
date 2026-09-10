import type { Prisma } from '@prisma/client';

/**
 * Week 21.4/21.5 — kitchen tuning knobs.
 *
 * Settings live namespaced under the tenant's `settings` Json column
 * (`Tenant.settings.kitchen`), so future setting groups can join without a
 * migration. Absent or malformed values fall back to the defaults below —
 * normalization never throws (fail-open, mirroring feature-flags.ts).
 */
export interface KitchenSettings {
  /** Minutes a ticket should take from prep start to READY (21.4 target). */
  prepTimeTargetMinutes: number;
  /** Soft cap of concurrently active tickets; 0 disables the guard (21.5). */
  capacity: number;
}

export const KITCHEN_SETTINGS_DEFAULTS: KitchenSettings = {
  prepTimeTargetMinutes: 15,
  capacity: 20,
};

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Reads `Tenant.settings.kitchen`, filling defaults for absent/malformed keys. */
export function normalizeKitchenSettings(raw: Prisma.JsonValue | null | undefined): KitchenSettings {
  const out: KitchenSettings = { ...KITCHEN_SETTINGS_DEFAULTS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const kitchen = (raw as Record<string, unknown>).kitchen;
  if (!kitchen || typeof kitchen !== 'object' || Array.isArray(kitchen)) return out;
  const rec = kitchen as Record<string, unknown>;
  const prep = clampInt(rec.prepTimeTargetMinutes, 1, 240);
  if (prep !== null) out.prepTimeTargetMinutes = prep;
  const capacity = clampInt(rec.capacity, 0, 999);
  if (capacity !== null) out.capacity = capacity;
  return out;
}