#!/usr/bin/env bash
# =============================================================================
# Install / Restore the Hourly Homelab Git Backup Systemd Timer
# =============================================================================
# Usage: sudo ./scripts/install-git-timer.sh [username]
# =============================================================================

set -euo pipefail

RUN_USER="${1:-${SUDO_USER:-ubuntu}}"
HOMELAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
    echo "Please run with sudo: sudo $0 ${RUN_USER}" >&2
    exit 1
fi

cat > /etc/systemd/system/homelab-git-backup.service <<EOF
[Unit]
Description=Homelab Git Backup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=${RUN_USER}
WorkingDirectory=${HOMELAB_DIR}
ExecStart=${HOMELAB_DIR}/scripts/git-backup.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/homelab-git-backup.timer <<'EOF'
[Unit]
Description=Hourly Git Backup Timer
Requires=homelab-git-backup.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now homelab-git-backup.timer

echo "✅ Installed and started homelab-git-backup.timer (running as ${RUN_USER})."
systemctl list-timers --no-pager homelab-git-backup.timer
