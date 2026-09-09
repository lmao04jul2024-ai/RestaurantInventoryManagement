import prisma from './database';

/**
 * Week 20.2 — group-ordering helpers.
 *
 * Codes are 6-char A-Z0-9 (URL-safe, short enough to rattle off at the table)
 * and unique per tenant. Groups expire 2h after creation: members can still
 * READ/append until then; expiry is enforced lazily by the consumers.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no confusing I/L/O/0/1

export const GROUP_TTL_MS = 2 * 60 * 60 * 1000;

export function generateGroupCode(): string {
  const bytes = new Uint8Array(6);
  // crypto.randomUUID is available everywhere in Node 18; use it seeded by
  // randomness rather than Math.random which is not crypto-safe for codes.
  const seed = crypto.randomUUID().replace(/-/g, '');
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = parseInt(seed.slice(i * 2, i * 2 + 2), 16) % CODE_ALPHABET.length;
  }
  return [...bytes].map((b) => CODE_ALPHABET[b]).join('');
}

export async function uniqueGroupCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateGroupCode();
    const clash = await prisma.groupOrder.findUnique({
      where: { tenantId_code: { tenantId, code } },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error('Could not allocate a unique group code');
}

export function isGroupExpired(group: { expiresAt: Date }): boolean {
  return group.expiresAt.getTime() <= Date.now();
}

export { prisma };