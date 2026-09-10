#!/usr/bin/env bash
# Week 22.5 — database backup with rotation + integrity check.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/backup.sh [--keep N]
#
# Environment:
#   DATABASE_URL   Postgres connection string (required, or DATABASE_HOST/etc)
#   BACKUP_DIR     output directory (default ./backups)
#   BACKUP_KEEP    number of dumps to retain (default 14)
#   BACKUP_ENCRYPT set to a gpg passphrase file path to encrypt dumps
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${1:-${BACKUP_KEEP:-14}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="${BACKUP_DIR}/restaurant-${STAMP}.dump"
DIGEST="${DUMP}.sha256"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required (postgres://user:pass@host:5432/dbname)" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[backup] starting ${STAMP}"
pg_dump --format=custom --no-owner --dbname "${DATABASE_URL}" > "${DUMP}"

# Integrity: a checksum makes the dump's completeness verifiable at restore time.
shasum -a 256 "${DUMP}" | awk '{print $1}' > "${DIGEST}"

if [[ -n "${BACKUP_ENCRYPT:-}" && -f "${BACKUP_ENCRYPT}" ]]; then
  gpg --batch --yes --passphrase-file "${BACKUP_ENCRYPT}" -c "${DUMP}"
  rm -f "${DUMP}"
  echo "[backup] encrypted with ${BACKUP_ENCRYPT} (gpg)"
fi

# Rotation: drop the oldest beyond KEEP.
ls -1t "${BACKUP_DIR}"/restaurant-*.dump* 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "${old}" "${old}.sha256"
  echo "[backup] rotated out ${old}"
done

echo "[backup] complete ${DUMP} (keep ${KEEP})"