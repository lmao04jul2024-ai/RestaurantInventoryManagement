# Admin User Guide (Week 18.5)

A practical tour of the restaurant admin surfaces. Admin (`ADMIN`) and manager
(`MANAGER`) roles see these tools; only `ADMIN` may customize branding or view
the immutable audit trail. Everything is tenant-scoped — staff only ever see
their own restaurant's data.

## 1. Dashboard home

The role-aware homescreen surfaces quick actions and the tenant name/logo. The
sidebar shows only the tools your role can open.

## 2. Menus

- Build menus → categories → items with pricing, diet tags and availability.
- Pricing rules (`PERCENT_DISCOUNT` / `FIXED_PRICE`) and availability windows
  apply automatically; the storefront resolves effective prices in real time.
- Toggle an item's availability for instant menu changes.

## 3. Inventory

- Track items (`name`, `SKU`, unit, min/max stock, cost & selling price) and
  link them to suppliers.
- Record stock movements: `RESTOCK`, `USAGE`, `ADJUSTMENT`, `RETURN`. Usage
  cannot drive stock negative.
- Watch **Low-stock alerts** (items at or below `minStock`) and use the
  **Valuation** / **Consumption** reports for costing and ordering decisions.

## 4. Orders

- See live orders and the kitchen queue; advance statuses
  (`PENDING → CONFIRMED → PREPARING → READY → COMPLETED`).
- Cancel or settle orders (simulated payment gateway in dev).
- The order-stream feeds live tray updates; the summary report rolls up a shift.

### Kitchen & fulfilment (Week 21)

- **Status transitions** stamp the kitchen timeline automatically: entering
  `PREPARING` records `preparationStartedAt`, and reaching `READY` records
  `readyAt`. Every transition is written to the audit trail as
  `order:kitchen_status` (with targeted prep-time fields), so fulfilment lag
  is reconstructible without a separate history table.
- **Staff assignment** — KITCHEN/MANAGER/ADMIN can assign a staff member to a
  live ticket via `POST /api/orders/:id/assign` (body `{ staffId }`) and clear
  it with `DELETE /api/orders/:id/assign`. The board shows an
  `assignedStaff: { id, name }` chip; reaching `READY` auto-clears the
  assignment, and closed orders cannot be (un)assigned.
- **Prep-time analytics** — `GET /api/orders/kitchen/analytics?days=1..30`
  returns the average prep minutes (`readyAt − preparationStartedAt`) over
  completed tickets, the percentage that met the tenant's target, throughput
  per hour, and per-status counts. Use it to spot persistent over-target
  items before they become complaints.
- **Prep target & capacity knobs** — MANAGER+ can tune the kitchen via
  `PATCH /api/orders/kitchen/settings`: `prepTimeTargetMinutes` (1–240,
  default 15) and `capacity` (0–999, default 20; `0` disables the guard).
  The kitchen board colors prep elapsed red when it exceeds the target and
  shows a `live/capacity` indicator that warns (amber ≥ 80%) long before the
  soft cap rejects new tickets.
- **Soft capacity guard** — when active tickets (`PENDING`/`CONFIRMED`/
  `PREPARING`) reach the configured capacity, new orders are rejected with
  `429 KITCHEN_AT_CAPACITY` and a `Retry-After: 60` header. It is a soft
  signal, not hard backpressure: set `capacity: 0` to turn it off entirely.

## 5. Purchase orders

- Draft → submit → receive goods. Receiving auto-creates `RESTOCK` transactions
  so inventory balances always match delivered POs.

## 6. Reviews

- Moderate customer reviews (hide/show) and delete abusive ones. The
  `customer_reviews` feature flag can switch the whole review flow off.

## 7. Staff & permissions (ADMIN/MANAGER)

- Create staff (`MANAGER`, `KITCHEN`, `SERVER`) and manage the directory.
- Per-user **permission overrides** refine the role matrix per person
  (explicit grant or deny; an explicit deny always wins).
- Role changes are immediate; audit rows record every staff mutation.

## 8. Feature flags (ADMIN/MANAGER)

- The global registry lists every toggle (default on/off).
- Per-restaurant overrides: switch a feature on/off for YOUR restaurant without
  a global effect or a deployment.

