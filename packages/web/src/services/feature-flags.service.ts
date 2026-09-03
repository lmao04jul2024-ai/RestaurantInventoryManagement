import api from '@/lib/api';
import type {
  FeatureFlag,
  FeatureFlagConfig,
  FeatureFlagPayload,
  FeatureFlagUpdatePayload,
} from '@/types/feature-flags';

/** Week 14 — feature flag endpoints (packages/api/src/routes/feature-flag.routes.ts). */
export const featureFlagService = {
  /** GET /api/feature-flags — management list with effective state (staff). */
  async listFeatureFlags(): Promise<FeatureFlag[]> {
    const { data } = await api.get<{ data: FeatureFlag[] }>('/feature-flags');
    return data.data;
  },

  /** POST /api/feature-flags — register a new flag. */
  async createFeatureFlag(payload: FeatureFlagPayload): Promise<FeatureFlag> {
    const { data } = await api.post<{ data: FeatureFlag }>('/feature-flags', payload);
    return data.data;
  },

  /** PATCH /api/feature-flags/:id — update name/description/global default. */
  async updateFeatureFlag(id: string, payload: FeatureFlagUpdatePayload): Promise<FeatureFlag> {
    const { data } = await api.patch<{ data: FeatureFlag }>(`/feature-flags/${id}`, payload);
    return data.data;
  },

  /** DELETE /api/feature-flags/:id. */
  async deleteFeatureFlag(id: string): Promise<void> {
    await api.delete(`/feature-flags/${id}`);
  },

  /** GET /api/feature-flags/config — effective boolean map for the tenant. */
  async getConfig(): Promise<FeatureFlagConfig> {
    const { data } = await api.get<{ data: FeatureFlagConfig }>('/feature-flags/config');
    return data.data;
  },

  /** PATCH /api/feature-flags/config — merge per-tenant overrides (null clears). */
  async updateConfig(overrides: Record<string, boolean | null>): Promise<FeatureFlagConfig> {
    const { data } = await api.patch<{ data: FeatureFlagConfig }>('/feature-flags/config', {
      overrides,
    });
    return data.data;
  },
};