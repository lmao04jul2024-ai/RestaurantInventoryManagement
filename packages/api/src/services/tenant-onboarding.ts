import { UserRole } from '@prisma/client';
import prisma from './database';
import { httpError } from '../utils/http-error';

/**
 * Week 15.4 — tenant onboarding. Creates a brand-new tenant, its first ADMIN
 * user, and a default menu atomically, so a new restaurant starts with a
 * working shell instead of an empty account.
 */

/** Deterministic URL-safe tenant slug from a restaurant name. */
export function slugifyTenantSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'restaurant';
}

export interface OnboardingInput {
  restaurantName: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  timezone?: string;
  currency?: string;
  taxRate?: number;
}

export interface OnboardingResult {
  tenant: { id: string; name: string; slug: string };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    emailVerified: boolean;
  };
}

/** Allocates a unique slug by appending `-2`, `-3`, … on collisions. */
async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 100; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const existing = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw httpError(409, 'SLUG_EXHAUSTED', 'Could not allocate a unique tenant slug');
}

/** Creates tenant + first ADMIN + default menu inside one transaction. */
export async function createTenantWithAdmin(input: OnboardingInput): Promise<OnboardingResult> {
  const slug = await uniqueSlug(slugifyTenantSlug(input.restaurantName));

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.restaurantName,
        slug,
        timezone: input.timezone ?? 'UTC',
        currency: input.currency ?? 'USD',
        taxRate: input.taxRate ?? 0,
      },
    });

    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        password: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.ADMIN,
        tenantId: tenant.id,
        emailVerified: true,
      },
    });

    await tx.menu.create({
      data: { name: 'Main Menu', tenantId: tenant.id },
    });

    return {
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
      },
    };
  });
}