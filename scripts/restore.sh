#!/usr/bin/env bash
# Week 22.5 — restore a backup produced by scripts/backup.sh.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/dbname ./scripts/restore.sh ./backups/restaurant-YYYYMMDDTHHMMSSZ.dump
#
# The restore verifies the sidecar checksum, warns loudly, and only then
# streams the custom-format dump into the target database.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "${DUMP}" || ! -f "${DUMP}" ]]; then
  echo "Usage: $0 <path-to-dump>" >&2
  exit 1
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

# Integrity gate: the sidecar checksum must match or we refuse to restore.
if [[ -f "${DUMP}.sha256" ]]; then
  EXPECTED="$(cat "${DUMP}.sha256")"
  ACTUAL="$(shasum -a 256 "${DUMP}" | awk '{print $1}')"
  if [[ "${EXPECTED}" != "${ACTUAL}" ]]; then
    echo "ERROR: checksum mismatch — ${DUMP} may be corrupt" >&2
    exit 1
  fi
  echo "[restore] checksum verified"
else
  echo "WARNING: no sidecar checksum found for ${DUMP}" >&2
fi

if [[ "${SKIP_CONFIRM:-0}" != "1" ]]; then
  read -r -p "Restore ${DUMP} into ${DATABASE_URL}? This REPLACES existing data. Type 'restore' to continue: " CONFIRM
  if [[ "${CONFIRM}" != "restore" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

pg_restore --clean --if-exists --no-owner --dbname "${DATABASE_URL}" "${DUMP}"
echo "[restore] done — run the restore-drill checklist in docs/deployment/BACKUP.md"