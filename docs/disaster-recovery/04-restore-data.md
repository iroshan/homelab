# Step 4 — Restore Application Data

Restore actual data (databases, files, configuration) from Kopia snapshots.

!!! info "What needs restoring"
    The Kopia backup contains a full snapshot of `/home/ubuntu/homelab` including all data directories. The stacks from Step 3 are running but mostly empty — this step fills them with your actual data.

---

## 4.0 Connect Kopia Container to Repository

The Kopia container needs to be connected to Google Drive before it can restore:

```bash
docker exec kopia kopia repository connect rclone \
  --remote-path=gdrive-backups:homelab-backups \
  --password=<YOUR_KOPIA_PASSWORD>
```

Verify:

```bash
docker exec kopia kopia snapshot list
```

---

## 4.1 Restore Vaultwarden (Password Manager)

!!! danger "Restore Vaultwarden First"
    Vaultwarden contains your other passwords. Restore it before anything else so you can access those credentials.

Stop the container before restoring:

```bash
docker stop vaultwarden
```

Restore the data directory from Kopia:

```bash
docker exec kopia kopia snapshot restore latest \
  --path=/backup-source/11-security/vaultwarden_data \
  /backup-source/11-security/vaultwarden_data
```

Or use the Google Drive direct backup (also maintained by the vw-gdrive-backup job):

```bash
# Alternative: restore from Google Drive rclone backup
rclone ls gdrive-backups:vaultwarden-backups | sort | tail -5

# Download the latest backup
LATEST=$(rclone ls gdrive-backups:vaultwarden-backups --include "db_*.sqlite3" | sort | tail -1 | awk '{print $2}')
rclone copy "gdrive-backups:vaultwarden-backups/${LATEST}" /tmp/vw-restore/

# Stop container, replace database, restart
docker stop vaultwarden
cp /tmp/vw-restore/${LATEST} ~/homelab/11-security/vaultwarden_data/db.sqlite3
chown 1000:1000 ~/homelab/11-security/vaultwarden_data/db.sqlite3
docker start vaultwarden
```

Verify Vaultwarden is running:

```bash
sleep 10
curl -s https://vault.iroshan.uk/api/version
# Expected: "1.36.0" (or current version)
```

---

## 4.2 Restore Affine PKM (Postgres Database)

Affine uses PostgreSQL for storage. Restore the database:

```bash
# Stop Affine first
docker stop affine

# Restore Postgres data directory from Kopia
docker exec kopia kopia snapshot restore latest \
  --path=/backup-source/05-pkm/postgres_data \
  /backup-source/05-pkm/postgres_data

# Restart
docker start affine
sleep 30
docker logs affine 2>&1 | tail -10
```

Alternative: If data directory restore fails, use pg_dump/pg_restore if you have a SQL dump in your backup.

---

## 4.3 Restore Memos (Notes)

Memos stores data in a SQLite file inside its data volume:

```bash
docker stop memos

docker exec kopia kopia snapshot restore latest \
  --path=/backup-source/04-productivity/memos_data \
  /backup-source/04-productivity/memos_data

docker start memos
```

---

## 4.4 Restore Nginx Proxy Manager Configuration

NPM stores all proxy rules, SSL certs, and settings in its data directory:

```bash
docker stop nginx_proxy_manager

docker exec kopia kopia snapshot restore latest \
  --path=/backup-source/02-network-access/npm_data \
  /backup-source/02-network-access/npm_data

docker start nginx_proxy_manager
sleep 20
```

After restart, all proxy hosts, SSL certificates, and access rules should be restored automatically.

---

## 4.5 Restore Workout Tracker Data

```bash
docker stop workout-tracker

docker exec kopia kopia snapshot restore latest \
  --path=/backup-source/workout-tracker \
  /backup-source/workout-tracker

docker start workout-tracker
```

---

## 4.6 Reconnect Backup System to Google Drive

The Kopia container needs its rclone config to resume automated backups:

```bash
# Verify rclone config is in place
ls ~/homelab/10-backup/rclone-config/rclone.conf

# Test rclone from within Kopia container
docker exec kopia rclone ls gdrive-backups:homelab-backups --max-depth 1
```

Reconnect Kopia to the repository:

```bash
docker exec -e KOPIA_PASSWORD="<YOUR_KOPIA_PASSWORD>" kopia \
  kopia repository connect rclone \
  --remote-path=gdrive-backups:homelab-backups
```

Run a test backup:

```bash
docker exec kopia kopia snapshot create /backup-source --description 'Post-restore test backup'
```

---

## 4.7 Restore Systemd Git Push Timer

The hourly git push timer runs as a systemd unit. Restore it:

```bash
# Create the systemd service
sudo tee /etc/systemd/system/homelab-git-backup.service << 'EOF'
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

# Create the timer
sudo tee /etc/systemd/system/homelab-git-backup.timer << 'EOF'
[Unit]
Description=Hourly Git Backup Timer
Requires=homelab-git-backup.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable homelab-git-backup.timer
sudo systemctl start homelab-git-backup.timer

# Verify
systemctl status homelab-git-backup.timer
```

---

## Checklist

- [ ] Vaultwarden restored — can log in at `vault.iroshan.uk`
- [ ] Affine restored — notes and workspaces visible
- [ ] Memos restored — notes visible
- [ ] NPM restored — proxy hosts and SSL certs working
- [ ] Kopia reconnected to Google Drive and test backup succeeded
- [ ] Git push timer running (`systemctl status homelab-git-backup.timer`)

---

**Next → [Verify everything](./05-verify.md)**
