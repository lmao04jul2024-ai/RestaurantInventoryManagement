# Session Todo — 2026-09-03 (Week 14 — Feature Flags System)

Context: Weeks 1–11 + 13 done (**72/144**), git clean at `020ecbd` (Week 13 termination push recovered). Week 12 (QR/QappR) skipped per user. Feature-flag infrastructure already scaffolded: `FeatureFlag` model (name unique, `isEnabled` global default, `metadata` Json) + `Tenant.features` Json for per-tenant overrides — **no schema change needed**. House convention: evaluation = tenant override wins, else global default; fail closed.

## Week 14 — Feature Flags System (Phase 3 W2)
- [x] **14.1** Feature flag schema + seed — document existing `FeatureFlag`/`Tenant.features` contract; align seed keys to flag names (snake_case); add `customer_reviews` flag used as the real gate
- [x] **14.2** API endpoints — `/api/feature-flags` (GET list w/ effective state, POST/PATCH/DELETE CRUD, RBAC `feature-flag:read`/`manage` = MANAGER+) + `/config` (GET effective map for any tenant user, PATCH overrides MANAGER+)
- [x] **14.3** Management UI — `/dashboard/features` + sidebar entry (ADMIN/MANAGER): flag list, create form, global toggle, per-tenant override select (Default/On/Off), delete
- [x] **14.4** Route protection middleware — `attachFeatureFlags` (loads flags + tenant overrides → `req.featureFlags`) + `requireFeature(name)` (403 FEATURE_DISABLED, fail closed); gates `POST /api/reviews` behind `customer_reviews`
- [x] **14.5** Client-specific configs — `Tenant.features` override mechanism via PATCH `/config`; web `useFeaturesConfig()`/`useIsFeatureEnabled()`; customer review form gated on `customer_reviews`
- [x] **14.6** Testing utilities — api `feature-flag.spec.ts` (CRUD, RBAC, config, evaluation, middleware) + `factories/feature-flag.ts`; web `feature-flags.service.spec.ts` + `features-page.spec.tsx`

## Verification
- [x] API: tsc exit 0; eslint 0 errors (28 pre-existing src warnings); jest **157/157** incl. 22-test feature-flag suite
- [x] Web: tsc exit 0; jest **76/76** incl. 11 new (6 service / 2 lib / 3 page); eslint clean; next build exit 0 incl. `/dashboard/features`
- [x] Full gate via root fan-out: api 157 / web 76 / shared 31 / mobile 5 = **269 tests green**

## Commit split
- [x] api (service/middleware/controller/routes/rbac+tenant/index/reviews gate/seed/specs+factory) → web (types/service/hooks/lib/page+route/sidebar/order-detail gate/tests) → bookkeeping (tracker/lessons/todo)

## Wrap-up
- [x] Tracker ticks (78/144); L017 lesson; todo close-out
- [ ] Memory MCP termination push per L009/L016: tick → write → verify (`open_nodes`) → commit → `[MEMORY BANK: UPDATED]`

## Review
- **Design:** two layers — global `FeatureFlag` registry (default state) + `Tenant.features` per-restaurant overrides (`{ flagName: boolean }`); effective state = override wins else global, computed centrally in `services/feature-flags.ts` and normalized defensively on tenant resolve. Route gates and the web UI both consume ONE source of truth (`GET /config` map / `attachFeatureFlags`), so no drift between API and UI toggles.
- **Real integration:** `customer_reviews` flag (seed default ON) gates `POST /api/reviews` server-side (`requireFeature`) and the customer ReviewForm client-side (`useIsFeatureEnabled`) — a restaurant can disable reviews for its tenant in seconds, both layers honored. Defaults preserve existing behavior exactly.
- **Middleware:** `attachFeatureFlags` loads all flags + tenant overrides once → `req.featureFlags`; `requireFeature(name)` fails closed (403 FEATURE_DISABLED, incl. unregistered flags). Route ordering keeps literal `/config` ahead of `/:id`.
- **Config PATCH semantics:** merge (not replace) — `true|false` sets, `null` clears, unknown flag names rejected 400 FEATURE_NOT_FOUND. Only boolean values survive `normalizeOverrides`, so garbage Json can't poison evaluation.
- **L017:** Joi `.pattern()` sub-schemas leave inferred types opaque (`{} | undefined`) — pass an explicit payload generic to `validateBody<T>()` instead of fighting schema inference.
- **Tests:** api +22 (evaluation matrix incl. garbage overrides, CRUD 201/204/404/409, config merge/clear/unknown, all middleware branches) → 157; web +11 (service contracts, slugify/resolve helpers, page: pills, slugified create, override select via `within(row)`) → 76. Grand total **269**. Commit split: api → web → bookkeeping.

