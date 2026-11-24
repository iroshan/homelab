#!/bin/sh
# =============================================================================
# Affine PostgreSQL Daily Logical Backup Script
# =============================================================================
# Runs inside the affine_postgres container via Ofelia at 1:05 AM daily
# (before the 2:00 AM Kopia snapshot to Google Drive).
# Produces a guaranteed-consistent gzipped SQL dump that restores cleanly
# across architectures and Postgres minor versions.
# Retains the last 7 daily dumps + latest.sql.gz.
# =============================================================================

set -eu

BACKUP_DIR="/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/affine_${TIMESTAMP}.sql.gz"
TMP_FILE="${BACKUP_FILE}.tmp"

DB_USER="${POSTGRES_USER:-affine}"
DB_NAME="${POSTGRES_DB:-affine}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup for database '${DB_NAME}'..."

if ! pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges | gzip -c > "$TMP_FILE"; then
    echo "[$(date)] ERROR: pg_dump failed!"
    rm -f "$TMP_FILE"
    exit 1
fi

# Verify archive integrity and non-empty output
if [ ! -s "$TMP_FILE" ] || ! gzip -t "$TMP_FILE"; then
    echo "[$(date)] ERROR: Backup file failed gzip integrity check!"
    rm -f "$TMP_FILE"
    exit 1
fi

mv "$TMP_FILE" "$BACKUP_FILE"
cp "$BACKUP_FILE" "${BACKUP_DIR}/latest.sql.gz"

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[$(date)] SUCCESS: PostgreSQL backup completed: ${BACKUP_FILE} (${SIZE})"

# Retain only the last 7 dated dumps
ls -t "${BACKUP_DIR}"/affine_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[$(date)] Old backups pruned (keeping last 7)"
