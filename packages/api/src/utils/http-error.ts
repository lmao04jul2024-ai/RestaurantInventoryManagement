interface HttpError extends Error {
  statusCode: number;
  code: string;
}

/**
 * Creates an error carrying the standard envelope fields consumed by the
 * global error handler ({ statusCode, code }) — thrown from services/controllers.
 */
export function httpError(statusCode: number, code: string, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/** Throws when tenant context is absent (resolveTenant should have set it). */
export function requireTenant(tenantId: string | undefined): string {
  if (!tenantId) {
    throw httpError(400, 'TENANT_REQUIRED', 'Tenant context is missing');
  }
  return tenantId;
}
