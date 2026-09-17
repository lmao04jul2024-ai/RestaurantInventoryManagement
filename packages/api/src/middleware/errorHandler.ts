import { Request, Response, NextFunction } from 'express';
import { logServerError } from '../services/logger';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Global error handling middleware.
 * Normalizes all errors into the standard error envelope:
 * { error: { code, message, details? } }
 *
 * S4.2 — 5xx errors are logged through the structured logger with the
 * request's tenantId/requestId tags (when the log-context middleware ran),
 * so a failing tenant request can be traced end-to-end in the aggregator.
 */
export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  // Log unexpected server errors with stack trace
  if (statusCode >= 500) {
    logServerError(req, err, code);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'An internal error occurred. Please try again later.'
        : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