---

# Session Todo — 2026-08-30 (Week 13 — Theme Engine Foundation)

Context: Weeks 1–11 done (66/144), git clean at `3ec5121`. **Week 12 (QR/QappR) SKIPPED per user** — revisit after Phase 3. No schema changes needed. ⚠️ Memory MCP still unattached in this session — pending delta recorded here (same blocker as Week 11, see `3ec5121`).

## Week 13 — Theme Engine Foundation (Phase 3 W1)
- [x] **13.1** Design token system — `lib/theme.ts`: palettes as RGB-triplet strings (`"37 99 235"`) so Tailwind `<alpha-value>` opacity utilities keep working; 3 brand presets (classic/emerald/sunset) + custom; light+dark surface/gray token sets; single source of truth for every `--color-*` var
- [x] **13.2** Theme provider & context — `theme-provider.tsx` (`useTheme()` → prefs, setPreset/setMode/setCustom; listens to `prefers-color-scheme` changes in system mode; writes vars + `data-theme` to `<html>`); wired into root `providers.tsx`
- [x] **13.3** CSS variable generation — pure `buildCssVariables(prefs, systemPrefersDark)`; `globals.css` holds classic/light defaults as fallback; `tailwind.config.js` remaps primary/secondary/gray/surface/content tokens to `var(--color-…)`
- [x] **13.4** Switching mechanism — `theme-switcher.tsx` (preset radio group w/ swatches, Light/Dark/System segment, custom brand color pickers); quick dark toggle in shop header; full control on /account
- [x] **13.5** Base templates — Light + Dark are first-class (surfaces/grays swap via `data-theme` CSS block + inline vars); Custom generates a 50–900 shade ladder from one brand hex (600 anchor = exact hex, monotonic luminance, sat clamped 35–90)
- [x] **13.6** Persistence & preferences — validated `rms-theme` localStorage (garbage → defaults); `THEME_BOOT_SCRIPT` inline in root layout stamps `data-theme` before first paint (no white flash); Appearance section on /account

## Verification
- [x] Web: tsc exit 0; jest **65/65** (+14 theme: 10 lib, 4 provider/switcher incl. palette-anchor, luminance monotonicity, dark flip, persistence roundtrip, boot script); eslint src+tests clean; next build 17/17
- [x] Fixed en route: `buildPalette` dropped the HSL hue (`h is not defined` — L015 pattern: verify inserts structurally); provider spec rewritten off the uninstalled `user-event` → `fireEvent`; `getByLabelText` already returns the input (dropped pointless querySelector)

## Wrap-up
- [x] Tracker ticks (72/144); todo close-out
- [x] Logical commits (web feature → bookkeeping)
- [x] Memory MCP termination push — recovered 2026-08-30 at `1243e7d`: L016 logged, empty graph rebuilt (project snapshot + Week 13 decisions + lessons L001–L016), verified via `open_nodes` → `[MEMORY BANK: UPDATED]`

## Review
- **Design choice:** RGB triplets + `var()` mapping keep the entire existing class set (`bg-primary-600`, `text-content-muted`, `border-gray-200`…) theme-aware without touching a single component. `data-theme` handles surface flips in CSS pre-hydration; brand palettes hydrate in (classic === CSS defaults → zero visual jump).
- **FOUC prevention:** boot script resolves stored mode × OS preference and stamps `data-theme` before paint. Custom presets intentionally don't boot-script (palette CSS is generated at hydration; classic defaults cover SSR).
- **Tests:** `theme.spec.ts` (10) covers variable assembly for light/dark/custom, `resolveIsDark` matrix, ladder monotonicity via `luminance()`, hex parsing incl. shorthand + garbage rejection, persistence validation, boot-script shape. `theme-provider.spec.tsx` (4) drives the real switcher: mount applies defaults, preset switch regenerates all vars + persists, custom picker regenerates palette, dark mode flips surfaces.
- **Next:** Week 14 — Feature Flags System.

