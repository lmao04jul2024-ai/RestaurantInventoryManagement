jest.mock('../src/services/audit', () => ({
  __esModule: true,
  writeAuditLog: jest.fn(),
  writeSecurityEvent: jest.fn(),
}));

import { NextFunction, Request, Response } from 'express';
import { rateLimit } from '../src/middleware/rate-limit';

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
});