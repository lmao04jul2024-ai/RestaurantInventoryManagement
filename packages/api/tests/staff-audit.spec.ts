jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import {
  DEFAULT_STAFF_ROLES,
  OVERRIDEABLE_ROLES,
  hasPermissionWithOverrides,
  requirePermission,
} from '../src/middleware/rbac';
import {
  createStaff,
  getAuditLogs,
  listStaff,
  updateStaff,
} from '../src/controllers/staff.controller';
import { listAuditLogs, writeAuditLog } from '../src/services/audit';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = async (
  handler: (...args: any[]) => unknown,
  reqPartial: Record<string, unknown>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial as Partial<TenantRequest>), res as any, next as any);
  return { res, next };
};

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;
const errCode = (res: MockRes) => (bodyOf(res)?.error as { code?: string } | undefined)?.code;

/** Actor request builder — JWT-shaped user + resolved tenant. */
const staffReq = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  tenantId: 'tenant-1',
  user: { userId: 'actor-1', tenantId: 'tenant-1', role: 'ADMIN', email: 'admin@bloom.dev' },
  ...extra,
});

const staffRow = (over: Record<string, unknown> = {}) => ({
  id: uid(2),
  email: 'kitchen@bloom.dev',
  firstName: 'Kai',
  lastName: 'Line',
  role: 'KITCHEN',
  isActive: true,
  permissionOverrides: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

beforeEach(() => jest.clearAllMocks());

// ── 16.5 — override-aware permission checks (pure) ───────────────────────────

describe('hasPermissionWithOverrides', () => {
  it('denies a role-granted permission when the override is explicitly false', () => {
    expect(hasPermissionWithOverrides('SERVER', 'order:create', { 'order:create': false })).toBe(false);
  });

  it('grants a permission beyond the role when the override is explicitly true', () => {
    expect(hasPermissionWithOverrides('SERVER', 'inventory:read', { 'inventory:read': true })).toBe(true);
  });

  it('falls back to the role matrix when the permission has no override', () => {
    // MANAGER holds `menu:*` — domain wildcard must keep working through overrides.
    expect(hasPermissionWithOverrides('MANAGER', 'menu:create', { 'order:create': true })).toBe(true);
    expect(hasPermissionWithOverrides('SERVER', 'inventory:read', { 'order:create': true })).toBe(false);
  });

  it('treats missing/empty override maps as a pure matrix lookup', () => {
    expect(hasPermissionWithOverrides('SERVER', 'order:create', undefined)).toBe(true);
    expect(hasPermissionWithOverrides('SERVER', 'inventory:read', {})).toBe(false);
    expect(hasPermissionWithOverrides('SERVER', 'inventory:read', null)).toBe(false);
    expect(hasPermissionWithOverrides('ADMIN', 'anything:at:all', undefined)).toBe(true);
  });

  it('keeps the overrideable/default staffing role constants honest', () => {
    expect(OVERRIDEABLE_ROLES).toEqual(['MANAGER', 'KITCHEN', 'SERVER']);
    expect(DEFAULT_STAFF_ROLES).toEqual(['MANAGER', 'KITCHEN', 'SERVER']);
  });
});

// ── 16.5 — override-aware middleware ──────────────────────────────────────────

describe('requirePermission with per-user overrides', () => {
  it('blocks a role-granted permission that the user overrides to false', async () => {
    const middleware = requirePermission('order:create');
    const { res, next } = await run(middleware, {
      user: { userId: 'u1', tenantId: 'tenant-1', role: 'SERVER' },
      permissionOverrides: { 'order:create': false },
    });
    expect(res.statusCode).toBe(403);
    expect(errCode(res)).toBe('FORBIDDEN_PERMISSION');
    expect(next).not.toHaveBeenCalled();
  });

  it('admits a permission granted only by override (beyond the role)', async () => {
    const middleware = requirePermission('inventory:read');
    const { res, next } = await run(middleware, {
      user: { userId: 'u1', tenantId: 'tenant-1', role: 'SERVER' },
      permissionOverrides: { 'inventory:read': true },
    });
    expect(res.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('still returns 401 without an authenticated user', async () => {
    const middleware = requirePermission('staff:read');
    const { res, next } = await run(middleware, {});
    expect(res.statusCode).toBe(401);
    expect(errCode(res)).toBe('UNAUTHENTICATED');
    expect(next).not.toHaveBeenCalled();
  });
});

// ── 16.5 — staff directory & creation ────────────────────────────────────────

/** Controller error paths surface through next(error) with envelope fields. */
const nextErr = (next: jest.Mock) => next.mock.calls[0][0] as { statusCode: number; code: string };

describe('listStaff', () => {
  it('returns a sanitized page with meta', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([
      1,
      [staffRow()],
    ]);
    const { res } = await run(listStaff, staffReq({ query: { page: '2', limit: '10' } }));
    expect(res.statusCode).toBeUndefined();
    const body = bodyOf(res) as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).not.toHaveProperty('password');
    expect(body.data[0].permissionOverrides).toEqual({}); // null → normalized map
    expect(body.meta).toEqual({ page: 2, limit: 10, total: 1, pages: 1 });
  });

  it('passes the role filter into the where clause', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([0, []]);
    await run(listStaff, staffReq({ query: { role: 'KITCHEN', q: 'kai' } }));
    const arg = (prisma.user.count as jest.Mock).mock.calls[0][0];
    expect(arg.where.role).toBe('KITCHEN');
    expect(arg.where.OR).toBeDefined(); // q → email/firstName/lastName search
  });
});

describe('createStaff', () => {
  const payload = {
    email: 'new@bloom.dev',
    password: 'Passw0rd!',
    firstName: 'Noor',
    lastName: 'Pace',
    role: 'SERVER',
  };

  it('hashes the password, creates the user and audits staff.created', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue(staffRow({ email: payload.email, role: 'SERVER' }));

    const { res } = await run(createStaff, staffReq({ body: payload }));
    expect(res.statusCode).toBe(201);

    const created = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(created.data.tenantId).toBe('tenant-1');
    expect(created.data.password).not.toBe(payload.password);
    expect(String(created.data.password)).toMatch(/^\$2[aby]\$/); // bcrypt-12

    const audit = (prisma.auditLog.create as jest.Mock).mock.calls[0][0].data;
    expect(audit.action).toBe('staff.created');
    expect(audit.actorId).toBe('actor-1');
    expect(audit.targetType).toBe('User');
    expect(audit.metadata).toMatchObject({ email: payload.email, role: 'SERVER' });
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: uid(9) });
    const { next } = await run(createStaff, staffReq({ body: payload }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('EMAIL_TAKEN');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects staffable-role violations (no ADMIN/CUSTOMER) at validation', async () => {
    const { next } = await run(createStaff, staffReq({ body: { ...payload, role: 'ADMIN' } }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

// ── 16.5 — profile / role / override updates ─────────────────────────────────

describe('updateStaff', () => {
  it('updates the profile and audits staff.updated', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(staffRow());
    (prisma.user.update as jest.Mock).mockResolvedValue(staffRow({ firstName: 'Kai', lastName: 'Renamed' }));

    const { res } = await run(updateStaff, staffReq({ params: { id: uid(2) }, body: { lastName: 'Renamed' } }));
    expect(res.statusCode).toBeUndefined();

    const audit = (prisma.auditLog.create as jest.Mock).mock.calls[0][0].data;
    expect(audit.action).toBe('staff.updated');
    expect(audit.targetId).toBe(uid(2));
    expect(audit.metadata.profile).toEqual({ firstName: false, lastName: true });
  });

  it('forbids role changes by non-ADMIN actors', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(staffRow());
    const { next } = await run(updateStaff, staffReq({
      user: { userId: 'actor-2', tenantId: 'tenant-1', role: 'MANAGER', email: 'mgr@bloom.dev' },
      params: { id: uid(2) },
      body: { role: 'MANAGER' },
    }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ROLE_CHANGE_REQUIRES_ADMIN');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forbids editing ADMIN targets', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(staffRow({ role: 'ADMIN' }));
    const { next } = await run(updateStaff, staffReq({ params: { id: uid(2) }, body: { lastName: 'X' } }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('CANNOT_MODIFY_ADMIN');
  });

  it('forbids changing your own role', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(staffRow({ id: 'actor-1' }));
    const { next } = await run(updateStaff, staffReq({ params: { id: 'actor-1' }, body: { role: 'SERVER' } }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('CANNOT_CHANGE_OWN_ROLE');
  });

  it('404s for staff outside the tenant', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    const { next } = await run(updateStaff, staffReq({ params: { id: uid(2) }, body: { lastName: 'X' } }));
    expect(nextErr(next).code).toBe('STAFF_NOT_FOUND');
  });

  it('merges overrides: true/false set, null clears, and the diff lands in the audit row', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(
      staffRow({ permissionOverrides: { 'inventory:read': true, 'order:create': false } }),
    );
    (prisma.user.update as jest.Mock).mockResolvedValue(staffRow());

    await run(updateStaff, staffReq({
      params: { id: uid(2) },
      body: { permissionOverrides: { 'order:create': null, 'menu:read': true } },
    }));

    const updateArg = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArg.data.permissionOverrides).toEqual({ 'inventory:read': true, 'menu:read': true });

    const audit = (prisma.auditLog.create as jest.Mock).mock.calls[0][0].data;
    expect(audit.metadata.overrides).toEqual({
      from: { 'inventory:read': true, 'order:create': false },
      to: { 'inventory:read': true, 'menu:read': true },
    });
  });

  it('rejects overrides for non-overrideable roles', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(staffRow({ role: 'CUSTOMER' }));
    const { next } = await run(updateStaff, staffReq({
      params: { id: uid(2) },
      body: { permissionOverrides: { 'order:create': true } },
    }));
    const err = nextErr(next);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('OVERRIDES_NOT_ALLOWED');
  });
});

// ── 16.6 — audit trail service & read model ──────────────────────────────────

describe('audit service', () => {
  it('writeAuditLog maps the input row and omits empty metadata', async () => {
    await writeAuditLog({
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      action: 'staff.created',
      targetType: 'User',
      targetId: uid(3),
    });
    const arg = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
    expect(arg.data).toMatchObject({ tenantId: 'tenant-1', actorId: 'actor-1', action: 'staff.created' });
    expect(arg.data.metadata).toBeUndefined();
  });

  it('writeAuditLog never throws when persistence fails', async () => {
    (prisma.auditLog.create as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    await expect(
      writeAuditLog({ tenantId: 't', actorId: 'a', action: 'x', targetType: 'User', targetId: uid(1) }),
    ).resolves.toBeUndefined();
  });

  it('listAuditLogs applies filters and returns pagination meta', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([2, [{ id: uid(1) }, { id: uid(2) }]]);
    const result = await listAuditLogs({ tenantId: 'tenant-1', action: 'staff.updated', targetType: 'User', page: 2, limit: 1 });

    // $transaction receives op *return values* (undefined on plain jest.fn mocks),
    // so the where/findMany shapes are asserted on the model mocks directly.
    expect((prisma.auditLog.count as jest.Mock).mock.calls[0][0].where).toEqual({
      tenantId: 'tenant-1',
      action: 'staff.updated',
      targetType: 'User',
    });
    expect((prisma.auditLog.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      skip: 1,
      take: 1,
      orderBy: { createdAt: 'desc' },
    });
    expect(result.meta).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(result.data).toHaveLength(2);
  });
});

describe('getAuditLogs controller', () => {
  it('validates the query and delegates to the service', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([0, []]);
    const { res } = await run(getAuditLogs, staffReq({ query: { action: 'staff.created', limit: '5' } }));
    expect(res.statusCode).toBeUndefined();
    expect((prisma.auditLog.count as jest.Mock).mock.calls[0][0].where).toEqual({
      tenantId: 'tenant-1',
      action: 'staff.created',
    });
    expect((prisma.auditLog.findMany as jest.Mock).mock.calls[0][0].take).toBe(5);
    const body = bodyOf(res) as { meta: Record<string, unknown> };
    expect(body.meta).toMatchObject({ page: 1, limit: 5, pages: 1 });
  });
});
