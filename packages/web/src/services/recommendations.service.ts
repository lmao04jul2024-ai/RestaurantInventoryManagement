import api from '@/lib/api';
import type { RecommendationResponse } from '@/types/advanced-ordering';

/** Week 20.5 — personalized recommendations (packages/api/src/routes/recommendations.routes.ts). */
export const recommendationService = {
  async getRecommendations(): Promise<RecommendationResponse> {
    const { data } = await api.get<{ data: RecommendationResponse }>('/recommendations');
    return data.data;
  },
};
