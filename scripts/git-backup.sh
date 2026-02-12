#!/bin/bash
# Automated Git Backup Script
# Commits and pushes homelab configuration changes to GitHub

set -euo pipefail

# Configuration
REPO_DIR="/home/ubuntu/homelab"
COMMIT_MSG_PREFIX="[AUTO]"
LOG_FILE="/home/ubuntu/homelab/git-backup.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd "$REPO_DIR" || {
    log "❌ ERROR: Cannot access repository directory"
    exit 1
}

# Check if there are changes
if [[ -z $(git status -s) ]]; then
    log "✓ No changes to commit"
    exit 0
fi

# Get commit message based on changes
CHANGED_FILES=$(git status -s | wc -l)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log "📝 Detected $CHANGED_FILES changed file(s)"

# Show what changed (for logs)
git status -s | head -10 | while read line; do
    log "  $line"
done

# Stage all changes
git add -A

# Commit with auto-generated message
COMMIT_MSG="${COMMIT_MSG_PREFIX} Backup - ${CHANGED_FILES} files changed - ${TIMESTAMP}"
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1

# Push to remote
if git push origin main >> "$LOG_FILE" 2>&1; then
    log "✅ Backup completed: ${CHANGED_FILES} files committed and pushed"
    exit 0
else
    log "❌ ERROR: Failed to push to remote"
    exit 1
fi
