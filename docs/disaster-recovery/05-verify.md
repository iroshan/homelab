# Step 5 — Verify Full Recovery

Run these checks to confirm every service, tunnel, and backup job is healthy.

---

## 5.1 Container Health Check

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | sort
```

Expected active containers (all `Up`, none `Restarting` or `Exited`):

| Stack | Containers |
|---|---|
| `01-core-infrastructure` | `cloudflared` |
| `02-network-access` | `nginx_proxy_manager`, `portainer` |
| `03-monitoring` | `uptime_kuma`, `dozzle` |
| `04-productivity` | `memos`, `telegram_memos_bot`, `actual-budget`, `truelayer2actual`, `actual-finance-bot`, `actual-ai` |
| `05-pkm` | `affine`, `affine_postgres`, `affine_redis` |
| `06-documentation` | `homelab-docs` |
| `06-media` | `aiostreams`, `aiometadata`, `aiometadata_redis` |
| `10-backup` | `kopia`, `backup-scheduler` |
| `11-security` | `vaultwarden`, `sqlite-helper` |

---

## 5.2 Endpoint & Tunnel Checks

1. Check [Cloudflare Zero Trust Dashboard](https://one.cloudflare.com) → Networks → Tunnels → **Healthy**.
2. Test key services:

```bash
for url in \
  "https://vault.iroshan.uk/api/version" \
  "https://memos.iroshan.uk" \
  "https://pkm.iroshan.uk" \
  "https://status.iroshan.uk" \
  "https://docs.iroshan.uk"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
    echo "${STATUS}  ${url}"
done
```

3. Check Tailscale-only admin UIs from a Tailscale-connected device:
   - NPM Admin: `http://<NEW_TAILSCALE_IP>:81`
   - Portainer: `http://<NEW_TAILSCALE_IP>:9000`
   - TrueLayer sync: `http://<NEW_TAILSCALE_IP>:5007`

---

## 5.3 Verify Backups Will Keep Running

```bash
# 1. Confirm Ofelia registered all 5 jobs
docker logs backup-scheduler 2>&1 | grep "New job registered" | tail -n 10

# 2. Test Affine Postgres dump
docker exec affine_postgres /bin/sh /usr/local/bin/backup-postgres.sh

# 3. Test Vaultwarden SQLite backup
docker exec sqlite-helper /bin/sh /data/backup-vaultwarden.sh

# 4. Confirm hourly git backup timer is active
systemctl status homelab-git-backup.timer --no-pager

# 5. Test git push works from the new server
~/homelab/scripts/git-backup.sh
```

---

## Final Checklist

- [ ] All ~21 containers are `Up` (and `healthy` where applicable)
- [ ] Can log into Vaultwarden, Affine, Memos, and Actual Budget with data intact
- [ ] Telegram bots (`telegram_memos_bot`, `actual-finance-bot`) respond
- [ ] Cloudflare Tunnel shows **Healthy**
- [ ] Ofelia shows all 5 backup jobs registered
- [ ] `homelab-git-backup.timer` is active and pushing to GitHub
- [ ] Old server containers remain stopped (keep old server powered down 24–48h before deleting)
