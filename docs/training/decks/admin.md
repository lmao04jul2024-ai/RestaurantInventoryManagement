# Deck: Admin (Session 5, 60 min)

> Narration script — one line per slide. Exercise at the end is mandatory.

## Slide 1 — Your scope
- Everything a Manager can do, plus tenant-level administration. Full walkthrough: `docs/admin/README.md`.

## Slide 2 — Tenant settings
- Restaurant profile, operating hours, locale. Accounts are invited via **Staff** — never created by hand.

## Slide 3 — Feature flags
- Turn `loyalty_program`, `analytics`, and other modules on/off per tenant.
- Flagged APIs fail **closed** (`403 FEATURE_DISABLED`) the moment you switch off — announce first.

## Slide 4 — Branding & theming
- Five presets × light/dark/system, logo, accent colors, fonts.
- **Publish** re-renders instantly; drafts are private until published; **Discard** returns to published state.

## Slide 5 — Security console (Week 22)
- Event feed: failed logins, rate-limit hits, permission denials — with a 24h rollup for alerting.
- `/api/security/health`: live control-objectives board (limiters, headers, encryption key, backups).

## Slide 6 — GDPR workflow
- Export a customer's data (JSON) or run erasure; keep the privacy notice's 30-day SLA.
- Erasure anonymizes the account and writes a `security:data_erasure` audit event.

## Slide 7 — Backups
- Nightly `scripts/backup.sh` (checksummed, rotated); verify it ran every morning.
- **Quarterly restore drill** with `scripts/restore.sh` — see `docs/deployment/BACKUP.md`.

## Slide 8 — Audit log
- Immutable who-did-what with before/after values — the answer to "something changed".

## Slide 9 — Admin commandments
- One account per human; review the audit log weekly; test your restore, not just your backup.

## Exercise (do it now)
Publish a branding draft, then export a demo customer's data via the GDPR
endpoint (`GET /api/me/data` from the customer's account). Show the trainer the
published site and the export envelope.
