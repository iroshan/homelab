#!/bin/bash
# =============================================================================
# Homelab GitHub Auto-Push Script
# =============================================================================
# Purpose: Commit and push infra configs to GitHub daily for disaster recovery
# Sensitive data (.env, data dirs, certs, tokens) is excluded by .gitignore
# Schedule: Daily at 05:00 AM via Ofelia (host-exec job)
# =============================================================================

set -euo pipefail

PUSH_DIR="/home/ubuntu/homelab"
LOG_TAG="[git-push]"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "${LOG_TAG} === Starting GitHub push at ${DATE} ==="

cd "${PUSH_DIR}"

# Safety check: ensure we're in the right repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "${LOG_TAG} ERROR: Not a git repository: ${PUSH_DIR}"
    exit 1
fi

# Check remote is reachable
if ! git ls-remote --exit-code origin >/dev/null 2>&1; then
    echo "${LOG_TAG} ERROR: Cannot reach GitHub remote. Skipping."
    exit 1
fi

# Stage all tracked/untracked non-ignored files
git add -A

# Check if there's anything to commit
if git diff --cached --quiet; then
    echo "${LOG_TAG} Nothing to commit — repo is up to date."
    exit 0
fi

# Count changed files for the commit message
CHANGED=$(git diff --cached --name-only | wc -l)

# Commit with a descriptive automated message
git commit -m "[AUTO] Daily backup - ${CHANGED} file(s) changed - $(date '+%Y-%m-%d %H:%M:%S')"

# Push to GitHub
git push origin main

echo "${LOG_TAG} === Successfully pushed ${CHANGED} file(s) to GitHub at $(date '+%Y-%m-%d %H:%M:%S') ==="
