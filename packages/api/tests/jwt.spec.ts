import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/services/jwt';
import { UserRole } from '@prisma/client';
import { makeUser } from './factories/user';

const accessPayload = () => {
  const u = makeUser({ role: UserRole.MANAGER });
  return { userId: u.userId, tenantId: u.tenantId, role: u.role, email: u.email };
};

describe('access tokens', () => {
  it('round-trips payload through sign/verify', () => {
    const payload = accessPayload();
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.email).toBe(payload.email);
  });

  it('rejects refresh tokens as access tokens (audience separation)', () => {
    const refresh = signRefreshToken({ userId: 'u1', tokenId: 's1' });
    expect(() => verifyAccessToken(refresh)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects tampered signatures', () => {
    const token = signAccessToken(accessPayload());
    const [head, body] = token.split('.');
    const tampered = `${head}.${body.slice(0, -2)}xx.invalid`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('expires access tokens after their configured lifetime', () => {
    const token = signAccessToken(accessPayload());
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 16 * 60 * 1000);

    try {
      expect(() => verifyAccessToken(token)).toThrow(jwt.TokenExpiredError);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('refresh tokens', () => {
  it('round-trips session-scoped payload', () => {
    const token = signRefreshToken({ userId: 'u9', tokenId: 'session-abc' });
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe('u9');
    expect(decoded.tokenId).toBe('session-abc');
  });

  it('rejects access tokens as refresh tokens (audience separation)', () => {
    const access = signAccessToken(accessPayload());
    expect(() => verifyRefreshToken(access)).toThrow(jwt.JsonWebTokenError);
  });
});

describe('issuer hardening', () => {
  it('rejects tokens minted by another issuer', () => {
    const foreign = jwt.sign(
      { userId: 'u1', tenantId: 't1', role: UserRole.ADMIN, email: 'x@y.z' },
      process.env.JWT_SECRET!,
      { issuer: 'evil-service', audience: 'restaurant-clients' },
    );
    expect(() => verifyAccessToken(foreign)).toThrow(jwt.JsonWebTokenError);
  });
});
