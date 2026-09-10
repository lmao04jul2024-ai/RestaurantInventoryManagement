# Server Guide

You log into the **dashboard** and see: Orders (and the order board).

## 1. Take an order
1. **Orders → New order**. Pick a table (or takeaway) and add menu items.
2. Items show their **current effective price** (happy-hour and time-window
   pricing rules are applied automatically).
3. Unavailable items are blocked at order time with the item name — pick
   something else rather than trying to override.
4. Submit. The ticket appears on the **Kitchen Display** instantly (real-time,
   no refresh).

## 2. Manage tables
Each table shows its open orders. Guests can also add to a **group order** you
started: create one from an order, share the 6-character code, and everyone's
items accumulate into one ticket. You (the host) **Convert** it to a real order
when the party is done, or **Cancel** it.

## 3. Payment & close-out
- Open the order → **Pay** → choose method (card/cash/…). Payment status flips
  to PAID and the ticket is finalized.
- The guest earns loyalty points automatically at payment — you don't do
  anything; don't manually "add points".

## 4. Things you cannot do (by design)
- Edit menu prices or availability (Manager).
- See other tenants' anything — the system is tenant-isolated end to end.
- Remove menu items from a *placed* ticket — cancel and re-order instead, or
  ask a Manager.

## 5. If something looks stuck
The dashboard and kitchen display update in real time, but they are **live
connections** — if the internet drops, updates pause until it returns. Reload
the page to reconnect. While offline you cannot place orders or advance
tickets (there is no offline queue); wait for the connection, then retry. If an
action you just took doesn't appear after a reload, don't repeat it blindly —
check **Orders** for the ticket first, and ask a Manager if in doubt.
