'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformService } from '@/services/platform.service';
import type {
  PlatformListParams,
  PlatformTenantDetail,
  PlatformTenantUpdatePayload,
} from '@/types/platform';

/**
 * Phase 5 S2.2/S2.4 — platform console queries + mutations.
 *
 * The list and detail share the `platform-tenants` key prefix so an operator
 * change (S2.4) refreshes both the row on the list and the change trail on the
 * detail page.
 */

export const PLATFORM_KEYS = {
  tenants: (params: PlatformListParams = {}) => ['platform-tenants', 'list', params] as const,
  tenant: (tenantId: string) => ['platform-tenants', 'detail', tenantId] as const,
  attention: ['platform-tenants', 'attention'] as const,
};

/**
 * S3.4 — the operator attention queue. Shares the `platform-tenants` key
 * prefix so recording a commercial-state change refreshes the queue too.
 */
export function usePlatformAttention() {
  return useQuery({
    queryKey: PLATFORM_KEYS.attention,
    queryFn: () => platformService.getAttention(),
    staleTime: 30_000,
  });
}

export function usePlatformTenants(params: PlatformListParams = {}) {
  return useQuery({
    queryKey: PLATFORM_KEYS.tenants(params),
    queryFn: () => platformService.listTenants(params),
    staleTime: 30_000,
  });
}

export function usePlatformTenant(tenantId: string) {
  return useQuery({
    queryKey: PLATFORM_KEYS.tenant(tenantId),
    queryFn: () => platformService.getTenant(tenantId),
    enabled: tenantId.length > 0,
    staleTime: 15_000,
  });
}

export function useUpdatePlatformTenant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlatformTenantUpdatePayload) =>
      platformService.updateTenant(tenantId, payload),
    onSuccess: (updated: PlatformTenantDetail) => {
      qc.setQueryData(PLATFORM_KEYS.tenant(tenantId), updated);
      // The change trail and the list row both move — refresh everything.
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });
}