---

# Session Todo — 2026-08-27 (Week 7)

Context restored from Memory MCP. Roadmap position: Weeks 1–6 done — **Phase 1 COMPLETE (36/144)**, git clean at `40daa9f`. This session starts Phase 2.

## 0. Housekeeping
- [x] Read Memory MCP graph + tasks/lessons.md (L001–L007 reviewed)
- [x] Written plan; began Week 7 — Menu Management System

## Week 7 — Menu Management System
- [x] **7.1** Menu item CRUD API endpoints (`/api/menus/items` + auth/RBAC/tenant middleware)
- [x] **7.2** Categories & subcategories (self-relation parentId; category CRUD; tree endpoint)
- [x] **7.3** Images & nutritional info (schema fields already present → expose + validate + UI)
- [x] **7.5** Search & filtering (q, category, availability, dietary tags, sort, pagination)
- [x] **7.6** Availability & pricing rules — API + shared engine DONE (31 shared + 19 api tests); UI PENDING
- [x] **7.4** Admin menu management UI (`(dashboard)/dashboard/menu` React Query page) — DONE

## Verification
- [x] `npx prisma validate/generate` after schema change — valid, client regenerated
- [x] Shared unit tests for pricing/availability engine green — 31
- [x] API controller specs (tenant scoping, RBAC gates, filters, effective pricing) green — 19 new (api total 48)
- [x] Root `npm test` fan-out green — **95 total** (api 48 / shared 31 / web 11 / mobile 5)
- [x] `tsc --noEmit` exit 0 (shared, api, web)
- [x] ESLint clean on api (0 errors) + web (0 warnings/errors)

## Wrap-up
- [x] Tick `tasks/00_PROJECT_TASKS.md` Week 7 checkboxes — Phase 2 W1 done (42/144)
- [x] Logical commits: schema+shared engine `168700c` → api `236fb45` → web `763a3da` → bookkeeping
- [x] Memory MCP termination push + `[MEMORY BANK: UPDATED]` *(delayed — recovered 2026-08-29, see lesson L009)*

## Review
**Shipped:** Week 7 Menu Management System (Phase 2 W1, 42/144). Schema: Category
self-relation parentId (subcategories + cycle guard), MenuPricingRule,
MenuItemAvailabilityWindow, PricingAdjustmentType enum. Shared pure
pricing/availability engine (`computeEffectivePrice`, `isMenuItemAvailableNow`,
`windowMatchesAt`) — 31 tests. API: item/category CRUD, subcategory tree,
search & filters, rules & windows, `/effective` preview — 48 api tests,
tenant-scoped + RBAC-gated. Web: `/dashboard/menu` admin UI (React Query,
search/filter/sort toolbar, item cards, rule & window editors).
**Gate:** root `npm test` 95 green (api 48 / shared 31 / web 11 / mobile 5);
tsc + eslint clean. **Learnings:** L008. **Process gap closed:** termination
push recovered 2026-08-29 (L009). **Next up:** Week 8 — Inventory Management.

---

# Session Todo — 2026-08-29 (Week 8 — Inventory Management)

Context restored from Memory MCP. Roadmap position: Weeks 1–7 done (42/144), git clean at `dca900d`. Schema baseline: InventoryItem / InventoryTransaction / Supplier exist; PurchaseOrder does NOT.

## 0. Housekeeping
- [x] Recover Week 7 termination push (L009 + todo tick + memory entities) — committed
- [x] Review lessons L001–L009

