import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller';
import { resolveTenant } from '../middleware/tenant';
import { optionalAuthenticate, authenticate } from '../middleware/auth';

const router = Router();

// Credential-entry flows (login / forgot-password) resolve the tenant from the
// credentials themselves — the web app cannot know a tenantId before its first
// successful login (no JWT yet, no subdomain on localhost). Gating them with
// resolveTenant made every web login fail with TENANT_REQUIRED (L052).
// /register stays tenant-gated: first-user-becomes-ADMIN role assignment must
// never be reachable without a resolved tenant.
router.post('/register', resolveTenant, register);
router.post('/login', login);
router.post('/refresh', refresh); // no tenant needed - token identifies user
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Authenticated routes
router.post('/logout', optionalAuthenticate, logout);
// Self-service password change. Deliberately NOT resolveTenant-gated: the
// platform operator must be able to rotate their own credential, and
// resolveTenant rejects PLATFORM_ADMIN on tenant surfaces. The handler scopes
// the write to req.user.userId, so no tenant context is needed.
router.patch('/password', authenticate, changePassword);

export default router;
