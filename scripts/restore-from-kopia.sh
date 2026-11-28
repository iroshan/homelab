#!/usr/bin/env bash
# =============================================================================
# Guided Disaster Recovery Restore from Google Drive (Kopia)
# =============================================================================
# Run this on a FRESH server after cloning git@github.com:iroshan/homelab.git
# and configuring rclone (`gdrive-backups` remote).
#
# You do NOT need to know Kopia commands — this script walks through:
#   1. Checking rclone + Kopia + Docker are installed
#   2. Connecting Kopia to Google Drive (prompts for KOPIA_PASSWORD securely)
#   3. Listing snapshots and restoring the chosen one to /tmp/kopia-restore
#   4. Copying all *.env files and app data dirs with exact numeric UIDs/GIDs
#   5. Copying rclone.conf into 10-backup/rclone-config/
#   6. Auto-setting TAILSCALE_IP for the new server
#   7. Creating Docker networks & deploying all stacks
#   8. Restoring Affine PostgreSQL cleanly from the daily pg_dump (optional)
#   9. Re-enabling the hourly git backup timer
#
# Usage:
#   ./scripts/restore-from-kopia.sh
#   ./scripts/restore-from-kopia.sh --snapshot <SNAPSHOT_ID>
#   ./scripts/restore-from-kopia.sh --restore-only   # Stop before docker compose up
# =============================================================================

set -euo pipefail

HOMELAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RCLONE_REMOTE="gdrive-backups:homelab-backups"
RESTORE_TMP="/tmp/kopia-restore"
SNAPSHOT_ID=""
RESTORE_ONLY="false"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --snapshot)     SNAPSHOT_ID="$2"; shift 2 ;;
        --restore-only) RESTORE_ONLY="true"; shift ;;
        -h|--help)      sed -n '2,23p' "$0"; exit 0 ;;
        *)              echo "❌ Unknown option: $1" >&2; exit 1 ;;
    esac
done

echo "============================================================"
echo " Homelab Guided Disaster Recovery (from Google Drive)"
echo " Target directory: ${HOMELAB_DIR}"
echo "============================================================"

# 1. Check prerequisites
for cmd in rclone kopia docker rsync sudo; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ Missing required command: $cmd"
        echo "   Follow docs/disaster-recovery/01-provision-server.md & 02-restore-secrets.md first."
        exit 1
    fi
done

RCLONE_CONF="${HOME}/.config/rclone/rclone.conf"
if [ ! -f "$RCLONE_CONF" ]; then
    echo "❌ rclone config not found at ${RCLONE_CONF}."
    echo "   Run 'rclone config' (or copy rclone.conf from your laptop) for remote 'gdrive-backups' first."
    exit 1
fi

echo ""
echo "1) Verifying Google Drive access via rclone..."
rclone lsd gdrive-backups: >/dev/null 2>&1 || {
    echo "❌ rclone could not reach 'gdrive-backups:'. Check ${RCLONE_CONF}."
    exit 1
}
echo "✅ Google Drive remote 'gdrive-backups' is reachable."

# 2. Connect Kopia (as root so restored files preserve original UIDs/GIDs like 70, 999, 1000, 1001)
echo ""
echo "2) Connecting Kopia to ${RCLONE_REMOTE}..."
if [ -z "${KOPIA_PASSWORD:-}" ]; then
    read -rsp "Enter your KOPIA_PASSWORD (input hidden): " KOPIA_PASSWORD
    echo ""
fi

# Ensure root has the same rclone.conf so `sudo kopia` can talk to Google Drive
sudo mkdir -p /root/.config/rclone
sudo cp "$RCLONE_CONF" /root/.config/rclone/rclone.conf
sudo chmod 600 /root/.config/rclone/rclone.conf

if ! sudo KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia repository status >/dev/null 2>&1; then
    echo "   Connecting to repository (Google Drive connection may take 30-90 seconds)..."
    sudo KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia repository connect rclone \
        --remote-path="${RCLONE_REMOTE}"
fi
echo "✅ Kopia connected."

