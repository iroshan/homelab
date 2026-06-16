#!/bin/sh
# =============================================================================
# Vaultwarden SQLite Backup Script
# =============================================================================
# Creates a consistent SQLite backup before Kopia snapshots.
# Scheduled via Ofelia at 1:00 AM daily (Kopia runs at 2:00 AM).
# Retains the last 7 daily backups.
# =============================================================================

BACKUP_DIR="/data/backups"
DB_FILE="/data/db.sqlite3"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sqlite3"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "[$(date)] ERROR: Database file not found at $DB_FILE"
    exit 1
fi

# Create consistent SQLite backup using .backup command
# This is safe even while Vaultwarden is running
sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'"

if [ $? -eq 0 ]; then
    echo "[$(date)] SUCCESS: Vaultwarden backup completed: $BACKUP_FILE"
    
    # Also backup attachments and other important files
    if [ -d "/data/attachments" ]; then
        cp -r /data/attachments "${BACKUP_DIR}/attachments_${TIMESTAMP}" 2>/dev/null
        echo "[$(date)] Attachments backed up"
    fi
    
    # Retain only the last 7 database backups
    ls -t "${BACKUP_DIR}"/db_*.sqlite3 2>/dev/null | tail -n +8 | xargs -r rm
    
    # Retain only the last 7 attachment backups
    ls -dt "${BACKUP_DIR}"/attachments_* 2>/dev/null | tail -n +8 | xargs -r rm -rf
    
    echo "[$(date)] Old backups cleaned up (keeping last 7)"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi
