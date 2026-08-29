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
