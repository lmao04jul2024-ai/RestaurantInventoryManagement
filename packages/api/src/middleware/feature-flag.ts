import { Response, NextFunction } from 'express';
import prisma from '../services/database';
import { TenantRequest } from './tenant';
import { requireTenant } from '../utils/http-error';
import { buildEffectiveMap } from '../services/feature-flags';

export interface FeatureFlagRequest extends TenantRequest {
  /** Effective `{ flagName: boolean }` map for the resolved tenant. */
  featureFlags?: Record<string, boolean>;
}

/**
 * Week 14.4 — loads every registered flag plus the resolved tenant's overrides
 * into `req.featureFlags` as an effective boolean map. Mount AFTER
 * `authenticate` + `resolveTenant` so tenant scope is guaranteed.
 */
export async function attachFeatureFlags(req: FeatureFlagRequest, _res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    const flags = await prisma.featureFlag.findMany({
      select: { name: true, isEnabled: true },
    });
    req.featureFlags = buildEffectiveMap(flags, req.tenantFeatures ?? {});
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Week 14.4 — route-protection middleware. Requires `attachFeatureFlags` to
 * have run on the same router. Disabled OR unregistered flags fail closed with
 * 403 FEATURE_DISABLED so a misconfigured gate never accidentally grants access.
 */
export function requireFeature(name: string) {
  return (req: FeatureFlagRequest, res: Response, next: NextFunction) => {
    if (!req.featureFlags) {
      return res.status(500).json({
        error: {
          code: 'FEATURES_NOT_LOADED',
          message: 'attachFeatureFlags must run before requireFeature',
        },
      });
    }
    if (req.featureFlags[name] !== true) {
      return res.status(403).json({
        error: {
          code: 'FEATURE_DISABLED',
          message: `Feature '${name}' is disabled for this tenant`,
        },
      });
    }
    next();
  };
}