## Week 8 — Inventory Management
- [x] **8.1** Inventory tracking API endpoints (items CRUD + stock transactions with atomic stock mutation)
- [x] **8.2** Stock level monitoring & alerts (low-stock endpoint + status derivation)
- [x] **8.3** Supplier management system (CRUD + supplier-scoped item listing)
- [x] **8.4** Inventory dashboard for managers (web UI)
- [x] **8.5** Purchase order management (schema PurchaseOrder/PurchaseOrderItem + API + receive flow)
- [x] **8.6** Inventory reporting & analytics (valuation, consumption, transaction history)

## Verification
- [x] `npx prisma validate/generate` after schema change — valid; client regenerated with PurchaseOrder models
- [x] API controller specs green (tenant scoping, RBAC, stock math) — 37 new (api total 85)
- [x] Root `npm test` fan-out green — web suite +37% (20 total)
- [x] `tsc --noEmit` + eslint clean (api + web); `next build` routed `/dashboard/inventory` successfully

## Wrap-up
- [x] Tick `tasks/00_PROJECT_TASKS.md` Week 8 checkboxes — Phase 2 W2 done (48/144)
- [x] Logical commits (schema → api → web → bookkeeping)
- [x] Memory MCP termination push IN ORDER per L009: tick → write → verify → commit → indicator

## Review
**Shipped:** Week 8 Inventory Management (Phase 2 W2, 48/144). Schema:
PurchaseOrderStatus enum + PurchaseOrder/PurchaseOrderItem with back-relations
(Tenant, Supplier, InventoryItem). API: `/api/inventory` (items CRUD,
SKU-unique + tenant-bound supplier checks, delete-in-use guard, atomic
RESTOCK/USAGE/ADJUSTMENT/RETURN transactions, low-stock alerts derived from
current ≤ min via field reference, valuation + 30-day consumption reports,
paginated transaction history) — 15 specs; `/api/suppliers` CRUD + delete guard
(8 specs); `/api/purchase-orders` full lifecycle incl. $transaction receive flow
(post-line progress + RESTOCK tx + stock increment + status all-or-nothing,
partial vs full receipt, over-receipt/foreign-line guards, DRAFT-only edit/delete)
— 14 specs. Web: `/dashboard/inventory` tabbed dashboard with reorder alerts,
valuation & consumption cards, inline +1/Use-1 stock moves, supplier registry,
PO create/submit/cancel/receive — 9 service specs.
**Gate:** api 85 tests, web 20 tests — all green; tsc + eslint clean; next build
OK. **Learnings:** L010 (JSX insert-assembly hazards), L011 (nested-object Jest
matching needs recursive objectContaining), L012 (`res.json` mock leaves
statusCode undefined). **Next up:** Week 9 — Order Processing System
(order API, status workflow, KDS, notifications).

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

---

# Session Todo — 2026-08-29 (Week 9 — Order Processing System)

Context: Weeks 1–8 done (48/144), git clean. Schema already has Order/OrderItem/Payment/Table + OrderStatus/PaymentStatus enums (Week 2 foundation) and RBAC matrix covers `order:*` / `order:create` / `order:read` / `order:update:status` / `order:create:own` / `order:read:own`. Shared pricing engine (`computeEffectivePrice`, `isMenuItemAvailableNow`) is available for price snapshotting.

## Week 9 — Order Processing System
- [x] **9.1** Order creation & management API (`POST /api/orders` snapshotting prices via shared engine; list/detail/update)
- [x] **9.2** Order status workflow (guarded PENDING→CONFIRMED→PREPARING→READY→COMPLETED + CANCELLED; completedAt; per-line item status)
- [x] **9.3** Kitchen display system — `/api/orders/kitchen-queue` + per-item READY flips with auto-order-READY + web `/dashboard/kitchen`
- [x] **9.4** Real-time updates — tenant-scoped order-events emitter + `GET /api/orders/stream` (SSE) + web fetch-stream hook invalidating queries
- [x] **9.5** Order history & reporting — history filters, customer-own scoping, manager revenue summary
- [x] **9.6** Order management dashboard — `/dashboard/orders` (filter/advance/pay/cancel) + nav + dashboard placeholders

