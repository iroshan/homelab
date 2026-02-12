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
  - ./kopia-cache:/app/cache             # Performance cache
  - ./kopia-logs:/app/logs               # Logs
  - ./rclone-config:/root/.config/rclone # rclone OAuth (CRITICAL!)
```

**Why:** Survives container recreation, easy to backup/restore

### 2. rclone Google Drive Setup

**One-time configuration:**

```bash
docker exec -it kopia rclone config
```

Steps:
1. `n` (new remote)
2. Name: `gdrive-backups`
3. Storage: `15` (Google Drive)
4. Client ID/Secret: Press Enter (use defaults)
5. Scope: `1` (full access)
6. Root folder: Press Enter (all of Drive)
7. Service account: `n`
8. Advanced: `n`
9. Web browser: `n` (use manual auth)
10. Copy URL, authorize in browser, paste code back

**Result:** Config saved to `./rclone-config/rclone.conf` (persisted!)

### 3. Kopia Repository Connection

**Via Web UI (http://localhost:51515):**

1. Login with credentials from `.env`
2. "Connect to Repository"
3. Select "Rclone Remote"
4. Remote Path: `gdrive-backups:homelab-backups`
5. Password: `KOPIA_PASSWORD` from `.env`
6. Click "Connect"

**Result:** Repository created in Google Drive, encrypted

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

**Configuration:** Via container labels on kopia service:

```yaml
labels:
  ofelia.enabled: "true"
  ofelia.job-exec.backup-daily.schedule: "0 0 2 * * *"
  ofelia.job-exec.backup-daily.command: "kopia snapshot create /backup-source --description 'Automated daily backup'"
```

**Schedule:** Daily at 2:00 AM (London timezone)

**Why ofelia:** Host system may not have `cron` installed

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

### Issue 1: rclone Config Lost on Container Restart

**Problem:** rclone config was inside container, lost when recreated

**Solution:** Added volume mount:
```yaml
- ./rclone-config:/root/.config/rclone
```

**Result:** Config persists forever, one-time setup only

### Issue 2: No cron on Host

**Problem:** Host didn't have `crontab` installed

**Solution:** Used ofelia (Docker-based scheduler)

**Result:** Works perfectly, no host dependencies

### Issue 3: YAML Syntax Error

**Problem:** Unquoted colon in command broke YAML parsing

**Fix:** Quote commands with colons:
```yaml
command: "mount gdrive-music: /mnt/music ..."
```

## Files Reference

**In `/home/ubuntu/homelab/10-backup/`:**

- `docker-compose.yml` - Service definitions
- `.env` - Passwords and configuration
- `README.md` - Full usage guide
- `kopia-config/` - Repository connection (persisted)
- `rclone-config/` - Google OAuth (persisted)
- `scripts/` - Backup scripts and exclusions

## Related Documentation

- [Kopia Docs](https://kopia.io/docs/)
- [rclone Google Drive Guide](https://rclone.org/drive/)
- [ofelia Scheduler](https://github.com/mcuadros/ofelia)

---

**Last Updated:** 2026-02-12  
**Status:** ✅ Production Ready
