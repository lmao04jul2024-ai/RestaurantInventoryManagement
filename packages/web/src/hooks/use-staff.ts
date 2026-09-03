'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffService } from '@/services/staff.service';
import type {
  AuditLogParams,
  CreateStaffPayload,
  StaffListParams,
  UpdateStaffPayload,
} from '@/types/staff';

/** Week 16 — staff directory & audit-trail queries + mutations. */

export const STAFF_KEYS = ['staff'] as const;
export const AUDIT_KEYS = ['audit-logs'] as const;

export function useStaff(params: StaffListParams = {}) {
  return useQuery({
    queryKey: [...STAFF_KEYS, params],
    queryFn: () => staffService.list(params),
    staleTime: 15_000,
    // Keep the previous page's rows visible while the next page loads.
    placeholderData: (prev) => prev,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaffPayload) => staffService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STAFF_KEYS });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStaffPayload }) =>
      staffService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STAFF_KEYS });
      // Role/override changes land in the audit trail too.
      qc.invalidateQueries({ queryKey: AUDIT_KEYS });
    },
  });
}

export function useAuditLogs(params: AuditLogParams = {}) {
  return useQuery({
    queryKey: [...AUDIT_KEYS, params],
    queryFn: () => staffService.auditLogs(params),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}
