# Pre-Production Tasks (branch `pre-prod`)

Closes the three **day-1 production-readiness gaps** identified in the hosting
analysis of 2026-09-17 (memory: `HostingPlanDecision-2026-09-17`). They are
repo-level gaps — no VPS tier fixes them.

| # | Gap | Why it blocks go-live |
|---|---|---|
| 1 | Dev secrets + DB ports published to the world | `docker-compose.yml` hardcodes `restaurant123` / `JWT_SECRET` and binds 5433/6379/3000/3001 on `0.0.0.0`. A leaked JWT secret means anyone can mint a token for any `tenantId`. |
| 2 | `NEXT_PUBLIC_API_URL` not a build arg | Next inlines it into the **client** bundle at `next build`; proved baked as `http://localhost:3001` in 5 built chunks. Every browser call fails on a real domain. |
| 3 | No TLS edge | `docs/deployment/README.md:94` tells operators to "terminate TLS at the edge" but no nginx/Caddy config exists in-repo, and tenant subdomains need a cert that scales past one host. |

## Deliverables

### 1. Secrets + network isolation
- [ ] `docker-compose.prod.yml` — every secret via `${VAR:?…}` (fails fast, never defaults), Postgres/Redis publish **no** host ports, only Caddy exposes 80/443, `restart: unless-stopped`, healthchecks on all four services, `no-new-privileges`.
- [ ] `.env.production.example` — documented template incl. generation commands for `JWT_SECRET` / `ENCRYPTION_KEY` / DB password.

### 2. Build-time config
- [ ] `Dockerfile` — `ARG`/`ENV` for `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_SALES_EMAIL` in the `web-builder` stage (client bundle).
- [ ] `docker-compose.prod.yml` passes them as `build.args`.
- [ ] Proof: build the web image with a public URL and grep the emitted chunks — no `localhost:3001`.

### 3. TLS edge for apex + api + every tenant subdomain
- [ ] `deploy/Caddyfile` — one site block for `{root}` + `*.{root}`, routing `api.*` → `api:3001` and everything else → `web:3000`; on-demand TLS gated by an `ask` endpoint; the ask path answers 404 on the public edge.
- [ ] API: `GET /api/internal/tls-ask?domain=<host>` (no auth — it is Caddy's ACME hook, reachable only inside the compose network).
- [ ] Tests: allow apex/www/api/active-tenant (+`api.{slug}`), deny foreign/inactive/unknown, normalize case/port/trailing dot, fail closed when `TENANT_ROOT_DOMAIN` is unset.
- [ ] `caddy validate` green against the real Caddyfile.

### 4. Docs + verification
- [ ] `docs/deployment/README.md` §9 — prod stack boot sequence; §6 corrected (it claims the API image runs `migrate deploy` at boot — the Dockerfile does not).
- [ ] `docs/api/README.md` + `openapi.yaml` — document the internal endpoint; fix the stale path count.
- [ ] `docs/deployment/OPERATIONS.md` — TLS certificate runbook.
- [ ] Full suite green (api + web), `tsc`, `eslint`.

## Out of scope (still open after this branch)
Swap/ufw/fail2ban/backup-cron host bootstrap (items 4–6 of the analysis), and the Week 24 monitoring items.
