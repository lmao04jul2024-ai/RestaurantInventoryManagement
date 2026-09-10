# Week 21 — Kitchen & Fulfillment Hardening (21.1–21.6)

## Context
- Tracker 119/144 (Weeks 1–20 done; 31 remaining/open across Weeks 2–24 incl. Week 12 skipped, Week 23–24 planned-ahead placeholders). Phase 5 continues.
- Existing: Week 20 delivered scheduled/group/loyalty/promo/recs/recurring with tests; `kitchenQueue` SSE on WebSocket connection (single push transport); `Order.status` enum has PENDING/CONFIRMED/PREPARING/READY/CANCELLED; kitchen board consumes queue.

## Plan
### API
- [x] **21.1** Kitchen status transitions (PATCH /:id/status with allowed-transition guard PENDING→CONFIRMED→PREPARING→READY, CANCELLED terminal, KitchenEvent audit, 409 STATUS_TRANSITION_INVALID)
- [x] **21.2** Staff assignment (Order.staffId FK, POST /:id/assign kitchen+, GET /api/kitchen?status=, unassign on READY)
- [x] **21.3** Prep time tracking (Order.prepStartedAt/readyAt set on transitions, GET /api/kitchen/analytics avg prep time/throughput/per-status)
- [x] **21.4** Prep time targets config (TenantSetting `kitchen.prepTimeTargetMinutes` default 15, MANAGER+ writable, analytics compare vs target)
- [x] **21.5** Kitchen capacity soft cap (TenantSetting `kitchen.capacity` default 20, 429 with RETRY_AFTER when active count ≥ capacity, advisory)
- [x] **21.6** Kitchen board SSE enrichment (assignedStaff name+id, prepElapsed, prepTargetMet in kitchen queue SSE, board re-renders)

### Web
- [ ] **21.1** Kitchen status actions in kitchen board (status dropdown/button with allowed transitions only, feedback toast, optimistic re-render)
- [x] **21.2** Staff assignment UI (assign/unassign buttons, staff dropdown from /api/staff, show assigned staff on card)
- [x] **21.3** Prep time display (prepStartedAt → elapsed, readyAt when ready, color by target)
- [ ] **21.4** Prep time target config in tenant settings (MANAGER+ editable, default 15)
- [x] **21.5** Capacity indicator (active count vs capacity, warning when near limit)
- [x] **21.6** SSE field bindings (assignedStaff, prepElapsed, prepTargetMet re-render kitchen board)

### Docs
- [x] Update OpenAPI (new kitchen endpoints, status enum docs, staff assignment, prep-time fields)
- [x] Update admin guide (kitchen workflows, staff assignment, prep time targets, capacity)

## Status
- Week 20 complete: all 6 deliverables + tests + docs committed. 294 API tests / 143 web tests green, 0 tsc errors, web build exit 0.
- Week 21 complete: kitchen status audit + timeline (21.1), staff assignment + unassign (21.2), prep analytics (21.3), target+capacity settings API (21.4/21.5), enriched board (21.6). Fixed 2 latent web service URL bugs (/orders/kitchen, /orders/reports/summary). OPEN follow-ups: web settings-page UI for kitchen knobs (21.4 web) and order-level status buttons on the board (21.1 web) — API + board enrichment delivered.

- [ ] 21.1 Kitchen status transitions: order.controller PATCH /:id/status bumps status with allowed-transition guard (PENDING→CONFIRMED→PREPARING→READY; CANCELLED terminal from PREPARED/CONFIRMED/PENDING), records KitchenEvent (status, actor customerId, note?), returns updated order; out-of-order → 409 STATUS_TRANSITION_INVALID
- [ ] 21.2 Staff assignment: Order.staffId String? nullable FK to User; POST /:id/assign (kitchen+ sets staff, returns order); GET /api/kitchen?status= returns tenant orders filtered by status with assigned staff; unassign via status transition (READY clears staff)
- [ ] 21.3 Prep time tracking: Order.prepStartedAt DateTime? set on PENDING→PREPARING transition; Order.readyAt DateTime? set on PREPARING→READY; GET /api/kitchen/analytics returns avg prep time (readyAt−prepStartedAt, orders completed in window), throughput (# orders/hour), per-status counts — same analytics service, new read
- [ ] 21.4 Prep time targets config: new TenantSetting key `kitchen.prepTimeTargetMinutes` (number, default 15) — readable via GET /api/tenant/settings, writable by MANAGER+; analytics compare against target; no new model, reuse settings JSON
- [ ] 21.5 Kitchen capacity soft cap: TenantSetting `kitchen.capacity` (number, default 20) — at order creation time, if active (PENDING|CONFIRMED|PREPARING) count ≥ capacity, return 429 with `RETRY_AFTER` header (seconds until next slot frees, estimated from avg prep time or default 10min); capacity is advisory (orders still accepted) but flagged; used by kitchen board to signal congestion
- [ ] 21.6 Kitchen board SSE enrichment: kitchen queue SSE message includes `assignedStaff` (name+id if staffId set) and `prepElapsed` (seconds since prepStartedAt, null if not started) and `prepTargetMet` (boolean vs setting); board re-renders on these — single transport, no new endpoint

### Web
- [ ] types/order: status enum + KitchenEvent type; orders.service: status transition, assign, kitchen list/query, prep analytics; kitchen.service (SSE kitchen queue with enriched fields)
- [ ] Kitchen board (/orders/kitchen): status transition buttons (allowed transitions only), staff assign dropdown (search users by name, MANAGER+KITCHEN+), prep time column (elapsed + target indicator), capacity gauge, filter by status — reuses kitchen queue SSE
- [ ] Settings: kitchen section (prep time target, capacity) under /settings in existing settings page — MANAGER+ only
- [ ] Tests: service specs (status transitions, assign, prep analytics, capacity) + kitchen board + settings page specs

## Verification
- [ ] API: tsc 0, eslint 0 errors, new jest green + old still passing
- [ ] Web: tsc 0, jest green (+new), next build exit 0
- [ ] openapi.yaml + admin guide updated; tracker 21.1–21.6 (119/144); commits api → web → docs/bookkeeping; memory push

## Notes
- Status transitions are the source of truth for prep timing — no separate "start prep" action; starting prep IS the transition.
- Staff assignment is advisory (no fulfillment handoff protocol yet) — drives board display and future labor analytics.
- Capacity is a soft signal; hard backpressure (rejecting orders) is a Week 22+ hardening candidate with configurable policy.
- All kitchen data is tenant-scoped via existing TENANT_SCOPED_MODELS + tenant middleware; no cross-tenant leakage.

