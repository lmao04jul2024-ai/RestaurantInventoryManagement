import api from '@/lib/api';
import type {
  PlatformListParams,
  PlatformListResult,
  PlatformTenantDetail,
  PlatformTenantUpdatePayload,
} from '@/types/platform';

/**
 * Phase 5 S2.2 — platform (super-admin) endpoints
 * (packages/api/src/routes/platform.routes.ts).
 *
 * Every route requires the PLATFORM_ADMIN role; the API rejects tenant staff
 * with 403 FORBIDDEN_ROLE. Mutations are audit-logged server-side.
 */
export const platformService = {
  /** GET /api/platform/tenants — every workspace with usage counts. */
  async listTenants(params: PlatformListParams = {}): Promise<PlatformListResult> {
    const { data } = await api.get<PlatformListResult>('/platform/tenants', { params });
    return data;
  },

  /** GET /api/platform/tenants/:id — detail, usage and the change trail. */
  async getTenant(tenantId: string): Promise<PlatformTenantDetail> {
    const { data } = await api.get<{ data: PlatformTenantDetail }>(`/platform/tenants/${tenantId}`);
    return data.data;
  },

  /** PATCH /api/platform/tenants/:id — operator-only commercial state. */
  async updateTenant(
    tenantId: string,
    payload: PlatformTenantUpdatePayload,
  ): Promise<PlatformTenantDetail> {
    const { data } = await api.patch<{ data: PlatformTenantDetail }>(
      `/platform/tenants/${tenantId}`,
      payload,
    );
    return data.data;
  },
};