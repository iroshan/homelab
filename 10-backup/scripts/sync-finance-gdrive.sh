#!/bin/sh
# =============================================================================
# Actual Budget Exports -> Google Drive Sync (for Consumer Gemini / Gems)
# =============================================================================
# Runs inside the Kopia container (which has rclone + gdrive-backups configured)
# Syncs read-only finance-summary.md and transactions-90d.csv to Google Drive.
# =============================================================================

SRC_DIR="/backup-source/04-productivity/finance_exports"
GDRIVE_DEST="gdrive-backups:ActualBudget-Gemini"

echo "[$(date)] === Syncing Actual Budget exports to Google Drive ==="

if [ ! -f "${SRC_DIR}/finance-summary.md" ]; then
    echo "[$(date)] WARN: ${SRC_DIR}/finance-summary.md not found yet, skipping."
    exit 0
fi

rclone copy "$SRC_DIR" "$GDRIVE_DEST" \
    --include "finance-summary.md" \
    --include "transactions-90d.csv" \
    --log-level INFO

if [ $? -eq 0 ]; then
    echo "[$(date)] SUCCESS: Synced exports to ${GDRIVE_DEST}"
else
    echo "[$(date)] ERROR: Google Drive sync failed"
    exit 1
fi
