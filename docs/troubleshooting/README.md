# Troubleshooting Guide (Week 23.5)

Symptom-first fixes for operators and support. Escalation path: server →
manager (dashboard issues) → ops (infra) → engineering (code). Anything in the
audit log can be checked by an ADMIN at `GET /api/audit-logs`.

## Login & access

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 `UNAUTHENTICATED` on every call | Expired access token | Client must `POST /api/auth/refresh` (tokens rotate); re-login if the refresh call also 401s |
| 403 `FORBIDDEN_PERMISSION` | Role lacks the permission, or a per-user **deny override** | Staff → check overrides for that user (overrides beat roles) |
| 403 `TENANT_MISMATCH` | `X-Tenant-ID`/`?tenantId=` disagrees with the JWT | Remove the header/query — the tenant comes from the token |
| 403 `FEATURE_DISABLED` | Feature flag off for the tenant | Admin → Feature Flags → re-enable (announce first — it fails closed instantly) |
| 401 after password reset | All sessions revoked by design | Log in again with the new password |
| Reset email never arrives | SMTP not configured in the environment | Check `mailer` config (`.env`); in dev the code is logged by the API |

## Ordering & kitchen

| Symptom | Likely cause | Fix |
|---|---|---|
| 429 + `Retry-After` on order create | Kitchen at soft capacity | Manager: raise `capacity` via kitchen settings, or wait the `Retry-After` seconds |
| 409 `STATUS_TRANSITION_INVALID` | Out-of-order kitchen status change (e.g. QUEUED → READY) | Follow the pipeline PENDING → CONFIRMED → PREPARING → READY; CANCELLED is terminal |
| Item missing from the shop | 86'd (`isAvailable: false`) or outside its availability window | Menu → item → toggle Available / check the window |
| 400 `PROMO_INVALID` | Unknown/expired/limit-reached code | Verify the code in Manager → promo codes |
| 409 `INSUFFICIENT_LOYALTY` | Redemption exceeds balance or order total cap | Customer redeems fewer points (cap = subtotal) |
| 403/409 `GROUP_*` | Group order closed, not host, or item rules | Check the group's state in Orders; only the host converts/cancels |
| Order "scheduled" didn't cook | Scheduled for later by design | Queue separates scheduled tickets; confirm `scheduledFor` on the order |

## Dashboard / web app

| Symptom | Likely cause | Fix |
|---|---|---|
| Board stops updating live | SSE connection dropped (network blip) | Reload the page — connections are live-only, there is no offline queue |
| 404 on an action on a record | Record is cross-tenant or deleted (404 is deliberate — no existence leaks) | Confirm you're logged into the right restaurant |
| Chart/analytics empty | No data in the selected window | Widen the 7/30/90-day window; check `Analytics → Reports` |
| Export button does nothing | Browser blocked the blob download | Allow downloads for the dashboard origin |

## Infrastructure (ops)

| Symptom | Likely cause | Fix |
|---|---|---|
| API boots but DB errors (`P1001`) | Postgres unreachable / bad `DATABASE_URL` | Check `docker compose ps`, DSN, then `/health` |
| `Cannot find module '.prisma/client'` | Prisma client not generated | `npx prisma generate` from `packages/api` (see lessons L002) |
| 429 `RATE_LIMITED` on auth | Week 22 limiter (10/min per IP on auth) | Back off; the limit is per-IP+window — don't disable it, use stronger throttling upstream |
| `encryptionAtRest.ok = false` | `ENCRYPTION_KEY` unset in production | Set the env key on all API replicas (page-worthy) |
| Backup missing | `backup.sh` failed or cron didn't run | Check backup log + disk; rerun manually; see `docs/deployment/BACKUP.md` failure modes |
| Checksum mismatch at restore | Corrupt dump | Use the previous dump; never force-restore past the checksum |

## Diagnostics quick reference

```bash
curl -fsS http://localhost:3001/health                       # liveness
curl -fsS -H "Authorization: Bearer $ADMIN" .../api/security/health  # controls board
tail -f logs/api.log | grep -i error                          # recent errors (winston)
docker compose ps && docker compose logs api --tail=50        # container state
```

Still stuck? Capture: timestamp, tenant, user role, request path, full error
`code`, and the last 3 audit-log entries for the actor — then escalate.
