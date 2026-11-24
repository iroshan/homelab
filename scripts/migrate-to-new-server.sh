#!/usr/bin/env bash
# =============================================================================
# Planned Live Migration: Current Server -> New Server (No Kopia Needed!)
# =============================================================================
# Run this on the OLD server while it is still online.
# It creates a fresh Postgres dump, stops containers cleanly so every database
# flushes to disk, and rsyncs ~/homelab (preserving exact numeric UIDs/GIDs)
# directly to the new server.
#
# Usage:
#   ./scripts/migrate-to-new-server.sh --dry-run ubuntu@<NEW_IP>
#   ./scripts/migrate-to-new-server.sh ubuntu@<NEW_IP>
#
# Prerequisites on the NEW server before running this:
#   1. Ubuntu 24.04 with Docker + Tailscale installed and 'sudo tailscale up' done
#   2. Passwordless SSH from this server to ubuntu@<NEW_IP> (or SSH key/agent)
#   3. Target user on new server has passwordless sudo (needed for numeric UID rsync)
# =============================================================================

set -euo pipefail

HOMELAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="false"
TARGET=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN="true"; shift ;;
        -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
        *) TARGET="$1"; shift ;;
    esac
done

if [ -z "$TARGET" ]; then
    echo "Usage: $0 [--dry-run] user@NEW_SERVER_IP" >&2
    exit 1
fi

echo "============================================================"
echo " Homelab Live Server Migration"
echo " Source: ${HOMELAB_DIR}"
echo " Target: ${TARGET}:/home/ubuntu/homelab/"
echo " Mode:   $([ "$DRY_RUN" = "true" ] && echo "DRY RUN (no changes)" || echo "LIVE MIGRATION")"
echo "============================================================"

# 1. Verify SSH + sudo on target
echo ""
echo "1) Checking SSH and sudo on ${TARGET}..."
ssh -o BatchMode=yes -o ConnectTimeout=10 "$TARGET" "sudo -n true && mkdir -p /home/ubuntu/homelab" || {
    echo "❌ Cannot reach ${TARGET} with SSH + passwordless sudo."
    echo "   Set up SSH key auth to ${TARGET} first, then re-run."
    exit 1
}
echo "✅ SSH + sudo verified."

# 2. Take fresh DB backups while containers are still running
echo ""
echo "2) Taking fresh consistent database backups..."
if docker ps --format '{{.Names}}' | grep -qx "affine_postgres"; then
    docker exec affine_postgres /bin/sh /usr/local/bin/backup-postgres.sh
fi
if docker ps --format '{{.Names}}' | grep -qx "sqlite-helper"; then
    docker exec sqlite-helper /bin/sh /data/backup-vaultwarden.sh
fi

RSYNC_OPTS=(
    -aHAX
    --numeric-ids
    --delete
    --info=progress2
    --rsync-path="sudo rsync"
    --exclude='.git'
    --exclude='10-backup/kopia-cache'
    --exclude='10-backup/kopia-logs'
    --exclude='git-backup.log'
    --exclude='*.bak'
    --exclude='*.codex-before-*.bak'
)

if [ "$DRY_RUN" = "true" ]; then
    echo ""
    echo "3) [DRY RUN] Previewing rsync transfer (containers left running)..."
    sudo rsync "${RSYNC_OPTS[@]}" --dry-run "${HOMELAB_DIR}/" "${TARGET}:/home/ubuntu/homelab/"
    echo ""
    echo "✅ Dry run complete. Re-run without --dry-run when ready to cut over."
    exit 0
fi

# 3. Stop all stacks cleanly on the old server so DBs flush & tunnel/bots don't collide
echo ""
echo "⚠️  About to stop all containers on THIS server, rsync data to ${TARGET},"
echo "   and leave this server's containers stopped (so Cloudflare Tunnel & Telegram"
echo "   bots don't run on two servers at once)."
read -rp "Proceed with cutover? (type YES to continue): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 0
fi

"${HOMELAB_DIR}/scripts/deploy-all.sh" --stop-all

# 4. Sync everything cleanly with numeric UIDs/GIDs preserved
echo ""
echo "3) Syncing ~/homelab to ${TARGET} (preserving permissions & UIDs)..."
sudo rsync "${RSYNC_OPTS[@]}" "${HOMELAB_DIR}/" "${TARGET}:/home/ubuntu/homelab/"

echo ""
echo "============================================================"
echo "✅ Transfer complete! Old server containers remain STOPPED."
echo "============================================================"
echo ""
echo "Now SSH into ${TARGET} and run:"
echo ""
echo "  cd ~/homelab"
echo "  # 1. Reconnect git repo (keeps your synced data & .env files untouched)"
echo "  git init && git remote add origin git@github.com:iroshan/homelab.git"
echo "  git fetch origin && git reset --mixed origin/main"
echo ""
echo "  # 2. Update TAILSCALE_IP to the new server's Tailscale address"
echo "  ./scripts/set-tailscale-ip.sh"
echo ""
echo "  # 3. Create Docker networks and start all stacks"
echo "  ./scripts/deploy-all.sh"
echo ""
echo "  # 4. Re-enable hourly git config backup timer"
echo "  sudo ./scripts/install-git-timer.sh"
echo ""
echo "Rollback: If anything goes wrong, stop the new server and run"
echo "  ./scripts/deploy-all.sh  on THIS old server to bring it straight back."
