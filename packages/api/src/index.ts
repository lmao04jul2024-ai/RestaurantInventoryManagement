import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import inventoryRoutes from './routes/inventory.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import orderRoutes from './routes/order.routes';
import reviewRoutes from './routes/review.routes';
import userRoutes from './routes/user.routes';
import featureFlagRoutes from './routes/feature-flag.routes';
import tenantRoutes from './routes/tenant.routes';
import staffRoutes from './routes/staff.routes';
import auditLogRoutes from './routes/audit.routes';
import analyticsRoutes from './routes/analytics.routes';
import groupOrderRoutes from './routes/group-orders.routes';
import loyaltyRoutes from './routes/loyalty.routes';
import promoRoutes from './routes/promo.routes';
import recommendationRoutes from './routes/recommendations.routes';
import recurringRoutes from './routes/recurring-orders.routes';
import gdprRoutes from './routes/gdpr.routes';
import securityRoutes from './routes/security.routes';
import platformRoutes from './routes/platform.routes';
import { authRateLimit, globalRateLimit, tenantRateLimit } from './middleware/rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'];

// Week 22.2 — behind a TLS-terminating proxy/CDN, trust the first hop so
// `req.ip` reflects the real client (required for meaningful rate limiting).
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Week 22.2 — DDoS/abuse ceilings. The global limiter is a coarse per-IP
// tripwire; details live in docs/security/AUDIT.md. Auth gets a much tighter
// window to blunt credential stuffing (buckets are keyed separately).
app.use(globalRateLimit);
// S1.4 — per-tenant fairness ceiling (keyed on the verified JWT tenant; IP
// fallback for anonymous traffic) so one busy tenant cannot starve the rest.
app.use('/api', tenantRateLimit);
app.use('/api/auth', authRateLimit);

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Restaurant Management API',
    version: '1.0.0',
    status: 'running',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feature-flags', featureFlagRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/group-orders', groupOrderRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/promo-codes', promoRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/recurring-orders', recurringRoutes);
// Week 22.4 — GDPR self-service (data portability + erasure).
app.use('/api/me', gdprRoutes);
// Week 22.6 — security monitoring & control-objectives health (ADMIN).
app.use('/api/security', securityRoutes);
// Phase 5 S2.2 — platform super-admin surface (PLATFORM_ADMIN role only).
app.use('/api/platform', platformRoutes);

// 404 + global error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Only start server when run directly (not when imported by tests)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 API server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => process.exit(0));
  });
}

export default app;
