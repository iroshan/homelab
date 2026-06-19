# Homelab Infrastructure

Self-hosted homelab infrastructure with Docker-based services and automated backups.

## 🏗️ Architecture

Organized into modular stacks:
- **01-core-infrastructure** - Cloudflare Tunnel
- **02-network-access** - Nginx Proxy Manager (NPM), Portainer CE
- **03-monitoring** - Homepage, Uptime Kuma, Dozzle
- **04-productivity** - Memos + Telegram Memos Bot
- **05-pkm** - Affine PKM (Postgres + Redis)
- **06-documentation** - MkDocs Documentation
- **10-backup** - Kopia (Google Drive), ofelia (scheduler)
- **11-security** - Vaultwarden, sqlite-helper
- **workout-tracker** (standalone) - Flask Workout Tracker App

## 🚀 Quick Start

```bash
# Deploy all stacks in order
cd /home/ubuntu/homelab
./plan/deploy-all.sh

# Or deploy individual stacks
cd 01-core-infrastructure
docker compose up -d
```

## 📁 Repository Structure

```
homelab/
├── 01-core-infrastructure/   # Core routing / tunnels
├── 02-network-access/        # Reverse proxy and Portainer
├── 03-monitoring/            # Dashboards and monitoring
├── 04-productivity/          # Memos notes stack
├── 05-pkm/                   # Affine knowledge management
├── 06-documentation/         # MkDocs material site
├── 10-backup/                # Kopia snapshot systems
├── 11-security/              # Password vault (Vaultwarden)
├── shared/                   # Shared configs (networks, DNS)
├── scripts/                  # Git automation scripts
└── plan/                     # Documentation & setup guides
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
