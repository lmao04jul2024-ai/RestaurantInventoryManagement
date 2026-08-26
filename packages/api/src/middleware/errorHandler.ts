import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Global error handling middleware.
 * Normalizes all errors into the standard error envelope:
 * { error: { code, message, details? } }
 */
export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  // Log unexpected server errors with stack trace
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${code}:`, err.stack || err.message);
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
