#!/bin/bash
# Setup automated Git backups using systemd timer
# Alternative to cron for systems without crontab

set -euo pipefail

echo "Setting up automated Git backups with systemd..."

# Create systemd service
sudo tee /etc/systemd/system/homelab-git-backup.service > /dev/null <<'EOF'
[Unit]
Description=Homelab Git Backup
After=network.target

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/home/ubuntu/homelab
ExecStart=/home/ubuntu/homelab/scripts/git-backup.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create systemd timer (runs hourly)
sudo tee /etc/systemd/system/homelab-git-backup.timer > /dev/null <<'EOF'
[Unit]
Description=Hourly Git Backup Timer
Requires=homelab-git-backup.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Reload systemd and enable timer
sudo systemctl daemon-reload
sudo systemctl enable homelab-git-backup.timer
sudo systemctl start homelab-git-backup.timer

echo "✅ Systemd timer configured!"
echo ""
echo "Check status:"
echo "  sudo systemctl status homelab-git-backup.timer"
echo ""
echo "Manual run:"
echo "  sudo systemctl start homelab-git-backup.service"
echo ""
echo "View logs:"
echo "  journalctl -u homelab-git-backup.service -f"
