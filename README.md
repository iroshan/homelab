# Homelab Infrastructure

Self-hosted homelab infrastructure with Docker-based services and automated backups.

## 🏗️ Architecture

Organized into modular stacks:
- **01-core-infrastructure** - DNS (AdGuard), Proxy (NGINX), Tunnel (Cloudflare)
- **02-network** - WireGuard VPN access
- **03-monitoring** - Glances, Uptime Kuma
- **04-productivity** - Memos + Telegram bot
- **09-communication** - Ntfy notifications
- **10-backup** - Kopia (Google Drive), rclone, automated Git backups

## 🚀 Quick Start

```bash
# Deploy all stacks in order
cd /home/ubuntu/homelab
./scripts/deploy-all.sh

# Or deploy individual stacks
cd 01-core-infrastructure
docker compose up -d
```

## 📁 Repository Structure

```
homelab/
├── 01-core-infrastructure/   # Core services
├── 02-network/               # VPN access
├── 03-monitoring/            # Monitoring tools
├── 04-productivity/          # Productivity apps
├── 09-communication/         # Notification services
├── 10-backup/                # Backup systems
├── shared/                   # Shared configs (networks, DNS)
├── scripts/                  # Automation scripts
└── plan/                     # Documentation & guides
```

## 🔐 Security

- **Sensitive data excluded**: .env files, credentials, OAuth tokens not in this repository
- **Private repository**: Keep this repo private (contains infrastructure details)
- **Secrets management**: Store .env files separately (backed up via Kopia)

## 💾 Backup Strategy

**Dual backup approach:**
1. **Git** (this repo): Configuration, scripts, docker-compose files
2. **Kopia**: Data, secrets, complete system state (Google Drive)

## 📚 Documentation

See [`plan/`](./plan/) directory for:
- Implementation guides
- Network architecture
- Deployment procedures
- Quick references

## 🔄 Automation

- **Kopia backups**: Daily at 2:00 AM
- **Git backups**: Hourly automated commits
- **Monitoring**: Uptime Kuma, Glances

## ⚙️ Maintenance

```bash
# Update all services
docker compose pull
docker compose up -d

# View logs
docker logs <service-name> -f

# Backup now
docker exec kopia kopia snapshot create /backup-source
```

## 🆘 Disaster Recovery

1. Clone this repository
2. Restore .env files from Kopia backup
3. Run deployment scripts
4. Restore data from Kopia snapshots

---

**Last Updated**: 2026-02-12  
**Managed by**: Automated Git backups
