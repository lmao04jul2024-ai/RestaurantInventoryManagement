import crypto from 'node:crypto';

/**
 * Week 22.3 — data protection primitives for "encryption at rest".
 *
 * Two complementary tools, used deliberately:
 *
 *  1. `sensitiveDigest(value, namespace)` — a deterministic, keyed
 *     HMAC-SHA-256 fingerprint. Use it for *lookup secrets* (session tokens,
 *     API keys, password-reset codes): the DB stores only the digest, so a
 *     leak of the table never exposes a usable bearer credential, while
 *     uniqueness + equality lookups keep working because the digest is
 *     deterministic. This is the standard OWASP "store a hash of the token"
 *     pattern.
 *
 *  2. `encryptSensitive` / `decryptSensitive` — reversible AES-256-GCM with a
 *     random 96-bit IV and a 128-bit auth tag. Use it for *columns that must
 *     be readable server-side* (PII the API has to echo back). Every cipher
 *     is integrity-protected; tampering throws. Not for lookups (random IV).
 *
 * The key material comes from `ENCRYPTION_KEY` (≥ 32 chars in production —
 * the dev fallback exists only so the app boots locally; the security health
 * check reports when it is not configured).
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-only-change-me-in-production';

/** Production config check — surfaced by GET /api/security/health (22.6). */
export function isEncryptionKeyConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 16;
}

/** Derives a usage-scoped 256-bit key so namespaces never share key material. */
function keyFor(usage: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(ENCRYPTION_KEY)
    .update('::')
    .update(usage)
    .digest();
}

const DIGEST_PREFIX = 'sha256:';

/** Keyed digest for lookup secrets — deterministic, one-way, usage-scoped. */
export function sensitiveDigest(value: string, namespace = 'session'): string {
  const digest = crypto.createHash('sha256');
  digest.update(namespace);
  digest.update(':');
  digest.update(ENCRYPTION_KEY);
  digest.update(':');
  digest.update(value);
  return `${namespace}-${DIGEST_PREFIX}${digest.digest().toString('hex')}`;
}

const ENC_PREFIX = 'enc:v1';

/** Encrypts a value at rest (AES-256-GCM, random IV, authenticated). */
export function encryptSensitive(plaintext: string, usage = 'pii'): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(usage), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENC_PREFIX,
    usage,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/** Decrypts `encryptSensitive` output; throws on bad shape, wrong usage, or tampering. */
export function decryptSensitive(payload: string, usage = 'pii'): string {
  const fields = payload.split(':');
  if (fields.length !== 6) throw new Error('Invalid ciphertext envelope');
  const [enc, ver, payloadUsage, ivB64, tagB64, ctB64] = fields;
  if (enc !== 'enc' || ver !== 'v1') throw new Error('Invalid ciphertext envelope');
  if (payloadUsage !== usage) throw new Error('Ciphertext usage mismatch');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(usage), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  try {
    const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
    return plain.toString('utf8');
  } catch (error) {
    throw new Error('Ciphertext authentication failed (tampered or wrong key)');
  }
}

/** Fail-open helper for nullable columns: returns null on absence or any error. */
export function decryptOrNull(payload: string | null | undefined, usage = 'pii'): string | null {
  if (!payload) return null;
  try {
    return decryptSensitive(payload, usage);
  } catch {
    return null;
  }
}