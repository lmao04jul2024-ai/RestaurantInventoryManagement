import { UserRole } from '@prisma/client';

export interface TestUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

let seq = 0;

/** Deterministic user factory for middleware/JWT payloads. */
export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  seq += 1;
  return {
    userId: overrides.userId ?? `user-${seq}`,
    email: overrides.email ?? `user${seq}@restaurant.test`,
    role: overrides.role ?? UserRole.CUSTOMER,
    tenantId: overrides.tenantId ?? 'tenant-1',
  };
}

/** Tenant row shape used by resolveTenant lookups. */
export function makeTenantRow(overrides: Partial<{ id: string; slug: string; isActive: boolean }> = {}) {
  seq += 1;
  return {
    id: overrides.id ?? `tenant-${seq}`,
    slug: overrides.slug ?? `tenant-${seq}`,
    isActive: overrides.isActive ?? true,
  };
}
