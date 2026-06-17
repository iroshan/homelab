# 🌐 Homelab Architecture and Setup Guide

## Service Categories & Stack Organization

### 📁 ACTIVE DIRECTORY STRUCTURE

```
homelab/
├── 01-core-infrastructure/
│   ├── docker-compose.yml
│   └── .env
├── 02-network-access/
│   ├── docker-compose.yml
│   └── .env
├── 03-monitoring/
│   ├── docker-compose.yml
│   └── .env
├── 04-productivity/
│   ├── docker-compose.yml
│   └── .env
├── 05-knowledge-base/
│   ├── docker-compose.yml
│   └── .env
├── 05-pkm/
│   ├── docker-compose.yml
│   └── .env
├── 06-documentation/
│   ├── docker-compose.yml
│   └── .env
├── 06-media/
│   ├── docker-compose.yml
│   └── .env
├── 07-documents/
│   ├── docker-compose.yml
│   └── .env
├── 08-utilities/
│   ├── docker-compose.yml
│   └── .env
├── 09-communication/
│   ├── docker-compose.yml
│   └── .env
├── 10-backup/
│   ├── docker-compose.yml
│   └── .env
├── 11-security/
│   ├── docker-compose.yml
│   └── .env
├── shared/
│   ├── networks.yml        # Shared network definitions
│   └── dns-config.yml      # Common DNS settings
└── scripts/
    ├── deploy-all.sh
    ├── stop-all.sh
    └── update-all.sh

workout-tracker/            # Standalone workout tracker stack
├── docker-compose.yml
└── .env
```

---

## 🗂️ STACK 1: CORE INFRASTRUCTURE
**Directory:** `01-core-infrastructure/`
**Purpose:** External access ingress via Cloudflare Tunnel
**Services:**
- cloudflared (Cloudflare tunnel)

**Priority:** Deploy FIRST
**Network:** `infrastructure_net` + `proxy_net`

---

## 🗂️ STACK 2: NETWORK & ACCESS
**Directory:** `02-network-access/`
**Purpose:** Reverse proxy and container management
**Services:**
- npm (Nginx Proxy Manager)
- portainer

**Priority:** Deploy SECOND (after core infrastructure)
**Network:** `proxy_net` + `infrastructure_net`

**Depends on:** None (uses public fallback DNS / host Tailscale network)

---

## 🗂️ STACK 3: MONITORING & OBSERVABILITY
**Directory:** `03-monitoring/`
**Purpose:** System monitoring and health checks
**Services:**
- uptime-kuma
- beszel
- beszel-agent ⚠️ FIX REQUIRED
- dozzle
- glances
- homepage (dashboard)

**Network:** `monitoring_net`

**CRITICAL FIX for beszel-agent:**
```yaml
beszel-agent:
  # REMOVE: network_mode: host  ❌
  # ADD:
  networks:
    - monitoring_net
  extra_hosts:
    - "host.docker.internal:host-gateway"
  # This allows host access without breaking DNS
```

---

## 🗂️ STACK 4: PRODUCTIVITY APPS
**Directory:** `04-productivity/`
**Purpose:** Task management, inventory, notes
**Services:**
- vikunja (tasks)
- homebox (inventory)
- memos (notes)
- telegram-memos-bot
- actualbudget (finance)

**Network:** `productivity_net`

---

## 🗂️ STACK 5: KNOWLEDGE BASE & DOCUMENTATION
**Directory:** `05-knowledge-base/`
**Purpose:** Wikis, bookmarks, read-it-later
**Services:**
- linkwarden + linkwarden-db
- outline + outline-db + outline-redis
- docmost + docmost_db + docmost_redis
- wallabag
- hoarder + hoarder-meilisearch + hoarder-workers + hoarder-chrome

**Network:** `knowledge_net`

**Each sub-stack gets its own compose:**
```
05-knowledge-base/
├── linkwarden/
│   └── docker-compose.yml
├── outline/
│   └── docker-compose.yml
├── docmost/
│   └── docker-compose.yml
├── hoarder/
│   └── docker-compose.yml
└── wallabag/
    └── docker-compose.yml
```

