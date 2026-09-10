# Privacy & GDPR Policy (Week 22.4)

Scope: how the platform collects, stores, and deletes personal data, and what
users (and operators) can do about it. Fulfills the GDPR "transparency"
obligation for the customer/shopper account surface and the staff surface.

## Data inventory

| Datum | Stored in | Lawful basis | Retention |
| ----- | --------- | ------------ | --------- |
| Name, email, phone, avatar | `User` | contract + consent (`consentGivenAt`) | account lifetime + 30d |
| Credentials (bcrypt hash only — the password is **never** stored) | `User.password` | contract | account lifetime |
| Orders, reviews, loyalty ledgers | `Order` / `Review` / `LoyaltyEntry` | contract + legitimate interest (analytics) | PII-anonymized on erasure |
| Session + reset tokens | `Session.token` (**keyed digest only** — §22.3) | security (legitimate interest) | session 7d, reset 1h, then deleted |
| Audit rows | `AuditLog` | legal obligation (tamper-evident ops trail) | 24 months |
| Staff permission overrides | `User.permissionOverrides` | legal/contract | staff tenure |

**Data minimization:** address-less, card-less checkout — payments go through the
(simulated) gateway and no card numbers ever touch the database.

## Subject rights — how to exercise them

- **Access / portability (Art. 15/20)** — `GET /api/me/data` returns the
  caller's profile + orders + reviews + loyalty entries as one envelope.
- **Erasure (Art. 17)** — `DELETE /api/me` anonymizes the row
  (`Deleted User`, `erased-<id>@deleted.invalid`, credentials destroyed,
  sessions revoked, `dataErasedAt` stamped) and writes a `security:data_erasure`
  audit event. Order history is retained only in anonymized form.
- **Rectification (Art. 16)** — `PATCH /api/users/me` (`firstName`, `lastName`, `phone`).
- **Restriction (Art. 18)** — deactivated accounts (`isActive: false`) block
  login and degrade the profile path automatically.
- **Withdraw consent** — consent is recorded as `consentGivenAt`; withdrawing
  is equivalent to requesting erasure (above).

Operators: process written DSR requests by (a) verifying identity, (b) hitting
the self-service endpoint **in the requester's account/tenant**, (c) exporting
and archiving the envelope, (d) confirming the security event in
`GET /api/security/events`. SLA: 30 days, extensions documented.

## Subprocessors & transfers

No third-party sub-processors in the reference deployment (SMTP for mail in
dev). Add the provider list here per deployment; international transfers rely
on the platform's EU residency or standard contractual clauses.

## Breach procedure

1. Contain (revoke sessions, rotate `JWT_SECRET` + `ENCRYPTION_KEY`).
2. Assess in ≤ 24 h (scope + categories via the audit trail / exports).
3. Notify the supervisory authority within 72 h when required; inform affected
   users without undue delay where risk is high.
4. Record the incident in the audit trail and in `docs/security/AUDIT.md`
   findings on the next review cycle.