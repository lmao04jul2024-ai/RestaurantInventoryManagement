import api from '@/lib/api';
import type {
  SecurityEventsParams,
  SecurityEventsResponse,
  SecurityHealth,
} from '@/types/security';

/**
 * Week 22.6 — security monitoring surface (ADMIN only server-side).
 * All reads come from the immutable audit trail (`security:*` actions).
 */
export const securityService = {
  /** GET /api/security/events — recent security events + 24h rollup. */
  async events(params: SecurityEventsParams = {}): Promise<SecurityEventsResponse> {
    const { data } = await api.get<SecurityEventsResponse>('/security/events', { params });
    return data;
  },

  /** GET /api/security/health — control-objectives board (rate limit, headers, keys, backups). */
  async health(): Promise<SecurityHealth> {
    const { data } = await api.get<{ data: SecurityHealth }>('/security/health');
    return data.data;
  },
};