---

## 🗂️ STACK 6: MEDIA SERVICES
**Directory:** `06-media/`
**Purpose:** Music streaming and organization
**Services:**
- rclone-mount
- navidrome
- beets
- magiclists

**Network:** `media_net`

**Volume dependencies:**
```yaml
# navidrome and beets both need:
volumes:
  - /home/ubuntu/homelab/music:/music
```

---

## 🗂️ STACK 7: DOCUMENTS & FILE MANAGEMENT
**Directory:** `07-documents/`
**Purpose:** Document processing and file sharing
**Services:**
- paperless + paperless-db + paperless-redis
- stirling-pdf
- filebrowser
- pingvin-share

**Network:** `documents_net`

**Consider splitting:**
```
07-documents/
├── paperless/
│   └── docker-compose.yml
└── file-sharing/
    └── docker-compose.yml
```

---

## 🗂️ STACK 8: UTILITIES & TOOLS
**Directory:** `08-utilities/`
**Purpose:** Various utility services
**Services:**
- it-tools
- changedetection
- microbin
- privatebin
- etherpad
- excalidraw
- reveal (presentations)
- freshrss
- mealie (recipes)
- shlink + shlink-web-client (URL shortener)

**Network:** `utilities_net`

**Note:** These are independent - can split further if needed

---

## 🗂️ STACK 9: COMMUNICATION
**Directory:** `09-communication/`
**Purpose:** Notifications
**Services:**
- ntfy

**Network:** `communication_net` + `proxy_net`

---

## 🗂️ STACK 10: BACKUP SYSTEMS
**Directory:** `10-backup/`
**Purpose:** Deduplicated, encrypted backups with retention policies
**Services:**
- kopia (backup server and Web UI)
- ofelia (backup scheduler)

**Network:** `backup_net` + `proxy_net`

**Backup mechanism:**
- **Source directories:** `/backup-source` mounts the entire `/home/ubuntu/homelab` directory (read-only).
- **Snapshot rules:** Excludes local logs, caches, and repositories via `.kopiaignore` using relative paths to prevent feedback loops.
- **SQLite upload:** A custom script `backup-vaultwarden-gdrive.sh` handles copying Vaultwarden's database backup to staging and uploading it directly to the `gdrive-backups:vaultwarden-backups` remote.

---

## 🗂️ STACK 11: SECURITY & SECRETS
**Directory:** `11-security/`
**Purpose:** Vault and credential storage with isolated backups
**Services:**
- vaultwarden (Bitwarden-compatible server)
- sqlite-helper (SQLite helper utility for backups)

**Network:** `security_net` + `proxy_net`

**Core Configuration:**
- Vaultwarden runs as non-root user `1000:1000`, with all endpoints hardened (PBKDF2 iteration count raised, signups disabled, and device verification email enabled).
- SMTP notification routing is configured via Google Mail (Gmail SMTP).
- `sqlite-helper` runs natively in the security net, handling the database backup sequence via the internal `ofelia` cron schedule (at 1:00 AM daily), outputting consistent backups to `/data/backups/`.

---

## 🗂️ STANDALONE: WORKOUT TRACKER
**Directory:** `workout-tracker/` (Outside homelab main directory)
**Purpose:** Fitness tracking app
**Services:**
- workout-tracker (Flask Python app)

**Network:** `infrastructure_net`

**Core Configuration:**
- Packaged as a production service running via `gunicorn` with 4 workers.
- Runs as a non-root `python` user.
- Host port exposure bound exclusively to `127.0.0.1:5005` on the host to enforce Cloudflare Tunnel access.

---

## 🌐 NETWORK ARCHITECTURE

### Create shared networks file:
**File:** `shared/networks.yml`

