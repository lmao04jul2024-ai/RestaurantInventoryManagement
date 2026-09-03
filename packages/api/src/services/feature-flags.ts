import type { Prisma } from '@prisma/client';

/**
 * Week 14 — feature-flag evaluation helpers.
 *
 * Contract: a flag's runtime state for a tenant = the tenant's own override in
 * `Tenant.features[name]` when present, otherwise the global default in
 * `FeatureFlag.isEnabled`. Tenant overrides are stored as a plain object
 * `{ [flagName]: boolean }` inside the tenant's `features` Json column, so
 * restaurants can tune features without code deploys.
 */

export type FeatureOverrides = Record<string, boolean>;

/** Defensively narrows the opaque Json `Tenant.features` into a boolean map. */
export function normalizeOverrides(value: Prisma.JsonValue | null | undefined): FeatureOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: FeatureOverrides = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'boolean') out[key] = val;
  }
  return out;
}

/** Effective decision for one flag — the tenant override wins, else the global default. */
export function isEnabled(globalEnabled: boolean, overrides: FeatureOverrides, name: string): boolean {
  return name in overrides ? overrides[name] : globalEnabled;
}

export interface FlagRow {
  name: string;
  isEnabled: boolean;
}

/** Builds the plain `{ [name]: boolean }` map loaded into `req.featureFlags`. */
export function buildEffectiveMap(flags: FlagRow[], overrides: FeatureOverrides): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const flag of flags) map[flag.name] = isEnabled(flag.isEnabled, overrides, flag.name);
  return map;
}