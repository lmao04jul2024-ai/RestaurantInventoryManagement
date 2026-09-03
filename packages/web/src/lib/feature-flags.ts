/**
 * Week 14 — client-side feature-flag helpers (pure, unit-tested).
 * Server state is authoritative; these helpers keep the UI honest between
 * refetches and normalize admin form input into registry-safe keys.
 */

/** Normalizes a human-entered label into a `[a-z0-9_]` flag key. */
export function slugifyFlagName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export interface FeatureStateInput {
  globalEnabled: boolean;
  tenantOverride: boolean | null;
}

/** Effective state — the per-tenant override wins, else the global default. */
export function resolveFlagState({ globalEnabled, tenantOverride }: FeatureStateInput): boolean {
  return tenantOverride === null ? globalEnabled : tenantOverride;
}