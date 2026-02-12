# 📋 Docker Homelab Quick Reference Card

## 🚀 Common Commands

### Deploy Operations
```bash
# Deploy all stacks in order
cd ~/homelab/scripts && ./deploy-all.sh

# Deploy with latest images
./deploy-all.sh --pull

# Deploy specific stack
./deploy-all.sh --stack 03-monitoring

# Deploy single stack manually
cd ~/homelab/03-monitoring
docker compose up -d

# Force recreate all containers in stack
docker compose up -d --force-recreate
```

### Monitoring & Logs
```bash
# View all running containers
docker ps

# View stack status
cd ~/homelab/03-monitoring && docker compose ps

# Follow logs for entire stack
docker compose logs -f

# Follow logs for specific service
docker compose logs -f uptime-kuma

# View last 100 lines
docker compose logs --tail=100 uptime-kuma

# View logs with timestamps
docker compose logs -f --timestamps
```

### Updates
```bash
# Update single stack
cd ~/homelab/03-monitoring
docker compose pull
docker compose up -d

# Check what would be updated (dry run)
docker compose pull --dry-run
```

### Restart Operations
```bash
# Restart entire stack
docker compose restart

# Restart single service
docker compose restart uptime-kuma

# Stop stack (keeps containers)
docker compose stop

# Start stopped stack
docker compose start
```

### Cleanup
```bash
# Remove stack (keeps volumes/data)
docker compose down

# Remove stack AND volumes (DELETES DATA!)
docker compose down -v

# Remove stopped containers system-wide
docker container prune

# Remove unused images
docker image prune -a

# Remove everything unused (careful!)
docker system prune -a --volumes
```

### Troubleshooting
```bash
# Inspect service details
docker inspect <container-name>

# Check health status
docker inspect <container> | grep -A 20 Health

# Test DNS from container
docker exec <container> nslookup google.com

# Test connectivity between containers
docker exec <container1> ping <container2>

# Access container shell
docker exec -it <container> sh

# View network details
docker network inspect knowledge_net

# View all networks
docker network ls

# Check what's using a port
sudo lsof -i :8080
```

---

## 🌐 Network Quick Reference

### Network Assignment
| Network | Purpose | Services |
|---------|---------|----------|
| `infrastructure_net` | Core DNS/tunnels | adguard, cloudflared |
| `proxy_net` | Public-facing | npm, portainer, all web apps |
| `monitoring_net` | Health checks | uptime-kuma, beszel, dozzle |
| `knowledge_net` | Wiki stack | outline, linkwarden, etc |
| `media_net` | Music services | navidrome, beets |
| `documents_net` | Document tools | paperless, stirling-pdf |
| `utilities_net` | Misc tools | it-tools, etherpad |
| `productivity_net` | Task apps | vikunja, memos |

### DNS Configuration
Every service should have:
```yaml
dns:
  - 172.18.0.2  # AdGuard
  - 1.1.1.1     # Cloudflare fallback
  - 8.8.8.8     # Google fallback
```

---

## 🔧 Common Fixes

### "Port already in use"
```bash
# Find what's using the port
sudo lsof -i :80

# Kill the process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8080:80"  # Use 8080 instead
```

### "Container can't resolve hostname"
```yaml
# Add to service in docker-compose.yml
dns:
  - 172.18.0.2
  - 1.1.1.1
  - 8.8.8.8
```

### "Service unhealthy"
```yaml
# Increase start period
healthcheck:
  start_period: 60s  # Give more time to start
```

### "Database connection refused"
```yaml
# Fix connection string to use service name
# ✅ GOOD
DATABASE_URL=postgres://user:pass@mydb:5432/dbname

# ❌ BAD (don't use localhost in containers!)
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
```

### "Permission denied" on volumes
```bash
# Fix ownership
sudo chown -R 1000:1000 ~/homelab/service_data

# Or in docker-compose.yml
environment:
  - PUID=1000
  - PGID=1000
```

---

## 📁 File Structure

```
homelab/
├── 01-core-infrastructure/
│   ├── docker-compose.yml
│   ├── .env
│   └── [data folders]
├── 02-network-access/
├── 03-monitoring/
├── scripts/
│   ├── deploy-all.sh
│   ├── stop-all.sh
│   └── backup-configs.sh
└── backups/
```

---

## 🔐 Security Checklist

- [ ] All databases NOT on proxy_net
- [ ] All services have `no-new-privileges:true`
- [ ] Secrets in .env files, not in compose
- [ ] .env files in .gitignore
- [ ] Resource limits on memory-hungry services
- [ ] Health checks on all critical services
- [ ] Regular backups configured
- [ ] NPM configured with SSL certificates
- [ ] Strong passwords in all .env files

---

## 📊 Health Check

```bash
# Quick health overview
docker ps --format "table {{.Names}}\t{{.Status}}"

# Detailed stack health
cd ~/homelab/03-monitoring
docker compose ps

# Check specific service logs
docker logs uptime-kuma --tail=50

# Monitor resource usage
docker stats

# Check disk usage
docker system df
```

---

## 🎯 Daily Operations

### Morning Check
```bash
# 1. Check all stacks running
docker ps | wc -l  # Should match total service count

# 2. Check for any restarting containers
docker ps -a | grep -i restarting

# 3. Quick log scan for errors
for stack in 01-core-infrastructure 02-network-access 03-monitoring; do
  echo "=== $stack ==="
  cd ~/homelab/$stack
  docker compose logs --tail=20 | grep -i error
done
```

### Update Routine (Weekly)
```bash
# 1. Backup first!
cd ~/homelab/scripts
./backup-configs.sh

# 2. Update each stack
for stack in $(ls -d ~/homelab/0*/); do
  cd $stack
  docker compose pull
  docker compose up -d
done

# 3. Check health
docker ps
```

---

## 🆘 Emergency Procedures

### Complete System Restart
```bash
# 1. Stop all stacks
cd ~/homelab
for dir in 0*/; do
  cd $dir && docker compose stop && cd ..
done

# 2. Restart in correct order
cd ~/homelab/scripts
./deploy-all.sh
```

### Rollback Stack
```bash
# If update breaks something:
cd ~/homelab/03-monitoring

# Stop new version
docker compose down

# Restore from backup
cp ~/homelab-backups/03-monitoring/docker-compose.yml .

# Deploy old version
docker compose up -d
```

### Network Reset
```bash
# If network issues persist:
docker network prune
cd ~/homelab/scripts
./deploy-all.sh
```

---

## 📞 Quick Access URLs

After deployment, access services at:

```
http://your-server-ip:81    → Nginx Proxy Manager
http://your-server-ip:9000  → Portainer
http://your-server-ip:3005  → Homepage Dashboard
http://your-server-ip:3000  → AdGuard Home
http://your-server-ip:3001  → Uptime Kuma
http://your-server-ip:8888  → Dozzle (Logs)
```

Then configure your domains in NPM!

---

**Pro Tip:** Bookmark this file and keep it handy! 🔖