## Verification
- [x] API order specs green — 26/26 in order.spec.ts; full suite 111/111 across 8 suites
- [x] Web order service specs 8/8; tsc clean; eslint clean; next build routes /dashboard/orders + /dashboard/kitchen
- [x] Full gate: api tsc+eslint+jest (111/111), web tsc+jest+lint+next build (routes generated)

## Wrap-up
- [x] Tracker ticks (54/144); lesson L013; todo close-out
- [x] Logical commits (api → web → bookkeeping)
- [x] Memory MCP termination push per L009: tick → write → verify → commit → indicator

## Review
- **9.1** `POST /api/orders` snapshots per-line unit prices via the shared pricing engine inside one `$transaction`; availability + tenant-menu guards; CUSTOMER orders force own userId. Update/delete guarded to PENDING.
- **9.2** `PATCH /orders/:id/status` + `POST /orders/:id/cancel` with ORDER_TRANSITIONS map, FAILED-payment block, completedAt stamping.
- **9.3** KDS: `GET /orders/kitchen/queue` (CONFIRMED/PREPARING oldest-first), `PATCH /orders/:id/items/:itemId/status` per-line PENDING→PREPARING→READY with auto order-READY when all lines done; web `/dashboard/kitchen` board with 10s polling and 15m age highlighting.
- **9.4** In-process tenant-scoped pub/sub (`order-events.ts`) + `GET /orders/stream` SSE; web uses polling as the v1 stand-in (EventSource cannot attach Authorization headers — noted for the future WS gateway).
- **9.5** History listing w/ status+payment filters + customer-own scoping; `GET /orders/report/summary` (countsByStatus, paidRevenue, AOV, windowDays).
- **9.6** `/dashboard/orders` dashboard: summary cards, status filter, lifecycle actions, card payment collection, cancel; New Order tab building a ticket from available menu items.
- **Tests:** 26 API order tests + 8 web service tests. Lesson **L013**: Joi object schemas reject undefined payloads — mirror Express's always-object `req.query` in unit tests.
- **Commit split:** api (controller/routes/events/rbac/validation/tests) → web (types/service/hooks/components/pages/nav/tests) → bookkeeping (tracker/todo/lessons).

---

# Session Todo — 2026-08-29 (Week 11 — Customer Features: Tracking & Reviews)

Context: Weeks 1–10 done (60/144), git clean at `a01f107`. Review model exists (rating 1–5, comment, orderId @unique, isVisible) + `review:create:own` on CUSTOMER; order detail already polls (10s). No schema changes required this week (User has firstName/lastName/phone).

## Week 11 — Tracking & Reviews
- [x] **11.1** Real-time order tracking — `/orders/[id]` tracking upgrade: 5s polling while active (idle when closed), Live indicator, per-item KDS status on receipt lines
- [x] **11.2** Order status notifications — `OrderNotifications` provider in shop layout: 15s poll of active orders, status-diff vs persisted `rms-order-notified` map, toast stack; gated by account preference
- [x] **11.3** Customer review & rating system — API `/api/reviews` (create for own COMPLETED order w/ unique guard 409 REVIEW_EXISTS, mine list, staff list, moderate visibility, delete; RBAC + `review:read:own` grant) + web star-rating form/display on the order page
- [x] **11.4** Review management for admin — `/dashboard/reviews` (ADMIN/MANAGER): infinite list w/ hidden-state styling, show-hide + delete (w/ confirm), star display; sidebar entry (avg-rating summary + filters deferred — not in API contract)
- [x] **11.5** Customer feedback collection — post-completion "Rate your experience" prompt on order page (review = feedback mechanism per data model)
- [x] **11.6** Customer profile & preferences — API `GET/PATCH /users/me` (+ tenant-scoped `GET /users/:id`) + `/account` page: profile form (auth store updated in place) + preferences card (status notifications toggle via persisted `rms-prefs` store) + Account link in shop header

## Verification
- [x] API: `user.spec.ts` 10/10 (sanitized profile, 401/404, Joi trim/min/max, empty-body 400, phone>20 400, tenant-scoped lookup); full api suite 135/135; tsc exit 0; eslint src 0 errors
- [x] Web: `notifications.spec.ts` 5/5 (active filter, first-seen toast, no-change silence, per-advance toasts, finished-between-polls) + `user.service.spec.ts` 3/3 + cart fixture fix; jest 51/51; tsc exit 0; eslint clean; next build 17/17 routes incl. /account + /dashboard/reviews
- [x] Grand totals: api 135 / web 51 / shared 31 / mobile 5 = **222 tests green**

