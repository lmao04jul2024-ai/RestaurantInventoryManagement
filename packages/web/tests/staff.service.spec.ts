jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { staffService } from '@/services/staff.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;

const MEMBER = {
  id: 'user-2',
  email: 'sam@bloom.test',
  firstName: 'Sam',
  lastName: 'Lee',
  role: 'SERVER',
  isActive: true,
  permissionOverrides: { 'inventory:update:stock': true },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('staffService — Week 16 endpoint contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the tenant staff directory with params', async () => {
    const list = { data: [MEMBER], meta: { page: 1, limit: 10, total: 1, pages: 1 } };
    apiGet.mockResolvedValue({ data: list });

    await expect(staffService.list({ page: 1, limit: 10, role: 'SERVER', q: 'sam' })).resolves.toBe(list);
    expect(apiGet).toHaveBeenCalledWith('/staff', { params: { page: 1, limit: 10, role: 'SERVER', q: 'sam' } });
  });

  it('creates a staff account and unwraps data', async () => {
    apiPost.mockResolvedValue({ data: { data: MEMBER } });

    const payload = { firstName: 'Sam', lastName: 'Lee', email: 'sam@bloom.test', password: 'Passw0rd!', role: 'SERVER' as const };
    await expect(staffService.create(payload)).resolves.toBe(MEMBER);
    expect(apiPost).toHaveBeenCalledWith('/staff', payload);
  });

  it('patches profile/role/overrides via PATCH /staff/:id', async () => {
    const updated = { ...MEMBER, role: 'KITCHEN', permissionOverrides: { 'inventory:update:stock': null } };
    apiPatch.mockResolvedValue({ data: { data: updated } });

    const payload = { role: 'KITCHEN' as const, permissionOverrides: { 'inventory:update:stock': null } };
    await expect(staffService.update('user-2', payload)).resolves.toBe(updated);
    expect(apiPatch).toHaveBeenCalledWith('/staff/user-2', payload);
  });

  it('fetches audit log entries with filters', async () => {
    const list = { data: [], meta: { page: 2, limit: 20, total: 0, pages: 0 } };
    apiGet.mockResolvedValue({ data: list });

    await expect(staffService.auditLogs({ action: 'staff.role_changed', targetType: 'User' })).resolves.toBe(list);
    expect(apiGet).toHaveBeenCalledWith('/audit-logs', { params: { action: 'staff.role_changed', targetType: 'User' } });
  });
});