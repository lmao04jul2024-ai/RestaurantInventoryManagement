# Admin Guide

You can do everything a Manager can, plus tenant-level administration. The
full screen-by-screen walkthrough with field details is
[`docs/admin/README.md`](../admin/README.md) — this is the short version.

## 1. Tenant settings (**Settings**)
Restaurant profile, operating hours, and locale. The JWT is tenant-bound;
never create accounts "by hand" in the database — invite through Staff.

## 2. Feature flags (**Feature Flags**)
Turn `loyalty_program`, `analytics`, and other modules on/off per tenant.
Flagged APIs fail closed (`403 FEATURE_DISABLED`) the moment you switch off —
announce before disabling something in use.

## 3. Branding & theming (**Customize**)
Five presets × light/dark/system mode, logo, accent colors, fonts. **Publish**
re-renders the site instantly; drafts are private until you publish. You can
always **Discard** back to the published state.

## 4. Security console (**Security**, Week 22)
- Review the security event feed (failed logins, rate-limit hits, permission
  denials).
- Process **GDPR** requests: export a customer's data (JSON) or run an erasure
  workflow. Keep the privacy notice's response-time promise.
- Backups: verify the nightly `scripts/backup.sh` ran (see
  [`docs/deployment/BACKUP.md`](../deployment/BACKUP.md)); do a restore drill
  quarterly with `scripts/restore.sh`.

## 5. Audit log (**Audit Log**)
Immutable who-did-what with before/after values. Check it after any "something
changed" report — it answers who, when, and exactly what.

## 6. Analytics & staff analytics
Full analytics access, including the ability to grant/take away
`analytics:read` from individual managers (Staff → overrides).

## 7. Admin-only commandments
1. Never share the admin account; each human gets their own.
2. Enable 2FA where your deployment provides it.
3. Review the audit log weekly.
4. Test your restore, not just your backup.
