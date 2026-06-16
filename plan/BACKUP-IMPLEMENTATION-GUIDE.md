# Backup System Implementation Guide

**Status:** ✅ Deployed and Operational  
**Date:** 2026-02-12  
**Stack:** 10-backup

## Overview

Automated backup solution for entire homelab using:
- **Kopia** - Deduplicated, encrypted backups
- **rclone** - Google Drive backend with OAuth
- **ofelia** - Automated scheduling (Docker-based cron)

## Quick Facts

- **Storage:** Google Drive (2TB available via rclone)
- **Retention:** 3 daily, 2 weekly, 1 monthly snapshots
- **Schedule:** Daily at 2:00 AM (automated)
- **Encryption:** AES-256-GCM-HMAC-SHA256
- **Compression:** zstd (high ratio, fast)
- **Deduplication:** Enabled (~70% storage savings)

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Homelab Data (/home/ubuntu/homelab)            │
└─────────────────┬───────────────────────────────┘
                  │
         ┌────────▼────────┐
         │  Kopia Server   │
         │  (Container)    │
         │  - Encrypt      │
         │  - Compress     │
         │  - Deduplicate  │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │     rclone      │
         │  (Google Drive) │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  Google Drive   │
         │    (2TB)        │
         │   Encrypted     │
         └─────────────────┘

  Scheduler (ofelia)
  └─> Triggers daily at 2 AM
```

## Key Implementation Details

### 1. Persistent Configuration

**Critical:** All configs use bind mounts (folders), not Docker volumes:

```yaml
volumes:
  - ./kopia-config:/app/config           # Repository config
  - ./kopia-cache:/app/cache             # Performance cache (10-backup/kopia-cache)
  - ./kopia-logs:/app/logs               # Logs
  - ./rclone-config:/app/rclone          # rclone OAuth (CRITICAL! Aligned to Kopia's path)
```

**Why:** Survives container recreation, easy to backup/restore.

### 2. rclone Google Drive Setup

Since OAuth login requires interactive input and browser authorization, run the configuration command on the host terminal:

```bash
docker run --rm -it -v /home/ubuntu/homelab/10-backup/rclone-config:/config/rclone rclone/rclone config
```

Steps:
1. `n` (new remote)
2. Name: `gdrive-backups`
3. Storage: Select `Google Drive` (e.g. number `18` or `15` depending on list version)
4. Client ID/Secret: Press Enter (use defaults)
5. Scope: `1` (full access)
6. Root folder / Service account: Press Enter (defaults)
7. Advanced config: `n`
8. Use web browser to authenticate: `n` (Choose **No**, as this is a remote server)
9. Copy URL, authorize in browser, paste verification code back into the terminal.
10. Confirm remote: `y`
11. Type `q` to quit.

**Result:** Config saved to `./rclone-config/rclone.conf` (persisted!) and mapped directly to Kopia and other backup scripts.

### 3. Kopia Repository Connection

**Via Web UI (http://localhost:51515):**

1. Login with credentials from `.env`
2. "Connect to Repository"
3. Select "Rclone Remote"
4. Remote Path: `gdrive-backups:homelab-backups`
5. Password: `KOPIA_PASSWORD` from `.env`
6. Click "Connect"

**Result:** Repository created in Google Drive, encrypted.

### 4. Retention Policy

```bash
docker exec kopia kopia policy set --global \
  --keep-daily 3 \
  --keep-weekly 2 \
  --keep-monthly 1 \
  --compression=zstd
```

**What this means:**
- Last 3 days: Daily snapshots
- Last 2 weeks: Weekly snapshots  
- Last 1 month: Monthly snapshot
- Auto-deletes older snapshots
- ~6-7 total snapshots at any time

### 5. Automated Scheduling

**Method:** ofelia (Docker job scheduler)

**Configuration:** Via container labels on service containers:

**Inside `11-security/docker-compose.yml` (sqlite-helper):**
```yaml
labels:
  ofelia.enabled: "true"
  ofelia.job-exec.vw-backup.schedule: "0 0 1 * * *"
  ofelia.job-exec.vw-backup.command: "/bin/sh /data/backup-vaultwarden.sh"
