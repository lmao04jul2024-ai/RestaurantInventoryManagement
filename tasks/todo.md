# Session 2026-09-17 (b) — Self-service password change (platform operator) + console column rationale

## Report
- "fix password change for /platform platform admin": there was **no** in-app password change anywhere —
  live check (headless Chrome, platform@yourapp.com) shows the avatar menu contains only *Sign out*;
  the only documented path was the email reset flow. Grep confirmed zero change-password UI and no
  authenticated `PATCH .../password` endpoint. Fix = build the missing capability.
- "why seats and usage column in this UI table?": answered (S2.4 manual-billing console rationale) — no code change.

## Plan
- [x] API: `changePasswordSchema` (validation.ts) + `changePassword` controller (auth.controller.ts)
- [x] API: `PATCH /api/auth/password` via `authenticate` only (no resolveTenant → PLATFORM_ADMIN is legal here)
- [x] API: revoke every session on success + fail-open `security:auth.password_changed` audit row
- [x] API tests: `packages/api/tests/auth-password.spec.ts` (operator path, wrong current, reuse, inactive, weak, audit)
- [x] Web: `ChangePasswordPayload` type + `authService.changePassword`
- [x] Web: `components/auth/change-password-dialog.tsx` (current + new + confirm, success → sign out)
- [x] Web: UserMenu gains "Change password" (lands in the platform console shell AND the dashboard shell)
- [x] Web tests: dialog spec + user-menu spec (shared `mocks/auth-service.ts` gains `mockChangePassword`)
- [x] Docs: `docs/api/README.md` + `docs/api/openapi.yaml`
- [x] Verify: api + web suites, tsc, live curl round-trip on the Docker stack

## Review (2026-09-17)
- Root cause: the capability was MISSING, not broken. Live headless-Chrome check of /platform/tenants as
  platform@yourapp.com showed the avatar menu offering only "Sign out"; no change-password UI and no
  authenticated password endpoint existed anywhere (only the email reset flow).
- API: `PATCH /api/auth/password` → 200 (rotates, revokes all sessions, audit row), 400
  CURRENT_PASSWORD_INCORRECT, 400 PASSWORD_UNCHANGED, 400 VALIDATION_ERROR (weak), 401 unauthenticated /
  USER_INACTIVE. Route is authenticate-only so the operator role (rejected by resolveTenant on tenant
  surfaces) can use it; handler scopes by `req.user.userId`.
- Web: avatar menu (shared by /platform console and /dashboard) → "Change password" → modal dialog;
  success revokes the session client-side too and routes to /login.
- Live verification on the rebuilt Docker stack: curl round-trip rotated the operator password, logged in
  with the new one, rejected the old one, then RESTORED the seeded password (final login 200 as
  PLATFORM_ADMIN). Headless Chrome: menu shows "Change password" + "Sign out", the dialog opens with all
  three fields, and submitting a wrong current password renders "Your current password is incorrect."
  (no mutation) — i.e. the whole web→api path is exercised.
- Suites: api 30 suites / 447 tests green (+8 new), web 35 suites / 186 tests green (+7 new); api + web tsc
  clean; eslint 0 errors (7 pre-existing `any` warnings only); openapi.yaml parses (70 paths).
- Untouched working-tree noise (other session): untracked `packages/api/prisma/migrations/*` — left alone.

- [x] Inspect running images, schema drift, seed behavior, and build setup.
- [x] Add the missing PLATFORM_ADMIN migration (no database reset).
- [x] Fix Docker build context/workspace installs and rebuild API/web.
- [x] Back up PostgreSQL, deploy migration, and provision only the platform account.
- [x] Recreate app containers; verify health, web routes, and authenticated platform access.
- [x] Record verification results and update Memory MCP before closure.


# Session 2026-09-10 — Visual rebrand + admin-login fix + CSS pipeline fix

