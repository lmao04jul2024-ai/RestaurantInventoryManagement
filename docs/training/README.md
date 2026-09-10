# Training Materials (Week 23.3)

Everything a trainer needs to run an onboarding session for each role. Each
module has:

1. A **lesson plan** (objectives, timing, activities) in this index.
2. A **slide-style script** (markdown decks, one bullet per slide) in
   `decks/` — present as-is, or read as the narration for screen-capture
   videos (recording checklist below).
3. A **hands-on exercise** per deck that ends with a verifiable outcome.

## Lesson plans

### Session 1 — Customer experience (30 min) → [decks/customer.md](./decks/customer.md)
Audience: anyone supporting front-of-house or social channels.
Objectives: place an order, apply a promo, redeem points, schedule an order,
track status, leave a review.
Exercise: place and pay a demo order on the staging shop; screenshot the
confirmation.

### Session 2 — Server (45 min) → [decks/server.md](./decks/server.md)
Objectives: create table orders, read effective pricing, start/join/convert a
group order, take payment, explain loyalty to a guest.
Exercise: run a 2-person group order end-to-end on staging.

### Session 3 — Kitchen (45 min) → [decks/kitchen.md](./decks/kitchen.md)
Objectives: work the ticket lifecycle, 86 an item, read capacity + prep-time
indicators.
Exercise: 86 an item, verify it vanishes from the shop, restore it.

### Session 4 — Manager (90 min) → [decks/manager.md](./decks/manager.md)
Objectives: menu + pricing rules, inventory cycle, staff overrides, promos,
analytics + exports.
Exercise: create a promo code and a report template, then export last 7 days
as CSV.

### Session 5 — Admin (60 min) → [decks/admin.md](./decks/admin.md)
Objectives: feature flags, branding publish flow, audit log, security console,
GDPR workflow, backup drill.
Exercise: publish a branding draft, then export a demo customer's data via the
GDPR endpoint.

## Recording checklist (for video tutorials)

These decks double as narration scripts. When recording:

- [ ] Record at 1920×1080, browser zoom 100%, dark-mode dashboard for contrast.
- [ ] Use the **staging tenant** with seeded data
      (`npm run prisma:seed --workspace @restaurant/api`); blur or
      avoid real customer emails (GDPR — see `docs/privacy/README.md`).
- [ ] Pause on each error state you demo (403s, validation errors) for 2s so
      viewers can read the code.
- [ ] One take per section (§), not one take per deck — splices are invisible.
- [ ] Export MP4 (H.264), name `week23-<role>-<n>-<slug>.mp4`, store in your
      shared drive; link the URL in the deck header.
- [ ] Re-record whenever a UI flow changes — decks list the screen paths, so
      diffs are easy to spot.

## Trainer notes
- Run sessions on staging, never production; training mutations pollute real
  analytics.
- End every session with the exercise, not the slides — completion is the
  outcome, not attendance.
- New hires must pass Session 2 or 3 (by role) before taking live orders on a
  real tenant.
