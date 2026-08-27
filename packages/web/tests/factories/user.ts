import type { AuthUser } from '@/types';

let seq = 0;

/** Deterministic AuthUser factory mirroring API serialization (UPPERCASE roles). */
export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  seq += 1;
  return {
    id: overrides.id ?? `user-${seq}`,
    email: overrides.email ?? `staff${seq}@restaurant.test`,
    firstName: 'Testy',
    lastName: `McFace${seq}`,
    role: overrides.role ?? 'SERVER',
    tenantId: overrides.tenantId ?? 'tenant-1',
    emailVerified: overrides.emailVerified ?? false,
  };
}