```
*Triggers the consistent SQLite backup of Vaultwarden daily at 1:00 AM.*

**Inside `10-backup/docker-compose.yml` (kopia):**
```yaml
labels:
  ofelia.enabled: "true"
  ofelia.job-exec.backup-daily.schedule: "0 0 2 * * *"
  ofelia.job-exec.backup-daily.command: "kopia snapshot create /backup-source --description 'Automated daily backup'"
  # Vaultwarden SQLite to GDrive upload (runs 15m after backup helper)
  ofelia.job-exec.vw-gdrive-backup.schedule: "0 15 1 * * *"
  ofelia.job-exec.vw-gdrive-backup.command: "sh /app/scripts/backup-vaultwarden-gdrive.sh"
```

**Schedule summary:**
- 1:00 AM: Vaultwarden database helper generates consistent SQLite backup.
- 1:15 AM: Kopia copies latest Vaultwarden SQLite backup and uploads to Google Drive.
- 2:00 AM: Kopia executes daily snapshot of `/backup-source` (entire homelab folder).

**Why ofelia:** Host system may not have `cron` installed.

## Deployment Steps

### Initial Setup

```bash
cd /home/ubuntu/homelab/10-backup

# 1. Configure environment
cp .env.example .env
# Edit .env with secure passwords

# 2. Deploy stack
docker compose up -d

# 3. Configure rclone (one-time)
docker exec -it kopia rclone config
# Follow OAuth flow

# 4. Connect Kopia to repository (via Web UI)
# http://localhost:51515
# Rclone Remote → gdrive-backups:homelab-backups

# 5. Set retention policy
docker exec kopia kopia policy set --global \
  --keep-daily 3 \
  --keep-weekly 2 \
  --keep-monthly 1 \
  --compression=zstd

# 6. Test first backup
docker exec kopia kopia snapshot create /backup-source

# 7. Verify
docker exec kopia kopia snapshot list
```

### After Container Recreation

**If container is recreated and loses config:**

1. **rclone config persists** (in `./rclone-config/`)
2. **Kopia config persists** (in `./kopia-config/`)
3. Just reconnect via UI if needed
4. **No need to reconfigure OAuth!**

## Common Commands

### View Snapshots
```bash
docker exec kopia kopia snapshot list
```

### Manual Backup
```bash
docker exec kopia kopia snapshot create /backup-source --description "Manual backup"
```

### Repository Status
```bash
docker exec kopia kopia repository status
```

### Check Scheduler
```bash
docker logs backup-scheduler
```

### Restore Data
```bash
# Via UI: http://localhost:51515 → Snapshots → Browse → Restore

# Via CLI:
docker exec kopia kopia snapshot restore latest /tmp/restore/
```

## Disaster Recovery

**If you lose everything:**

1. Install Docker on new system
2. Copy `10-backup/` directory (includes rclone config!)
3. Deploy: `docker compose up -d`
4. Reconnect Kopia via UI (password from `.env`)
5. Restore: `docker exec kopia kopia snapshot restore latest /home/ubuntu/homelab/`

## Monitoring

### Health Checks

```bash
# All services running?
docker ps | grep -E "kopia|scheduler|rclone"

# rclone working?
docker exec kopia rclone lsd gdrive-backups:

# Kopia connected?
docker exec kopia kopia repository status

# Scheduler active?
docker logs backup-scheduler | grep backup-daily
```

### Logs

```bash
# Kopia logs
docker logs kopia -f

# Scheduler logs
docker logs backup-scheduler -f

