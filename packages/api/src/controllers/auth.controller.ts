import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../services/database';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/jwt';
import { sensitiveDigest } from '../services/crypto';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateBody,
} from '../utils/validation';
import { TenantRequest } from '../middleware/tenant';
import { AuthRequest } from '../middleware/auth';
import { runWithTenant } from '../services/tenant-context';

const REFRESH_TOKEN_TTL_DAYS = 7;

/**
 * Precomputed bcrypt digest that equalizes login-failure timing when no
 * account matches the email (Week 22.2 anti-enumeration posture): the
 * no-account path runs the same bcrypt KDF as the wrong-password path.
 */
const TIMING_EQUALIZER_HASH = bcrypt.hashSync('timing-equalizer', 12);

function publicUser(user: { id: string; email: string; firstName: string; lastName: string; role: string; tenantId: string; emailVerified: boolean }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: user.tenantId,
    emailVerified: user.emailVerified,
  };
}

/**
 * POST /api/auth/register
 */
export async function register(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const data = validateBody(registerSchema, req.body);
    const tenantId = req.tenantId || data.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: {
          code: 'TENANT_REQUIRED',
          message: 'Tenant context is required to register',
        },
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email_tenantId: { email: data.email.toLowerCase(), tenantId } },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists',
        },
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // First user in a tenant becomes ADMIN, subsequent registrations are CUSTOMERs
    const userCount = await prisma.user.count({ where: { tenantId } });
    const role = userCount === 0 ? 'ADMIN' : 'CUSTOMER';

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        role: role as any,
        tenantId,
        emailVerified: false,
        // Week 22.4 — GDPR: stamp consent when the checkbox was supplied and true.
        ...(data.consent === true ? { consentGivenAt: new Date() } : {}),
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as any,
      email: user.email,
    });

    const { rawToken } = await createSession(user.id);
    const refreshToken = signRefreshToken({ userId: user.id, tokenId: rawToken });

    // TODO (Week 3.6): send verification email with emailVerifyToken via SMTP
    console.log(`[auth] Verification token for ${user.email}: ${emailVerifyToken}`);

    res.status(201).json({
      user: publicUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const data = validateBody(loginSchema, req.body);

    // Identity is scoped per tenant (the same email may exist in two
    // restaurants), but the tenant cannot be known before credentials are
    // verified — the web app has neither a JWT nor a tenant subdomain on its
    // first login (L052: resolveTenant gating /login made every login fail
    // with TENANT_REQUIRED). Resolve the tenant from the credential match
    // itself; an explicit body tenantId (organization code) may pre-narrow.
    const candidates = await prisma.user.findMany({
      where: {
        email: data.email.toLowerCase(),
        isActive: true,
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      },
    });

    const matches: typeof candidates = [];
    for (const candidate of candidates) {
      if (await bcrypt.compare(data.password, candidate.password)) {
        matches.push(candidate);
      }
    }

    // Uniform failure prevents user enumeration; the dummy compare equalizes
    // the no-account timing path against the bcrypt-always-ran path (Week 22.2).
    if (matches.length === 0) {
      await bcrypt.compare(data.password, TIMING_EQUALIZER_HASH);
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    if (matches.length > 1) {
      return res.status(400).json({
        error: {
          code: 'TENANT_AMBIGUOUS',
          message:
            'These credentials match accounts in multiple restaurants. Provide tenantId (or X-Tenant-ID) to choose one.',
        },
      });
    }

    const user = matches[0];

    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as any,
      email: user.email,
    });

    // The Prisma tenant guard only rewrites queries under a tenant context;
    // run downstream work inside the matched user's tenant for consistent scoping.
    const { rawToken, refreshToken } = await runWithTenant(user.tenantId, async () => {
      const { rawToken: t } = await createSession(user.id);
      return { rawToken: t, refreshToken: signRefreshToken({ userId: user.id, tokenId: t }) };
    });

    res.json({
      user: publicUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh - rotate refresh tokens
 */
export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = validateBody(refreshSchema, req.body);
    const payload = verifyRefreshToken(refreshToken);

    // Week 22.3 — tokens are stored at rest as authenticated digests only.
    const session = await prisma.session.findUnique({ where: { token: sensitiveDigest(payload.tokenId, 'session') } });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Refresh token is invalid or expired. Please log in again.',
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'USER_INACTIVE',
          message: 'Account not found or deactivated',
        },
      });
    }

    // Rotate: invalidate old session, issue a fresh one
    await prisma.session.delete({ where: { id: session.id } });

    const accessToken = signAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as any,
      email: user.email,
    });

    const { rawToken: newRawToken } = await createSession(user.id);
    const newRefreshToken = signRefreshToken({ userId: user.id, tokenId: newRawToken });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid',
        },
      });
    }
    next(error);
  }
}

/**
 * POST /api/auth/logout - revokes the refresh session
 */
export async function logout(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as { refreshToken?: string };

    if (body.refreshToken) {
      try {
        const payload = verifyRefreshToken(body.refreshToken);
        await prisma.session.deleteMany({ where: { token: sensitiveDigest(payload.tokenId, 'session') } });
      } catch {
        // Token already invalid - treat as logged out
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/forgot-password - issues a password reset token
 */
export async function forgotPassword(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const { email } = validateBody(forgotPasswordSchema, req.body);

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
    });

    // Always respond 200 to avoid account enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Week 22.3 — reset codes are stored hashed at rest (never the raw hex).
      await prisma.session.create({
        data: {
          userId: user.id,
          token: sensitiveDigest(`pwd-reset:${resetToken}`, 'reset'),
          expiresAt,
        },
      });

      // TODO (Week 3.6): send reset email via SMTP service
      console.log(`[auth] Password reset token for ${user.email}: ${resetToken} (expires ${expiresAt.toISOString()})`);
    }

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password - consumes reset token and sets new password
 */
export async function resetPassword(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const { token, password } = validateBody(resetPasswordSchema, req.body);

    const session = await prisma.session.findUnique({
      where: { token: sensitiveDigest(`pwd-reset:${token}`, 'reset') },
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(400).json({
        error: {
          code: 'RESET_TOKEN_INVALID',
          message: 'Password reset token is invalid or has expired',
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { password: hashedPassword },
      }),
      // Single-use: delete the reset token AND revoke all login sessions
      prisma.session.delete({ where: { id: session.id } }),
      prisma.session.deleteMany({
        where: { userId: session.userId, token: { not: { startsWith: 'reset-sha256:' } } },
      }),
    ]);

    res.json({ message: 'Password has been reset successfully. Please log in.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a login session, storing ONLY the keyed digest of the raw token at
 * rest (Week 22.3). The raw token is returned once so callers can embed it in
 * the signed refresh JWT — the client is the only holder of the plaintext.
 */
async function createSession(userId: string): Promise<{ rawToken: string }> {
  const rawToken = crypto.randomUUID();
  await prisma.session.create({
    data: {
      userId,
      token: sensitiveDigest(rawToken, 'session'),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { rawToken };
}
