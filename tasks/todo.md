# Week 19 — Analytics & Reporting (19.1–19.6)

## Context
- Tracker 102/144 (Weeks 1–11, 13–18 done; 12 skipped per user). Phase 4 begins: Week 19 Analytics & Reporting.
- Already shipped: `/api/tenants/me/analytics` (usage/billing, 15.6), `/api/orders/reports/summary` (order summary), inventory valuation/consumption reports (8.6), SSE order stream (`order-events` pub/sub). No dedicated analytics dashboard, no exports, no report templates.

## Plan
### API
- [x] 19.1 `GET /api/analytics/sales?days=30` — totals (orders/paidRevenue/avgOrderValue), byStatus, revenueByDay + ordersByDay histograms, top items (qty+revenue via JS agg over order items), peak hours
- [x] 19.2 `GET /api/analytics/inventory?days=30` — items/active/lowStock counts, valuation (cost) + retail value, dead stock (no USAGE in window), top movers (usage qty), supplier breakdown
- [x] 19.3 `GET /api/analytics/customers?days=30` — customers/new/active/returning, repeat rate, avg orders per customer, top customers (orders+spend), review rating avg
- [x] 19.4 `GET /api/analytics/export?type=sales|inventory|customers&format=csv|pdf&days=30` — new pure `services/report-export.ts`: RFC4180 CSV w/ UTF-8 BOM (Excel) + dependency-free minimal PDF writer (Helvetica, paginated, xref)
- [x] 19.5 `GET /api/analytics/stream` — SSE live analytics: today snapshot on connect + on each order event (reuses `order-events` pub/sub, tenant-keyed; same pattern as order stream — documented SSE-over-WebSockets decision)
- [x] 19.6 Report templates: Prisma `ReportTemplate` model (tenantId, name unique-per-tenant, type sales|inventory|customers, config Json{days,sections}) + CRUD `/api/analytics/templates` (read: analytics:read; write: MANAGER+) + add to TENANT_SCOPED_MODELS
- [x] Routes `analytics.routes.ts` mounted at `/api/analytics` (authenticate + resolveTenant); validation schemas (analyticsQuery, exportQuery, reportTemplate create/update)
- [x] Tests: analytics.spec (aggregation math, exports CSV/PDF structure, templates CRUD + 409/404), tenant-scope.spec set + ReportTemplate, integration gate (SERVER → 403)

### Web
- [x] types/analytics.ts (mirror API payloads; union enums per L018), services/analytics.service.ts (getSales/Inventory/Customers/Templates CRUD, blob export download), hooks/use-analytics.ts
- [x] 19.1–19.3 `/dashboard/analytics` page: tabs Sales | Inventory | Customers | Reports; KPI cards; SVG bar chart (no chart lib in repo); low-stock/top-customers tables
- [x] 19.4 Reports tab: export buttons (CSV/Excel, PDF) per report type w/ current window
- [x] 19.6 Reports tab: template list, save current (name/type/days), apply (switches tab+window), delete
- [x] Sidebar 📈 (ADMIN/MANAGER) + dashboard-index quick links
- [x] Tests: analytics.service.spec, analytics-page.spec (tabs, role gate, export download, template save/apply/delete)

## Verification
- [x] API: tsc 0, eslint exit 0, jest green (+new)
- [x] Web: tsc 0, jest green (+new), `next build` exit 0
- [x] openapi.yaml + admin guide updated; tracker ticks 19.1–19.6 (108/144); commits api → web → bookkeeping; memory push

## Notes
- 19.5 says "WebSockets"; repo already standardizes on SSE (order stream, single-process EventEmitter, Redis-adapter-ready) — analytics stream reuses it (zero new deps, consistent ops story). Documented in controller + docs.
- 19.4 PDF: dependency-free minimal writer (repo has no pdf/xlsx libs; Excel opens BOM'd CSV natively). Documented tradeoff in service header.
- No migrations dir exists in repo (schema-first, `migrate dev`/`db push` locally) — ReportTemplate follows convention: schema.prisma + `prisma generate`; baseline migration happens at deployment (see deployment doc).
## Review
- **Converged design:** one analytics controller with shared report builders feeding both the JSON endpoints and the 19.4 exporter (single source of aggregation truth). Routes gated by `analytics:read` (MANAGER matrix/ADMIN '*'); template writes MANAGER+.
- **Zero new runtime deps:** CSV via RFC4180 + BOM (Excel-native) and a minimal but standards-valid PDF 1.4 writer (paginated, xref-verified by tests) instead of pulling pdf/xlsx libraries. Real-time analytics reuses the SSE order-events transport instead of adding WebSockets — one push transport, Redis-adapter-ready.
- **Templates:** ReportTemplate follows the repo's schema-first convention (no migrations dir exists; baseline SQL happens at deployment). Tenant-scoped via TENANT_SCOPED_MODELS + explicit tenantId; name-unique-per-tenant with friendly 409s; PATCH never re-stamps a config default on bare renames (update schema has no config default).
- **Test lessons:** xref byte-offset verification catches PDF writer drift (an `undefined` object hole slipped through until the offset loop failed); SSE tests must synchronously emit `close` or the 25s heartbeat hangs jest; jsdom lacks URL.createObjectURL (stub both URL methods); multiple same-name export buttons need aria-labels (a11y + testability).
- **Verification:** api tsc 0 / lint 0 errors / 252 jest green (+24: 23 analytics + 1 integration gate) · web tsc 0 / 133 jest green (+10) · next build exit 0 (/dashboard/analytics 7.24 kB) · openapi.yaml valid (59 paths / 20 schemas).
- **Commit split:** api (feat) → web (feat) → docs → bookkeeping (tracker 108/144, todo, memory).