## 9. Tenant settings

- Edit profile/contact details, timezone, currency and tax rate.
- Set operating hours (cleared with a JSON `null`).
- See plan, subscription status, seat usage and analytics, and change billing
  plan tier.

## 10. Analytics (ADMIN/MANAGER)

- **Sales**: orders, paid revenue and average order value over a 7/30/90-day
  window, a daily revenue chart, status breakdown, top items and peak hours.
- **Inventory**: stock valuation (cost & retail), low-stock list, dead stock
  (items with zero usage in the window), top movers and per-supplier value.
- **Customers**: new vs returning mix, repeat rate, average orders per
  customer, top customers by spend and average review rating.
- **Exports**: every report downloads as **CSV** (opens directly in Excel) or
  **PDF** for the selected window.
- **Templates**: save the current window as a named report template and reuse
  it later (delete anytime). Templates are per-restaurant.
- **Live metrics**: the API also streams today's revenue/orders/active orders
  over Server-Sent Events (`/api/analytics/stream`) for real-time dashboards.

## 11. Customize (ADMIN only)

- **Appearance**: pick a preset palette (Classic/Emerald/Sunset/Custom),
  custom brand hexes, and light/dark/system default mode.
- **Branding**: set an `https` logo URL and a web-safe brand font. The logo
  appears in the dashboard header and storefront preview.
- The **live preview** is scoped — it reflects your draft instantly and never
  affects the rest of the dashboard.
- **Publish** to persist the theme tenant-wide. Publishing updates every
  signed-in visitor who hasn't set a personal override.

## 12. Audit log (ADMIN only)

- Read-only, filterable trail of staff actions (`action`, `targetType`,
  `targetId`, actor, timestamp). Rows are insert-only — nothing can be edited
  or deleted.

## 13. Security (Week 22 — ADMIN only)

- **Health board** (`/dashboard/security` → `GET /api/security/health`):
  rate-limit wiring, security headers, encryption-key state, password-hashing
  policy, and backup-script presence — each check shows a pass/fail flag with
  an explanatory note. Act when `encryptionAtRest` reports a missing
  `ENCRYPTION_KEY` (prod), or when `backups` reports missing scripts.
- **Events + rollup** (`GET /api/security/events`): recent `security:*` rows
  plus a 24 h count breakdown by action (`auth_failed`, `rate_limited`,
  `data_erasure`). Alert when `rate_limited` climbs (DDoS/credential-stuffing
  pressure) or repeated `auth_failed` events look like a targeted attempt.
- **Privacy operations**: customers use `/api/me/data` (export) and
  `DELETE /api/me` (erasure) directly. For written DSRs, identify-verify the
  requester, run the self-service flow in their tenant, and keep the envelope —
  see `docs/privacy/README.md` for the 30-day SLA and process.
- **Backups**: daily 02:10 UTC `scripts/backup.sh` with SHA-256 sidecars and a
  14-dump rotation; restore drills are the gate, not the cron. Full runbook in
  `docs/deployment/BACKUP.md`.

## Roles recap

| Capability                   | CUSTOMER | SERVER | KITCHEN | MANAGER | ADMIN |
| ---------------------------- | :------: | :----: | :-----: | :-----: | :---: |
| Order entry / status         | own only |  ✔️  | status  |   ✔️    |  ✔️  |
| Inventory (read / movement)  |    —     |  —    |   ✔️    |   ✔️    |  ✔️  |
| Menus, suppliers, purchase   |    —     |  —    |   —     |   ✔️    |  ✔️  |
| Staff & permission overrides |    —     |  —    |   —     |   ✔️    |  ✔️  |
| Feature flags, tenant admin  |    —     |  —    |   —     |   ✔️    |  ✔️  |
| Analytics & report exports   |    —     |  —    |   —     |   ✔️    |  ✔️  |
| Customize (branding)         |    —     |  —    |   —     |   —     |  ✔️  |
| Audit trail                  |    —     |  —    |   —     |   —     |  ✔️  |

> Security note: access control happens server-side (`middleware/rbac`) — the
> sidebar just hides tools; it never by itself protects an endpoint.