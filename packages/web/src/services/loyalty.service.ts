import api from '@/lib/api';
import type { LoyaltySummary } from '@/types/advanced-ordering';

/** Week 20.3 — customer loyalty endpoints (packages/api/src/routes/loyalty.routes.ts). */
export const loyaltyService = {
  /** GET /api/loyalty/me — own points balance + ledger history. */
  async getMyLoyalty(): Promise<LoyaltySummary> {
    const { data } = await api.get<{ data: LoyaltySummary }>('/loyalty/me');
    return data.data;
  },
};
