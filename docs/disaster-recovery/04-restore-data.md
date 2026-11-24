# Step 4 — Manual Data Restore Reference

If you used `./scripts/restore-from-kopia.sh` (DR) or `./scripts/migrate-to-new-server.sh` (live move), all data is already restored. Use the commands below only if you need to restore a **single service** manually.

!!! warning "Never restore inside the Kopia container into `/backup-source`"
    Inside the `kopia` container, `/backup-source` is mounted **read-only** (`:ro`). Always run Kopia restores on the **host** using `sudo kopia restore <SNAPSHOT_ROOT_ID> /tmp/kopia-restore` and copy from `/tmp/kopia-restore` while the target container is stopped.

---

## 4.1 Restore Vaultwarden (Direct from Google Drive — No Kopia Needed)

Vaultwarden uploads a clean, unencrypted-by-Kopia SQLite backup (`db_YYYYMMDD_010000.sqlite3`) directly to Google Drive every night at `01:15` (the passwords inside the DB are still end-to-end encrypted by your Bitwarden master key):

```bash
# List latest backups on Google Drive
rclone ls gdrive-backups:vaultwarden-backups --include "db_*.sqlite3" | sort -k2 | tail -5

# Download the newest one
LATEST=$(rclone ls gdrive-backups:vaultwarden-backups --include "db_*.sqlite3" | sort -k2 | tail -1 | awk '{print $2}')
mkdir -p /tmp/vw-restore
rclone copy "gdrive-backups:vaultwarden-backups/${LATEST}" /tmp/vw-restore/

# Swap into place cleanly
docker stop vaultwarden
sudo cp "/tmp/vw-restore/${LATEST}" ~/homelab/11-security/vaultwarden_data/db.sqlite3
sudo rm -f ~/homelab/11-security/vaultwarden_data/db.sqlite3-wal ~/homelab/11-security/vaultwarden_data/db.sqlite3-shm
sudo chown 1000:1000 ~/homelab/11-security/vaultwarden_data/db.sqlite3
docker start vaultwarden
rm -rf /tmp/vw-restore
```

---

## 4.2 Restore Affine PostgreSQL from Daily `pg_dump`

Every night at `01:05`, `affine_postgres` writes a guaranteed-consistent SQL dump to `05-pkm/postgres_backups/latest.sql.gz` (backed up by Kopia).

To restore cleanly from a dump (works even across ARM64 ↔ x86_64!):

```bash
cd ~/homelab/05-pkm
docker compose down

# Start with a fresh empty Postgres data directory
sudo rm -rf ./postgres_data && mkdir -p ./postgres_data
docker compose up -d postgres

# Wait until healthy
until [ "$(docker inspect -f '{{.State.Health.Status}}' affine_postgres)" = "healthy" ]; do sleep 2; done

# Import the dump
set -a && source .env && set +a
gunzip -c ./postgres_backups/latest.sql.gz | docker exec -i affine_postgres psql -U "${POSTGRES_USER:-affine}" -d "${POSTGRES_DB:-affine}"

# Start Affine + Redis
docker compose up -d
```

---

## 4.3 Restore Any Single Directory from Kopia

```bash
# 1. List snapshots on the host (as root)
sudo kopia snapshot list --all | tail -10

# 2. Restore a specific directory using <ROOT_ID>/<relative-path>
#    Example: restore Actual Budget data
docker stop actual-budget actual-ai truelayer2actual actual-finance-bot
sudo kopia restore <ROOT_ID>/04-productivity/actual_data /tmp/restore-actual
sudo rsync -aHAX --numeric-ids --delete /tmp/restore-actual/ ~/homelab/04-productivity/actual_data/
sudo rm -rf /tmp/restore-actual
docker start actual-budget actual-ai truelayer2actual actual-finance-bot
```

Key data directory paths inside `/home/ubuntu/homelab`:

| Service | Data Path(s) | Expected UID:GID |
|---|---|---|
| Nginx Proxy Manager | `02-network-access/npm/data`, `02-network-access/npm/letsencrypt` | `0:0` |
| Portainer | `02-network-access/portainer_data` | `1001:1001` (or host user) |
| Uptime Kuma | `03-monitoring/uptime_kuma_data` | `1001:1001` (or host user) |
| Memos | `04-productivity/memos_data` | `1000:1000` |
| Actual Budget + Finance | `04-productivity/actual_data`, `truelayer_data`, `finance_bot_data`, `finance_exports` | `1001:1001` |
| Affine + Postgres + Redis | `05-pkm/affine_data`, `postgres_data`, `postgres_backups`, `redis_data` | `0:0` / `70:0` / `999:0` |
| Media stack | `06-media/data/{aiostreams,aiometadata,nzbdavex,redis}` | `1001` / `1000` / `999` |
| Vaultwarden | `11-security/vaultwarden_data` | `1000:1000` |

---

## 4.4 Reconnect Kopia Container for Future Automated Backups

```bash
# 1. Make sure rclone.conf is in place
ls -la ~/homelab/10-backup/rclone-config/rclone.conf

# 2. Connect the Kopia container to Google Drive
docker exec -e KOPIA_PASSWORD="<YOUR_KOPIA_PASSWORD>" kopia \
  kopia repository connect rclone \
  --remote-path=gdrive-backups:homelab-backups

# 3. Verify Ofelia has all 5 scheduled jobs registered
docker logs backup-scheduler --tail 25
```

Expected Ofelia jobs:
- `vw-backup` (`01:00` daily)
- `affine-pg-backup` (`01:05` daily)
- `vw-gdrive-backup` (`01:15` daily)
- `backup-daily` (`02:00` daily — runs `backup.sh` with Telegram + Ntfy alerts)
- `finance-gdrive-sync` (every 6h at `:15`)

**Next → [Step 5: Verify Everything](./05-verify.md)**
