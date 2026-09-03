'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { featureFlagService } from '@/services/feature-flags.service';
import type { FeatureFlagUpdatePayload } from '@/types/feature-flags';

/** Week 14 — feature flag queries + mutations (react-query, loaded via service). */

export const FEATURE_FLAG_KEYS = ['feature-flags'] as const;

/** Staff management list (registry + tenant overrides + effective state). */
export function useFeatureFlags() {
  return useQuery({
    queryKey: FEATURE_FLAG_KEYS,
    queryFn: () => featureFlagService.listFeatureFlags(),
    staleTime: 30_000,
  });
}

/** Effective boolean map for the current tenant — also used by customer pages. */
export function useFeaturesConfig() {
  return useQuery({
    queryKey: [...FEATURE_FLAG_KEYS, 'config'],
    queryFn: () => featureFlagService.getConfig(),
    staleTime: 60_000,
  });
}

/** Fail-closed gate — true only when the tenant's effective state says ON. */
export function useIsFeatureEnabled(name: string): boolean {
  const { data } = useFeaturesConfig();
  return data?.[name] === true;
}

export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string | null; isEnabled?: boolean }) =>
      featureFlagService.createFeatureFlag(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURE_FLAG_KEYS });
    },
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FeatureFlagUpdatePayload }) =>
      featureFlagService.updateFeatureFlag(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURE_FLAG_KEYS });
    },
  });
}

export function useDeleteFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => featureFlagService.deleteFeatureFlag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURE_FLAG_KEYS });
    },
  });
}

export function useUpdateFeatureConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (overrides: Record<string, boolean | null>) =>
      featureFlagService.updateConfig(overrides),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FEATURE_FLAG_KEYS });
    },
  });
}