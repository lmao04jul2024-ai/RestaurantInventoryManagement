import api from '@/lib/api';
import type { PromoCode, PromoValidation } from '@/types/advanced-ordering';

/** Week 20.4 — promotional-code endpoints (packages/api/src/routes/promo.routes.ts). */
export const promoService = {
  /** POST /api/promo-codes/validate — customer-side discount preview. */
  async validate(code: string, subtotal: number): Promise<PromoValidation> {
    const { data } = await api.post<{ data: PromoValidation }>('/promo-codes/validate', { code, subtotal });
    return data.data;
  },

  /** GET /api/promo-codes — manager/staff listing. */
  async listPromos(): Promise<PromoCode[]> {
    const { data } = await api.get<{ data: PromoCode[] }>('/promo-codes');
    return data.data;
  },

  /** POST /api/promo-codes — create a code (MANAGER+). */
  async createPromo(payload: Partial<PromoCode> & { code: string; type: 'PERCENT' | 'FIXED'; value: number }): Promise<PromoCode> {
    const { data } = await api.post<{ data: PromoCode }>('/promo-codes', payload);
    return data.data;
  },

  /** DELETE /api/promo-codes/:id (MANAGER+). */
  async deletePromo(id: string): Promise<void> {
    await api.delete(`/promo-codes/${id}`);
  },
};
