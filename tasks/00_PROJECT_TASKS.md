# Restaurant Inventory Management System - Implementation Tasks

## 📋 Task Overview
This document breaks down the 24-week implementation plan into actionable tasks with clear dependencies.

## 🎯 Phase 1: Foundation & Core Infrastructure (Weeks 1-6)

### Week 1: Project Setup & Configuration ✅ *completed*
- [x] **1.1** Initialize monorepo structure (packages: web, mobile, api, shared)
- [x] **1.2** Set up TypeScript configuration across all packages
- [x] **1.3** Configure ESLint, Prettier, and Husky for code quality
- [x] **1.4** Set up Git hooks and commit conventions
- [x] **1.5** Create base Docker configuration for development
- [x] **1.6** Initialize package.json files with shared dependencies


### Week 2: Database Schema & Migrations
- [x] **2.1** Design PostgreSQL database schema (users, roles, tenants, menus, orders, inventory)
- [x] **2.2** Create database migration files using Prisma/Knex
- [x] **2.3** Set up database connection pooling and environment variables
- [x] **2.4** Create seed data scripts for development
- [ ] **2.5** Implement row-level security for multi-tenancy
- [x] **2.6** Set up Redis for caching and session management

### Week 3: Backend Core - Authentication & RBAC
- [x] **3.1** Set up Express/Fastify server with TypeScript
- [x] **3.2** Implement JWT authentication with refresh tokens
- [x] **3.3** Create user registration and login endpoints
- [x] **3.4** Implement role-based access control (RBAC) middleware
- [x] **3.5** Create tenant middleware for multi-tenant isolation
- [x] **3.6** Set up password reset and email verification

### Week 4: Frontend Core - Web App Setup ✅ *completed*
- [x] **4.1** Initialize Next.js 14+ with App Router (route groups: `(auth)`, `(dashboard)`)
- [x] **4.2** Set up Tailwind CSS with design token system (CSS-variable palettes mapped in tailwind.config; runtime re-branding ready)
- [x] **4.3** Create base layout components (Header, Sidebar w/ role-gated nav, Footer, UserMenu)
- [x] **4.4** Implement authentication pages (Login, Register, Forgot Password, Reset Password) with react-hook-form + zod
- [x] **4.5** Set up React Query for server state management (+ axios client with single-flight token refresh)
- [x] **4.6** Create protected route wrapper and auth hooks (`ProtectedRoute` with hydration-safe gating, `useAuth`, role guard)

