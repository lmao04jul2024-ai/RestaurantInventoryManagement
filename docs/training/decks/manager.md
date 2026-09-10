# Deck: Manager (Session 4, 90 min)

> Narration script — one line per slide. Exercise at the end is mandatory.

## Slide 1 — Your surfaces
- Menu, Inventory, Orders, Kitchen, Analytics, Reviews, Staff, Feature Flags (if enabled) — plus everything Servers and Kitchen see.

## Slide 2 — Menu & pricing
- Categories → items (name, description, price, image, category).
- **Pricing rules** (happy hour, time windows) and **availability windows** resolve automatically at order time.
- Toggle `isAvailable` for instant 86'ing.

## Slide 3 — Inventory & purchasing
- Stock per item with par levels; **low-stock alerts** fire automatically.
- **Purchase orders** to suppliers → receive to add stock.
- **Analytics → Inventory**: valuation, dead stock, top movers.

## Slide 4 — Staff
- Invite by email with role (SERVER / KITCHEN / MANAGER).
- **Permission overrides** beat roles: grant a server `inventory:manage`, deny a manager `analytics:read`.
- Deactivate leavers — audit history is preserved.

## Slide 5 — Promotions & loyalty
- **Promo codes**: percent or fixed, expiry, redemption limits; counted automatically.
- **Loyalty**: 1 pt per $1, 100 pts = $1 off capped at subtotal.

## Slide 6 — Kitchen knobs
- **Kitchen settings**: prep-time target (default 15 min) and capacity (default 20, 0 disables).
- Analytics compares actual prep time to target; the board warns near capacity.

## Slide 7 — Analytics
- Tabs: Sales, Inventory, Customers; 7/30/90-day windows.
- **Reports tab**: CSV (Excel-friendly) or PDF export; save a template to re-run in one click.
- Live stream pushes real-time revenue/order updates.

## Slide 8 — Reviews
- Read, filter, reply publicly. Moderate abuse before responding.

## Slide 9 — Security duties
- Watch failed-login spikes, rotate staff access promptly, never share accounts — per-user identity is what makes the audit log meaningful.

## Exercise (do it now)
Create a promo code and a report template, then export the last 7 days as CSV.
Show the trainer all three artifacts.
