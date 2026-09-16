jest.mock('../src/services/audit', () => ({
  __esModule: true,
  writeAuditLog: jest.fn(),
  writeSecurityEvent: jest.fn(),
}));

import { NextFunction, Request, Response } from 'express';
import { rateLimit, tenantRateLimit, tenantBucketKey } from '../src/middleware/rate-limit';
import { signAccessToken } from '../src/services/jwt';
import { UserRole } from '@prisma/client';

/**
 * Week 22.2 — fixed-window limiter behaving as a sliding tripwire: N allowed
 * per key/window, then 429 + Retry-After until the window rolls.
 */
const req = (ip = '127.0.0.1', path = '/api/x') =>
  ({ ip, path, headers: {}, method: 'GET' }) as unknown as Request;
const res = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  }) as unknown as Response & { status: jest.Mock; json: jest.Mock; setHeader: jest.Mock };

const next = () => jest.fn() as NextFunction;

describe('rateLimit middleware', () => {
  it('allows requests up to max within the window, then blocks with 429 + Retry-After', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const r = res();
    const n1 = next();

    for (let i = 0; i < 3; i++) limiter(req('ip-x'), r, n1);
    expect(n1).toHaveBeenCalledTimes(3);
    expect(r.json).not.toHaveBeenCalled();

    const blocked = res();
    const nb = next();
    limiter(req('ip-x'), blocked, nb);

    expect(nb).not.toHaveBeenCalled();
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'RATE_LIMITED' }) }),
    );
  });

  it('isolates buckets per key (different clients never throttle each other)', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    limiter(req('ip-a'), res(), next());
    const other = res();
    const n = next();
    limiter(req('ip-b'), other, n);
    expect(n).toHaveBeenCalled();
    expect(other.status).not.toHaveBeenCalled();
  });

  it('resets the window after windowMs passes', async () => {
    const limiter = rateLimit({ windowMs: 20, max: 1 });
    limiter(req('ip-c'), res(), next());
    const blocked = res();
    limiter(req('ip-c'), blocked, next());
    expect(blocked.status).toHaveBeenCalledWith(429);

    await new Promise((r) => setTimeout(r, 30));
    const after = res();
    const n = next();
    limiter(req('ip-c'), after, n);
    expect(n).toHaveBeenCalled();
    expect(after.status).not.toHaveBeenCalled();
  });

  it('fires the onLimit hook when rejecting', () => {
    const onLimit = jest.fn();
    const limiter = rateLimit({ windowMs: 60_000, max: 1, onLimit });
    limiter(req('ip-d'), res(), next());
    limiter(req('ip-d'), res(), next());
    expect(onLimit).toHaveBeenCalledTimes(1);
    expect(onLimit.mock.calls[0][0].path).toBe('/api/x');
  });

  it('sets the Retry-After + RateLimit-Policy headers', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    limiter(req('ip-e'), res(), next());
    const blocked = res();
    limiter(req('ip-e'), blocked, next());
    expect(blocked.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(blocked.setHeader).toHaveBeenCalledWith('RateLimit-Policy', expect.stringContaining('max=1'));
  });

describe('S1.4 — tenantRateLimit per-tenant fairness buckets', () => {
  const reqTenant = (tenantToken?: string, ip = '127.0.0.1', reqTenantId?: string) =>
    ({
      ip,
      path: '/api/x',
      method: 'GET',
      headers: tenantToken ? { authorization: `Bearer ${tenantToken}` } : {},
      ...(reqTenantId ? { tenantId: reqTenantId } : {}),
    }) as unknown as Request;

  const tokenFor = (tenantId: string) =>
    signAccessToken({ userId: 'u-1', tenantId, role: UserRole.ADMIN, email: 'a@example.com' });

  it('buckets authenticated requests by tenant, regardless of client IP', () => {
    const limiter = tenantRateLimit;
    const tokenA = tokenFor('tenant-a');
    for (let i = 0; i < 3000; i++) limiter(reqTenant(tokenA, `10.0.0.${i % 250}`), res(), next());
    // A different IP with the SAME tenant is now inside the shared bucket.
    const blocked = res();
    limiter(reqTenant(tokenA, '10.9.9.9'), blocked, next());
    expect(blocked.status).toHaveBeenCalledWith(429);
  });

  it('never lets one tenant fill another tenant’s bucket', () => {
    const limiter = tenantRateLimit;
    const tokenA = tokenFor('tenant-fill');
    const tokenB = tokenFor('tenant-victim');
    for (let i = 0; i < 3000; i++) limiter(reqTenant(tokenA, `10.1.0.${i % 250}`), res(), next());
    const n = next();
    const other = res();
    limiter(reqTenant(tokenB, '10.1.0.7'), other, n); // same IP range, different tenant
    expect(n).toHaveBeenCalledTimes(1);
    expect(other.status).not.toHaveBeenCalled();
  });

  it('a forged token falls back to the IP bucket and cannot poison a tenant bucket', () => {
    const limiter = tenantRateLimit;
    const forged = signAccessToken({ userId: 'u-evil', tenantId: 'tenant-victim2', role: UserRole.ADMIN, email: 'e@example.com' });
    // Tampered signature → verifyAccessToken throws → IP bucket.
    const broken = `${forged.slice(0, forged.lastIndexOf('.'))}.deadbeef`;
    for (let i = 0; i < 3500; i++) limiter(reqTenant(broken, `10.2.0.${i % 250}`), res(), next());
    // Legit tenant-a traffic from a fresh IP is untouched.
    const n = next();
    const ok = res();
    limiter(reqTenant(tokenFor('tenant-legit3'), '10.2.9.9'), ok, n);
    expect(n).toHaveBeenCalledTimes(1);
    expect(ok.status).not.toHaveBeenCalled();
  });

  it('prefers req.tenantId when a downstream middleware already resolved it', () => {
    const limiter = tenantRateLimit;
    const tokenA = tokenFor('tenant-reqkey');
    for (let i = 0; i < 3000; i++) limiter(reqTenant(tokenA, `10.3.0.${i % 250}`), res(), next());
    // No token at all, but req.tenantId set → same bucket.
    const blocked = res();
    limiter(reqTenant(undefined, '10.3.9.9', 'tenant-reqkey'), blocked, next());
    expect(blocked.status).toHaveBeenCalledWith(429);
  });

  it('anonymous traffic buckets by IP', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, key: tenantBucketKey });
    for (let i = 0; i < 2; i++) limiter(reqTenant(undefined, '10.4.0.1'), res(), next());
    const blocked = res();
    limiter(reqTenant(undefined, '10.4.0.1'), blocked, next());
    expect(blocked.status).toHaveBeenCalledWith(429);
    const n = next();
    limiter(reqTenant(undefined, '10.4.0.2'), res(), n);
    expect(n).toHaveBeenCalledTimes(1);
  });
});

});