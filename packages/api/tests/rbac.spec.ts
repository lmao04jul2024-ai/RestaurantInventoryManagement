import type { AuthRequest } from '../src/middleware/auth';
import {
  PERMISSIONS,
  requirePermission,
  requireRole,
  requireRoleOrHigher,
} from '../src/middleware/rbac';
import { UserRole } from '@prisma/client';
import { asRequest, createRes, MockRes } from './helpers/mock-express';
import { makeUser } from './factories/user';

const call = (
  mw: ReturnType<typeof requireRole>,
  role?: UserRole,
): { res: MockRes; next: jest.Mock } => {
  const res = createRes();
  const nextFn = jest.fn();
  const req = asRequest<AuthRequest>(
    role ? { user: makeUser({ role }) } : {},
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mw(req as any, res as any, nextFn as any);
  return { res, next: nextFn };
};

describe('requireRole', () => {
  it('401s before any role evaluation when unauthenticated', () => {
    const { res, next } = call(requireRole(UserRole.ADMIN));
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows exactly-listed roles through', () => {
    const mw = requireRole(UserRole.MANAGER, UserRole.ADMIN);
    const { res, next } = call(mw, UserRole.ADMIN);
    expect(res.statusCode).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('403s roles outside the allowlist', () => {
    const { res, next } = call(requireRole(UserRole.ADMIN), UserRole.CUSTOMER);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: { code: 'FORBIDDEN_ROLE', message: expect.stringContaining('ADMIN') },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRoleOrHigher (hierarchy)', () => {
  const mw = requireRoleOrHigher(UserRole.MANAGER);

  it('admits equal level', () => {
    expect(call(mw, UserRole.MANAGER).next).toHaveBeenCalled();
  });

  it('admits higher privilege roles', () => {
    expect(call(mw, UserRole.ADMIN).next).toHaveBeenCalled();
  });

  it.each([UserRole.SERVER, UserRole.KITCHEN])('denies %s below manager', (role) => {
    expect(call(mw, role).res.statusCode).toBe(403);
  });
});

describe('requirePermission (matrix)', () => {
  it('honors exact grants', () => {
    const { next } = call(
      requirePermission('inventory:update:stock') as never,
      UserRole.KITCHEN,
    );
    expect(next).toHaveBeenCalled();
  });

  it('supports domain wildcards for managers', () => {
    const { next } = call(requirePermission('inventory:write') as never, UserRole.MANAGER);
    expect(next).toHaveBeenCalled();
  });

  it('grants admin everything via global wildcard', () => {
    const { next } = call(requirePermission('anything:at:all') as never, UserRole.ADMIN);
    expect(next).toHaveBeenCalled();
  });

  it('denies customers staff endpoints and reports the missing permission', () => {
    const { res, next } = call(requirePermission('staff:read') as never, UserRole.CUSTOMER);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: { code: 'FORBIDDEN_PERMISSION', message: expect.stringContaining('staff:read') },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('own-scope permissions are not inferable from domain prefix alone', () => {
    // order:create:own must NOT satisfy plain order:create
    expect(call(requirePermission('order:create') as never, UserRole.CUSTOMER).res.statusCode).toBe(403);
  });
});

describe('PERMISSIONS invariants', () => {
  it('admin is the sole holder of the global wildcard', () => {
    for (const [role, perms] of Object.entries(PERMISSIONS)) {
      if (role !== UserRole.ADMIN) expect(perms).not.toContain('*');
    }
    expect(PERMISSIONS[UserRole.ADMIN]).toEqual(['*']);
  });
});
