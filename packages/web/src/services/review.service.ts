import api from '@/lib/api';
import { Pagination } from '@/types/menu';
import type { Review, ReviewLite } from '@/types/order';

/** Week 11 — Review & rating endpoints (packages/api/src/routes/review.routes.ts). */
export const reviewService = {
  /** POST /api/reviews — create a review on a completed order */
  async createReview(payload: { orderId: string; rating: number; comment?: string | null }): Promise<ReviewLite> {
    const { data } = await api.post<{ data: ReviewLite }>('/reviews', payload);
    return data.data;
  },

  /** GET /api/reviews/me — customer's own reviews */
  async listMyReviews(
    query: { rating?: number; isVisible?: boolean; page?: number; limit?: number } = {},
  ): Promise<{ data: ReviewLite[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: ReviewLite[]; pagination: Pagination }>('/reviews/me', {
      params: query,
    });
    return data;
  },

  /** GET /api/reviews — staff: all reviews for the tenant (includes order + customer) */
  async listReviews(
    query: { rating?: number; isVisible?: boolean; page?: number; limit?: number } = {},
  ): Promise<{ data: Review[]; pagination: Pagination }> {
    const { data } = await api.get<{ data: Review[]; pagination: Pagination }>('/reviews', {
      params: query,
    });
    return data;
  },

  /** PATCH /api/reviews/:id/visibility — staff only */
  async setVisibility(id: string, isVisible: boolean): Promise<Review> {
    const { data } = await api.patch<{ data: Review }>(`/reviews/${id}/visibility`, { isVisible });
    return data.data;
  },

  /** DELETE /api/reviews/:id — staff only */
  async deleteReview(id: string): Promise<void> {
    await api.delete(`/reviews/${id}`);
  },
};