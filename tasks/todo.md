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
