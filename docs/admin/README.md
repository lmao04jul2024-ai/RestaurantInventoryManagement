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