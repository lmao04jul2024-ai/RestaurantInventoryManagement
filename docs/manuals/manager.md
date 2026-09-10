# Manager Guide

You see: Menu, Inventory, Orders, Kitchen, Analytics, Reviews, Staff, Feature
Flags (if enabled for you), plus everything Servers and Kitchen see.

## 1. Menu management (**Menu**)
- Create categories → create items (name, description, price, image, category).
- **Pricing rules**: add happy-hour or time-window rules; the effective price
  is computed at order time and shown to servers.
- **Availability windows**: restrict items to service windows.
- Toggle `isAvailable` for instant 86'ing (see Kitchen guide §3).

## 2. Inventory & purchasing (**Inventory**)
- Track stock per item with par levels; the dashboard raises **low-stock
  alerts** automatically.
- Create **purchase orders** to suppliers; receive them to add stock.
- Multi-location tenants can run **stock transfers** between locations.
- Check **Analytics → Inventory** for valuation, dead stock, and top movers.

## 3. Staff (**Staff**)
- Invite staff by email with a role (SERVER / KITCHEN / MANAGER).
- Per-user **permission overrides**: grant a specific server `inventory:manage`
  or deny a manager `analytics:read`. Overrides beat the role.
- Deactivate leavers — audit history is preserved.

## 4. Promotions & loyalty
- **Promo codes**: create percent or fixed codes with expiry and redemption
  limits; redemptions are counted automatically at checkout.
- **Loyalty**: 1 pt per $1 paid, 100 pts = $1 off, capped at subtotal. Balances
  and ledger are per customer.

## 5. Analytics (**Analytics**)
- Tabs: Sales (revenue, top items, peak hours), Inventory (valuation, dead
  stock), Customers (repeat rate, top spenders).
- Pick a 7/30/90-day window.
- **Reports tab**: download CSV (opens in Excel) or PDF; save a report template
  to re-run a configuration in one click.
- **Live stream**: the dashboard receives real-time revenue/order updates.

## 6. Reviews (**Reviews**)
Read, filter, and **reply** publicly to guest reviews. Moderate abuse before
responding.

## 7. Your security duties
Watch for failed-login spikes on the Security console (Admin will invite you
if you need it), rotate staff access promptly, and never share accounts —
per-user identity is what makes the audit log meaningful.
