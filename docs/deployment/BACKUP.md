# Backup & Recovery (Week 22.5)

This runbook describes the backup and restore procedures for the Postgres database
that backs the API. **Backups are only as good as their restore drills** — run a
restore into a scratch database at least once per quarter.

## Objectives

| Goal                        | Target                          |
| --------------------------- | ------------------------------- |
| Recovery point objective    | ≤ 24 h (daily full dumps)       |
| Recovery time objective     | ≤ 60 min to a validated restore |
| Retention                   | 14 dumps (rolling) + monthly    |
| Integrity                   | SHA-256 sidecar per dump        |

## Backup — `scripts/backup.sh`

```bash
export DATABASE_URL='postgres://user:pass@host:5432/restaurant'
./scripts/backup.sh            # defaults: ./backups, keep 14
./scripts/backup.sh 60         # keep 60
BACKUP_DIR=/srv/backups ./scripts/backup.sh
```

What it does:

1. `pg_dump --format=custom` — portable, restorable with `pg_restore`, and
   `--no-owner` keeps it environment-agnostic.
2. Writes a `sha256` sidecar — the restore script refuses corrupt dumps.
3. Optional GPG encryption when `BACKUP_ENCRYPT` points at a passphrase file
   (recommended for offsite storage; the ciphertext replaces the plain dump).
4. Rotation — the newest `BACKUP_KEEP` dumps survive, everything older is
   removed with its sidecar.

### Scheduling

The job is **not** part of the application process; run it on the host or via
the orchestrator (`docker compose exec`):

```bash
# crontab — 02:10 UTC daily
10 2 * * * cd /srv/app && DATABASE_URL="$POSTGRES_URL" BACKUP_DIR=/srv/backups ./scripts/backup.sh >> /var/log/backup.log 2>&1
```

Offsite copy (rclone/restic) should pull `/srv/backups` at least daily.

## Restore — `scripts/restore.sh`

```bash
export DATABASE_URL='postgres://user:pass@host:5432/restaurant_scratch'
./scripts/restore.sh ./backups/restaurant-20260910T020000Z.dump
```

The script:

1. Verifies the sidecar checksum (hard fail on mismatch).
2. Requires an explicit `restore` confirmation (unless `SKIP_CONFIRM=1`).
3. Runs `pg_restore --clean --if-exists --no-owner`.

### Restore drill checklist

- [ ] Restore the newest dump into a scratch DB; assert row counts match the
      pre-backup figures and the `/health` endpoint comes up.
- [ ] Verify a recent user can still log in (session rows are included).
- [ ] Check the audit trail contains the most recent entries.
- [ ] Time the drill — it must fit inside the RTO.

## Failure modes

| Symptom                          | Response                                      |
| -------------------------------- | --------------------------------------------- |
| Checksum mismatch at restore     | Try the previous dump; contact the DBA        |
| `pg_dump` fails (auth/disk)      | Check `DATABASE_URL` and disk space; paging   |
| Encryption passphrase lost       | Dumps are unrecoverable — store the passphrase in the secret manager (e.g. Vault) |
| Backup dir unwritable            | Monitor `scripts/backup.sh` exit code + log   |

## Monitoring tie-in (Week 22.6)

`GET /api/security/health` reports whether `scripts/backup.sh` exists as a
static control. Production monitoring should additionally alert whenever the
daily backup job does **not** produce a new dump by 03:00 UTC — absence of a
fresh blob is the failure signal, not a nonzero exit alone.