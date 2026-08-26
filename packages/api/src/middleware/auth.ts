import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../services/jwt';

export interface AuthRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Authentication middleware - validates JWT access token
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        },
      });
    }

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