```yaml
networks:
  # Public-facing services
  proxy_net:
    name: proxy_net
    driver: bridge
    
  # Core infrastructure (DNS, tunnels)
  infrastructure_net:
    name: infrastructure_net
    driver: bridge
    internal: true  # No external access
    
  # Monitoring systems
  monitoring_net:
    name: monitoring_net
    driver: bridge
    
  # Application networks (isolated per stack)
  productivity_net:
    name: productivity_net
    driver: bridge
    
  knowledge_net:
    name: knowledge_net
    driver: bridge
    
  media_net:
    name: media_net
    driver: bridge
    
  documents_net:
    name: documents_net
    driver: bridge
    
  utilities_net:
    name: utilities_net
    driver: bridge
    
  communication_net:
    name: communication_net
    driver: bridge
    
  backup_net:
    name: backup_net
    driver: bridge
    
  security_net:
    name: security_net
    driver: bridge
```
### Network Assignment Strategy:
1. **Services exposed to internet:** `proxy_net` + their stack network
2. **Services with databases:** Stay within stack network only
3. **Monitoring tools:** `monitoring_net` + access to other networks as needed
4. **Reverse Proxy (NPM):** `proxy_net` + `infrastructure_net`

---

## 🔧 DNS CONFIGURATION

### Shared DNS Config
**File:** [dns-config.yml](file:///home/ubuntu/homelab/shared/dns-config.yml)

```yaml
services:
  dns-base:
    dns:
      - 1.1.1.1     # Cloudflare
      - 8.8.8.8     # Google fallback
    dns_search:
      - homelab.local
```

### Reference in Stack Services
Services import this common configuration via the `extends` mechanism in their `docker-compose.yml`:

```yaml
services:
  myservice:
    extends:
      file: ../shared/dns-config.yml
      service: dns-base
```

---

## 📶 TAILSCALE INTEGRATION & PORT HARDENING

To secure administrative interfaces and internal tools while enabling safe remote access, the server uses a hybrid approach combining **Tailscale** and **Localhost port bindings**.

### Tailscale Host Config
* **Tailscale Host IP:** `100.72.31.46`
* **Tailnet:** `tail161db.ts.net`

### Administrative Interface Protection
All internal administrative dashboards are restricted to the Tailscale interface only, preventing public internet or local LAN exposure:
* **Nginx Proxy Manager Admin Console:** Bound to `100.72.31.46:81` (Internal container port 81). Accessible only via `http://100.72.31.46:81`.
* **Portainer Container Management UI:** Bound to `100.72.31.46:9000` (Internal container port 9000). Accessible only via `http://100.72.31.46:9000`.

### Internal Service Localhost Hardening
All other internal web applications and services that are proxied by Nginx Proxy Manager (or routed via Cloudflare Tunnel) are bound strictly to `127.0.0.1` (localhost only) on the host to block direct network access:
* **Homepage Dashboard:** Bound to `127.0.0.1:3005:3000`
* **Uptime Kuma:** Bound to `127.0.0.1:3001:3001`
* **Dozzle Log Viewer:** Bound to `127.0.0.1:8888:8080`
* **Memos Note-Taking:** Bound to `127.0.0.1:5230:5230`
* **Affine Knowledge Base:** Bound to `127.0.0.1:3010:3010`
* **MkDocs Material Docs Site:** Bound to `127.0.0.1:8010:8000`
* **Kopia Backup Web UI:** Bound to `127.0.0.1:51515:51515`
* **Workout Tracker (Flask):** Bound to `127.0.0.1:5005:5000`

### Nginx Proxy Manager Configured Hosts
The active proxy mappings are stored in the SQLite database (`/home/ubuntu/homelab/02-network-access/npm/data/database.sqlite`):

| Public Domain | Target Service Container | Target Port | Status |
| :--- | :--- | :--- | :--- |
| `logs.iroshan.uk` | `dozzle` | `8080` | ✅ Active |
| `pkm.iroshan.uk` | `affine` | `3010` | ✅ Active |
| `vault.iroshan.uk` | `vaultwarden` | `80` | ✅ Active |
| `adguard.iroshan.uk` | `adguard` | `3000` | ❌ Defunct (AdGuard Removed) |

---

## 📋 OPERATIONAL STATUS CHECKLIST

### 🔒 Core Security & Hardening Controls
- [x] **no-new-privileges:true** set on all services to prevent privilege escalation.
- [x] **Resource Limits** (CPU/Memory limits and reservations) applied to all services to prevent resource exhaustion or DoS.
- [x] **Non-Root Execution**: Critical services (`memos`, `homelab-docs`, `workout-tracker`, and the Vaultwarden database helper) run under unprivileged users (`1000:1000` or native container users) with host directories chowned.
- [x] **Capabilities Dropped**: High-risk services like Vaultwarden run with `cap_drop: [ALL]` to restrict system calls.
- [x] **Isolated Databases**: Databases (e.g., PostgreSQL for Affine) stay on private stack networks and are not exposed on `proxy_net` or host ports.
- [x] **Network Port Bindings**: Services bound strictly to localhost (`127.0.0.1`) or Tailscale IP (`100.72.31.46`) to prevent unauthorized ingress.

---

## 💾 BACKUP VALIDATION & MAINTENANCE

### 1. SQLite Database Backup (Vaultwarden)
The `sqlite-helper` container in `11-security` runs a database backup daily at 1:00 AM.
To trigger it manually:
```bash
docker exec sqlite-helper sh /data/backup-vaultwarden.sh
```
*Backups are outputted to `/home/ubuntu/homelab/11-security/vaultwarden_data/backups/` and the last 7 daily backups are kept.*

### 2. Kopia Snapshot Backup (Entire Homelab)
Kopia creates hourly system state snapshots. Exclusions are managed in `/home/ubuntu/homelab/.kopiaignore` using relative paths to prevent backing up cache/logs recursively.
To run a manual snapshot:
```bash
docker exec kopia kopia snapshot create /backup-source
```
To view all snapshots:
```bash
docker exec kopia kopia snapshot list
```

### 3. Google Drive Uploads
Kopia executes the custom script `backup-vaultwarden-gdrive.sh` at 1:15 AM daily (15m after SQLite backup helper completes) which clones the database backup to staging and uploads it to Google Drive.
To trigger it manually:
```bash
docker exec kopia sh /app/scripts/backup-vaultwarden-gdrive.sh
```
*Verify uploads in the Google Drive dashboard under the folder `vaultwarden-backups`.*

---

## 🚀 ACTIVE DEPLOYMENT SCRIPTS

### Complete Stack Deployment Order (`plan/deploy-all.sh`)
When starting or upgrading the server, deploy stacks in this exact sequence to ensure external networks exist before they are referenced:

1. **01-core-infrastructure** (Creates `infrastructure_net`)
2. **02-network-access** (Creates `proxy_net`)
3. **11-security** (Creates `security_net` — Vaultwarden & backups setup)
4. **03-monitoring** (Creates `monitoring_net` — Uptime Kuma & Homepage)
5. **04-productivity** (Creates `productivity_net`)
6. **05-pkm** & **05-knowledge-base** (Creates `knowledge_net`)
7. **06-documentation** & **06-media** (Creates `media_net` & `docs_net`)
8. **07-documents** (Creates `documents_net`)
9. **08-utilities** (Creates `utilities_net`)
10. **09-communication** (Creates `communication_net`)
11. **10-backup** (Creates `backup_net` — Kopia Snapshot scheduler)
12. **workout-tracker** (Standalone stack)

### Automated Backup Check Script
Verify the scheduler is running:
```bash
docker logs backup-scheduler
```

---

## 📊 HOMELAB ARCHITECTURE ADVANTAGES

- ✅ **Strong Network Segmentation**: Compromised containers cannot communicate laterally across stacks.
- ✅ **Host Isolation**: Ports are isolated to localhost (`127.0.0.1`) where possible, with NPM and Cloudflared handling external TLS termination.
- ✅ **Stateless Backups**: Backup cache, logs, and configurations are mapped to host folders for ease of recovery.
- ✅ **Zero Host Cron Dependencies**: Cron schedules are managed entirely inside Docker using `ofelia`, avoiding external OS dependencies.

