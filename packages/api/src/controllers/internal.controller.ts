import { NextFunction, Request, Response } from 'express';
import prisma from '../services/database';
import { tlsAskQuerySchema, validateQuery } from '../utils/validation';

/**
 * S4.5 — edge TLS automation surface (see `deploy/Caddyfile`).
 *
 * `GET /api/internal/tls-ask?domain=acme.yourapp.com`
 *
 * Caddy's `on_demand_tls` hook: before issuing a certificate for a host it
 * calls this endpoint and issues only when the answer is 2xx. Without it,
 * anyone able to point a domain at our IP could make us burn ACME quota (and
 * serve a phishing page on our certificate).
 *
 * Deliberately unauthenticated — Caddy cannot present a JWT — and therefore
 * deliberately NOT an internet-facing surface: the Caddyfile answers 404 for
 * this path, so only Caddy's internal call (`http://api:3001/…`) reaches it.
 *
 * Allowed hosts: the apex, `www.<root>`, `api.<root>`, plus `{slug}.<root>` and
 * `api.{slug}.<root>` where `{slug}` is an ACTIVE workspace. Everything else —
 * including any host outside `TENANT_ROOT_DOMAIN` — is refused. The slug rule
 * mirrors `extractSubdomain` in `middleware/tenant.ts`, so the edge can never
 * mint a certificate for a host the API itself would refuse to serve.
 *
 * Failure mode is **fail closed**: an unanswered or refused ask means no new
 * certificate. A database outage therefore degrades to "no new certificates"
 * rather than "any host may obtain one".
 *
 * No audit row is written for denials: this route is anonymous, so persisting
 * every probe would be a write-amplification vector. Denials are logged
 * instead (structured JSON → the aggregator).
 */

/** Lowercases, drops the port and any trailing dot: `API.Acme.Root.:443` → `api.acme.root`. */
export function normalizeHost(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      // Port first: `acme.root.:443` must lose the port BEFORE the trailing dot,
      // otherwise the dot survives and the host never matches the root.
      .split(':')[0]
      .replace(/\.+$/, '')
  );
}

/**
 * The tenant slug a host claims, or null when it is not under the root domain.
 * Mirrors the deterministic mode of `extractSubdomain`: the LAST label before
 * the root is the slug (`acme.yourapp.com` → `acme`, `api.acme.yourapp.com` →
 * `acme`; `www` never resolves to a workspace).
 */
export function tenantSlugForHost(host: string, root: string): string | null {
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;
  const labels = host.slice(0, -suffix.length).split('.');
  const slug = labels[labels.length - 1];
  return slug && slug !== 'www' ? slug : null;
}

function refuse(req: Request, res: Response, code: string, message: string) {
  req.logContext?.log.warn('tls_ask_denied', {
    code,
    domain: String(req.query?.domain ?? ''),
  });
  return res.status(403).json({ error: { code, message } });
}

export async function tlsAsk(req: Request, res: Response, next: NextFunction) {
  try {
    const { domain } = validateQuery(tlsAskQuerySchema, req.query);

    const root = process.env.TENANT_ROOT_DOMAIN?.trim().toLowerCase();
    if (!root) {
      // Without a root domain there is no way to distinguish a tenant host from
      // a foreign one — refuse everything rather than guess.
      return refuse(
        req,
        res,
        'TLS_NOT_CONFIGURED',
        'TENANT_ROOT_DOMAIN is not configured on this deployment'
      );
    }

    const host = normalizeHost(domain);

    // Infrastructure hosts that are not workspaces.
    if (host === root || host === `www.${root}` || host === `api.${root}`) {
      return res.json({ data: { domain: host, allowed: true } });
    }

    const slug = tenantSlugForHost(host, root);
    if (!slug) {
      return refuse(
        req,
        res,
        'TLS_DOMAIN_NOT_ALLOWED',
        'This host is not served by this deployment'
      );
    }

    // Active workspaces only: a suspended/cancelled workspace must not keep a
    // certificate (offboarding step 5 in docs/deployment/README.md §8).
    const tenant = await prisma.tenant.findFirst({
      where: { slug, isActive: true },
      select: { id: true },
    });
    if (!tenant) {
      return refuse(
        req,
        res,
        'TLS_DOMAIN_NOT_ALLOWED',
        'This host is not served by this deployment'
      );
    }

    return res.json({ data: { domain: host, allowed: true } });
  } catch (error) {
    next(error);
  }
}
