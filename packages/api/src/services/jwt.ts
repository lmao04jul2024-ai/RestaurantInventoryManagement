import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string; // session id for revocation
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'restaurant-management',
    audience: 'restaurant-clients',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'restaurant-management',
    audience: 'restaurant-clients',
  }) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: 'restaurant-management',
    audience: 'restaurant-refresh',
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'restaurant-management',
    audience: 'restaurant-refresh',
  }) as RefreshTokenPayload;
}