## 1. Warm Hospitality visual refresh (user-requested, out-of-roadmap)
- Primary blue→orange #EA580C (Tailwind orange scale), stone surfaces/grays, radius 8→12/16, layered warm shadows + glow, selection/scrollbars, keyframes.
- Lockstep: shared/tokens.ts ↔ web globals.css ↔ lib/theme.ts (classic='Classic Amber') ↔ theme-editor/switcher defaults ↔ 5 web spec files ↔ shared index.spec dark anchor.
- Primitives: Button (shadow/lift/press), Card (+hoverable), Input (ring-4 soft), Alert (Heroicons chips).
- Dashboard: warm hero band + staggered quick-link cards (tested strings preserved).
- Verified: shared 31/31, web 149/149, api 332/332, next build clean.

## 2. fix(api): admin login TENANT_REQUIRED (L052)
- resolveTenant gated POST /auth/login → pre-login web could never resolve a tenant (no JWT/X-Tenant-ID/subdomain on localhost) → login impossible (chicken-and-egg).
- login now resolves tenant FROM credentials: email-global findMany (+optional body tenantId pre-narrow) → bcrypt filter → 0=401 (+timing equalizer), >1=400 TENANT_AMBIGUOUS (documented in openapi), 1=tokens+runWithTenant.
- /login + /forgot-password unwired from resolveTenant; /register stays gated (first-user-ADMIN safety).
- New tests/auth-login.spec.ts (8 regression tests); security.spec live probe no longer pins tenant.

## 3. fix(web): Tailwind was NEVER compiling — missing postcss.config.js (L053)
- User screenshot showed raw unstyled HTML (default links/buttons; only raw CSS vars applied). No postcss.config.js ever existed (not in git history); autoprefixer not installed.
- Added postcss.config.js (tailwindcss plugin). First rebuild was served from stale .next cache — rm -rf .next + rebuild → utilities verified (--tw- markers, preflight, .rounded-card).
- Live verified via headless Chrome: button rgb(234,88,12), radius 12/16px, preflight no-underline links, flex auth shell, primary-700 brand panel.
- NOTE: dev servers must be RESTARTED to pick up the new postcss config; run `npm run dev` fresh.

## Excluded from commits (other-session noise, untouched)
Dockerfile, docker-compose.yml, package-lock.json, next.config.js, tsconfig.json, tests/mocks/next-navigation.ts
# Session 2026-09-16 — SaaS Commercialization Plan (Phase 5 tasks added)

## Context
- User decision: sell app to multiple businesses; shared-DB/row-level multi-tenancy already exists (Week 15). Billing is MANUAL — no payment processor, no in-app transactions, ever. App records commercial state only.
- Added "Phase 5: SaaS Commercialization" to tasks/00_PROJECT_TASKS.md (S-Weeks 1–4, 20 new tasks S1.1–S4.4).
- First implementation task: **S1.1 tenant-isolation audit** → S1.2 cross-tenant test suite.
- After S1: S-Week 2 combines manual billing ops + super-admin console (platform-admin role, audit-logged plan/status/seat changes, seats-limit enforcement at invite, remove self-serve plan-change UI).
- Then S-Week 3 (onboarding wizard/CSV import/data export/email) and S-Week 4 (prod deploy, per-tenant logging, marketing site with manual-billing CTA) — parallelizable.

## Implementation results (this session)

