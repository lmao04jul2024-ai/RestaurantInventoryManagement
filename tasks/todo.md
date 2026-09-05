# Week 18 — Testing & Documentation (18.1–18.6)

## Context
- Tracker 96/144 (Weeks 1–11, 13–17 done; 12 skipped per user). Next: Week 18 Testing & Documentation.
- Customization features shipped Weeks 13/17 (theme engine, console). Week 18 hardens them with tests and documents the platform.

## Plan
### API (18.1 / 18.2)
- [x] tenant-api.spec extended: all 4 presets × persistence, all 3 modes, branding-less theme accepted, malformed theme (missing preset/mode) → 400, operatingHours+theme combo
- [x] multi-tenant.integration.spec: supertest over the real `src/index` app (only `services/database` mocked) — health, 401 unauth, list scoped to caller tenant, create inherits tenantId, X-Tenant-ID mismatch → 403 TENANT_MISMATCH, cross-tenant row → 404, CUSTOMER blocked (role gate), per-user deny override → 403 FORBIDDEN_PERMISSION, feature-flag fail-closed → 403 FEATURE_DISABLED
- [x] devDep: supertest + @types/supertest

### Web (18.1 / 18.3)
- [x] theme-preview-card.spec: scoped vars (classic/custom+dark anchors, font var, logo vs emoji fallback, invalid-draft default fallback, :root isolation)
- [x] branding-editor.spec: font catalog, font drafting, logo preview chip, clear → null
- [x] customization-workflow.spec (e2e, real ThemeProvider + CustomizationPage): published emerald applies app-wide → draft sunset updates scoped preview only → publish PATCHes tenant theme → refetch re-syncs console → discard reverts
- [x] FIX (found by 18.3): customization-page draft never adopted a non-default published theme (sync effect gated on `!dirty`); draft now starts null and adopts saved until touched — prevents accidental branding wipe

### Docs (18.4 / 18.5 / 18.6)
- [x] docs/api/openapi.yaml (OpenAPI 3.0.3, 52 paths, 15 schemas, security schemes, error envelope) + docs/api/README.md conventions
- [x] docs/admin/README.md (admin feature guide + role matrix)
- [x] docs/deployment/README.md (compose, migrations, env, CI, prod notes, rollout checklist)

## Verification
- [x] API: tsc 0 · eslint exit 0 (pre-existing no-var-requires pattern only) · jest 228 green (+14: +5 unit, +9 integration)
- [x] Web: tsc 0 · `next build` exit 0 (customize route compiled) · next lint 0 errors · jest 123 green (+11)
- [x] openapi.yaml `yaml.safe_load` valid (52 paths / 15 schemas)
- [x] Tracker ticks 18.1–18.6 (102/144); lesson L020; commits api → web → docs → bookkeeping; memory termination push

## Notes
- Integration tier needs no DB: jest mocks the prisma module; the tenant-scope data guard stays unit-tested in tenant-scope.spec (it lives inside the mocked module).
- `redis.ts`/`mailer.ts` are currently unreferenced by src — no mocks needed for app boot.
- `next build` prints a `patchIncorrectLockfile` TypeError while finalizing (env quirk: registry fetch + ENOWORKSPACES from its internal npm call); exit code is 0 and all routes compile — cosmetic.
- Known documented limitation (unchanged): tenant theme applies app-wide only to signed-in users.

## Review
- **Converged design:** Week 18 added the missing test tiers without new infra — unit (extended tenant-api + component specs), integration (supertest over the real express app with only the prisma module mocked), and component-level e2e (real ThemeProvider + CustomizationPage, services mocked).
- **Real bug caught by 18.3:** the customization console's draft never adopted a published non-default theme (permanently "dirty" from first render → Discard/Publish could wipe branding). Fixed via null-initial draft + `touched` flag; regression-covered by the workflow spec. Lesson L020.
- **Docs are generated-from-routes:** openapi.yaml mirrors every `src/routes/*.routes.ts` path (52) with shared schemas; admin/deployment guides cover the shipped feature set through Week 18.
- **Verification:** api tsc 0 / 228 green · web tsc 0 / 123 green / next build exit 0 · yaml valid.
- **Commit split:** api `test/integration` → web `fix+test` → docs → bookkeeping (tracker 102/144, L020, todo).
