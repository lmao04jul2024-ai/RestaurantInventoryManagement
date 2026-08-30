import api from '@/lib/api';
import type { AuthUser } from '@/types';

/**
 * Week 11.6 — profile self-service endpoints (packages/api/src/routes/user.routes.ts).
 * The API sanitizes input via updateProfileSchema (trim, length caps).
 */
export const userService = {
  /** GET /api/users/me */
  async getMyProfile(): Promise<AuthUser> {
    const { data } = await api.get<{ data: AuthUser }>('/users/me');
    return data.data;
  },

  /** PATCH /api/users/me — names/phone only (email/role are server-owned). */
  async updateMyProfile(
    payload: { firstName?: string; lastName?: string; phone?: string | null },
  ): Promise<AuthUser> {
    const { data } = await api.patch<{ data: AuthUser }>('/users/me', payload);
    return data.data;
  },
};
