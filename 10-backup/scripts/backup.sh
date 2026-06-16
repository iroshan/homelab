#!/bin/bash
# Kopia Backup Script with Notifications
# Runs automated backup and sends notifications via Telegram and Ntfy

set -euo pipefail

# Source environment variables
if [ -f /app/.env ]; then
    export $(cat /app/.env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_SOURCE="/backup-source"
EXCLUDE_FILE="/app/scripts/backup-excludes.txt"
LOG_FILE="/app/logs/backup-$(date +%Y%m%d-%H%M%S).log"

# Notification function
send_notification() {
    local status=$1
    local message=$2
    
    # Send to Telegram
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=${message}" \
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
        curl -s -X POST "${NTFY_URL}/${NTFY_TOPIC}" \
            -H "Title: Homelab Backup ${status}" \
            -H "Priority: ${priority}" \
            -H "Tags: ${tags}" \
            -d "${message}" > /dev/null 2>&1 || true
    fi
}

# Start backup
echo "========================================" | tee -a "${LOG_FILE}"
echo "Homelab Backup Started" | tee -a "${LOG_FILE}"
echo "Time: $(date)" | tee -a "${LOG_FILE}"
echo "========================================" | tee -a "${LOG_FILE}"

START_TIME=$(date +%s)

# Run Kopia snapshot
echo "Creating snapshot..." | tee -a "${LOG_FILE}"

if kopia snapshot create "${BACKUP_SOURCE}" \
    --file-ignore="${EXCLUDE_FILE}" \
    --parallel=8 \
    --progress-update-interval=30s 2>&1 | tee -a "${LOG_FILE}"; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    DURATION_MIN=$((DURATION / 60))
    DURATION_SEC=$((DURATION % 60))
    
    # Get snapshot info
    SNAPSHOT_INFO=$(kopia snapshot list --json | tail -n 1)
    
    # Extract stats (if available)
    SIZE=$(echo "${SNAPSHOT_INFO}" | grep -o '"totalSize":[0-9]*' | cut -d':' -f2 || echo "N/A")
    FILES=$(echo "${SNAPSHOT_INFO}" | grep -o '"fileCount":[0-9]*' | cut -d':' -f2 || echo "N/A")
    
    # Format size
    if [ "${SIZE}" != "N/A" ]; then
        SIZE_GB=$(awk "BEGIN {printf \"%.2f\", ${SIZE}/1024/1024/1024}")
        SIZE_DISPLAY="${SIZE_GB} GB"
    else
        SIZE_DISPLAY="N/A"
    fi
    
    SUCCESS_MSG="✅ *Homelab Backup Completed*

📊 *Stats:*
- Size: ${SIZE_DISPLAY}
- Files: ${FILES}
- Duration: ${DURATION_MIN}m ${DURATION_SEC}s
- Time: $(date '+%Y-%m-%d %H:%M:%S')

🎉 All data backed up successfully!"
    
    echo "Backup completed successfully!" | tee -a "${LOG_FILE}"
    send_notification "SUCCESS" "${SUCCESS_MSG}"
    
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    ERROR_MSG="❌ *Homelab Backup FAILED*

🚨 *Error Details:*
- Time: $(date '+%Y-%m-%d %H:%M:%S')
- Duration: ${DURATION}s
- Check logs: docker logs kopia

🔧 Please investigate immediately!"
    
    echo "Backup failed!" | tee -a "${LOG_FILE}"
    send_notification "FAILED" "${ERROR_MSG}"
    exit 1
fi

# Run maintenance (every backup)
echo "Running repository maintenance..." | tee -a "${LOG_FILE}"
kopia maintenance run --safety=none 2>&1 | tee -a "${LOG_FILE}" || true

echo "Backup process completed" | tee -a "${LOG_FILE}"
