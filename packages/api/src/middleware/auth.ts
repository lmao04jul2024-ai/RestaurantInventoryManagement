import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../services/jwt';
import { writeSecurityEvent } from '../services/audit';

export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Week 22.6 — fire-and-forget security events. Audit writes are fail-open, so
 * monitoring never stands in the way of the auth decision. Tenant is unknown
 * pre-resolution; events are attributed to the tenant embedded in the token
 * when one can be verified, otherwise to the shared 'system' scope.
 */
function securityEvent(tenantId: string, action: string, metadata: Record<string, unknown>) {
  try {
    writeSecurityEvent({ tenantId, actorId: 'system', action, metadata });
  } catch {
    // Fail-open: monitoring must never break the auth decision path.
  }
}

/**
 * Authentication middleware - validates JWT access token
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      securityEvent('system', 'auth_missing_token', { path: req.path });
      return res.status(401).json({
        error: {
          code: 'NO_TOKEN',
          message: 'Authentication token is required',
        },
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      securityEvent('system', 'auth_token_expired', { path: req.path });
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      });
    }

    securityEvent('system', 'auth_failed', { path: req.path });
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    });
  }
}

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.user = verifyAccessToken(authHeader.substring(7));
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
}
