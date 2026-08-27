# Session Todo — 2026-08-27 (Week 6)

## 0. Deps
- [x] Install @testing-library/react@14 + jest-environment-jsdom@29 (web); mobile: zero deps — bundled RN preset discovered

## Week 6 — DevOps & Testing Infrastructure
- [x] **6.3** Jest configs: shared (new test script), api (ts-jest + JWT_SECRET setup), web (jsdom + aliases + tsconfig.jest jsx fix), mobile (bundled-RN preset directory-form)
- [x] **6.4** RTL wiring on web (jest-dom setup; ProtectedRoute + Button suites pass)
- [x] **6.5** Utilities: api factories/mock-express; web factories/next-navigation mock
- [x] **6.6** Suites: 58 green — shared 13, api 29, web 11, mobile 5
- [x] **6.1** Docker: api-production Prisma-client fix, npm ci builders, compose version-drop
- [x] **6.2** CI: .github/workflows/ci.yml (npm ci → prisma generate → build shared → lint → test)

## Wrap-up
- [x] Tracker ticks (Phase 1 COMPLETE: 36/144); lessons L005–L007
- [x] Logical commits: test stack, docker fix, ci workflow, task bookkeeping
- [x] Memory MCP termination push — verified via open_nodes

---
## Review
**Shipped:** Per-package Jest 29 stacks; 58-test matrix (`npm test` fan-out);
RTL14+jsdom29 on web; ts-jest-specific patterns documented in-config;
factories/mocks utilities; Dockerfile api-production root-cause fix (prisma CLI
gap) + npm ci determinism; GitHub Actions quality gate.
**Incident resolved:** react runtime tear in web tests (nested
react-dom@18.3.1 × root-bound zustand hooks → `null.useRef`) — root cause:
fossilized `packages/web/node_modules/react{,-dom}@18.3.1` LOCK entries that
survived purge/npm ci; excised keys, tree dedupes to unified react@18.2.0,
web pinned exactly 18.2.0 (extends L003 — never caret next to RN-shared
monorepos).
**Key learnings logged:** L005 ts-jest/mock-module import order; L006
@react-native/jest-preset has NO 0.7x npm release (use bundled RN root
preset, directory form); L007 lock-fossil surgery procedure.
**Follow-ups raised:** @types/jest explicit in web/mobile devDeps (currently
hoist-resolved, deterministic under npm ci but implicit); Storybook enable
(unchanged deferral); httpOnly cookie hardening (pre-existing).

# Session Todo — 2026-08-27 (continue)

Context restored from Memory MCP. Roadmap position: Weeks 1–4 done (24/144). Pending items
from last session: uncommitted Prisma fix (verified working) → commit; then Week 5.

## 0. Housekeeping
- [x] Read Memory MCP graph + verify prior-session state (Prisma fix diff matches memory record)
- [x] Confirm L001 fault pattern already logged in tasks/lessons.md

## 1. Commit pending Prisma client fix
- [x] Commit `9387432` — postinstall hook + P1012 list-default + trackable root package-lock.json

## 2. Week 5 — Mobile App Setup & Shared Components
- [x] **5.1** Finish RN+TS init: babel.config.js + monorepo-aware metro.config.js, `@react-native-async-storage/async-storage` installed (1.24.0); `react`/`react-test-renderer` pinned to exact 18.2.0 per RN 0.73 peer requirement
- [x] **5.2** React Navigation auth flow: RootNavigator hydration-safe gate, AuthNavigator (Login/Register/ForgotPassword), MainNavigator tabs
- [x] **5.3** Base mobile UI kit: Button, Input, Card, Text, Spinner (`src/components/ui`)
- [x] **5.4** Shared token library: `packages/shared/src/tokens.ts` (+barrel export)
- [x] **5.5** Styling system: `createAppTheme` mapping + ThemeProvider (light/dark, tenant overrides)
- [x] **5.6** docs/COMPONENTS.md + `.storybook/README.md` enable scaffold

## 3. Verification
- [x] `tsc --noEmit` exit 0 for packages/shared AND packages/mobile
- [x] Shared dist build + node runtime smoke (tenant override / alpha helper / palette fallbacks)

## 4. Wrap-up
- [x] Update `tasks/00_PROJECT_TASKS.md` checkboxes (incl. backfill Week 1 ✓)
- [x] Commit Week 5 work in logical commits — fb53c3b mobile, 46a66c0 shared, cb5e1ed tracker/lessons (prisma fix 9387432 earlier same day)
- [x] Memory MCP termination push (snapshot, decisions, lessons) — verified via open_nodes after write → `[MEMORY BANK: UPDATED]`

## Review
**Shipped:** prisma fix commit `9387432`; shared token source-of-truth (palettes,
spacing, radii, typography, semantic light/dark sets, `withAlpha`,
`hexToRgbTriplet`, `buildTenantTheme`); mobile app end-to-end skeleton — config,
types mirror of web contract, axios client w/ single-flight refresh (clearAuth +
auth-gate replaces web's window redirect), zustand store on AsyncStorage with
`_hasHydrated` gate pattern, auth service/hook, theme system, 5-component UI kit
(theme-driven only), 3 auth screens, tab shell with role badge proof, themed
NavigationContainer + StatusBar; storybook scaffold deferred-by-design.
**Gotchas fixed en route:** ERESOLVE react@18.3.1 vs RN-pinned 18.2.0 (purged
stale nested workspace modules); `process` untyped on RN → ambient env.d.ts;
Input spread-order bug (consumer props could clobber internal focus/style).
**Env quirks:** sandbox npm blocks lifecycle scripts behind an
install-scripts approval layer (postinstalls skipped incl. api's — existing
.prisma client intact); concurrent command batching raced install checks.
Next up: Week 6 DevOps & testing infrastructure.
