'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantService } from '@/services/tenants.service';
import type { TenantUpdatePayload } from '@/types/tenant';

/** Week 15 — tenant self-service queries + mutations. */

export const TENANT_KEYS = ['tenant'] as const;

/** Current tenant profile (shared by the dashboard/settings + plan card). */
export function useTenant() {
  return useQuery({
    queryKey: TENANT_KEYS,
    queryFn: () => tenantService.getMyTenant(),
    staleTime: 30_000,
  });
}

export function useTenantAnalytics(days = 30) {
  return useQuery({
    queryKey: [...TENANT_KEYS, 'analytics', days],
    queryFn: () => tenantService.getAnalytics(days),
    staleTime: 60_000,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TenantUpdatePayload) => tenantService.updateMyTenant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANT_KEYS });
    },
  });
}