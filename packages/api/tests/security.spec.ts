/**
 * Week 22.1 — executable security regression suite (the "red" cases from the
 * audit). Every case here corresponds to a row in docs/security/AUDIT.md.
 */

// These suites run against the REAL express app, but the Prisma layer is
// replaced with tenant + user where the tested handlers demand it — mirrors
// tests/multi-tenant.integration.spec.ts's pattern, scoped for auth routes.
jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1', isActive: true, features: {} }) },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    session: { create: jest.fn((args: { data: Record<string, unknown> }) => Promise.resolve({ id: 'sess-1', ...args.data })) },
  },
}));

import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/index';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../src/services/jwt';
import { hasPermissionWithOverrides } from '../src/middleware/rbac';
import { UserRole } from '@prisma/client';

const user = {
  userId: 'u-1',
  tenantId: 'tenant-1',
  role: UserRole.CUSTOMER,
  email: 'c@example.com',
};

describe('22.1 — JWT hardening', () => {
  it('round-trips a valid token', () => {
    const token = signAccessToken(user);
    expect(verifyAccessToken(token).userId).toBe('u-1');
  });

  it('rejects a token signed with a different key', () => {
    const forged = jwt.sign(user, 'attacker-secret', {
      expiresIn: '15m',
      issuer: 'restaurant-management',
      audience: 'restaurant-clients',
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects an alg:none token (algorithm-confusion attempt)', () => {
    const noneToken = jwt.sign(user, '', { algorithm: 'none' });
    expect(() => verifyAccessToken(noneToken)).toThrow();
    expect(() => verifyRefreshToken(noneToken)).toThrow();
  });

  it('rejects a token minted for a different audience/issuer', () => {
    const wrongAud = jwt.sign(user, process.env.JWT_SECRET || 'change-me-in-production', {
      expiresIn: '15m',
      issuer: 'restaurant-management',
      audience: 'some-other-client',
    });
    expect(() => verifyAccessToken(wrongAud)).toThrow();
  });

  it('rejects an expired access token', () => {
    const expired = jwt.sign(user, process.env.JWT_SECRET || 'change-me-in-production', {
      expiresIn: -30,
      issuer: 'restaurant-management',
      audience: 'restaurant-clients',
    });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  it('refresh tokens are scoped to the refresh audience', () => {
    const refresh = signRefreshToken({ userId: 'u-1', tokenId: 'sess-1' });
    expect(() => verifyRefreshToken(refresh)).not.toThrow();
    // An access token is not a refresh token (audience isolation).
    expect(() => verifyRefreshToken(signAccessToken(user))).toThrow();
  });
});

describe('22.1 — transport hardening (live app)', () => {
  it('serves helmet security headers on every response', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('rejects malformed input at the validation gate (mass-assignment / injection probes)', async () => {
    // Credential-entry auth routes need no tenant context (L052) and reach
    // validation before any database dependency — no pinning required.
    const probe = await request(app).post('/api/auth/login').send({
      email: { $gt: '' },              // Prisma/Mongo-style operator smuggling
      password: 'Xy12345',
      role: 'ADMIN',                    // mass-assignment attempt
      isAdmin: true,
    });
    expect(probe.status).toBe(400);
    expect(probe.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('22.1 — authorization matrix denial checks', () => {
  it('KITCHEN cannot manage staff, CUSTOMER cannot read others', () => {
    expect(hasPermissionWithOverrides(UserRole.KITCHEN, 'staff:manage', null)).toBe(false);
    expect(hasPermissionWithOverrides(UserRole.CUSTOMER, 'order:read', null)).toBe(false);
    expect(hasPermissionWithOverrides(UserRole.KITCHEN, 'order:update:status', null)).toBe(true);
    expect(hasPermissionWithOverrides(UserRole.MANAGER, 'staff:manage', null)).toBe(true);
  });

  it('wildcard denies and grants resolve correctly', () => {
    expect(hasPermissionWithOverrides(UserRole.ADMIN, 'anything:at:all', null)).toBe(true);
    expect(hasPermissionWithOverrides(UserRole.CUSTOMER, '*', null)).toBe(false);
  });
});