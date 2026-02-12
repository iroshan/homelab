# Backup Stack - Kopia + rclone

Automated backup solution for the entire homelab using Kopia with Google Drive storage.

## 🎯 Features

- ✅ **Automated Daily Backups** at 2:00 AM
- 💾 **Google Drive Storage** with OAuth authentication
- 🔐 **Encryption** (AES-256-GCM)
- 📦 **Deduplication** saves ~70% storage
- 📊 **Retention Policy**: 3 daily, 2 weekly, 1 monthly
- 📲 **Dual Notifications**: Telegram + Ntfy
- 🎵 **Bonus**: rclone for music mounting

## 📋 What's Backed Up

- ✅ All homelab stacks and configurations
- ✅ Docker volumes and data directories  
- ✅ Environment files and configs
- ❌ Music folder (rclone mount)
- ❌ Temporary/cache data

## 🚀 Initial Setup

### 1. Update Environment Variables

Edit `.env` and set:
```bash
# Set secure passwords
KOPIA_PASSWORD=your_secure_repository_password
KOPIA_SERVER_PASSWORD=your_secure_ui_password

# Get your Telegram chat ID
TELEGRAM_CHAT_ID=your_telegram_user_id
```

To get your Telegram chat ID:
```bash
curl https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
```

### 2. Deploy the Stack

```bash
cd /home/ubuntu/homelab/10-backup
docker compose up -d
```

### 3. Configure Kopia Repository

**Option A: Web UI (Recommended)**

1. Open http://localhost:51515
2. Login with `KOPIA_SERVER_USERNAME` and `KOPIA_SERVER_PASSWORD`
3. Click "Create Repository"
4. Select "Google Drive"
5. Configure:
   - Folder: `homelab-backups`
   - Encryption: AES256-GCM-HMAC-SHA256
   - Password: Use `KOPIA_PASSWORD` from `.env`
6. Complete OAuth flow to authorize Google Drive
7. Click "Connect"

**Option B: Setup Helper Script**

```bash
chmod +x scripts/setup-kopia.sh
./scripts/setup-kopia.sh
```

### 4. Set Retention Policy

```bash
docker exec kopia kopia policy set --global \
  --keep-daily 3 \
  --keep-weekly 2 \
  --keep-monthly 1 \
  --compression zstd \
  --enable-actions
```

### 5. Test First Backup

```bash
# Make backup script executable
docker exec kopia chmod +x /app/scripts/backup.sh

# Run first backup
docker exec kopia /app/scripts/backup.sh
```

You should receive notifications on Telegram and Ntfy!

## ⏰ Automated Backups

Backups run automatically at **2:00 AM daily** via cron inside the Kopia container.

To change the schedule, edit `docker-compose.yml` and add cron environment:
```yaml
environment:
  - KOPIA_CRON_SCHEDULE=0 2 * * *  # Daily at 2 AM
```

## 📱 Notifications

### Telegram
Messages sent to your Telegram bot with backup stats.

### Ntfy  
Push notifications to topic `homelab-backups`.

Subscribe on your phone:
```bash
# iOS/Android: Download Ntfy app
# Subscribe to: your-ntfy-server/homelab-backups
```

## 🔄 Manual Operations

### Run Backup Manually
```bash
docker exec kopia /app/scripts/backup.sh
```

### List Snapshots
```bash
docker exec kopia kopia snapshot list
```

### View Repository Stats
```bash
docker exec kopia kopia repository status
```

### Browse Snapshot
```bash
docker exec kopia kopia snapshot list
docker exec kopia kopia mount <snapshot-id> /mnt/restore
# Files available at /mnt/restore
# Unmount: kopia unmount /mnt/restore
```

## 💽 Restore Data

### Via Web UI
1. Open Kopia UI
2. Go to "Snapshots"
3. Browse files
4. Select files/folders to restore
5. Click "Restore" and choose destination

### Via CLI
```bash
# List available snapshots
docker exec kopia kopia snapshot list

# Restore specific snapshot
docker exec kopia kopia restore <snapshot-id> /restore-path

# Restore single file
docker exec kopia kopia restore <snapshot-id>:/path/to/file /tmp/
```

### Full Disaster Recovery

If complete system loss:

1. Install Docker on new system
2. Clone your homelab repo (or restore docker-compose.yml)
3. Deploy Kopia:
   ```bash
   cd 10-backup
   docker compose up -d kopia
   ```
4. Connect to existing Google Drive repository via UI
5. List and restore latest snapshot:
   ```bash
   docker exec kopia kopia snapshot list
   docker exec kopia kopia restore latest /home/ubuntu/homelab/
   ```
6. Start all services:
   ```bash
   cd /home/ubuntu/homelab
   # Deploy stacks in order
   ```

## 🎵 rclone Music Mounting

The stack includes rclone for mounting Google Drive music.

### Setup

1. Create rclone config:
```bash
mkdir -p rclone-config
docker exec -it rclone-music rclone config
```

2. Configure Google Drive remote named `gdrive-music`

3. Restart rclone:
```bash
docker compose restart rclone
```

Music will be available at `/home/ubuntu/homelab/music/`

## 🛠️ Maintenance

### View Logs
```bash
docker logs kopia -f
docker logs rclone-music -f
```

### Run Maintenance
```bash
# Quick maintenance
docker exec kopia kopia maintenance run

# Full maintenance
docker exec kopia kopia maintenance run --full
```

### Update Kopia
```bash
docker compose pull kopia
docker compose up -d kopia
```

## 📊 Storage Usage

Check how much Google Drive storage is used:

```bash
docker exec kopia kopia repository status
```

Expected usage with your setup:
- ~50-100GB homelab
- With deduplication: ~15-30GB per snapshot
- 6-7 snapshots: **~100-200GB total**
- Plenty of room in your 2TB!

## 🔍 Troubleshooting

### Backup Fails
1. Check logs: `docker logs kopia`
2. Verify Google Drive connection
3. Check disk space
4. Verify permissions on source directories

### No Notifications
1. Check `.env` has correct tokens
2. Test Telegram:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
     -d "chat_id=<CHAT_ID>" \
     -d "text=Test"
   ```
3. Test Ntfy:
   ```bash
   curl -X POST http://ntfy:80/homelab-backups -d "Test"
   ```

### Can't Access UI
1. Verify container running: `docker ps | grep kopia`
2. Check port: `netstat -tulpn | grep 51515`
3. Try accessing: http://localhost:51515

## 📚 Resources

- [Kopia Documentation](https://kopia.io/docs/)
- [rclone Documentation](https://rclone.org/docs/)
- [Google Drive Setup](https://kopia.io/docs/repositories/#google-drive)

---

**Your data is safe! 🛡️**
