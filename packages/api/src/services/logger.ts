/**
 * S4.2 — structured logging + per-tenant log tagging + monitoring hooks.
 *
 * Every request gets a correlation id (`X-Request-Id`, generated when the
 * client does not supply one) and, once auth has run, a `tenantId` tag. Both
 * ride on every log line as top-level JSON fields so a production log
 * aggregator can filter to one workspace with a plain `tenant_id="<id>"`
 * query — the multi-tenant replacement for grepping a single app's logs.
 *
 * Transport: winston → stdout as single-line JSON (12-factor; the container
 * runtime owns shipping). Level from LOG_LEVEL (default: info, debug in dev).
 * No file transports here — see docs/deployment/OPERATIONS.md for the
 * ship/alert runbook.
 */

import winston from 'winston';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** S4.2 — correlation + tenant tags for structured logging. */
      logContext?: {
        requestId: string;
        tenantId?: string;
        /** Child logger pre-bound to this request's tags. */
        log: winston.Logger;
      };
    }
  }
}

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

/** The header clients may set to correlate their own traces with ours. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attaches the per-request log context (first middleware in the chain).
 * `tenantId` is captured LAZILY — middleware runs before auth/resolveTenant,
 * so the tag is read from the request at log time, not here.
 */
export function attachLogContext(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? crypto.randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  req.logContext = {
    requestId,
    log: logger.child({ requestId }),
  };
  next();
}

/** Best-effort tenant tag: tenant context, JWT claims, then explicit header. */
function tenantTag(req: Request): string | undefined {
  return (
    (req as Request & { tenantId?: string }).tenantId ??
    (req as Request & { user?: { tenantId?: string } }).user?.tenantId ??
    (req.headers['x-tenant-id'] as string | undefined)
  );
}

/**
 * Emits one structured line per request when it finishes. The tenant tag is
 * resolved at finish time so requests that authenticated mid-chain still get
 * tagged. /health and / are logged at debug (probe noise, not signal).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const path = req.originalUrl.split('?')[0];
    const quiet = path === '/health' || path === '/';
    req.logContext?.log.log(quiet ? 'debug' : 'info', 'http_request', {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      tenantId: tenantTag(req),
      requestId: req.logContext?.requestId,
    });
  });
  next();
}

/**
 * Tagged error logging for the 5xx path (and any caller that wants context).
 * Errors from an authenticated request inherit its tenantId/requestId, so an
 * operator can pull EVERY log line for the failing request with one filter.
 */
export function logServerError(req: Request, err: Error, code: string) {
  req.logContext?.log.error('server_error', {
    code,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    tenantId: tenantTag(req),
    requestId: req.logContext?.requestId,
    stack: err.stack,
  });
}
