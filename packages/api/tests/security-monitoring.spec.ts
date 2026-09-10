jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

jest.mock('../src/services/audit', () => ({
  __esModule: true,
  listAuditLogs: jest.fn(),
  writeAuditLog: jest.fn(() => Promise.resolve(undefined)),
  writeSecurityEvent: jest.fn(() => Promise.resolve(undefined)),
}));

import prisma from '../src/services/database';
import { listAuditLogs } from '../src/services/audit';
import type { TenantRequest } from '../src/middleware/tenant';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { getSecurityEvents, getSecurityHealth } from '../src/controllers/security.controller';

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const adminReq = (): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: 'u-admin', tenantId: 'tenant-1', role: 'ADMIN', email: 'a@x.com' } as TenantRequest['user'],
});

describe('22.6 — security events surface', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists security-prefixed audit rows and rolls up the last 24h by action', async () => {
    (listAuditLogs as jest.Mock).mockResolvedValue({
      data: [{ id: 'e1', action: 'security:rate_limited' }],
      meta: { page: 1, limit: 50, total: 1, pages: 1 },
    });
    (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      { action: 'security:rate_limited' },
      { action: 'security:auth_failed' },
      { action: 'security:rate_limited' },
    ]);

    const { res, next } = await run(getSecurityEvents, adminReq());

    expect(next).not.toHaveBeenCalled();
    expect(listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', actionPrefix: 'security:' }),
    );
    const body = res.body as { summary: Record<string, unknown> };
    expect(body.summary).toEqual({
      last24h: 3,
      byAction: { 'security:rate_limited': 2, 'security:auth_failed': 1 },
    });
  });

  it('health reports each control objective with a healthy flag', async () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'test-encryption-key-0123456789abcdef';

    try {
      const { res, next } = await run(getSecurityHealth, adminReq());
      expect(next).not.toHaveBeenCalled();
      const checks = (res.body as { data: { checks: Record<string, { ok: boolean }> } }).data.checks;
      expect(checks.rateLimit.ok).toBe(true);
      expect(checks.securityHeaders.ok).toBe(true);
      expect(checks.encryptionAtRest.ok).toBe(true);
      expect(checks.passwordHashing.ok).toBe(true);
      expect(typeof checks.backups.ok).toBe('boolean');
      expect((res.body as { data: Record<string, unknown> }).data.checkedAt).toEqual(expect.any(String));
    } finally {
      process.env.ENCRYPTION_KEY = previousKey;
    }
  });

  it('health flags unconfigured encryption key material', async () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    try {
      const { res } = await run(getSecurityHealth, adminReq());
      const checks = (res.body as { data: { checks: Record<string, { ok: boolean }> } }).data.checks;
      expect(checks.encryptionAtRest.ok).toBe(false);
    } finally {
      process.env.ENCRYPTION_KEY = previousKey;
    }
  });
});