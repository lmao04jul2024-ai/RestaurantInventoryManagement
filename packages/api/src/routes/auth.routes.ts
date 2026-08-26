import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import { resolveTenant } from '../middleware/tenant';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Public routes (tenant context resolved where possible)
router.post('/register', resolveTenant, register);
router.post('/login', resolveTenant, login);
router.post('/refresh', refresh); // no tenant needed - token identifies user
router.post('/forgot-password', resolveTenant, forgotPassword);
router.post('/reset-password', resetPassword);

// Authenticated routes
router.post('/logout', optionalAuthenticate, logout);

export default router;
