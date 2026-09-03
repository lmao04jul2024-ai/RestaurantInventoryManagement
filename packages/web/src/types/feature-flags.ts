/**
 * Week 14 — feature flag registry + tenant configuration types mirroring the
 * API contract (packages/api/src/controllers/feature-flag.controller.ts).
 */

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  /** Global default from the registry. */
  globalEnabled: boolean;
  /** Per-tenant override — null means "inherit the global default". */
  tenantOverride: boolean | null;
  /** Effective state for the current tenant (override wins). */
  enabled: boolean;
}

/** Effective `{ flagName: boolean }` map returned by GET /api/feature-flags/config. */
export type FeatureFlagConfig = Record<string, boolean>;

export interface FeatureFlagPayload {
  name: string;
  description?: string | null;
  isEnabled?: boolean;
}

export type FeatureFlagUpdatePayload = Partial<FeatureFlagPayload>;