# Step 3 — Deploy All Stacks

Deploy services in the correct order. Each stack depends on the previous one being up.

!!! warning "Prerequisites"
    Complete [Step 2 (Restore Secrets)](./02-restore-secrets.md) before this step. Every stack needs its `.env` file.

---

## Deployment Order

```
1. 01-core-infrastructure  (Cloudflare Tunnel — external access)
2. 02-network-access       (Nginx Proxy Manager + Portainer)
3. 03-monitoring           (Homepage, Uptime Kuma, Dozzle)
4. 04-productivity         (Memos + Telegram Bot)
5. 05-pkm                  (Affine + Postgres + Redis)
6. 06-documentation        (MkDocs)
7. 10-backup               (Kopia + Ofelia scheduler)
8. 11-security             (Vaultwarden + sqlite-helper)
9. workout-tracker         (Standalone Flask app)
```

---

## Automated Deployment (Recommended)

```bash
cd ~/homelab

# Deploy all stacks in order
./plan/deploy-all.sh
```

Watch for any errors before proceeding to the next step.

---

## Manual Deployment (Stack by Stack)

If the automated script fails, deploy each stack manually:

### Stack 1: Core Infrastructure

```bash
cd ~/homelab/01-core-infrastructure
docker compose up -d

# Verify cloudflared is running
docker ps | grep cloudflared
docker logs f075f3c9fe6d_cloudflared 2>&1 | tail -5
```

Expected: Cloudflare tunnel should connect. Check Cloudflare dashboard → Zero Trust → Tunnels → your tunnel should show "Healthy".

### Stack 2: Network Access

```bash
cd ~/homelab/02-network-access
docker compose up -d

# Verify
docker ps | grep -E "nginx_proxy_manager|portainer"
```

Wait 30 seconds, then NPM admin panel should be accessible at `http://<SERVER_IP>:81`.

!!! note "NPM Configuration"
    All proxy host configs are stored in NPM's data directory. If restoring from a fresh install, you'll need to reconfigure proxy hosts manually (or restore the NPM data volume from Kopia — see Step 4).

### Stack 3: Monitoring

```bash
cd ~/homelab/03-monitoring
docker compose up -d

docker ps | grep -E "homepage|uptime_kuma|dozzle"
```

### Stack 4: Productivity

```bash
cd ~/homelab/04-productivity
docker compose up -d

docker ps | grep -E "memos|telegram"
```

### Stack 5: PKM (Affine)

```bash
cd ~/homelab/05-pkm
docker compose up -d

# Affine takes 60-90 seconds to initialise
sleep 90
docker ps | grep -E "affine|redis|postgres"
docker logs affine 2>&1 | tail -10
```

### Stack 6: Documentation

```bash
cd ~/homelab/06-documentation
docker compose up -d

docker ps | grep homelab-docs
```

### Stack 7: Backup

```bash
cd ~/homelab/10-backup

# Ensure rclone config is in place
ls rclone-config/rclone.conf || echo "MISSING rclone config!"

docker compose up -d

docker ps | grep -E "kopia|backup-scheduler"
```

### Stack 8: Security (Vaultwarden)

```bash
cd ~/homelab/11-security
docker compose up -d

# Wait for health check
sleep 20
docker ps | grep vaultwarden
curl -s http://localhost/api/version 2>/dev/null || echo "Not yet accessible directly (proxied)"
```

### Stack 9: Workout Tracker

```bash
cd ~/homelab/workout-tracker
docker compose up -d

docker ps | grep workout-tracker
```

---

## 3.1 Reconfigure Cloudflare Tunnel

If you're provisioning a completely new server, the Cloudflare Tunnel token in your `.env` should already point to the right tunnel. Verify:

1. Go to [Cloudflare Zero Trust Dashboard](https://one.cloudflare.com)
2. Networks → Tunnels → your tunnel
3. Status should be **Healthy**
4. If not, check connector logs: `docker logs f075f3c9fe6d_cloudflared`

If the tunnel token expired or tunnel was deleted, create a new one:

```bash
# In Cloudflare dashboard, create new tunnel
# Copy the tunnel token
# Update 01-core-infrastructure/.env:
# TUNNEL_TOKEN=<new_token>

# Restart cloudflared
cd ~/homelab/01-core-infrastructure
docker compose down && docker compose up -d
```

---

## 3.2 Reconfigure Nginx Proxy Manager

NPM hosts all your reverse proxy rules. After restoring NPM data (Step 4), the proxy hosts should be restored automatically.

If starting from scratch, you'll need to reconfigure each proxy host:

| Domain | Forwarding to | Port |
|---|---|---|
| `vault.iroshan.uk` | `vaultwarden` | `80` |
| `memos.iroshan.uk` | `memos` | `5230` |
| `affine.iroshan.uk` | `affine` | `3010` |
| `docs.iroshan.uk` | `homelab-docs` | `8000` |
| `status.iroshan.uk` | `uptime_kuma` | `3001` |
| `logs.iroshan.uk` | `dozzle` | `8080` |
| `backup.iroshan.uk` | `kopia` | `51515` |
| `home.iroshan.uk` | `775db7bd1684_homepage` | `3000` |
| `workout.iroshan.uk` | `workout-tracker` | `5000` |

---

## Checklist

- [ ] All 9 stacks deployed and showing healthy in `docker ps`
- [ ] Cloudflare tunnel status is **Healthy**
- [ ] NPM admin panel accessible at `http://<IP>:81`
- [ ] No containers showing `Exited` or `Restarting`

```bash
# Quick status check
docker ps --format "table {{.Names}}\t{{.Status}}" | sort
```

---

**Next → [Restore application data](./04-restore-data.md)**
