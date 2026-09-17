/**
 * Self-service password change — PATCH /api/auth/password.
 *
 * Gap this closes: the platform operator (PLATFORM_ADMIN) had NO in-app way to
 * rotate their own credential — the console's avatar menu offered only Sign out
 * and the sole alternative was the email-reset round trip. The route is
 * deliberately NOT resolveTenant-gated, because resolveTenant rejects
 * PLATFORM_ADMIN on every tenant surface with 403 PLATFORM_ADMIN_FORBIDDEN;
 * the handler scopes the write to req.user.userId instead.
 *
 * Pattern: controller-level unit with a mocked Prisma layer (same as
 * tests/auth-login.spec.ts); REAL bcrypt at a low cost keeps credential checks
 * honest without mocking crypto.
 */

jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    session: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../src/services/database';
import bcrypt from 'bcryptjs';
import { changePassword } from '../src/controllers/auth.controller';
import { asRequest, createRes } from './helpers/mock-express';
import type { AuthRequest } from '../src/middleware/auth';

const findUnique = prisma.user.findUnique as jest.Mock;
const update = prisma.user.update as jest.Mock;
const deleteMany = prisma.session.deleteMany as jest.Mock;
const auditCreate = (prisma as unknown as { auditLog: { create: jest.Mock } }).auditLog.create;
const transaction = (prisma as unknown as { $transaction: jest.Mock }).$transaction;

const CURRENT = 'Sup3rSecret!';
const NEW = 'Ev3nBetterOne!';

const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'u-operator',
  email: 'platform@example.com',
  password: bcrypt.hashSync(CURRENT, 4),
  firstName: 'Platform',
  lastName: 'Admin',
  role: 'PLATFORM_ADMIN',
  tenantId: 'tenant-platform',
  isActive: true,
  ...overrides,
});

const callChange = async (body: Record<string, unknown>, userId = 'u-operator') => {
  const res = createRes();
  await changePassword(
    asRequest<AuthRequest>({
      body,
      user: {
        userId,
        tenantId: 'tenant-platform',
        role: 'PLATFORM_ADMIN',
        email: 'platform@example.com',
      },
    } as never),
    res as never,
    jest.fn((err?: unknown) => {
      if (err) throw err;
    }),
  );
  return res;
};

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  deleteMany.mockReset();
  auditCreate.mockReset();
  transaction.mockReset();

  findUnique.mockResolvedValue(userRow());
  update.mockResolvedValue({});
  deleteMany.mockResolvedValue({ count: 2 });
  auditCreate.mockResolvedValue({});
  transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe('PATCH /api/auth/password — self-service credential rotation', () => {
  it('lets the platform operator change their own password (no tenant route, no 403)', async () => {
    const res = await callChange({ currentPassword: CURRENT, newPassword: NEW });

    expect(res.statusCode).toBeUndefined(); // res.json() success path
    expect((res.body as { message: string }).message).toMatch(/sign in again/i);

    // Scoped by the CALLER's id only — the operator has no usable tenant surface.
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u-operator' } });

    const data = update.mock.calls[0][0].data as { password: string };
    expect(update.mock.calls[0][0].where).toEqual({ id: 'u-operator' });
    expect(await bcrypt.compare(NEW, data.password)).toBe(true);
    expect(data.password).not.toBe(CURRENT);
    expect(data.password).toMatch(/^\$2[aby]\$/); // bcrypt hash at rest, never plaintext
  });

  it('revokes every refresh session so stolen tokens die with the old password', async () => {
    await callChange({ currentPassword: CURRENT, newPassword: NEW });

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'u-operator' } });
    // The password write + revocation are one atomic unit.
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('writes a security-trail row for the credential change (Week 22.6)', async () => {
    await callChange({ currentPassword: CURRENT, newPassword: NEW });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      tenantId: 'tenant-platform',
      actorId: 'u-operator',
      action: 'security:auth.password_changed',
    });
  });

  it('400 CURRENT_PASSWORD_INCORRECT when the current password is wrong', async () => {
    const res = await callChange({ currentPassword: 'NotMyPassword1', newPassword: NEW });

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('CURRENT_PASSWORD_INCORRECT');
    expect(update).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('400 PASSWORD_UNCHANGED when the new password repeats the current one', async () => {
    const res = await callChange({ currentPassword: CURRENT, newPassword: CURRENT });

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { code: string } }).error.code).toBe('PASSWORD_UNCHANGED');
    expect(update).not.toHaveBeenCalled();
  });

  it('401 USER_INACTIVE when the account is gone or deactivated', async () => {
    findUnique.mockResolvedValue(userRow({ isActive: false }));

    const res = await callChange({ currentPassword: CURRENT, newPassword: NEW });

    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('USER_INACTIVE');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a weak new password with the standard VALIDATION_ERROR envelope', async () => {
    await expect(callChange({ currentPassword: CURRENT, newPassword: 'weak' })).rejects.toMatchObject(
      { statusCode: 400, code: 'VALIDATION_ERROR' },
    );

    expect(update).not.toHaveBeenCalled();
  });

  it('requires the current password to be present at all', async () => {
    await expect(callChange({ newPassword: NEW })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});