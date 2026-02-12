# Homelab Docker Restructure Plan

## Service Categories & Stack Organization

### 📁 PROPOSED DIRECTORY STRUCTURE

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
├── shared/
│   ├── networks.yml        # Shared network definitions
│   └── dns-config.yml      # Common DNS settings
└── scripts/
    ├── deploy-all.sh
    ├── stop-all.sh
    └── update-all.sh
```

---

## 🗂️ STACK 1: CORE INFRASTRUCTURE
**Directory:** `01-core-infrastructure/`
**Purpose:** Essential services that everything else depends on
**Services:**
- adguard (DNS & ad blocking)
- cloudflared (Cloudflare tunnel)

**Priority:** Deploy FIRST
**Network:** `infrastructure_net` (isolated)

**DNS FIX:**
```yaml
# Change AdGuard port binding to avoid conflict
ports:
  - "5053:53/tcp"    # Use non-standard port externally
  - "5053:53/udp"
  - "3000:3000/tcp"
```

---

## 🗂️ STACK 2: NETWORK & ACCESS
**Directory:** `02-network-access/`
**Purpose:** Reverse proxy and container management
**Services:**
- npm (Nginx Proxy Manager)
- portainer

**Priority:** Deploy SECOND (after core infrastructure)
**Network:** `proxy_net` + `infrastructure_net`

**Depends on:** Stack 1 (for DNS)

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
**Purpose:** Backup and disaster recovery
**Services:**
- duplicati
- kopia

**Network:** `backup_net`

**Volume access:** Needs read access to all other stacks' data

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
```

### Network Assignment Strategy:
1. **Services exposed to internet:** `proxy_net` + their stack network
2. **Services with databases:** Stay within stack network only
3. **Monitoring tools:** `monitoring_net` + access to other networks as needed
4. **DNS (AdGuard):** `infrastructure_net` + `proxy_net`

---

## 🔧 DNS CONFIGURATION FIX

### Create shared DNS config:
**File:** `shared/dns-config.yml`

```yaml
# Common DNS settings for all containers
x-dns-settings: &dns-settings
  dns:
    - 172.18.0.2  # AdGuard container IP (set static)
    - 1.1.1.1     # Cloudflare fallback
    - 8.8.8.8     # Google fallback
  dns_search:
    - homelab.local
```

### Set AdGuard static IP:

```yaml
# In 01-core-infrastructure/docker-compose.yml
services:
  adguard:
    networks:
      infrastructure_net:
        ipv4_address: 172.18.0.2  # Static IP for DNS
      proxy_net:

networks:
  infrastructure_net:
    ipam:
      config:
        - subnet: 172.18.0.0/24
```

### Reference in other stacks:

```yaml
# Example in any stack's docker-compose.yml
services:
  myservice:
    <<: *dns-settings  # Import common DNS config
    
# Include at top of each compose file:
include:
  - path: ../shared/dns-config.yml
```

---

## 📋 MIGRATION CHECKLIST

### Phase 1: Preparation
- [ ] Create directory structure
- [ ] Create shared network definitions
- [ ] Create DNS configuration
- [ ] Backup current compose file
- [ ] Export all environment variables to separate .env files per stack

### Phase 2: Core Infrastructure (Can't fail!)
- [ ] Deploy Stack 1 (AdGuard + Cloudflared)
- [ ] Verify DNS resolution working
- [ ] Test internet connectivity through tunnel

### Phase 3: Network Access
- [ ] Deploy Stack 2 (NPM + Portainer)
- [ ] Verify proxy working
- [ ] Verify SSL certificates

### Phase 4: Critical Services (Priority order)
- [ ] Stack 3: Monitoring (so you can watch everything)
- [ ] Stack 4: Productivity
- [ ] Stack 9: Communication (Ntfy for alerts)

### Phase 5: Data Services
- [ ] Stack 5: Knowledge Base (has most databases)
- [ ] Stack 7: Documents
- [ ] Stack 6: Media

### Phase 6: Nice-to-Haves
- [ ] Stack 8: Utilities
- [ ] Stack 10: Backups (set up last, backs up everything)

### Phase 7: Validation
- [ ] Test DNS resolution from each stack
- [ ] Test inter-container communication
- [ ] Test external access through NPM
- [ ] Verify all volumes mounted correctly
- [ ] Check all healthchecks passing
- [ ] Test backup systems

---

## 🔐 SECURITY IMPROVEMENTS

### Per-Stack .env Files:
```bash
# Instead of one giant .env, create:
01-core-infrastructure/.env
02-network-access/.env
03-monitoring/.env
# ... etc
```

### Network Isolation Benefits:
1. Database services can't be accessed by random utilities
2. Media stack isolated from knowledge base
3. Monitoring has read-only access where needed
4. Easier to implement firewall rules per network

---

## 🚀 DEPLOYMENT SCRIPTS

### Deploy All (`scripts/deploy-all.sh`):
```bash
#!/bin/bash
set -e

STACKS=(
  "01-core-infrastructure"
  "02-network-access"
  "03-monitoring"
  "04-productivity"
  "05-knowledge-base"
  "06-media"
  "07-documents"
  "08-utilities"
  "09-communication"
  "10-backup"
)

# Create networks first
docker compose -f shared/networks.yml up -d

# Deploy each stack in order
for stack in "${STACKS[@]}"; do
  echo "🚀 Deploying $stack..."
  cd "$stack"
  docker compose up -d
  cd ..
  sleep 5  # Give services time to start
done

echo "✅ All stacks deployed!"
```

### Update Single Stack:
```bash
cd 05-knowledge-base/
docker compose pull
docker compose up -d
```

---

## 📊 EXPECTED IMPROVEMENTS

### Before (Current Issues):
- ❌ Single 1254-line compose file
- ❌ DNS failures cascade through all services
- ❌ Can't update one service without risk to others
- ❌ Hard to debug which service is failing
- ❌ All services can talk to all other services

### After (New Structure):
- ✅ ~10 focused compose files (50-150 lines each)
- ✅ DNS failure isolated to infrastructure stack
- ✅ Update individual stacks independently
- ✅ Easy to identify failing stack
- ✅ Network segmentation & security
- ✅ Git-friendly (clear commit history per stack)
- ✅ Faster restarts (only affected services)

---

## 🎯 QUICK START RECOMMENDATION

**Don't migrate everything at once!** Start with:

1. **Week 1:** Core Infrastructure + Network Access
2. **Week 2:** Add Monitoring + your most-used service stack
3. **Week 3:** Migrate 2-3 more stacks
4. **Week 4:** Complete migration

This way you can:
- Test the new structure with critical services
- Learn the workflow
- Keep old setup running as fallback
- Gradually migrate when each stack is stable

