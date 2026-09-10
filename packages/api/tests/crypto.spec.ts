/**
 * Week 22.3 — data-protection primitives (at-rest handling).
 * Deterministic keyed digests protect lookup secrets; AES-256-GCM protects
 * reversible PII. Tamper and misuse must fail loudly.
 */
import crypto from 'crypto';
import {
  sensitiveDigest,
  encryptSensitive,
  decryptSensitive,
  decryptOrNull,
} from '../src/services/crypto';

describe('sensitiveDigest — keyed, deterministic, one-way', () => {
  it('is deterministic and namespaced so equal inputs hash identically', () => {
    expect(sensitiveDigest('abc', 'session')).toBe(sensitiveDigest('abc', 'session'));
    expect(sensitiveDigest('abc', 'reset')).not.toBe(sensitiveDigest('abc', 'session'));
  });

  it('does not leak the raw value through the digest', () => {
    const digest = sensitiveDigest('very-secret-token', 'session');
    expect(digest).not.toContain('very-secret-token');
    expect(digest).toMatch(/^session-sha256:[0-9a-f]{64}$/);
  });

  it('never stores the plaintext for tokens (auth at-rest guarantee)', () => {
    // Session secret stored as its digest — the plaintext exists only client-side.
    const plaintext = crypto.randomUUID();
    const stored = sensitiveDigest(plaintext, 'session');
    expect(stored).not.toEqual(plaintext);
  });
});

describe('encryptSensitive / decryptSensitive — AES-256-GCM', () => {
  it('round-trips a value through the same usage namespace', () => {
    const cipher = encryptSensitive('Ada Lovelace', 'pii');
    expect(cipher).toMatch(/^enc:v1:pii:/);
    expect(decryptSensitive(cipher, 'pii')).toBe('Ada Lovelace');
  });

  it('produces non-deterministic ciphertexts (fresh IV per call)', () => {
    expect(encryptSensitive('same-value', 'pii')).not.toBe(encryptSensitive('same-value', 'pii'));
  });

  it('refuses to decrypt with the wrong usage namespace', () => {
    const cipher = encryptSensitive('secret', 'pii');
    expect(() => decryptSensitive(cipher, 'payment')).toThrow(/usage mismatch/i);
  });

  it('detects tampering (bit-flip / random blob)', () => {
    const cipher = encryptSensitive('do-not-touch', 'pii');
    const parts = cipher.split(':');
    parts[4] = Buffer.from('X'.repeat(24)).toString('base64'); // corrupt ciphertext
    expect(() => decryptSensitive(parts.join(':'), 'pii')).toThrow(/authenticat|tamper/i);
    expect(() => decryptSensitive('not-a-cipher', 'pii')).toThrow(/envelope/i);
  });

  it('decryptOrNull is fail-open for absent or garbage values', () => {
    expect(decryptOrNull(null, 'pii')).toBeNull();
    expect(decryptOrNull('garbage', 'pii')).toBeNull();
    const cipher = encryptSensitive('ok', 'pii');
    expect(decryptOrNull(cipher, 'pii')).toBe('ok');
  });
});