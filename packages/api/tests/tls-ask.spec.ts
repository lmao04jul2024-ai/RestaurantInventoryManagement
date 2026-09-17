/**
 * S4.5 — Caddy on-demand TLS ask endpoint (`deploy/Caddyfile`).
 *
 * Unit tier: the allow-list decision itself — infrastructure hosts, active
 * workspaces, `api.{slug}`, normalization, and the fail-closed paths.
 *
 * Integration tier: supertest over the REAL express app proves the route is
 * mounted at `/api/internal/tls-ask` and reachable WITHOUT a token (Caddy can
 * present no JWT) while still refusing hosts the deployment does not serve.
 */
jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    tenant: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    featureFlag: { findMany: jest.fn() },
    supplier: { findFirst: jest.fn() },
    reportTemplate: { findMany: jest.fn() },
    inventoryItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      fields: { minStock: {} },
    },
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[])
    ),
  },
}));

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/services/database';
import { tlsAsk } from '../src/controllers/internal.controller';
import { asRequest, createRes, MockRes } from './helpers/mock-express';

const findFirst = prisma.tenant.findFirst as jest.Mock;
const ROOT = 'yourapp.com';
const previousRoot = process.env.TENANT_ROOT_DOMAIN;

const run = async (query: Record<string, string>) => {
  const res = createRes();
  const nextFn = jest.fn();
  await tlsAsk(asRequest({ query }), res as never, nextFn);
  return { res, next: nextFn };
};

const body = (res: MockRes) =>
  res.body as { data?: Record<string, unknown>; error?: { code: string } };

beforeEach(() => {
  findFirst.mockReset();
  process.env.TENANT_ROOT_DOMAIN = ROOT;
});
describe('tls-ask allow-list (unit)', () => {
  it('allows the apex, www and api hosts without a database lookup', async () => {
    for (const host of [ROOT, `www.${ROOT}`, `api.${ROOT}`]) {
      const { res } = await run({ domain: host });
      expect(res.statusCode).toBeUndefined(); // bare res.json() = 200
      expect(body(res).data).toEqual({ domain: host, allowed: true });
    }
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('allows an ACTIVE workspace subdomain and scopes the lookup to active rows', async () => {
    findFirst.mockResolvedValue({ id: 'tenant-1' });

    const { res } = await run({ domain: `acme.${ROOT}` });

    expect(body(res).data).toEqual({ domain: `acme.${ROOT}`, allowed: true });
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'acme', isActive: true },
      select: { id: true },
    });
  });

  it('allows api.{slug} — the same last-label slug rule as resolveTenant', async () => {
    findFirst.mockResolvedValue({ id: 'tenant-1' });

    const { res } = await run({ domain: `api.acme.${ROOT}` });

    expect(body(res).data).toEqual({
      domain: `api.acme.${ROOT}`,
      allowed: true,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'acme', isActive: true } })
    );
  });

  it('refuses an unknown slug with 403 TLS_DOMAIN_NOT_ALLOWED', async () => {
    findFirst.mockResolvedValue(null);

    const { res } = await run({ domain: `ghost.${ROOT}` });

    expect(res.statusCode).toBe(403);
    expect(body(res).error?.code).toBe('TLS_DOMAIN_NOT_ALLOWED');
  });

  it('refuses a SUSPENDED workspace (isActive filter is the offboarding control)', async () => {
    findFirst.mockResolvedValue(null); // isActive: true matched nothing

    const { res } = await run({ domain: `churned.${ROOT}` });

    expect(res.statusCode).toBe(403);
    expect(body(res).error?.code).toBe('TLS_DOMAIN_NOT_ALLOWED');
  });

  it('normalizes case, an explicit port and a trailing dot', async () => {
    findFirst.mockResolvedValue({ id: 'tenant-1' });

    const { res } = await run({ domain: `  ACME.${ROOT.toUpperCase()}.:443 ` });

    expect(body(res).data).toEqual({ domain: `acme.${ROOT}`, allowed: true });
  });

  it('refuses a foreign domain that merely contains the root as a suffix', async () => {
    const { res } = await run({ domain: `acme.${ROOT}.evil.test` });

    expect(res.statusCode).toBe(403);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('refuses everything when TENANT_ROOT_DOMAIN is unset (fail closed)', async () => {
    delete process.env.TENANT_ROOT_DOMAIN;

    const { res } = await run({ domain: `acme.${ROOT}` });

    expect(res.statusCode).toBe(403);
    expect(body(res).error?.code).toBe('TLS_NOT_CONFIGURED');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects a missing or oversized domain with VALIDATION_ERROR', async () => {
    const cases: Array<Record<string, string>> = [
      {},
      { domain: '' },
      { domain: 'a'.repeat(300) },
    ];

    for (const query of cases) {
      const { res, next } = await run(query);
      expect(next.mock.calls[0][0]).toMatchObject({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
      expect(res.statusCode).toBeUndefined();
    }
  });

  it('surfaces a database failure as an error instead of allowing the host', async () => {
    findFirst.mockRejectedValue(new Error('db down'));

    const { res, next } = await run({ domain: `acme.${ROOT}` });

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.statusCode).toBeUndefined(); // never a 2xx
  });
});

describe('tls-ask is mounted and public (integration)', () => {
  it('answers 200 with no Authorization header for an allowed workspace host', async () => {
    findFirst.mockResolvedValue({ id: 'tenant-1' });

    const res = await request(app)
      .get('/api/internal/tls-ask')
      .query({ domain: `acme.${ROOT}` });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ domain: `acme.${ROOT}`, allowed: true });
  });

  it('answers 403 for a host this deployment does not serve', async () => {
    const res = await request(app)
      .get('/api/internal/tls-ask')
      .query({ domain: 'evil.example.org' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TLS_DOMAIN_NOT_ALLOWED');
  });
});

afterAll(() => {
  if (previousRoot === undefined) delete process.env.TENANT_ROOT_DOMAIN;
  else process.env.TENANT_ROOT_DOMAIN = previousRoot;
});
