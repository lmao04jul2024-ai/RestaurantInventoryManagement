import api from '@/lib/api';
import type {
  AuditLogListResponse,
  AuditLogParams,
  CreateStaffPayload,
  StaffListParams,
  StaffListResponse,
  StaffMember,
  UpdateStaffPayload,
} from '@/types/staff';

/** Week 16 — staff directory + audit trail endpoints (staff.routes / audit.routes). */
export const staffService = {
  /** GET /api/staff — tenant staff directory (staff:read, MANAGER+). */
  async list(params: StaffListParams = {}): Promise<StaffListResponse> {
    const { data } = await api.get<StaffListResponse>('/staff', { params });
    return data;
  },

  /** POST /api/staff — create a staff user (staff:manage, ADMIN/MANAGER). */
  async create(payload: CreateStaffPayload): Promise<StaffMember> {
    const { data } = await api.post<{ data: StaffMember }>('/staff', payload);
    return data.data;
  },

  /** PATCH /api/staff/:id — profile / role (ADMIN-only) / permission overrides. */
  async update(id: string, payload: UpdateStaffPayload): Promise<StaffMember> {
    const { data } = await api.patch<{ data: StaffMember }>(`/staff/${id}`, payload);
    return data.data;
  },

  /** GET /api/audit-logs — immutable audit trail (ADMIN only). */
  async auditLogs(params: AuditLogParams = {}): Promise<AuditLogListResponse> {
    const { data } = await api.get<AuditLogListResponse>('/audit-logs', { params });
    return data;
  },
};
