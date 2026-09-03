import { PrismaClient } from '@prisma/client';
import { TENANT_SCOPED_MODELS, applyTenantScope } from './tenant-scope';
import { currentTenantId } from './tenant-context';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const base = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ── Week 15.1: automatic tenant isolation (data-access layer) ────────────────
// Every tenant-owned read / count / bulk-write inherits the request's tenantId
// from the AsyncLocalStorage context set by `resolveTenant` (runWithTenant).
// A controller that forgets to scope can therefore never cross tenant
// boundaries. Unique-where operations (findUnique/update/delete) are left
// alone — the existing findFirst-then-write guards keep covering those.
const tenantAware = base.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      if (!model || !operation) return query(args);
      if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
      const tenantId = currentTenantId();
      if (!tenantId) return query(args);
      const scoped = applyTenantScope(model, operation, args as Record<string, unknown> | undefined, tenantId);
      return query((scoped ?? args) as never);
    },
  },
});

export const prisma: PrismaClient = tenantAware as unknown as PrismaClient;
export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = tenantAware as unknown as PrismaClient;
}
