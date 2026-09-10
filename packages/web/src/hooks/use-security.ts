'use client';

import { useQuery } from '@tanstack/react-query';
import { securityService } from '@/services/security.service';
import type { SecurityEventsParams } from '@/types/security';

/** Week 22.6 — ADMIN security-monitoring queries. */

/** Recent `security:*` audit events with the 24h rollup by action. */
export function useSecurityEvents(params: SecurityEventsParams = {}) {
  return useQuery({
    queryKey: ['security-events', params],
    queryFn: () => securityService.events(params),
    staleTime: 10_000,
  });
}

/** Control-objectives health board (limiter, headers, keys, backups). */
export function useSecurityHealth() {
  return useQuery({
    queryKey: ['security-health'],
    queryFn: () => securityService.health(),
    staleTime: 30_000,
  });
}