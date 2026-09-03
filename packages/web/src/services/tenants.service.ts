import api from '@/lib/api';
import type {
  OnboardingPayload,
  OnboardingResponse,
  TenantAnalytics,
  TenantProfile,
  TenantUpdatePayload,
} from '@/types/tenant';

/** Week 15 — tenant self-service endpoints (packages/api/src/routes/tenant.routes.ts). */
export const tenantService = {
  /** POST /api/tenants — public: onboard a brand-new restaurant account. */
  async onboard(payload: OnboardingPayload): Promise<OnboardingResponse> {
    const { data } = await api.post<OnboardingResponse>('/tenants', payload);
    return data;
  },

  /** GET /api/tenants/me — the current tenant's profile + user count. */
  async getMyTenant(): Promise<TenantProfile> {
    const { data } = await api.get<{ data: TenantProfile }>('/tenants/me');
    return data.data;
  },

  /** PATCH /api/tenants/me — update profile/config/billing fields (MANAGER+). */
  async updateMyTenant(payload: TenantUpdatePayload): Promise<TenantProfile> {
    const { data } = await api.patch<{ data: TenantProfile }>('/tenants/me', payload);
    return data.data;
  },

  /** GET /api/tenants/me/analytics — usage + billing (MANAGER+). */
  async getAnalytics(days = 30): Promise<TenantAnalytics> {
    const { data } = await api.get<{ data: TenantAnalytics }>('/tenants/me/analytics', {
      params: { days },
    });
    return data.data;
  },
};