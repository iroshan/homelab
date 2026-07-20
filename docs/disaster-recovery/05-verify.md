# Step 5 — Verify Full Recovery

Run these checks to confirm every service is healthy and your homelab is fully operational.

---

## 5.1 Container Health Check

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | sort
```

All containers should show `Up X minutes (healthy)` or `Up X minutes`. None should show `Restarting` or `Exited`.

Expected containers:

| Container | Status |
|---|---|
| `vaultwarden` | Up (healthy) |
| `sqlite-helper` | Up |
| `nginx_proxy_manager` | Up (healthy) |
| `portainer` | Up |
| `f075f3c9fe6d_cloudflared` | Up |
| `775db7bd1684_homepage` | Up (healthy) |
| `uptime_kuma` | Up (healthy) |
| `dozzle` | Up |
| `memos` | Up |
| `telegram_memos_bot` | Up (healthy) |
| `affine` | Up (healthy) |
| `affine_postgres` | Up (healthy) |
| `affine_redis` | Up (healthy) |
| `kopia` | Up |
| `backup-scheduler` | Up |
| `homelab-docs` | Up |
| `workout-tracker` | Up |

---

## 5.2 Service Endpoint Checks

```bash
# Test each public URL
for url in \
  "https://vault.iroshan.uk/api/version" \
  "https://memos.iroshan.uk" \
  "https://affine.iroshan.uk" \
  "https://status.iroshan.uk" \
  "https://home.iroshan.uk" \
  "https://docs.iroshan.uk" \
  "https://workout.iroshan.uk"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
    if [[ "$STATUS" == "200" || "$STATUS" == "302" || "$STATUS" == "301" ]]; then
        echo "✅ $url → $STATUS"
    else
        echo "❌ $url → $STATUS"
    fi
done
```

---

## 5.3 Vaultwarden Login Test

1. Open [vault.iroshan.uk](https://vault.iroshan.uk) in browser
2. Check it shows version 1.36.0+ (bottom of page)
3. Log in with your master password via the Bitwarden extension
4. Confirm your passwords/logins are visible

---

## 5.4 Cloudflare Tunnel Status

1. Go to [Cloudflare Zero Trust Dashboard](https://one.cloudflare.com)
2. Networks → Tunnels
3. Your tunnel should show **Healthy** with a green indicator

---

## 5.5 Backup System Verification

```bash
# Check Ofelia scheduler logs — confirm jobs ran recently
docker logs backup-scheduler --tail 30

# Trigger a manual Kopia snapshot to confirm backup works
docker exec -e KOPIA_PASSWORD="<YOUR_KOPIA_PASSWORD>" kopia \
  kopia snapshot create /backup-source --description 'Post-restore verification'

# Confirm it succeeded
docker exec kopia kopia snapshot list | tail -5
```

---

## 5.6 Git Automation Check

```bash
# Check hourly timer is active
systemctl status homelab-git-backup.timer

# Manually trigger a push to confirm it works
sudo -u ubuntu /home/ubuntu/homelab/scripts/git-backup.sh

# Verify commit appears on GitHub
# → github.com/iroshan/homelab → commits
```

---

## 5.7 Vaultwarden Backup Verification

```bash
# Check last backup ran
docker logs backup-scheduler 2>&1 | grep -E "vw-backup|vw-gdrive" | tail -10

# Confirm backups exist on Google Drive
rclone ls gdrive-backups:vaultwarden-backups | sort | tail -5
```

---

## 5.8 Uptime Kuma Monitors

1. Open [status.iroshan.uk](https://status.iroshan.uk)
2. All monitors should show **Up**
3. If any are down, investigate the specific service

---

## Final Checklist

- [ ] `docker ps` shows all 17 containers healthy
- [ ] All public URLs return 200/301/302
- [ ] Can log into Vaultwarden with passwords intact
- [ ] Cloudflare tunnel shows Healthy
- [ ] Kopia test snapshot succeeded
- [ ] Git push timer is active and commits are reaching GitHub
- [ ] Vaultwarden backup appears on Google Drive

---

## �� Recovery Complete

Your homelab is fully operational. 

**Post-recovery actions:**

1. Monitor Uptime Kuma for the next 24 hours to catch any intermittent issues
2. Check Dozzle logs at [logs.iroshan.uk](https://logs.iroshan.uk) for any error patterns
3. Verify the next automated Kopia backup runs successfully (2:00 AM)
4. Update this documentation if you made any changes during recovery

---

!!! tip "Prevent Future Pain"
    Consider setting up **email/Telegram alerts** via Uptime Kuma so you're notified of outages before they become disasters.
