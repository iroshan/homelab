# 🚀 Docker Homelab Migration Guide
## From Single Monolith to Multi-Stack Architecture

---

## 📋 Executive Summary

**Current Problems:**
1. ❌ DNS failures cascade through all 47 services
2. ❌ AdGuard port 53 conflicts with system DNS
3. ❌ beszel-agent `network_mode: host` breaks Docker DNS
4. ❌ Single 1254-line file is unmaintainable
5. ❌ Can't update one service without affecting others
6. ❌ No network isolation or security

**Solution:**
✅ Split into 10 logical stacks
✅ Fix DNS with static IPs and proper configuration
✅ Network segmentation for security
✅ Independent updates per stack
✅ Easy debugging and maintenance
✅ Git-friendly structure

---

## 🔴 CRITICAL DNS FIXES EXPLAINED

### Problem 1: AdGuard Port Conflict
**What was wrong:**
```yaml
# OLD - BROKEN
adguard:
  ports:
    - "53:53/tcp"  # Conflicts with system DNS!
```

**Why it broke:**
- Linux uses port 53 for system DNS
- systemd-resolved or dnsmasq likely already using it
- Containers couldn't reach AdGuard reliably

**The fix:**
```yaml
# NEW - WORKS
adguard:
  ports:
    - "5353:53/tcp"    # External port 5353, internal 53
    - "5353:53/udp"
  networks:
    infrastructure_net:
      ipv4_address: 172.18.0.2  # Static IP for reliability
```

**How to set DNS on host:**
```bash
# Point your server to use AdGuard on port 5353
sudo resolvectl dns eth0 127.0.0.1:5353
# Or edit /etc/systemd/resolved.conf:
# DNS=127.0.0.1:5353
```

### Problem 2: beszel-agent Network Mode
**What was wrong:**
```yaml
# OLD - BROKEN
beszel-agent:
  network_mode: host  # Bypasses Docker DNS entirely!
```

**Why it broke:**
- `network_mode: host` puts container directly on host network
- Container can't use Docker's DNS resolver
- Can't communicate with other containers by name
- All inter-container communication fails

**The fix:**
```yaml
# NEW - WORKS
beszel-agent:
  networks:
    - monitoring_net
  extra_hosts:
    - "host.docker.internal:host-gateway"
  pid: host  # For system metrics access
  volumes:
    - /:/host:ro  # Read-only host access for metrics
```

**What this does:**
- Keeps container in Docker network (DNS works!)
- `extra_hosts` gives access to host when needed
- `pid: host` allows reading system metrics
- Volume mount provides filesystem metrics

### Problem 3: No Explicit DNS Configuration
**What was wrong:**
```yaml
# OLD - BROKEN
services:
  myservice:
    # No DNS configured! Uses Docker default (often unreliable)
```

**The fix:**
```yaml
# NEW - WORKS
services:
  myservice:
    dns:
      - 172.18.0.2  # AdGuard (primary)
      - 1.1.1.1     # Cloudflare (fallback)
      - 8.8.8.8     # Google (fallback)
```

---

## 📂 Directory Structure

```
homelab/
├── 01-core-infrastructure/
│   ├── docker-compose.yml
│   ├── .env
│   └── adguard_config/
│
├── 02-network-access/
│   ├── docker-compose.yml
│   ├── .env
│   ├── npm/
│   └── portainer_data/
│
├── 03-monitoring/
│   ├── docker-compose.yml
│   ├── .env
│   └── [service data folders]/
│
├── 04-productivity/
│   ├── docker-compose.yml
│   ├── .env
│   └── [service data folders]/
│
├── 05-knowledge-base/
│   ├── linkwarden/
│   │   └── docker-compose.yml
│   ├── outline/
│   │   └── docker-compose.yml
│   ├── docmost/
│   │   └── docker-compose.yml
│   ├── hoarder/
│   │   └── docker-compose.yml
│   └── wallabag/
│       └── docker-compose.yml
│
├── 06-media/
├── 07-documents/
├── 08-utilities/
├── 09-communication/
├── 10-backup/
│
└── scripts/
    ├── deploy-all.sh
    ├── stop-all.sh
    ├── update-stack.sh
    └── backup-configs.sh
```

---

## 🎯 Migration Steps (Do NOT Skip!)

### Step 1: Backup Everything
```bash
# Backup current setup
cd ~/homelab
tar -czf ~/homelab-backup-$(date +%Y%m%d).tar.gz .

# Backup Docker volumes
docker run --rm -v /var/lib/docker/volumes:/volumes \
  -v ~/docker-volumes-backup:/backup \
  alpine tar -czf /backup/volumes-$(date +%Y%m%d).tar.gz /volumes

# Export environment variables
docker compose config > docker-compose-rendered.yml
```