## Wrap-up
- [x] Tracker ticks (66/144); lesson L015; todo close-out
- [x] Logical commits (api → web → bookkeeping)
- [ ] Memory MCP termination push per L009/L014 — **BLOCKED 2026-08-29**: the Memory MCP server is not attached to the current session (no memory tools in the function set; no graph store found on disk). Pending delta to push when re-attached: Week 11 complete (66/144) at `a656865` — 11.1 dynamic-poll live tracking + Live pill + per-item KDS chips; 11.2 OrderNotifications (15s poll, `rms-order-notified` seen-map, toast stack, `rms-prefs` gate); 11.4 `/dashboard/reviews` moderation (ADMIN/MANAGER, sidebar); 11.6 `/users/me` API + `/account` profile/prefs + `AuthUser.phone`; lesson L015 (brace-nesting on insert_line; assert body not status for bare res.json handlers); tests 222 green (api 135 / web 51 / shared 31 / mobile 5). Next: Week 12 — QR Code System & QappR Integration.

## Review
- **11.1** `useOrder` now accepts a refetchInterval *function* `(order) => number | false`; OrderDetail passes `!o || isOrderActive(o.status) ? 5_000 : false` — live while PENDING→READY, zero polling once settled. Live pill (pulsing dot) beside the status badges; each receipt line shows `item.status.toLowerCase()` chip while active (KDS statuses surface without staff jargon).
- **11.2** `order-notifications.tsx` mounted in the `(shop)` shell. Pure diff helpers (`activeOrders`, `diffOrderStatuses`) are exported + unit-tested; seen-map persists to `rms-order-notified` so refreshes don't replay toasts; toast stack caps at 3, auto-dismiss 6s, aria-live polite. Master gate = `rms-prefs.statusNotifications` (11.6 toggle).
- **11.4** `reviews-page.tsx` (dashboard) renders `useAllReviews` infinite list as cards (stars, customer, order number, comment, Visible/Hidden pill, hidden rows amber-tinted); Hide/Show → PATCH `/reviews/:id/visibility`, Delete → DELETE (MANAGER+, confirm-guarded); sidebar entry ADMIN/MANAGER (matches `review:moderate`/MANAGER+ delete). Skipped the planned avg-rating summary/filters — the API list endpoint exposes none of it; honest scope beats a fake summary.
- **11.6** API `/users/me` GET+PATCH existed from the earlier pass; added web `user.service` + `use-user` hook (PATCH mirrors `firstName/lastName/phone` into the auth store in place, so the header greeting updates immediately). `/account` has a dirty-guarded form (names, phone optional/null-clearing, email read-only) + the notifications preference card. `AuthUser.phone?: string | null` added to the type.
- **Tests:** api +10 (user.spec) → 135; web +8 (5 notifications, 3 user.service) → 51; cart.store.spec fixtures updated for the `specialInstructions` field (pre-existing tsc failures fixed). Grand total 222 (api 135 / web 51 / shared 31 / mobile 5).
- **Commit split:** api (user.spec) → web (account/notifications/reviews pages, stores/hooks/services, order-detail upgrades, tests) → bookkeeping (trackers, lesson, .gitignore for tsbuildinfo).

---

# Session Todo — 2026-08-29 (Week 10 — Customer Features: Menu & Ordering)

Context: Weeks 1–9 done (54/144), git clean at `8061614`. Fault recovery: L014 logged + memory delta push for the post-Week-9 artifact commits. CUSTOMER already holds `menu:read`, `order:create:own`, `order:read:own`; `OrderItem.specialInstructions` + order-level `specialRequests` exist in schema and create schema. Gap: `POST /orders/:id/pay` is `requireRoleOrHigher(SERVER)` → customers cannot self-settle.

