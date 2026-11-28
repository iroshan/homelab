#!/usr/bin/env bash
# =============================================================================
# Kopia Daily Backup Script with Telegram & Ntfy Notifications
# =============================================================================
# Runs inside the Kopia container via Ofelia at 2:00 AM daily.
# Uses a single Kopia invocation (avoids slow extra Google Drive connections)
# and sends Telegram + Ntfy alerts on success or failure.
# =============================================================================

set -euo pipefail

BACKUP_SOURCE="/backup-source"
BACKUP_DESC="${1:-Automated daily backup}"
LOG_DIR="/app/logs"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "${LOG_DIR}"

send_notification() {
    local status="$1"
    local message="$2"

    # Send to Telegram
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -sS --max-time 15 -X POST \
            "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${message}" \
            -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi

    # Send to Ntfy
    if [ -n "${NTFY_URL:-}" ] && [ -n "${NTFY_TOPIC:-}" ]; then
        local priority="high"
        local tags="x"
        if [ "${status}" = "SUCCESS" ]; then
            priority="default"
            tags="white_check_mark"
        fi
        curl -sS --max-time 15 -X POST "${NTFY_URL}/${NTFY_TOPIC}" \
            -H "Title: Homelab Backup ${status}" \
            -H "Priority: ${priority}" \
            -H "Tags: ${tags}" \
            -d "${message}" > /dev/null 2>&1 || true
    fi
}

echo "========================================" | tee -a "${LOG_FILE}"
echo "Homelab Backup Started: $(date)" | tee -a "${LOG_FILE}"
echo "========================================" | tee -a "${LOG_FILE}"

START_TIME=$(date +%s)

if kopia snapshot create "${BACKUP_SOURCE}" \
    --description "${BACKUP_DESC}" \
    --progress-update-interval=30s 2>&1 | tee -a "${LOG_FILE}"; then

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    DURATION_MIN=$((DURATION / 60))
    DURATION_SEC=$((DURATION % 60))

    SNAP_LINE=$(grep "Created snapshot" "${LOG_FILE}" | tail -n 1 || true)
    SNAP_ID=$(echo "${SNAP_LINE}" | sed -n 's/.*ID \([a-f0-9]*\).*/\1/p')
    SNAP_ID="${SNAP_ID:-unknown}"

    SUCCESS_MSG="✅ *Homelab Backup Completed*

- Snapshot ID: \`${SNAP_ID}\`
- Duration: ${DURATION_MIN}m ${DURATION_SEC}s
- Time: $(date '+%Y-%m-%d %H:%M:%S')"

    echo "Backup completed successfully (${DURATION_MIN}m ${DURATION_SEC}s)." | tee -a "${LOG_FILE}"
    send_notification "SUCCESS" "${SUCCESS_MSG}"
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    LAST_ERR=$(tail -n 5 "${LOG_FILE}" | tr '`' "'" || true)

    ERROR_MSG="❌ *Homelab Backup FAILED*

- Time: $(date '+%Y-%m-%d %H:%M:%S')
- Duration: ${DURATION}s
- Check: \`docker logs backup-scheduler --tail 50\`"

    echo "Backup FAILED after ${DURATION}s!" | tee -a "${LOG_FILE}"
    send_notification "FAILED" "${ERROR_MSG}"
    exit 1
fi

# Keep only the 14 most recent backup-*.log files
ls -t "${LOG_DIR}"/backup-*.log 2>/dev/null | tail -n +15 | xargs -r rm -f
