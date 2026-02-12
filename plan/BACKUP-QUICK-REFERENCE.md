# Backup Stack - Quick Reference

## Status
✅ **OPERATIONAL** | Last Updated: 2026-02-12

## Services
- **Kopia** (port 51515) - Backup server + Web UI
- **ofelia** - Automated scheduler (daily 2:00 AM)
- **rclone** - Optional music mounting

## Storage
- **Backend:** Google Drive via rclone OAuth
- **Repository:** `gdrive-backups:homelab-backups`
- **Encryption:** AES-256-GCM-HMAC-SHA256
- **Space:** 2TB available

## Retention
- 3 daily snapshots
- 2 weekly snapshots
- 1 monthly snapshot

## Quick Commands

### View Backups
```bash
docker exec kopia kopia snapshot list
```

### Manual Backup
```bash
docker exec kopia kopia snapshot create /backup-source
```

### Restore Data
```bash
# Via UI
open http://localhost:51515

# Via CLI
docker exec kopia kopia snapshot restore latest /tmp/restore/
```

### Health Check
```bash
docker exec kopia kopia repository status
docker logs backup-scheduler | grep backup-daily
```

## Important Paths
- Config: `./kopia-config/` (persisted)
- rclone OAuth: `./rclone-config/` (persisted)
- Logs: `./kopia-logs/`
- Web UI: http://localhost:51515

## Disaster Recovery
1. Deploy stack: `docker compose up -d`
2. Reconnect via UI (password from `.env`)
3. Restore: `docker exec kopia kopia snapshot restore latest /home/ubuntu/homelab/`

---
**Docs:** [BACKUP-IMPLEMENTATION-GUIDE.md](./BACKUP-IMPLEMENTATION-GUIDE.md)
