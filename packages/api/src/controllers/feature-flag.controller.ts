import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/database';
import { TenantRequest } from '../middleware/tenant';
import { FeatureFlagRequest } from '../middleware/feature-flag';
import { httpError, requireTenant } from '../utils/http-error';
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  featureFlagIdParamSchema,
  updateFeatureConfigSchema,
  validateBody,
  validateParams,
} from '../utils/validation';
import { isEnabled, normalizeOverrides, buildEffectiveMap } from '../services/feature-flags';

/**
 * Week 14 — feature flag registry + per-tenant configuration.
 *
 * Two layers:
 *  1. The global registry (`FeatureFlag`) defines every feature and its default
 *     state — MANAGER+ management.
 *  2. `Tenant.features` carries per-restaurant overrides (`{ flagName: boolean }`),
 *     and the effective state (override wins) is what route gates and UIs read.
 */

function flagView(
  flag: { id: string; name: string; description: string | null; isEnabled: boolean },
  overrides: Record<string, boolean>,
) {
  return {
    id: flag.id,
    name: flag.name,
    description: flag.description,
    globalEnabled: flag.isEnabled,
    tenantOverride: flag.name in overrides ? overrides[flag.name] : null,
    enabled: isEnabled(flag.isEnabled, overrides, flag.name),
  };
}

// ── Registry (14.2) ───────────────────────────────────────────────────────────

export async function listFeatureFlags(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    const overrides = req.tenantFeatures ?? {};
    const flags = await prisma.featureFlag.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: flags.map((f) => flagView(f, overrides)) });
  } catch (e) {
    next(e);
  }
}

export async function createFeatureFlag(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    const data = validateBody(createFeatureFlagSchema, req.body);

    const existing = await prisma.featureFlag.findUnique({ where: { name: data.name } });
    if (existing) {
      throw httpError(409, 'FEATURE_FLAG_EXISTS', `Flag '${data.name}' already exists`);
    }

    const flag = await prisma.featureFlag.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isEnabled: data.isEnabled,
      },
    });
    res.status(201).json({ data: flag });
  } catch (e) {
    next(e);
  }
}

export async function updateFeatureFlag(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    const { id } = validateParams(featureFlagIdParamSchema, req.params);
    const data = validateBody(updateFeatureFlagSchema, req.body);

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      throw httpError(404, 'FEATURE_FLAG_NOT_FOUND', 'Feature flag not found');
    }
    if (data.name && data.name !== flag.name) {
      const dup = await prisma.featureFlag.findUnique({ where: { name: data.name } });
      if (dup) {
        throw httpError(409, 'FEATURE_FLAG_EXISTS', `Flag '${data.name}' already exists`);
      }
    }

    const updated = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      },
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
}

export async function deleteFeatureFlag(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    const { id } = validateParams(featureFlagIdParamSchema, req.params);

    const flag = await prisma.featureFlag.findUnique({ where: { id } });
    if (!flag) {
      throw httpError(404, 'FEATURE_FLAG_NOT_FOUND', 'Feature flag not found');
    }

    await prisma.featureFlag.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

// ── Per-tenant configuration (14.5) ───────────────────────────────────────────

/** Effective boolean map for the tenant — safe for any authenticated user. */
export async function getFeatureConfig(req: FeatureFlagRequest, res: Response, next: NextFunction) {
  try {
    requireTenant(req.tenantId);
    if (!req.featureFlags) {
      throw httpError(500, 'FEATURES_NOT_LOADED', 'Feature flags were not loaded');
    }
    res.json({ data: req.featureFlags });
  } catch (e) {
    next(e);
  }
}

/** Merge semantics: set `name → true|false`, `null` clears the override. */
export async function updateFeatureConfig(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = requireTenant(req.tenantId);
    // Explicit payload shape — Joi's pattern-schema inference stays opaque.
    const { overrides } = validateBody<{ overrides: Record<string, boolean | null> }>(
      updateFeatureConfigSchema,
      req.body,
    );

    const flags = await prisma.featureFlag.findMany({ select: { name: true, isEnabled: true } });
    const known = new Set(flags.map((f) => f.name));
    for (const name of Object.keys(overrides)) {
      if (!known.has(name)) {
        throw httpError(400, 'FEATURE_NOT_FOUND', `Unknown feature flag '${name}'`);
      }
    }

    const nextOverrides: Record<string, boolean> = { ...(req.tenantFeatures ?? {}) };
    for (const [name, val] of Object.entries(overrides)) {
      if (val === null) delete nextOverrides[name];
      else nextOverrides[name] = val;
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { features: normalizeOverrides(nextOverrides) as unknown as Prisma.InputJsonValue },
    });

    res.json({ data: buildEffectiveMap(flags, nextOverrides) });
  } catch (e) {
    next(e);
  }
}