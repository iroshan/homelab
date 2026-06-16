#!/bin/sh
# =============================================================================
# Vaultwarden → Google Drive Backup Script
# =============================================================================
# Runs inside the Kopia container (which has rclone + gdrive-backups configured)
# Schedule: Daily at 1:00 AM (before Kopia snapshot at 2:00 AM)
# Retention: 30 daily backups on Google Drive
# =============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VW_DATA="/backup-source/11-security/vaultwarden_data"
DB_FILE="${VW_DATA}/db.sqlite3"
LOCAL_BACKUP_DIR="/app/cache/vw-gdrive-staging"
GDRIVE_DEST="gdrive-backups:vaultwarden-backups"

echo "[$(date)] === Starting Vaultwarden Google Drive backup ==="

# Check source exists
if [ ! -f "$DB_FILE" ]; then
    echo "[$(date)] ERROR: Vaultwarden database not found at $DB_FILE"
    exit 1
fi

# Find the latest backup in the source directory
LATEST_BACKUP=$(ls -t /backup-source/11-security/vaultwarden_data/backups/db_*.sqlite3 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "[$(date)] ERROR: No Vaultwarden database backup found in /backup-source/11-security/vaultwarden_data/backups/"
    exit 1
fi

# Verify the file is not empty
if [ ! -s "$LATEST_BACKUP" ]; then
    echo "[$(date)] ERROR: Latest backup file is empty: $LATEST_BACKUP"
    exit 1
fi

echo "[$(date)] Found latest backup: $LATEST_BACKUP"

# Create local staging dir (in Kopia cache volume)
mkdir -p "$LOCAL_BACKUP_DIR"

# Extract timestamp from the backup file name (db_YYYYMMDD_HHMMSS.sqlite3)
FILE_NAME=$(basename "$LATEST_BACKUP")
TIMESTAMP_PART=$(echo "$FILE_NAME" | cut -d'_' -f2,3 | cut -d'.' -f1)

STAGED_DB="${LOCAL_BACKUP_DIR}/db_${TIMESTAMP_PART}.sqlite3"
cp "$LATEST_BACKUP" "$STAGED_DB"
echo "[$(date)] SQLite backup copied to staging: $STAGED_DB"

# Copy corresponding attachments if they exist
HOST_ATTACHMENTS="/backup-source/11-security/vaultwarden_data/backups/attachments_${TIMESTAMP_PART}"
if [ -d "$HOST_ATTACHMENTS" ]; then
    STAGED_ATTACHMENTS="${LOCAL_BACKUP_DIR}/attachments_${TIMESTAMP_PART}"
    cp -r "$HOST_ATTACHMENTS" "$STAGED_ATTACHMENTS"
    echo "[$(date)] Attachments copied to staging"
fi

# Upload to Google Drive
echo "[$(date)] Uploading to Google Drive..."
rclone copy "$LOCAL_BACKUP_DIR" "$GDRIVE_DEST" \
    --include "db_${TIMESTAMP_PART}.sqlite3" \
    --include "attachments_${TIMESTAMP_PART}/**" \
    --transfers 4 \
    --log-level INFO

if [ $? -eq 0 ]; then
    echo "[$(date)] SUCCESS: Uploaded to ${GDRIVE_DEST}"
else
    echo "[$(date)] ERROR: Google Drive upload failed"
    exit 1
fi

# Clean up local staging (keep only last 7)
ls -t "${LOCAL_BACKUP_DIR}"/db_*.sqlite3 2>/dev/null | tail -n +8 | xargs -r rm
ls -dt "${LOCAL_BACKUP_DIR}"/attachments_* 2>/dev/null | tail -n +8 | xargs -r rm -rf

# Enforce retention on Google Drive: keep last 30 backups
REMOTE_COUNT=$(rclone ls "$GDRIVE_DEST" --include "db_*.sqlite3" 2>/dev/null | wc -l)
if [ "$REMOTE_COUNT" -gt 30 ]; then
    echo "[$(date)] Pruning old Google Drive backups (keeping 30)..."
    rclone ls "$GDRIVE_DEST" --include "db_*.sqlite3" 2>/dev/null \
        | sort \
        | head -n $((REMOTE_COUNT - 30)) \
        | awk '{print $2}' \
        | while read -r f; do
            rclone delete "${GDRIVE_DEST}/${f}"
        done
fi

echo "[$(date)] === Vaultwarden Google Drive backup complete ==="
