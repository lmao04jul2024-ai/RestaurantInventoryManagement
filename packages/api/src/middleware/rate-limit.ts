import { NextFunction, Request, Response } from 'express';
import { writeSecurityEvent } from '../services/audit';

/**
 * Week 22.2 — in-memory sliding-window rate limiter.
 *
 * Dependency-free by design: a fixed-window counter per key (`ip` by default)
 * with a rolling reset, stored in a self-sweeping map. Good enough to blunt
 * credential-stuffing and naive DDoS at a single-node API; a Redis-backed
 * bucket (`services/redis.ts`) is the documented swap-in once there are
 * multiple instances (see docs/security/AUDIT.md).
 *
 * Exceeded requests get `429` + `Retry-After` (seconds) so well-behaved
 * clients back off, and every rejection raises a `security:rate_limited`
 * event (22.6) for monitoring.
 */

export interface RateLimitOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum requests per key within the window. */
  max: number;
  /** Bucket key; defaults to the client IP. */
  key?: (req: Request) => string;
  message?: string;
  /** Optional hook fired when a request is rejected (for security events / 22.6). */
  onLimit?: (req: Request) => void;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const SWEEP_THRESHOLD = 10_000;
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max } = options;
  const message =
    options.message ?? 'Too many requests. Please wait and try again.';
  const keyFn = options.key ?? ((req: Request) => clientKey(req));

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const bucketKey = keyFn(req);
    const bucket = buckets.get(bucketKey);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      sweep(now);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      const retryAfterMs = String(retryAfter * 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('RateLimit-Policy', `max=${max}, window=${windowMs}ms`);
      // RFC 6585 suggests the absolute time; a relative ms value is consumed
      // by clients and observability tooling alike.
      res.setHeader('RateLimit-RetryAfter', retryAfterMs);
      if (options.onLimit) {
        try {
          options.onLimit(req);
        } catch {
          // Never let the monitor break the response path.
        }
      }
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message },
      });
    }

    next();
  };
}

function clientKey(req: Request): string {
  // Express populates `req.ip`; behind a trusted proxy (app.set('trust proxy'))
  // this is the real client address, otherwise the immediate peer.
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

/** Security event on rejection — attributes to X-Tenant-ID when present. */
function onLimit(req: Request) {
  const tenantId = (req.headers['x-tenant-id'] as string | undefined) ?? 'system';
  try {
    void writeSecurityEvent({
      tenantId,
      actorId: 'system',
      action: 'rate_limited',
      metadata: { path: req.path, method: req.method },
    });
  } catch {
    // Fail-open: the limiter's rejection response is the control.
  }
}

/** Strict per-IP guard for the auth endpoints (login/register/refresh/reset). */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
  message: 'Too many authentication attempts. Please try again shortly.',
  onLimit,
});

/** Coarse per-IP ceiling across the whole API (DDoS mitigation). */
export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX || 300),
  message: 'Global request rate exceeded.',
  onLimit,
});