# Check backup execution
grep "snapshot created" kopia-logs/*.log
```

## Storage Usage

**Current (as of 2026-02-12):**
- 2 snapshots: ~6.3 MB
- Google Drive used: <10 MB

**Projected (with growth):**
- 50-100GB homelab
- After dedup: ~15-30GB per snapshot
- With retention (6-7 snapshots): ~100-200GB
- Available: 2TB

## Security

- **Encryption:** AES-256-GCM before upload
- **Repository password:** Stored in `.env` (keep secure!)
- **OAuth tokens:** Stored in `./rclone-config/` (protected)
- **Data in Google Drive:** Encrypted, unreadable without Kopia

## Lessons Learned

### Issue 1: rclone Config Mount Path Mismatch

**Problem:** rclone config inside the Kopia image was hardcoded to `/app/rclone/rclone.conf`. The docker-compose file mounted the folder to `/root/.config/rclone`. Recreating the container deleted the token, crashing Kopia.

**Solution:** Changed mount path in Kopia:
```yaml
- ./rclone-config:/app/rclone
```

**Result:** Configuration persists across container updates.

### Issue 2: Excluded Cache Loop and Out-of-Memory (OOM)

**Problem:** Kopia snapshot was configured with absolute ignore paths (`/home/ubuntu/homelab/...`), but inside the container the source directory was `/backup-source`. This caused Kopia to back up its own cache and active repository files, creating an infinite feedback loop that hit the 512MB container memory limit (Exit 137).

**Solution:** Updated `.kopiaignore` in `/home/ubuntu/homelab/.kopiaignore` using relative paths relative to the backup source:
```
10-backup/kopia-cache/
10-backup/kopia-logs/
10-backup/kopia-repository/
```
Also raised Kopia's memory limit to `1024m` and CPU to `0.8` to run the Kopia server and Kopia CLI concurrently without resource starvation.

### Issue 3: Missing sqlite3 Binaries

**Problem:** Both Kopia and Vaultwarden containers lacked `sqlite3` in their default Alpine images, causing database backup scripts to fail instantly.

**Solution:** Created a lightweight custom helper service `sqlite-helper` in `11-security/docker-compose.yml` that mounts the Vaultwarden data directory, runs natively as UID 1000, has `sqlite3` pre-installed, and outputs consistent SQLite backups. Kopia's Daily backup copies this consistent backup to staging and uploads to Google Drive.

### Issue 4: Notification Syntax Error in Backup Script

**Problem:** Inline bash checks (`${status == 'SUCCESS' && ...}`) inside `backup.sh` notification headers caused immediate crashes of the script during execution.

**Solution:** Refactored header compilation to use standard shell variables.

### Issue 5: Unused rclone-music restarting loop

**Problem:** The `rclone-music` service was crashing on startup because a `[gdrive-music]` remote section was not configured in `rclone.conf`.

**Solution:** Removed the service from `10-backup/docker-compose.yml` to prevent restart loops, as the music-mounting service is not currently required.

## Files Reference

**In `/home/ubuntu/homelab/10-backup/`:**
- `docker-compose.yml` - Kopia and Ofelia service definitions.
- `.env` - Kopia credential keys.
- `scripts/backup.sh` - Main system backup script with Telegram/Ntfy notification logic.
- `scripts/backup-vaultwarden-gdrive.sh` - Vaultwarden SQLite Google Drive sync script.
- `rclone-config/rclone.conf` - Google OAuth credentials file.
- `kopia-config/` - Kopia repository connection parameters.
- `kopia-cache/` - Cached blocks.

**In `/home/ubuntu/homelab/11-security/`:**
- `docker-compose.yml` - Vaultwarden and SQLite backup helper service.
- `backup-vaultwarden.sh` - Database and attachments backup script.

**In `/home/ubuntu/homelab/`:**
- `.kopiaignore` - Exclusion rules file.

## Related Documentation

- [Kopia Docs](https://kopia.io/docs/)
- [rclone Google Drive Guide](https://rclone.org/drive/)
- [ofelia Scheduler](https://github.com/mcuadros/ofelia)

---

**Last Updated:** 2026-06-16  
**Status:** ✅ Production Ready & Fully Hardened