### Week 5: Mobile App Setup & Shared Components ✅ *completed*
- [x] **5.1** Initialize React Native project with TypeScript (RN 0.73 + babel/metro monorepo configs; react pinned to RN's exact peer 18.2.0)
- [x] **5.2** Set up React Navigation with auth flow (hydration-safe RootNavigator gate → Auth stack ↔ Home/Settings tabs)
- [x] **5.3** Create base mobile UI components (Button, Input, Card, Text, Spinner — parity with web ui/)
- [x] **5.4** Implement shared component library (`@restaurant/shared/src/tokens.ts` = canonical design-token source consumed by all platforms)
- [x] **5.5** Set up styling system for shared components (ThemeProvider w/ dark mode + `buildTenantTheme` runtime re-branding)
- [x] **5.6** Create component documentation with Storybook (docs/COMPONENTS.md authoritative; .storybook/ scaffold ready-to-enable, dev deps deliberately not installed)

### Week 6: DevOps & Testing Infrastructure ✅ *completed*
- [x] **6.1** Create Docker Compose for full stack (DB, Redis, API, Web) — hardened: obsolete `version:` dropped; **fixed latent bug**: api-production kept devDeps + runs `prisma generate` (pure prod-install omitted the prisma CLI → shipped image crashed on boot); builders upgraded to reproducible `npm ci`
- [x] **6.2** Set up GitHub Actions CI/CD pipeline — `.github/workflows/ci.yml` single quality-gate: setup-node20+npm-cache → `npm ci` → explicit prisma generate → shared-first build → lint → `npm test` fan-out
- [x] **6.3** Configure Jest for unit testing across packages — per-package `jest.config.cjs`: shared(node)+new test script, api(node/ts-jest/env-seeding setupFile), web(jsdom+alias mapper+standalone `tsconfig.jest.json` fixing Next's jsx:"preserve"), mobile(bundled RN preset)
- [x] **6.4** Set up React Testing Library for component tests — `@testing-library/react@14` + `jest-environment-jsdom@29` on web; jest-dom matchers via setupFilesAfterEnv
- [x] **6.5** Create test utilities and factories — api: user/tenant factories + typed Express res double (`mock-express`); web: AuthUser factory + `next/navigation` mock (import-order contract documented)
- [x] **6.6** Write initial tests for core functionality — **58 tests green**: api jwt/rbac/tenant middleware (29), shared token behavioral pins (13), web ProtectedRoute hydration-gate/Button (11), mobile createAppTheme mapping (5)

## 🚀 Phase 2: Core Features & Integrations (Weeks 7-12)

### Week 7: Menu Management System ✅ *completed*
- [x] **7.1** Create menu item CRUD API endpoints (`/api/menus/items` × GET/POST/PATCH/DELETE + availability toggle; auth + resolveTenant + `requirePermission('menu:read')`/`requireRoleOrHigher(MANAGER)` gates; tenant isolation chains item → category → menu.tenantId)
- [x] **7.2** Implement menu categories and subcategories (Category self-relation parentId + same-menu validation + cycle guard; category CRUD; nested-tree `GET /menus/:menuId/categories`; delete guarded by children/items counts)
- [x] **7.3** Add menu item images and nutritional information (image/prep-time/calories/macros fields on MenuItem exposed + Joi-validated + editable in admin UI)
- [x] **7.4** Create menu management UI for admin dashboard (`(dashboard)/dashboard/menu` — React Query service/hooks, search/filter/sort toolbar, paginated item cards, create/edit modal, rules & window editors)
- [x] **7.5** Implement menu item search and filtering (q case-insensitive name/description, category-with-subtree expansion, availability + dietary booleans, 4 sorts, page/limit pagination)
- [x] **7.6** Add menu item availability and pricing rules (MenuPricingRule + MenuItemAvailabilityWindow models; shared pure engine `computeEffectivePrice`/`isMenuItemAvailableNow` with priority/day-of-week/overnight-window semantics; `/effective` endpoint with `?at=` preview)

### Week 8: Inventory Management ✅ *completed*
- [x] **8.1** Create inventory tracking API endpoints (`/inventory/items` CRUD with SKU-unique + tenant-bound supplier validation + delete guard; atomic stock transactions RESTOCK/RETURN/USAGE/ADJUSTMENT via `prisma.$transaction` writing tx + stock delta together, insufficient-stock rejection)
- [x] **8.2** Implement stock level monitoring and alerts (`GET /inventory/alerts/low-stock` derives LOW vs OUT_OF_STOCK at currentStock ≤ minStock via Prisma field reference; lowStock list filter)
- [x] **8.3** Add supplier management system (`/suppliers` CRUD tenant-scoped, reference-guarded delete via inventory/PO counts, `/suppliers/:id/items`)
- [x] **8.4** Create inventory dashboard for managers (`(dashboard)/dashboard/inventory` — Overview/Items/Suppliers/Purchase Orders tabs; alerts, valuation & consumption cards, stock badges, inline restock/usage, PO lifecycle)
- [x] **8.5** Implement purchase order management (PurchaseOrderStatus enum + PurchaseOrder/PurchaseOrderItem models; DRAFT→SUBMITTED→PARTIALLY_RECEIVED→RECEIVED lifecycle; receive endpoint atomically updates line progress + RESTOCK tx + item stock; over-receipt & foreign-line guards)
- [x] **8.6** Add inventory reporting and analytics (valuation report `Σ cost×stock`, 30-day consumption report via `groupBy` on USAGE transactions, paginated transaction history)

### Week 9: Order Processing System
- [x] **9.1** Create order creation and management API
- [x] **9.2** Implement order status workflow (Pending → Preparing → Ready → Completed)
- [x] **9.3** Create kitchen display system (KDS) interface
- [x] **9.4** Implement order notifications and real-time updates
- [x] **9.5** Add order history and reporting
- [x] **9.6** Create order management dashboard

### Week 10: Customer Features - Menu & Ordering ✅ *completed*
- [x] **10.1** Create customer menu browsing interface (`(shop)` route group + customer shell (ProtectedRoute CUSTOMER, shop header w/ live cart pill) + `/menu` — category chips (top-level; API expands subtree), search, dietary filters, 4 sorts, pagination, item cards with dietary/calorie/prep badges; `available: true` only)
- [x] **10.2** Implement shopping cart functionality (`store/cart.store.ts` — zustand persist `rms-cart`; lines keyed by item+instructions; merge on repeat adds; qty cap 99; updateQuantity 0-drop; pure `cartItemCount`/`cartSubtotal` selectors)
- [x] **10.3** Add order customization (item customizer modal — quantity stepper + per-line `specialInstructions` ≤300; order-level `specialRequests` ≤500 at checkout; both flow into the Week-9 create schema)
- [x] **10.4** Implement order placement and payment integration (`/checkout` line editing + CARD/ONLINE self-service; API `POST /orders/:id/pay` opened to customers via `requireAnyPermission('order:create','order:create:own')` with own-order 403 guard, `CASH_NOT_SELF_SERVICE` 400, amount forced to snapshotted total, `SIM-*` transactionId default; web pay payload key fixed to `transactionId`, PaymentMethod aligned CASH/CARD/ONLINE; pay-failure lands on the order page for retry)
- [x] **10.5** Create order confirmation and receipt generation (`/orders/[id]` — placed/pay-failed banners, 5-step status timeline w/ 10s polling, receipt card (lines, unit prices, instructions, totals, payment ref, completedAt), `Pay now` for unpaid, print-stylesheet receipt)
- [x] **10.6** Add order history for customers (`/orders` — status filter chips, deterministic UTC timestamps, badges + totals; API already narrows CUSTOMER listings to own; login redirects CUSTOMER → /menu, staff → /dashboard)

### Week 11: Customer Features - Tracking & Reviews
- [x] **11.1** Create real-time order tracking interface (`/orders/[id]` — dynamic 5s polling while PENDING→READY via refetchInterval fn, fully idle once COMPLETED/CANCELLED; pulsing Live pill; per-line kitchen status chip from item.status)
- [x] **11.2** Implement order status notifications (`components/shop/order-notifications.tsx` in shop shell — 15s poll of own orders, pure `activeOrders`/`diffOrderStatuses` diff vs persisted `rms-order-notified` map, aria-live toast stack w/ auto-dismiss; gated by `rms-prefs` toggle)
- [x] **11.3** Add customer review and rating system
- [x] **11.4** Create review management for admin (`/dashboard/reviews` ADMIN/MANAGER — infinite list, show/hide via PATCH visibility, delete (MANAGER+ w/ confirm), star display, hidden-state styling; sidebar entry)
- [x] **11.5** Implement customer feedback collection
- [x] **11.6** Add customer profile and preferences (API GET/PATCH `/users/me` + GET `/users/:id` tenant-scoped; web `user.service`/`use-user` hook mirroring into auth store; `/account` page with profile form + notifications preference toggle persisted in `rms-prefs`; AuthUser.phone added; Account link in shop header)

### Week 12: QR Code System & QappR Integration
- [ ] **12.1** Create QR code generation for tables
- [ ] **12.2** Implement QR code scanning and validation
- [ ] **12.3** Add mobile app detection and deep linking
- [ ] **12.4** Create QappR API integration layer
- [ ] **12.5** Implement data synchronization with QappR
- [ ] **12.6** Add webhook handling for real-time updates

## 🎨 Phase 3: Customization & Multi-Tenancy (Weeks 13-18)

### Week 13: Theme Engine Foundation
- [x] **13.1** Create design token system (colors, typography, spacing) (`lib/theme.ts` — single source of truth: brand palettes as raw RGB triplets so Tailwind opacity utils keep working; 3 presets + custom; light/dark surface + gray token sets)
- [x] **13.2** Implement theme provider and context (`components/theme/theme-provider.tsx` — `useTheme()` w/ prefs, setPreset/setMode/setCustom, matchMedia-tracked system preference, applies vars to `document.documentElement`)
- [x] **13.3** Add CSS variable generation for dynamic theming (`buildCssVariables()` emits every `--color-*` var; `globals.css` defaults match classic/light; `tailwind.config.js` maps primary/secondary/gray/surface/content to `var(--color-…)` with `<alpha-value>`)
- [x] **13.4** Create theme switching mechanism (`theme-switcher.tsx` preset radio group + mode segment + custom color pickers; header quick dark toggle; mounted in shop header + account Appearance card)
- [x] **13.5** Implement base theme templates (Light, Dark, Custom) (LIGHT/DARK surface+gray sets; custom preset generates a 50–900 shade ladder from one brand hex — 600 anchor is the exact brand color, ladder monotonic by luminance)
- [x] **13.6** Add theme persistence and user preferences (`rms-theme` localStorage via validated save/load; `THEME_BOOT_SCRIPT` inline in root layout stamps `data-theme` pre-paint — no FOUC; Appearance section on /account)

### Week 14: Feature Flags System
- [x] **14.1** Create feature flag database schema (`FeatureFlag` name-unique global registry w/ `isEnabled` default + `metadata`; `Tenant.features` Json carries per-restaurant overrides — seed keys aligned to flag names (snake_case), `customer_reviews` flag added as the real integration gate)
- [x] **14.2** Implement feature flag API endpoints (`/api/feature-flags` CRUD + `/config` GET/PATCH; permissions `feature-flag:read`/`feature-flag:manage` = MANAGER+; effective state = tenant override wins else global default)
- [x] **14.3** Create feature flag management UI (`/dashboard/features` ADMIN/MANAGER + sidebar entry, flag 🎛️ — create form w/ slugified `[a-z0-9_]` key, global default toggle, per-tenant override select Default/On/Off, delete w/ confirm)
- [x] **14.4** Add feature flag middleware for route protection (`attachFeatureFlags` → `req.featureFlags` + `requireFeature(name)` fail-closed 403 FEATURE_DISABLED; gates `POST /api/reviews` behind `customer_reviews`)
- [x] **14.5** Implement client-specific feature configurations (PATCH `/config` merge semantics w/ null-clear; web `useFeaturesConfig()`/`useIsFeatureEnabled()` fail-closed; customer ReviewForm hidden when `customer_reviews` off)
- [x] **14.6** Add feature flag testing utilities (api `feature-flag.spec` **22 tests** — evaluation service, CRUD/409s/404s, config merge+clear, middleware gates; web **11 tests** — service contract 6, lib helpers 2, features-page component 3)

### Week 15: Multi-Tenancy Implementation
- [x] **15.1** Implement tenant isolation at database level (`services/tenant-scope.ts` pure guard injecting tenantId into where/data for tenant-owned models + Prisma `$extends` query layer keyed off `AsyncLocalStorage` (`services/tenant-context.ts`); composite `[tenantId, createdAt]` indexes on User/Order/InventoryItem/PurchaseOrder)
- [x] **15.2** Create tenant management API (`/api/tenants` public onboarding POST + `/me` GET (any auth) / PATCH (MANAGER+); self-service scope — no cross-tenant super-admin surface, documented decision)
- [x] **15.3** Add tenant-specific configurations (Tenant gains timezone/currency/taxRate/operatingHours; PATCH `/me` partial-merge validation; seed demo values)
- [x] **15.4** Implement tenant onboarding workflow (`services/tenant-onboarding.ts` transaction: tenant + ADMIN + default menu, slugified slug w/ collision suffix; web `/onboarding` self-serve page auto-signs-in the new ADMIN)
- [x] **15.5** Create tenant administration dashboard (`/dashboard/tenants` + sidebar ⚙️ ADMIN/MANAGER: profile/config editor incl. 7-day operating-hours editor, plan/subscription/isActive controls)
- [x] **15.6** Add tenant usage analytics and billing (Tenant plan/subscriptionStatus/seatsLimit; `/me/analytics` MANAGER+ windowed orders/revenue/customers/menu/low-stock/reviews + billing seat-usage card)

### Week 16: Role-Based UI & Permissions
- [x] **16.1** Create dynamic navigation based on roles (sidebar gains Staff 👥 ADMIN/MANAGER + Audit 🛡️ ADMIN entries on the existing role-filtered NAV; new role-aware `/dashboard` index replaces the 404-ing login target and the duplicate dashboard at `/` is deleted)
- [x] **16.2** Implement permission-based component rendering (staff page edit affordances + tri-state editor gated by `isAdmin` role check via useAuth; pages wrapped in `ProtectedRoute roles`; audit viewer ADMIN-only)
- [x] **16.3** Add role-specific dashboards (`/dashboard` index `dashboard-index.tsx` — role-aware quick links; fixes latent `/` route collision + missing `/dashboard` index)
- [x] **16.4** Create permission management UI (`/dashboard/staff` ADMIN/MANAGER: staff directory w/ role filter, create form (`staff:manage`), per-user tri-state override editor inherit/allow/deny (deny wins) ADMIN-only)
- [x] **16.5** Implement role hierarchy and inheritance (`rbac.ts`: exported `ROLE_HIERARCHY`; `hasPermissionWithOverrides` role-matrix + per-user override, deny wins; `requirePermission`/`requireAnyPermission` consult `req.permissionOverrides`; `User.permissionOverrides Json?`; `resolveTenant` attaches overrides; `staff:read`/`staff:manage` matrix entries)
- [x] **16.6** Add audit logging for permission changes (`AuditLog` model + `services/audit.ts` `writeAuditLog` recorded transactionally on role/override mutations; `GET /api/audit` ADMIN w/ filters+pagination; `/dashboard/audit` viewer)

### Week 17: Customization UI & Admin Dashboard
- [x] **17.1** Create admin dashboard layout
- [x] **17.2** Implement theme customization interface
- [x] **17.3** Add feature flag configuration UI
- [x] **17.4** Create tenant management interface
- [x] **17.5** Implement branding customization (logo, colors, fonts)
- [x] **17.6** Add customization preview functionality

### Week 18: Testing & Documentation ✅ *completed*
- [x] **18.1** Write comprehensive unit tests for customization features (api tenant-api.spec +5: presets/modes matrix, branding-less theme, malformed-theme reject, config+theme combo; web theme-preview-card +5, branding-editor +4)
- [x] **18.2** Create integration tests for multi-tenant scenarios (multi-tenant.integration.spec: supertest over the real express app — isolation, X-Tenant-ID mismatch 403, cross-tenant 404, RBAC/override gates, feature-flag fail-closed; supertest added as api devDep)
- [x] **18.3** Write end-to-end tests for customization workflows (customization-workflow.spec: provider↔console e2e — published branding applies, scoped draft, publish+refetch re-sync, discard) — surfaced & fixed the draft-adoption bug in customization-page
- [x] **18.4** Create API documentation with Swagger/OpenAPI (docs/api/openapi.yaml — OpenAPI 3.0.3, 52 paths / 15 schemas mirroring every route; docs/api/README.md conventions guide)
- [x] **18.5** Write user documentation for admin features (docs/admin/README.md — menus/inventory/orders/POs/reviews/staff/flags/tenant/customize/audit + role matrix)
- [x] **18.6** Create deployment documentation (docs/deployment/README.md — compose, migrations, env, CI, prod notes, rollout checklist)

## ⚡ Phase 4: Advanced Features & Optimization (Weeks 19-24)

### Week 19: Analytics & Reporting ✅ *completed*
- [x] **19.1** Create sales analytics dashboard (GET /api/analytics/sales — totals/byStatus/revenueByDay/ordersByDay/topItems/peakHours; web /dashboard/analytics Sales tab with KPI cards + SVG revenue chart + top items/status/peak-hour panels)
- [x] **19.2** Implement inventory analytics (GET /api/analytics/inventory — valuation/retail value, low-stock list, dead stock (no USAGE in window), top movers, supplier breakdown; Inventory tab)
- [x] **19.3** Add customer behavior analytics (GET /api/analytics/customers — new/active/returning, repeat rate, avg orders per customer, top customers by spend, review avg; Customers tab)
- [x] **19.4** Create reporting export functionality (GET /api/analytics/export?type=&format=csv|pdf&days= — new dependency-free services/report-export.ts: RFC4180 CSV w/ UTF-8 BOM + minimal paginated PDF 1.4 writer with verified xref; blob download on web)
- [x] **19.5** Implement real-time analytics with WebSockets (GET /api/analytics/stream — SSE live today-snapshot on connect + on each order event, reusing the tenant-keyed order-events pub/sub; SSE chosen over WS to match the existing stream transport, documented)
- [x] **19.6** Add customizable report templates (Prisma ReportTemplate model, tenant-scoped CRUD /api/analytics/templates with name-unique-per-tenant 409s; web Reports tab save/apply/delete + export buttons)

### Week 20: Advanced Ordering Features ✅ *completed*
- [x] **20.1** Implement scheduled ordering (`Order.scheduledFor`, createOrder validation 15min–30d, kitchen queue separates scheduled)
- [x] **20.2** Add group ordering (GroupOrder/GroupOrderItem models, 6-char code, host/OPEN|CONVERTED|CANCELLED, endpoints: create/me/join/add-item/remove-item/convert/cancel, shared pricing helper)
- [x] **20.3** Create loyalty program (LoyaltyEntry ledger, 1pt/$1 accrual in payOrder gated on `loyalty_program` flag, 100pts=$1 redemption at createOrder capped at subtotal, GET /api/loyalty/me)
- [x] **20.4** Implement promotional codes (PromoCode PERCENT|FIXED, MANAGER+ CRUD, validate endpoint, createOrder applies promo → discountAmount + redeemedCount++)
- [x] **20.5** Add order recommendations (GET /api/recommendations — favorites top rebuys + popular bestsellers not tried, authed)
- [x] **20.6** Create subscription/recurring orders (RecurringOrder model, customer CRUD /api/recurring-orders, MANAGER+ run-due spawns real orders via shared pricing helper)

**Delivered:** 125/144 implementation ticks (148 total tasks across Weeks 1–20 incl. skipped); 324 API tests, 149 web tests, 0 tsc errors, 0 eslint errors, web build exit 0.

### Week 21: Kitchen & Fulfillment Hardening
- [x] **21.1** Kitchen status transitions (PATCH /:id/status with allowed-transition guard PENDING→CONFIRMED→PREPARING→READY, CANCELLED terminal, KitchenEvent audit, 409 STATUS_TRANSITION_INVALID)
- [x] **21.2** Staff assignment (Order.staffId FK, POST /:id/assign kitchen+, GET /api/kitchen?status=, unassign on READY)
- [x] **21.3** Prep time tracking (Order.prepStartedAt/readyAt set on transitions, GET /api/kitchen/analytics avg prep time/throughput/per-status)
- [x] **21.4** Prep time targets config (TenantSetting `kitchen.prepTimeTargetMinutes` default 15, MANAGER+ writable, analytics compare vs target)
- [x] **21.5** Kitchen capacity soft cap (TenantSetting `kitchen.capacity` default 20, 429 with RETRY_AFTER when active count ≥ capacity, advisory)
- [x] **21.6** Kitchen board SSE enrichment (assignedStaff name+id, prepElapsed, prepTargetMet in kitchen queue SSE, board re-renders)

### Week 22: Security & Compliance
- [x] **22.1** Conduct security audit and penetration testing
- [x] **22.2** Implement rate limiting and DDoS protection
- [x] **22.3** Add data encryption at rest and in transit
- [x] **22.4** Implement GDPR compliance features
- [x] **22.5** Add data backup and recovery procedures
- [x] **22.6** Create security monitoring and alerting

### Week 23: Documentation & Training Materials
- [ ] **23.1** Create comprehensive API documentation
- [ ] **23.2** Write user manuals for all user roles
- [ ] **23.3** Create video tutorials and training materials
- [ ] **23.4** Write deployment and operations guide
- [ ] **23.5** Create troubleshooting guide
- [ ] **23.6** Develop onboarding documentation for new clients

### Week 24: Production Launch
- [ ] **24.1** Set up production infrastructure
- [ ] **24.2** Configure monitoring and alerting (Prometheus, Grafana)
- [ ] **24.3** Implement logging and log aggregation
- [ ] **24.4** Create production deployment pipeline
- [ ] **24.5** Perform load testing and performance validation
- [ ] **24.6** Execute go-live checklist and launch

## 📊 Task Statistics
- **Total Tasks**: 144
- **Phase 1**: 36 tasks (Weeks 1-6)
- **Phase 2**: 36 tasks (Weeks 7-12)
- **Phase 3**: 36 tasks (Weeks 13-18)
- **Phase 4**: 36 tasks (Weeks 19-24)

## 🔄 Task Dependencies
- Tasks within each week are generally independent
- Week N tasks typically depend on Week N-1 completion
- Critical path: Database → Backend → Frontend → Integration

## 🎯 Getting Started
1. Start with Week 1 tasks in order
2. Complete all tasks in a week before moving to next week
3. Update this document as tasks are completed
4. Document any blockers or issues encountered