# 3. Pick snapshot
if [ -z "$SNAPSHOT_ID" ]; then
    echo ""
    echo "3) Fetching recent snapshots from Google Drive (may take 30-60 seconds)..."
    sudo KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia snapshot list --all | tail -n 15
    echo ""
    read -rp "Paste the snapshot ID to restore (the k... or root ID, or press Enter for LATEST): " USER_SNAP
    if [ -z "$USER_SNAP" ]; then
        SNAPSHOT_ID="$(sudo KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia snapshot list --all --json \
            | sed -n 's/.*"rootEntry":{"obj":"\([^"]*\)".*/\1/p' | tail -n 1)"
        if [ -z "$SNAPSHOT_ID" ]; then
            echo "❌ Could not auto-detect latest snapshot ID. Re-run with --snapshot <ID>."
            exit 1
        fi
        echo "   Using latest snapshot root: ${SNAPSHOT_ID}"
    else
        SNAPSHOT_ID="$USER_SNAP"
    fi
fi

# 4. Restore snapshot to staging dir as root (preserves numeric UIDs/GIDs)
echo ""
echo "4) Restoring snapshot ${SNAPSHOT_ID} to ${RESTORE_TMP}..."
echo "   (This downloads ~770 MB from Google Drive and usually takes 2-5 minutes.)"
sudo rm -rf "${RESTORE_TMP}"
sudo mkdir -p "${RESTORE_TMP}"
sudo KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia restore "${SNAPSHOT_ID}" "${RESTORE_TMP}"
echo "✅ Snapshot restored to ${RESTORE_TMP}."

# 5. Copy all .env files into ~/homelab
echo ""
echo "5) Restoring all *.env secret files..."
while IFS= read -r -d '' env_file; do
    rel="${env_file#${RESTORE_TMP}/}"
    dest="${HOMELAB_DIR}/${rel}"
    sudo mkdir -p "$(dirname "$dest")"
    sudo cp -a "$env_file" "$dest"
    sudo chown "$(id -u):$(id -g)" "$dest"
    chmod 600 "$dest"
    echo "   ✅ ${rel}"
done < <(sudo find "${RESTORE_TMP}" -maxdepth 3 \( -name ".env" -o -name "*.env" \) -type f -print0)

# 6. Copy all application data directories (preserving exact numeric UIDs/GIDs!)
echo ""
echo "6) Restoring application data directories (preserving container UIDs)..."
DATA_DIRS=(
    "02-network-access/npm/data"
    "02-network-access/npm/letsencrypt"
    "02-network-access/portainer_data"
    "03-monitoring/uptime_kuma_data"
    "04-productivity/memos_data"
    "04-productivity/actual_data"
    "04-productivity/truelayer_data"
    "04-productivity/finance_bot_data"
    "04-productivity/finance_exports"
    "05-pkm/affine_data"
    "05-pkm/postgres_data"
    "05-pkm/postgres_backups"
    "05-pkm/redis_data"
    "06-media/data"
    "11-security/vaultwarden_data"
)

for rel in "${DATA_DIRS[@]}"; do
    src="${RESTORE_TMP}/${rel}"
    dst="${HOMELAB_DIR}/${rel}"
    if sudo test -d "$src"; then
        sudo mkdir -p "$dst"
        sudo rsync -aHAX --numeric-ids --delete "${src}/" "${dst}/"
        echo "   ✅ ${rel}"
    else
        echo "   ⚠️  Not in snapshot (skipped): ${rel}"
    fi
done

# 7. Restore rclone.conf for the Kopia container (excluded from Kopia snapshots)
echo ""
echo "7) Setting up rclone config for the Kopia container..."
mkdir -p "${HOMELAB_DIR}/10-backup/rclone-config"
cp "$RCLONE_CONF" "${HOMELAB_DIR}/10-backup/rclone-config/rclone.conf"
chmod 600 "${HOMELAB_DIR}/10-backup/rclone-config/rclone.conf"
echo "   ✅ 10-backup/rclone-config/rclone.conf"

# 8. Set TAILSCALE_IP to this new server's Tailscale IP
echo ""
echo "8) Updating TAILSCALE_IP for this server..."
"${HOMELAB_DIR}/scripts/set-tailscale-ip.sh"

if [ "$RESTORE_ONLY" = "true" ]; then
    echo ""
    PG_DUMP_FILE="${HOMELAB_DIR}/05-pkm/postgres_backups/latest.sql.gz"
    if [ -s "$PG_DUMP_FILE" ] && gzip -t "$PG_DUMP_FILE" 2>/dev/null; then
        echo "✅ Verified Affine pg_dump backup: ${PG_DUMP_FILE} ($(du -h "$PG_DUMP_FILE" | cut -f1))"
    else
        echo "⚠️  Affine pg_dump not found or invalid at ${PG_DUMP_FILE}"
    fi
    read -rp "Delete temporary restore folder ${RESTORE_TMP} (contains decrypted secrets)? [Y/n]: " CLEAN
    if [[ ! "$CLEAN" =~ ^[Nn]$ ]]; then
        sudo rm -rf "${RESTORE_TMP}"
        echo "✅ Removed ${RESTORE_TMP}."
    fi
    echo "✅ Restore-only complete. Review files in ${HOMELAB_DIR}, then run:"
    echo "   ./scripts/deploy-all.sh"
    exit 0
fi

# 9. Deploy all stacks in order
echo ""
echo "9) Creating Docker networks and starting all stacks..."
"${HOMELAB_DIR}/scripts/deploy-all.sh"

# 10. Verify Affine Postgres & offer clean pg_dump restore if needed
echo ""
echo "10) Checking Affine PostgreSQL health..."
sleep 15
PG_DUMP_FILE="${HOMELAB_DIR}/05-pkm/postgres_backups/latest.sql.gz"
if [ -f "$PG_DUMP_FILE" ]; then
    PG_STATUS="$(docker inspect -f '{{.State.Health.Status}}' affine_postgres 2>/dev/null || echo "unhealthy")"
    if [ "$PG_STATUS" != "healthy" ]; then
        echo "⚠️  affine_postgres is '${PG_STATUS}' (likely hot-copied data dir)."
        echo "   Reinitializing Postgres cleanly from ${PG_DUMP_FILE}..."
        (cd "${HOMELAB_DIR}/05-pkm" && docker compose down)
        sudo rm -rf "${HOMELAB_DIR}/05-pkm/postgres_data"
        mkdir -p "${HOMELAB_DIR}/05-pkm/postgres_data"
        (cd "${HOMELAB_DIR}/05-pkm" && docker compose up -d postgres)
        echo "   Waiting for fresh Postgres to become healthy..."
        for _ in $(seq 1 30); do
            [ "$(docker inspect -f '{{.State.Health.Status}}' affine_postgres 2>/dev/null || true)" = "healthy" ] && break
            sleep 2
        done
        # shellcheck disable=SC1091
        set -a && source "${HOMELAB_DIR}/05-pkm/.env" && set +a
        gunzip -c "$PG_DUMP_FILE" | docker exec -i affine_postgres psql -U "${POSTGRES_USER:-affine}" -d "${POSTGRES_DB:-affine}"
        (cd "${HOMELAB_DIR}/05-pkm" && docker compose up -d)
        echo "✅ Affine PostgreSQL cleanly restored from pg_dump!"
    else
        echo "✅ affine_postgres is healthy."
    fi
fi

# 11. Reconnect Kopia container to Google Drive
echo ""
echo "11) Reconnecting Kopia container to Google Drive..."
docker exec -e KOPIA_PASSWORD="${KOPIA_PASSWORD}" kopia \
    kopia repository connect rclone \
    --remote-path="${RCLONE_REMOTE}" || echo "⚠️  Kopia container already connected or connect manually."

# 12. Install hourly git backup timer
echo ""
echo "12) Installing hourly git backup systemd timer..."
sudo "${HOMELAB_DIR}/scripts/install-git-timer.sh" "$(id -un)"

# 13. Cleanup prompt
echo ""
read -rp "Delete temporary restore folder ${RESTORE_TMP} (contains decrypted secrets)? [Y/n]: " CLEAN
if [[ ! "$CLEAN" =~ ^[Nn]$ ]]; then
    sudo rm -rf "${RESTORE_TMP}"
    echo "✅ Removed ${RESTORE_TMP}."
fi

echo ""
echo "============================================================"
echo "🎉 Recovery Complete!"
echo "============================================================"
echo "Next: check docs/disaster-recovery/05-verify.md to verify all services."
