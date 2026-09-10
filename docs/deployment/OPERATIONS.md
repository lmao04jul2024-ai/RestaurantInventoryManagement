# Operations Guide (Week 23.4)

Day-to-day operations for a running deployment: monitoring, alerting, runbooks,
and routine procedures. Deployment steps live in
[`README.md`](./README.md); backup/restore drills in
[`BACKUP.md`](./BACKUP.md).

## Service topology & health

```
web :3000 ─┐
           ├─ api :3001 ── PostgreSQL ──┐
mobile     │            └── Redis (lazy)│
           └─ TLS terminates at edge (nginx/Caddy)
```

| Probe | Endpoint | Expectation |
|---|---|---|
| Liveness | `GET /health` | 200, no auth |
| Security controls | `GET /api/security/health` (ADMIN) | 200 with every `checks[*].ok = true` |
| Auth smoke | `POST /api/auth/login` with an ops account | 200 + fresh token pair |

Alert when `/health` fails 3 consecutive probes from **outside** the API host
(the edge check catches TLS/routing failures, not just process death).

## What to monitor (and page on)

| Signal | Source | Page threshold |
|---|---|---|
| API up | `/health` | down 1 min |
| DB reachable | any authed query / Prisma errors in logs | 5 errors/min |
| Rate-limit pressure | `GET /api/security/events` → `summary.byAction['security:rate_limit']` (24h) | sudden spike vs. baseline |
| Failed authentication burst | `summary.byAction['security:login_failed']` | > 50/24h or 10× baseline |
| Backup freshness | newest file in `BACKUP_DIR` | no dump by 03:00 UTC (absence is the signal) |
| Encryption config | `/api/security/health` → `encryptionAtRest.ok` | `false` in production = page immediately |
| Disk | backup dir + Postgres volume | > 80% |

The Week 22 security-event rollup (`summary.last24h`, `byAction`) is designed
to be scraped into Prometheus/Grafana (roadmap Week 24): poll it with an ops
ADMIN token and export the counters.

## Routine runbooks

### Deploy a release
1. Green CI on the release commit (`npm run build` + lint + all jest suites).
2. `npm run prisma:migrate:deploy --workspace @restaurant/api` (before rollout — keeps rollback clean).
3. Ship API, confirm `/health` + one authed smoke call.
4. Ship web (build hash pinned), update `ALLOWED_ORIGINS` if the origin changed.
5. Flip feature flags per tenant before a new surface goes live.

### Rotate secrets
1. `JWT_SECRET`: set the new value on all API replicas **simultaneously** (tokens must validate cluster-wide); existing access tokens expire naturally, refresh tokens re-mint on next use.
2. `ENCRYPTION_KEY`: see `docs/security/AUDIT.md` — at-rest digests are keyed; plan a re-hash window with engineering.
3. Backup GPG passphrase: rotate in the secret manager **before** the next backup run.

### Security incident (suspected breach)
Follow `docs/privacy/README.md` §Breach procedure: contain (revoke sessions,
rotate `JWT_SECRET`/`ENCRYPTION_KEY`) → assess ≤ 24 h via
`GET /api/security/events` + audit trail → notify per GDPR timelines → record
in `docs/security/AUDIT.md`.

### Capacity / kitchen overload
- Board shows amber `live/capacity` ≥ 80%; 429 `KITCHEN_AT_CAPACITY` with
  `Retry-After` at the soft cap.
- Manager raises `capacity` or `prepTimeTargetMinutes` via
  `PATCH /api/orders/kitchen/settings` (MANAGER+) — no redeploy needed.

### Tenant offboarding / data requests
- DSR export/erasure: self-service endpoints (`/api/me/data`, `DELETE /api/me`) processed in the requester's account — procedure in `docs/privacy/README.md`.

## Log management
- API logs via `winston` to stdout — ship to your aggregator (Week 24 will add structured aggregation).
- **Never** log tokens or passwords; the dev-only token logging noted in `docs/security/AUDIT.md` must be gated off before launch.
- Audit trail (`AuditLog`) is insert-only, retained 24 months — exclude it from TRUNCATE-style resets.

## Weekly ops checklist
- [ ] `/health` monitored + paging path tested
- [ ] Nightly backups present (Mon–Sun) and one checksum spot-verified
- [ ] `GET /api/security/health` all-green
- [ ] Security event rollup reviewed (anomalies → `docs/security/AUDIT.md`)
- [ ] Audit log reviewed by an ADMIN (see `docs/manuals/admin.md` §5)
