# Client Onboarding (Week 23.6)

Everything a new restaurant needs to go from "signed" to "serving" on the
platform. Expected timeline: **one business day** for a standard single-location
tenant. Staff training sessions live in
[`docs/training/README.md`](../training/README.md).

## Day 0 — Provisioning (ops)

1. **Create the tenant + first admin** in one call:
   ```bash
   curl -X POST https://api.example.com/api/tenants \
     -H 'Content-Type: application/json' \
     -d '{"name":"Bistro One","adminEmail":"admin@bistro.one","adminPassword":"<strong temp password>"}'
   ```
   The response contains the tenant and access/refresh tokens for the new ADMIN.
2. **Hand over securely**: the admin changes the temp password at first login.
   One account per human — additional staff are invited in-app, never shared.
3. Confirm the tenant's locale basics: timezone, currency, tax rate,
   operating hours (Admin → Settings; `PATCH /api/tenants/me`).

## Day 0 — Configuration (the new admin)

Work top-to-bottom; each step is in the role manual
([`docs/manuals/admin.md`](../manuals/admin.md), [`manager.md`](../manuals/manager.md)):

- [ ] **Menu**: categories → items with prices, images, diet tags; add pricing
      rules (happy hour) and availability windows where relevant.
- [ ] **Inventory**: stock items with par levels linked to suppliers; enter
      opening stock levels so low-stock alerts are meaningful.
- [ ] **Staff**: invite managers, kitchen, and servers with the right roles;
      apply per-user permission overrides only where a person genuinely differs.
- [ ] **Feature flags**: turn on the modules the restaurant sold on
      (`loyalty_program`, analytics, reviews…). Flagged routes fail closed —
      enable before launch day, not after.
- [ ] **Branding**: pick a theme preset, upload the logo, set accent colors →
      **Publish** (drafts are private until published).
- [ ] **Kitchen settings**: prep-time target (default 15 min) and capacity
      (default 20) — tune after the first week of real data.

## Day 1 — Staff enablement

- Run the matching training sessions per role (see
  [`docs/training/README.md`](../training/README.md)); new staff must pass the
  Server or Kitchen session before taking live orders.
- Run a **staging dry-run**: one full order on staging (menu → order → pay →
  kitchen → analytics) before touching production.

## Week 1 — Success checks

- [ ] First real order completed end-to-end (visible in Analytics → Sales).
- [ ] Low-stock alerts reviewed; par levels adjusted once.
- [ ] Prep-time analytics reviewed against the target; kitchen knobs tuned.
- [ ] Backup verification confirmed with ops (nightly dump present —
      [`docs/deployment/BACKUP.md`](../deployment/BACKUP.md)).
- [ ] Reviews moderation + reply flow exercised (if the reviews flag is on).
- [ ] Admin has reviewed the audit log at least once (weekly habit —
      [`docs/manuals/admin.md`](../manuals/admin.md) §5).

## Reference pack (share with every new client)

| Doc | Purpose |
|---|---|
| [`docs/manuals/`](../manuals/README.md) | Per-role day-one manuals |
| [`docs/training/`](../training/README.md) | Lesson plans, slide decks, video checklist |
| [`docs/admin/README.md`](../admin/README.md) | Full feature walkthrough |
| [`docs/troubleshooting/README.md`](../troubleshooting/README.md) | Symptom-first support guide |
| [`docs/privacy/README.md`](../privacy/README.md) | Privacy notice & GDPR procedures |
| [`docs/api/README.md`](../api/README.md) | API reference (for POS/integration work) |
| [`docs/deployment/README.md`](../deployment/README.md) | Where their data lives & how it's run |