### S-Week 1 COMPLETE — S1.1–S1.5, api 394/394, tsc clean, eslint 0 errors
- **S1.1 fix (real vulnerability found):** `applyTenantScope` create path used to only inject `tenantId` when absent — an explicit stale value could write cross-tenant. Now `create`/`createMany` (array + object forms) FORCE the request tenant (mirrors where-path semantics). Verified safe: all current call sites either use `req.tenantId` or run with NO tenant context (public onboarding `tenant-onboarding.ts` → pass-through branch).
- **S1.1 audit doc:** `docs/security/TENANT_ISOLATION_AUDIT.md` — 15/15 own-tenantId models scoped; transitive rows reached only via scoped parents (verified in controller load helpers); zero `$queryRaw`/`$executeRaw` in src; unique-where ops (findUnique/update/delete/upsert) remain documented pass-through with findFirst-first compensating control; `AuditLog`/`Session` etc. global by design.
- **S1.2:** tenant-scope.spec now 66 tests — isolation matrix: every scoped model × 7 where-ops (tenant A context can't reach tenant-a rows) + create/createMany override + unique-op pass-through pinned.
- **S1.3:** `extractSubdomain` gains `TENANT_ROOT_DOMAIN` deterministic mode — only hosts under the root resolve (`{tenant}.root`, `api.{tenant}.root` → last non-www label); apex/www/foreign hosts → null (no stray "www" slug probes); legacy heuristic kept when unset. 5 new tenant.spec tests.
- **S1.4:** `tenantRateLimit` (default 3000 req/60s, `RATE_LIMIT_TENANT_MAX`) mounted `app.use('/api', …)` before routers; bucket key = req.tenantId → signature-verified JWT tenantId (forged tokens fall to IP bucket, can't poison) → IP. 5 new rate-limit.spec tests (shared singleton buckets ⇒ unique tenant ids per test!).
- **S1.5:** docs/api/README.md — tenant resolution/subdomain + rate limiting sections updated; audit doc linked; `.env.example` documents both vars.
- Commits: 3ade435 (S1.1+S1.2), ff2c0ba (S1.3+S1.4), 52dc167 (tracker/bookkeeping). Tracker: S-Week 1 fully ticked.
- Next session: **S-Week 2** — S2.1 platform-admin role → S2.6 self-serve plan-change removal.

### S-Week 2 COMPLETE — S2.1–S2.6 (manual billing + super-admin console), api 408/408, web 162/162
- **S2.1 role:** `UserRole.PLATFORM_ADMIN` added to the Prisma enum (rank 5 in `ROLE_HIERARCHY` so nothing accidentally outranks it), new `requirePlatformAdmin()` guard (401 unauthenticated / 403 FORBIDDEN_ROLE). `resolveTenant` REJECTS the role on every tenant surface with `403 PLATFORM_ADMIN_FORBIDDEN` → the operator role can never be used to read tenant data via a tenant route. Seed upserts a `platform` tenant + operator user (`PLATFORM_ADMIN_EMAIL`/`_PASSWORD`).
- **S2.2/S2.3 API:** `GET /api/platform/tenants` (search by name/slug, paginated, `_count` usage), `GET /:id` (usage + `billing{seatsUsed,seatsLimit}` + `recentChanges`), `PATCH /:id` (plan / subscriptionStatus / seatsLimit / isActive). Diff-based: a no-op PATCH writes nothing. Every real change writes an immutable `platform:tenant.updated` audit row INTO THE AFFECTED TENANT's scope with a field-level from→to diff. `seatsLimit` below current usage → `409 SEATS_BELOW_USAGE`.
- **S2.4 console:** NEW web route group `(platform)` — own shell (no tenant Header/Sidebar: the operator has no tenant context), `ProtectedRoute roles={PLATFORM_ROLES}`. `/platform/tenants` = searchable/paginated table + "needs attention" banner for suspended/lapsed rows; `/platform/tenants/[id]` = usage cards + seat-pressure bar + commercial-state editor (changed-fields-only save) + change-history list rendered from the audit trail (the manual-billing ledger). `ProtectedRoute` + login page send PLATFORM_ADMIN to `/platform` instead of bouncing through /dashboard.
- **S2.5 seats:** new `services/seats.ts` `enforceSeats()` called at BOTH user-creation paths — `POST /api/staff` (invite) and `auth register` (CUSTOMER self-signup; the first-user ADMIN bootstrap deliberately bypasses it). Exceeding → `409 SEATS_LIMIT_REACHED`.
- **S2.6 self-serve removal:** `updateTenantSchema` no longer accepts `plan`/`subscriptionStatus`/`isActive` (Joi strips them) — a workspace cannot change its own commercial state **or lift its own suspension** (that would void the lapse flow). Web `/dashboard/tenants` lost the plan/status selects and the "Workspace active" checkbox; plan/status are now read-only chips + "managed by your platform operator"; a suspended workspace shows guidance to settle with the operator.
- **Semantic change worth noting:** reactivation is now operator-only. `resolveTenant` still lets members GET/PATCH `/api/tenants/me` while suspended (so the workspace isn't bricked and settings remain readable) — the old test title "reactivation path" was renamed to "settings recovery path" and the stale `WORKSPACE_INACTIVE` message ("re-enable Workspace active") no longer promises a UI control that does not exist.
- Docs: `docs/api/README.md` (platform domain row, RBAC outside-the-ladder note, manual-billing/ledger section, error codes `FORBIDDEN_ROLE`/`PLATFORM_ADMIN_FORBIDDEN`/`TENANT_NOT_FOUND`/`SEATS_*`), `docs/api/openapi.yaml` (`/api/platform/tenants*` + self-service stripping note), `.env.example` operator credentials.
- Verification: `packages/api` tsc clean + 408/408 across 25 suites; `packages/web` tsc clean + 162/162 across 30 suites; shared tsc clean; eslint 0 errors (3 pre-existing `any` warnings in validation.ts).
- Next session: **S-Week 3** — S3.1 onboarding wizard + CSV inventory import, S3.2 tenant data export, S3.3 lifecycle email, S3.4 operator attention list, S3.5 entitlement display.

## Acceptance notes
- Keep house style: plan-mode first, logical feature commits, run test suites (api/web/shared/mobile) before marking ticks.
- S1.3 must not break the L052 login flow or WORKSPACE_INACTIVE recovery path (todo.md session 2026-09-11).
- No Stripe/payment deps anywhere; pricing page is "contact to subscribe".

## Excluded from commits (other-session noise, untouched)
Dockerfile, docker-compose.yml, package-lock.json, next.config.js, tsconfig.json, tests/mocks/next-navigation.ts



# Session 2026-09-11 — Configuration lockout investigation + dark-mode select fix

## 3. fix(web): dark-mode <select> white-on-white
- Symptom: "<select> text and bg are both white in dark mode". Verified every token-based select renders high-contrast in dark Chrome (bg `rgb(28,25,23)`, fg `rgb(250,250,249)`) — the failure is browsers/OSes combining dark-mode light inherited text with a light OS-drawn control/drop-down.
- Fix: globals.css adds `select, select option { color: var(--color-content-default); background-color: var(--color-surface) }` (minifier merges to one rule; verified present in served CSS). High-specificity utility classes still win on components.
- Verified: web 151/151; rebuilt web image, recreated `restaurant-web` container, served CSS confirmed (commit 79defeb).

# Session 2026-09-11 — Settings lockout after plan change (investigation + self-lockout fix)

## 1. Investigation: "changed Plan PRO → TRIAL, cannot access settings"
- Live-reproduced the full journey (login → PATCH plan TRIAL → settings): **plan downgrades do NOT block settings** — verified API (200s) and rendered web UI.
- Root cause of the reported symptom: the settings form's **"Workspace active" (`isActive`)** checkbox lives in the same save payload; `resolveTenant` filtered `isActive: true`, so an inactive tenant → every request 404 `TENANT_NOT_FOUND` (incl. PATCH → **no UI recovery**; login still worked).
- Infra note: docker compose (postgres 5433 / redis 6379) was DOWN at session start; started via Docker.app + `docker compose up -d postgres redis`; API on 3001 and web on 3000 started in background (logs /tmp/api-dev.log, /tmp/web-dev.log). Auth rate limit is 10 logins/60s — batch logins or wait.

## 2. fix(api): inactive-workspace self-lockout (no recovery path)
- `resolveTenant`: id lookups no longer filter `isActive`; inactive tenants → members get 403 `WORKSPACE_INACTIVE` on all surfaces EXCEPT GET/PATCH `/api/tenants/me` (settings loads + reactivation saves). Non-members/unauthenticated still 404 (no existence leak). Slug lookups keep the isActive filter.
- Tests: 4 new regression tests in tests/tenant.spec.ts; api suite 336/336 green.
- Live-verified end-to-end: deactivate → settings 200 + menus 403 → re-check box + Save in UI → `isActive=t` in DB → menus 200.
- Docs: `WORKSPACE_INACTIVE` row added to docs/api/README.md error table.

## Excluded from commits (other-session noise, untouched)
Dockerfile, docker-compose.yml, package-lock.json, next.config.js, tsconfig.json, tests/mocks/next-navigation.ts

# Warm Hospitality Visual Refresh — Web (out-of-roadmap polish)

## Context
- HEAD dbad065 (Week 23 bookkeeping). Tracker 131/144; roadmap weeks complete — this is an ad-hoc visual polish task per user request.
- User picked aesthetic: **Warm hospitality** — appetizing amber/orange palette, friendly rounded shapes, restaurant feel.
- Test-safety verified: no spec asserts brandPalette hexes or theme-editor `#2563eb` defaults (shared spec uses `#3B82F6` only as converter sample; identity checks are self-referential).
- Contract: palettes must stay byte-identical across shared → web (CSS triplets) → mobile (auto-maps from shared).

## Palette decision
- Primary: Tailwind orange scale (50 #FFF7ED … 600 #EA580C … 900 #7C2D12) — warm/appetizing.
- Secondary: keep teal (#0D9488) — proven appetite-complementary pairing, minimal impact.
- Surfaces/grays: blue-tinted gray → warm stone ladder; dark mode warms too.
- Shape: radius 8→12px default, card 12→16px; layered warm-tinted shadow tiers + primary glow.

## Plan
- [ ] 1. Rebrand tokens: shared/tokens.ts brandPalette + light/dark semantic warm
- [ ] 2. globals.css: warm triplets, radius/shadow tokens, selection/scrollbar/keyframes polish; tailwind.config.js shadow tiers + animations
- [ ] 3. UI primitives: Button (gradient/lift/press), Card (+hoverable prop, non-breaking), Input, Alert (Heroicons, soft tones)
- [ ] 4. Chrome: Header glass + Heroicon logo, Sidebar Heroicons + active indicator, UserMenu, Footer
- [ ] 5. Dashboard index: gradient hero + icon-chip quick links
- [ ] 6. Auth layout warm gradient panel; Shop header glass + cart badge
- [ ] 7. Sync theme-editor/lib defaults to new brand (#ea580c)
- [ ] 8. Verify: shared+web+mobile tests, next build, dev-server screenshot
- [ ] 9. Logical feature commit; Memory push + [MEMORY BANK: UPDATED]

# Week 23 — Documentation & Training Materials (23.1–23.6)

## Context
- HEAD 78d6893 (Week 22 committed). Tracker 125/144; Week 23 adds 6 → 131/144.
- Prior session left partial Week 23 work uncommitted + out-of-scope noise (Prisma ^7 bump, node:22 Dockerfile, web tsconfig excluding tests, deleted lockfile) — noise REVERTED at session start per L050.
- Memory MCP had no Week 22 push (L001 recurrence) → log as L051, push Week 22+23 at close.

## Plan
- [x] Revert out-of-scope working-tree noise; remove prisma.config.ts + stray `grep` file
- [x] 23.1 Fix docs/api/README.md factual errors (66 paths/26 schemas, /api/menus, /api/orders/kitchen*, GDPR=/api/me+/api/me/data, /api/audit-logs, suppliers row, drop VERSION_CONFLICT)
- [x] 23.2 Fix docs/manuals: server.md §5 fictional offline sync → real behavior; kitchen.md unclosed backtick
- [x] 23.3 Create docs/training/decks/{customer,server,kitchen,manager,admin}.md (slide-style, exercise per deck)
- [x] 23.4 docs/deployment/OPERATIONS.md (monitoring/alerting/runbooks; link from README)
- [x] 23.5 docs/troubleshooting/README.md
- [x] 23.6 docs/onboarding/README.md (new-client onboarding)
- [x] Tracker 23.1–23.6 → 131/144; lessons L051; todo update
- [x] Verify: link-check all docs relative links, yaml.safe_load openapi, git status clean of noise
- [x] Commits: docs commit → bookkeeping commit; Memory push (Week 22 retro + Week 23) + [MEMORY BANK: UPDATED]

## Review (2026-09-10)
- All 6 deliverables complete; noise reverted (Prisma 7/Docker/node22/tsconfig/lockfile); L051 logged.
- Factual fixes: api guide 66/26 + real paths (/api/menus, /api/orders/kitchen*, /api/me(+data), /api/audit-logs, suppliers), removed nonexistent VERSION_CONFLICT; server manual offline-sync section rewritten; kitchen backtick; seed command.
- Verified: 0 broken relative links in docs/, openapi yaml valid (66 paths/26 schemas), tracker 131/144, working tree = docs + bookkeeping only.
- Commits: docs commit → bookkeeping commit; memory pushed (Week 22 retro + Week 23).
