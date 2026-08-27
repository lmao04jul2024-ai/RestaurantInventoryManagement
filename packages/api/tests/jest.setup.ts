// Runs BEFORE any test-file module graph loads, so services reading env at
// import time (services/jwt.ts) observe deterministic secrets.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-do-not-ship';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
