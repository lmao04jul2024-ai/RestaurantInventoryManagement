/**
 * Security & compliance types mirroring the Week-22 API contract
 * (security.controller.ts: GET /api/security/events + /api/security/health).
 */

export interface SecurityEvent {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SecurityEventsParams {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
}

export interface SecurityEventsResponse {
  data: SecurityEvent[];
  meta: { page: number; limit: number; total: number; pages: number };
  /** 24h rollup by action — the alerting signal consumed by the Security page. */
  summary: { last24h: number; byAction: Record<string, number> };
}

export interface SecurityCheck {
  ok: boolean;
  detail: string;
}

export interface SecurityHealth {
  healthy: boolean;
  checkedAt: string;
  checks: Record<string, SecurityCheck>;
}