### Step 2: Prepare Directory Structure
```bash
cd ~
mkdir -p homelab-new/{01-core-infrastructure,02-network-access,03-monitoring,scripts}

# Copy data directories
cp -r ~/homelab/adguard_config ~/homelab-new/01-core-infrastructure/
cp -r ~/homelab/npm ~/homelab-new/02-network-access/
# etc...
```

### Step 3: Create .env Files
```bash
# Split your current .env into stack-specific files

# 01-core-infrastructure/.env
echo "TUNNEL_TOKEN=your_token" > 01-core-infrastructure/.env

# 02-network-access/.env
# (no secrets needed for NPM/Portainer)

# 03-monitoring/.env
cat > 03-monitoring/.env << EOF
BESZEL_SSH_KEY=your_key
BESZEL_TOKEN=your_token
BESZEL_HUB_URL=your_url
EOF

# etc...
```

### Step 4: Deploy Core Infrastructure FIRST
```bash
cd ~/homelab-new/01-core-infrastructure

# Start AdGuard and Cloudflared
docker compose up -d

# Wait for health check
docker compose ps

# Test DNS resolution
docker exec adguard nslookup google.com 127.0.0.1

# If healthy, move to next step
```

### Step 5: Update Server DNS (Important!)
```bash
# Point your server to use the new AdGuard setup
sudo resolvectl dns eth0 127.0.0.1:5353

# Or for permanent change, edit /etc/systemd/resolved.conf:
sudo nano /etc/systemd/resolved.conf
# Add: DNS=127.0.0.1:5353
sudo systemctl restart systemd-resolved

# Test it
nslookup google.com
```

### Step 6: Deploy Network Access
```bash
cd ~/homelab-new/02-network-access
docker compose up -d

# Verify NPM is accessible
curl -I http://localhost:81

# Verify Portainer
curl -I http://localhost:9000
```

### Step 7: Deploy Monitoring
```bash
cd ~/homelab-new/03-monitoring
docker compose up -d

# Check all services started
docker compose ps

# Test beszel-agent can still get metrics (should work now!)
docker logs beszel-agent
```

### Step 8: Migrate Remaining Stacks (One at a Time)
```bash
# For each stack:
cd ~/homelab-new/[stack-name]
docker compose up -d
docker compose ps
docker compose logs -f  # Watch for errors

# If everything looks good, move to next stack
```

### Step 9: Shutdown Old Setup
```bash
cd ~/homelab
docker compose down

# Rename for safety (don't delete yet!)
cd ~
mv homelab homelab-old
mv homelab-new homelab
```

### Step 10: Verify Everything Works
```bash
# Run health check
cd ~/homelab/scripts
chmod +x deploy-all.sh
./deploy-all.sh

# Check all containers
docker ps -a

# Test critical services:
# - Can you access NPM admin?
# - Can you access your apps through reverse proxy?
# - Is DNS resolution working?
# - Are database-backed apps working?
```

---

## 🌐 Network Architecture Explained

### Network Map:
```
Internet
    ↓
Cloudflare Tunnel (cloudflared)
    ↓
Nginx Proxy Manager (npm) ←─────┐
    ↓                            │
[proxy_net] ──────────────────┐  │
    │                         │  │
    ├─ infrastructure_net     │  │
    │    └─ AdGuard (DNS)     │  │
    │                         │  │
    ├─ monitoring_net         │  │
    │    ├─ Uptime Kuma ──────┘  │
    │    ├─ Dozzle               │
    │    ├─ Beszel               │
    │    └─ Homepage ────────────┘
    │
    ├─ productivity_net
    │    ├─ Vikunja
    │    ├─ Memos
    │    └─ Homebox
    │
    ├─ knowledge_net
    │    ├─ Outline (+ DB + Redis)
    │    ├─ Linkwarden (+ DB)
    │    └─ Hoarder (+ MeiliSearch)
    │
    └─ [other stack networks...]
```

### Network Isolation Rules:
1. **Public Services:** Only on `proxy_net` + their stack network
2. **Databases:** ONLY on their stack network (never on proxy_net)
3. **Monitoring:** Can connect to multiple networks (for health checks)
4. **Infrastructure:** Isolated on `infrastructure_net` except for NPM access

---

## 🔧 Troubleshooting Common Issues

### Issue: "Container can't resolve other containers"
**Symptom:** `getaddrinfo failed` or `Name or service not known`

**Solution:**
```bash
# Check DNS config
docker exec <container> cat /etc/resolv.conf

# Should show:
# nameserver 172.18.0.2
# nameserver 1.1.1.1
# nameserver 8.8.8.8

# If not, add DNS to compose:
services:
  myservice:
    dns:
      - 172.18.0.2
      - 1.1.1.1
```

### Issue: "Port already in use"
**Symptom:** `bind: address already in use`

**Solution:**
```bash
# Find what's using the port
sudo lsof -i :53

# If it's systemd-resolved:
sudo systemctl disable systemd-resolved
sudo systemctl stop systemd-resolved

# Or change AdGuard to use port 5353 (already done in new setup)
```

