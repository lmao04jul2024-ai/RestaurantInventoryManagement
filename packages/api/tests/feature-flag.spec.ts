jest.mock('../src/services/database', () => ({
  __esModule: true,
  default: {
    featureFlag: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenant: { update: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

import prisma from '../src/services/database';
import type { TenantRequest } from '../src/middleware/tenant';
import type { FeatureFlagRequest } from '../src/middleware/feature-flag';
import type { MockRes } from './helpers/mock-express';
import { asRequest, createRes } from './helpers/mock-express';
import { makeFeatureFlagRow } from './factories/feature-flag';
import {
  buildEffectiveMap,
  isEnabled,
  normalizeOverrides,
} from '../src/services/feature-flags';
import { attachFeatureFlags, requireFeature } from '../src/middleware/feature-flag';

/** Joi uuid validation requires real-shaped identifiers in params/bodies. */
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const run = async (
  handler: (...args: any[]) => Promise<unknown>,
  reqPartial: Partial<TenantRequest>,
): Promise<{ res: MockRes; next: jest.Mock }> => {
  const res = createRes();
  const next = jest.fn();
  await handler(asRequest<TenantRequest>(reqPartial), res as any, next as any);
  return { res, next };
};

const tenantReq = (extra: Partial<TenantRequest> = {}): Partial<TenantRequest> => ({
  tenantId: 'tenant-1',
  user: { userId: 'user-1', tenantId: 'tenant-1' } as TenantRequest['user'],
  ...extra,
});

const bodyOf = (res: MockRes) => res.body as Record<string, unknown>;

describe('feature-flag evaluation service (pure)', () => {
  it('normalizes Tenant.features Json into a boolean map, dropping garbage', () => {
    expect(normalizeOverrides({ customer_reviews: false, loyalty_program: true })).toEqual({
      customer_reviews: false,
      loyalty_program: true,
    });
    expect(normalizeOverrides({ customer_reviews: 'yes', n: 3, a: [] })).toEqual({});
    expect(normalizeOverrides(null)).toEqual({});
    expect(normalizeOverrides(['x'])).toEqual({});
    expect(normalizeOverrides(undefined)).toEqual({});
  });

  it('lets a tenant override win over the global default in either direction', () => {
    expect(isEnabled(true, { customer_reviews: false }, 'customer_reviews')).toBe(false);
    expect(isEnabled(false, { customer_reviews: true }, 'customer_reviews')).toBe(true);
    expect(isEnabled(true, {}, 'customer_reviews')).toBe(true);
    expect(isEnabled(false, { other: true }, 'customer_reviews')).toBe(false);
  });

  it('builds an effective map for a flag registry + overrides', () => {
    const flags = [
      { name: 'customer_reviews', isEnabled: true },
      { name: 'advanced_analytics', isEnabled: false },
    ];
    expect(buildEffectiveMap(flags, { customer_reviews: false })).toEqual({
      customer_reviews: false,
      advanced_analytics: false,
    });
  });
});
describe('feature-flag registry controller (14.2)', () => {
  const {
    listFeatureFlags,
    createFeatureFlag,
    updateFeatureFlag,
    deleteFeatureFlag,
  } = require('../src/controllers/feature-flag.controller');

  beforeEach(() => jest.clearAllMocks());

  it('lists flags with effective state computed from tenant overrides', async () => {
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([
      makeFeatureFlagRow(),
      makeFeatureFlagRow({ id: 'flag-2', name: 'advanced_analytics', isEnabled: false }),
    ]);

    const { res } = await run(
      listFeatureFlags,
      tenantReq({ tenantFeatures: { customer_reviews: false } }),
    );

    const rows = bodyOf(res).data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'customer_reviews',
      globalEnabled: true,
      tenantOverride: false,
      enabled: false,
    });
    expect(rows[1]).toMatchObject({
      name: 'advanced_analytics',
      globalEnabled: false,
      tenantOverride: null,
      enabled: false,
    });
  });

  it('creates a flag with the default disabled when isEnabled is absent', async () => {
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.featureFlag.create as jest.Mock).mockResolvedValue(makeFeatureFlagRow());

    const { res } = await run(createFeatureFlag, {
      ...tenantReq(),
      body: { name: 'loyalty_program', description: 'Points' },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.featureFlag.create).toHaveBeenCalledWith({
      data: { name: 'loyalty_program', description: 'Points', isEnabled: false },
    });
  });

  it('rejects duplicate flag names with 409', async () => {
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(makeFeatureFlagRow());

    const { next } = await run(createFeatureFlag, {
      ...tenantReq(),
      body: { name: 'customer_reviews' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_FLAG_EXISTS', statusCode: 409 });
    expect(prisma.featureFlag.create).not.toHaveBeenCalled();
  });

  it('rejects malformed flag names before touching the database', async () => {
    const { next } = await run(createFeatureFlag, {
      ...tenantReq(),
      body: { name: 'Camel Case!' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prisma.featureFlag.create).not.toHaveBeenCalled();
  });
  it('updates a flag globally and surfaces 404 for foreign ids', async () => {
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(makeFeatureFlagRow());
    (prisma.featureFlag.update as jest.Mock).mockResolvedValue(
      makeFeatureFlagRow({ isEnabled: false }),
    );

    const { res } = await run(updateFeatureFlag, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { isEnabled: false },
    });

    expect(prisma.featureFlag.update).toHaveBeenCalledWith({
      where: { id: uid(1) },
      data: { isEnabled: false },
    });
    expect(bodyOf(res).data).toMatchObject({ isEnabled: false });

    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(null);
    const notFound = await run(updateFeatureFlag, {
      ...tenantReq(),
      params: { id: uid(2) },
      body: { isEnabled: true },
    });
    expect(notFound.next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_FLAG_NOT_FOUND', statusCode: 404 });
  });

  it('blocks renaming onto an existing name with 409', async () => {
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValueOnce(makeFeatureFlagRow());
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValueOnce(makeFeatureFlagRow({ id: 'flag-9', name: 'reviews' }));

    const { next } = await run(updateFeatureFlag, {
      ...tenantReq(),
      params: { id: uid(1) },
      body: { name: 'reviews' },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_FLAG_EXISTS', statusCode: 409 });
    expect(prisma.featureFlag.update).not.toHaveBeenCalled();
  });

  it('deletes a flag with 204 when present and 404 otherwise', async () => {
    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(makeFeatureFlagRow());
    const ok = await run(deleteFeatureFlag, { ...tenantReq(), params: { id: uid(1) } });
    expect(ok.res.statusCode).toBe(204);
    expect(prisma.featureFlag.delete).toHaveBeenCalledWith({ where: { id: uid(1) } });

    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(null);
    const missing = await run(deleteFeatureFlag, { ...tenantReq(), params: { id: uid(2) } });
    expect(missing.next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_FLAG_NOT_FOUND', statusCode: 404 });
  });
});

describe('feature-flag tenant config controller (14.5)', () => {
  const { getFeatureConfig, updateFeatureConfig } =
    require('../src/controllers/feature-flag.controller');

  beforeEach(() => jest.clearAllMocks());

  it('returns the effective map when attachFeatureFlags has populated it', async () => {
    const { res } = await run(getFeatureConfig, {
      ...tenantReq(),
      featureFlags: { customer_reviews: false, loyalty_program: true },
    } as unknown as Partial<FeatureFlagRequest>);

    expect(bodyOf(res).data).toEqual({ customer_reviews: false, loyalty_program: true });
  });

  it('500s when the effective map was never loaded', async () => {
    const { next } = await run(getFeatureConfig, tenantReq());
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'FEATURES_NOT_LOADED', statusCode: 500 });
  });

  it('merges overrides into existing tenant features and returns the new map', async () => {
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([
      { name: 'customer_reviews', isEnabled: true },
      { name: 'advanced_analytics', isEnabled: false },
    ]);
    (prisma.tenant.update as jest.Mock).mockResolvedValue({ id: 'tenant-1' });

    const { res } = await run(updateFeatureConfig, {
      ...tenantReq({ tenantFeatures: { advanced_analytics: true } }),
      body: { overrides: { customer_reviews: false } },
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: expect.objectContaining({
        features: { advanced_analytics: true, customer_reviews: false },
      }),
    });
    expect(bodyOf(res).data).toEqual({
      customer_reviews: false,
      advanced_analytics: true,
    });
  });
  it('clears an override when the value is null', async () => {
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([
      { name: 'customer_reviews', isEnabled: true },
    ]);
    (prisma.tenant.update as jest.Mock).mockResolvedValue({ id: 'tenant-1' });

    const { res } = await run(updateFeatureConfig, {
      ...tenantReq({ tenantFeatures: { customer_reviews: false } }),
      body: { overrides: { customer_reviews: null } },
    });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: expect.objectContaining({ features: {} }),
    });
    expect(bodyOf(res).data).toEqual({ customer_reviews: true });
  });

  it('rejects overrides for flags that do not exist', async () => {
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([{ name: 'customer_reviews', isEnabled: true }]);

    const { next } = await run(updateFeatureConfig, {
      ...tenantReq(),
      body: { overrides: { ghost_flag: true } },
    });

    expect(next.mock.calls[0][0]).toMatchObject({ code: 'FEATURE_NOT_FOUND', statusCode: 400 });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('feature-flag middleware (14.4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attachFeatureFlags builds the effective map from registry + overrides', async () => {
    (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([
      { name: 'customer_reviews', isEnabled: true },
      { name: 'advanced_analytics', isEnabled: false },
    ]);

    const req = asRequest<FeatureFlagRequest>({
      tenantId: 'tenant-1',
      tenantFeatures: { customer_reviews: false },
    });
    const res = createRes();
    const nextFn = jest.fn();

    await attachFeatureFlags(req as any, res as any, nextFn as any);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(req.featureFlags).toEqual({ customer_reviews: false, advanced_analytics: false });
  });

  it('attachFeatureFlags rethrows a missing tenant context to the error handler', async () => {
    const req = asRequest<FeatureFlagRequest>({});
    const nextFn = jest.fn();

    await attachFeatureFlags(req as any, createRes() as any, nextFn as any);

    expect(nextFn.mock.calls[0][0]).toMatchObject({ code: 'TENANT_REQUIRED', statusCode: 400 });
  });

  it('requireFeature admits only explicitly-enabled flags', () => {
    const mw = requireFeature('customer_reviews');
    const nextFn = jest.fn();

    mw(
      asRequest<FeatureFlagRequest>({ featureFlags: { customer_reviews: true } }) as any,
      createRes() as any,
      nextFn as any,
    );
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  const disabledCases: Array<Partial<FeatureFlagRequest>> = [
    { featureFlags: { customer_reviews: false } },
    { featureFlags: {} },
    { featureFlags: { other: true } },
  ];

  it.each(disabledCases)('requireFeature fails closed for %j', (reqPartial) => {
    const res = createRes();
    const nextFn = jest.fn();

    requireFeature('customer_reviews')(asRequest<FeatureFlagRequest>(reqPartial) as any, res as any, nextFn as any);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('requireFeature 500s when attachFeatureFlags never ran', () => {
    const res = createRes();

    requireFeature('customer_reviews')(
      asRequest<FeatureFlagRequest>({}) as any,
      res as any,
      jest.fn() as any,
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: { code: 'FEATURES_NOT_LOADED' } });
  });
});
