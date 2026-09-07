'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics.service';
import type { ReportTemplateInput, ReportType } from '@/types/analytics';

/** Week 19 — analytics queries + template mutations. */

export const ANALYTICS_KEYS = ['analytics'] as const;

export function useSalesAnalytics(days = 30) {
  return useQuery({
    queryKey: [...ANALYTICS_KEYS, 'sales', days],
    queryFn: () => analyticsService.getSales(days),
    staleTime: 30_000,
  });
}

export function useInventoryAnalytics(days = 30) {
  return useQuery({
    queryKey: [...ANALYTICS_KEYS, 'inventory', days],
    queryFn: () => analyticsService.getInventory(days),
    staleTime: 30_000,
  });
}

export function useCustomerAnalytics(days = 30) {
  return useQuery({
    queryKey: [...ANALYTICS_KEYS, 'customers', days],
    queryFn: () => analyticsService.getCustomers(days),
    staleTime: 30_000,
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: [...ANALYTICS_KEYS, 'templates'],
    queryFn: () => analyticsService.listTemplates(),
    staleTime: 60_000,
  });
}

export function useCreateReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReportTemplateInput) => analyticsService.createTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ANALYTICS_KEYS }),
  });
}

export function useDeleteReportTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsService.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ANALYTICS_KEYS }),
  });
}

export interface ExportArgs {
  type: ReportType;
  format: 'csv' | 'pdf';
  days: number;
}

export function useExportReport() {
  return useMutation({
    mutationFn: (args: ExportArgs) => analyticsService.exportReport(args.type, args.format, args.days),
  });
}