## 0. Housekeeping
- [x] Read Memory MCP graph + lessons L001–L014
- [x] Fault recovery: L014 + memory delta push (artifact commits after Week 9 termination)

## Week 10 — Customer Features (Menu & Ordering)
- [x] **10.1** Customer menu browsing — `(shop)` route group + customer shell (ProtectedRoute CUSTOMER, shop header w/ cart pill) + `/menu` (categories w/ subtree, search, dietary filters, sort, pagination, item cards)
- [x] **10.2** Shopping cart — `store/cart.store.ts` (zustand persist; merge by item+instructions; qty caps; subtotal/count selectors)
- [x] **10.3** Order customization — item customizer modal (qty + per-line specialInstructions) + order-level specialRequests at checkout
- [x] **10.4** Order placement & payment — `/checkout` (line editing, CARD/ONLINE self-service) + API: open pay route to customers with own-order guard, no CASH self-service, amount forced to total, SIM transactionId
- [x] **10.5** Order confirmation & receipt — `/orders/[id]` placed banner, status timeline, printable receipt, pay-now for unpaid
- [x] **10.6** Customer order history — `/orders` list (API already scopes CUSTOMER-own) + login redirects CUSTOMER → /menu + type fixes (PaymentMethod −MOBILE, transactionRef→transactionId)

## Verification
- [x] API pay specs green — customer self-pay, foreign-order 403, CASH 400, amount forced; order suite 29/29; api tsc exit 0; eslint src 0 errors; full api 114/114 via root fan-out
- [x] Web cart store specs 9/9 + pay payload passthrough; web jest 38/38; eslint clean; next build routes /menu, /checkout, /orders, /orders/[id]
- [x] Full gate: api tsc + eslint + jest; web tsc + jest + eslint + next build (all exit 0)

## Wrap-up
- [x] Tracker ticks (60/144); lessons if any; todo close-out
- [x] Logical commits (api → web → bookkeeping)
- [x] Memory MCP termination push per L009/L014: tick → write → verify (`open_nodes`) → commit → indicator

## Review
- **10.1** `(shop)` layout gates CUSTOMER-only via ProtectedRoute (staff bounce to /dashboard per existing behavior); ShopHeader shows nav + live cart count pill + sign-out; `/menu` reuses Week-7 menu hooks (`available: true`), top-level category chips (API subtree-expands filters), dietary toggles, sort select, paginated grid of `CustomerItemCard`s.
- **10.2/10.3** Cart store persisted (`rms-cart`), identity = menuItemId + trimmed instructions; customizer modal collects qty + per-line instructions (API cap 300); checkout collects order-level specialRequests (cap 500).
- **10.4** Checkout creates the order (server snapshots effective prices) then immediately self-pays. API: pay route now `requireAnyPermission('order:create','order:create:own')` (KITCHEN still excluded — it holds neither permission); controller customer branch: foreign order → 403 ORDER_FORBIDDEN, CASH → 400 CASH_NOT_SELF_SERVICE, amount forced to snapshotted total, SIM-prefixed transactionId when absent. Web type fixes: PaymentMethod = CASH/CARD/ONLINE, PayOrderPayload.transactionId (was transactionRef), Payment.transactionId. Pay failure mid-checkout still clears the cart and lands on the order page (payFailed banner + Pay now).
- **10.5** `/orders/[id]`: Suspense-wrapped useSearchParams banners (placed/payFailed), CANCELLED alert, 5-step timeline, receipt card with print stylesheet (print-area isolation), Pay now (CARD) for unpaid, 10s polling until the Week 11 stream.
- **10.6** `/orders` history with status chips — API narrows CUSTOMER to own orders; deterministic UTC `formatWhen` avoids hydration drift; login fallback route is role-aware (CUSTOMER → /menu).
- **Tests:** api +3 (self-pay forced-amount, CASH 400, foreign 403) → order suite 29, api total 114; web +10 (9 cart store, 1 pay passthrough) → 38. Grand total 188 (api 114 / web 38 / shared 31 / mobile 5).
- **Commit split:** api (routes/controller/specs) → web (types/store/hooks/shop components+pages/login/landing/tests) → bookkeeping (tracker/todo).