### Issue: "Service unhealthy"
**Symptom:** Container stuck in "unhealthy" state

**Solution:**
```bash
# Check health check logs
docker inspect <container> | grep -A 20 Health

# Common fixes:
# 1. Increase start_period (service needs more time to start)
# 2. Fix health check command
# 3. Check service actually responds on expected port
```

### Issue: "Database connection refused"
**Symptom:** App can't connect to its database

**Solution:**
```bash
# Ensure both on same network
docker network inspect <network-name>

# Check database is healthy
docker compose ps

# Verify connection string uses container name:
# ✅ GOOD: postgres://user:pass@mydb:5432/dbname
# ❌ BAD:  postgres://user:pass@localhost:5432/dbname
```

---

## 📊 Before/After Comparison

| Metric | Before (Monolith) | After (Multi-Stack) |
|--------|------------------|---------------------|
| Lines per file | 1254 | ~100-150 each |
| Single point of failure | YES | NO |
| Update isolation | NO | YES |
| DNS reliability | Poor | Excellent |
| Debug time | Hours | Minutes |
| Network security | None | Segmented |
| Git commit clarity | Poor | Excellent |
| Deployment speed | Slow (all or nothing) | Fast (per stack) |
| Rollback capability | Risky | Safe (per stack) |

---

## 🎯 Best Practices Going Forward

### 1. One Service = One Concern
- Don't mix media and productivity in same stack
- Keep databases within their application stack
- Separate backup systems from live services

### 2. Always Use Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s  # Give service time to initialize
```

### 3. Explicit DNS Configuration
Every service should have:
```yaml
dns:
  - 172.18.0.2  # Your AdGuard
  - 1.1.1.1
  - 8.8.8.8
```

### 4. Use Depends_on with Conditions
```yaml
depends_on:
  database:
    condition: service_healthy  # Wait for health check!
  redis:
    condition: service_healthy
```

### 5. Resource Limits for Resource-Heavy Services
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      memory: 1G
```

### 6. Consistent Logging
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 7. Security Hardening
```yaml
security_opt:
  - no-new-privileges:true
read_only: true  # If service doesn't need to write
tmpfs:
  - /tmp  # Writable temp if read_only is enabled
```

---

## 🚦 Deployment Order (NEVER CHANGE THIS!)

1. ✅ **Core Infrastructure** (AdGuard + Cloudflared)
   - Everything depends on DNS working
   - Must be fully healthy before proceeding

2. ✅ **Network Access** (NPM + Portainer)
   - Provides reverse proxy for all other services
   - Portainer for management

3. ✅ **Monitoring** (Uptime Kuma, Beszel, Dozzle, Homepage)
   - Watch everything else deploy
   - Catch issues early

4. ✅ **Critical Apps** (Your most-used services)
   - Deploy what you need most first
   - Can use immediately while migrating others

5. ✅ **Nice-to-Haves** (Less critical utilities)
   - Deploy when main services stable

6. ✅ **Backup Systems** (Duplicati, Kopia)
   - Deploy last
   - Set up to backup new structure

---

## ⚡ Quick Commands Reference

```bash
# Deploy single stack
cd ~/homelab/03-monitoring
docker compose up -d

# View logs for stack
docker compose logs -f

# Restart single service in stack
docker compose restart uptime-kuma

# Update single stack
docker compose pull
docker compose up -d

# Stop stack (preserves data)
docker compose stop

# Remove stack (keeps volumes)
docker compose down

# Remove stack + volumes (DANGEROUS!)
docker compose down -v

# View stack health
docker compose ps

# Deploy all stacks in order
cd ~/homelab/scripts
./deploy-all.sh

# Deploy all with fresh images
./deploy-all.sh --pull

# Deploy specific stack
./deploy-all.sh --stack 03-monitoring
```

---

## 🎉 Success Criteria

You'll know the migration worked when:

✅ All 47 services running across 10 stacks
✅ DNS resolution works from any container
✅ No "address already in use" errors
✅ Can update one stack without touching others
✅ Homepage dashboard shows all services
✅ NPM can reverse proxy to all apps
✅ Uptime Kuma successfully monitoring all services
✅ No containers stuck in "restarting" state
✅ Database-backed apps work normally
✅ Can access logs easily with Dozzle

---

## 📞 Need Help?

If you run into issues:

1. Check the specific service logs:
   ```bash
   docker logs <container-name>
   ```

2. Check stack health:
   ```bash
   docker compose ps
   ```

3. Verify DNS:
   ```bash
   docker exec <container> nslookup google.com
   ```

4. Check networks:
   ```bash
   docker network inspect <network-name>
   ```

5. Test connectivity between containers:
   ```bash
   docker exec <container1> ping <container2>
   ```

---

**Remember:** The key to success is deploying in order and verifying each stack before moving to the next one!

Good luck! 🚀
