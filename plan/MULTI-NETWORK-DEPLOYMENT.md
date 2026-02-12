# 🚀 Multi-Network Deployment Guide
## Step-by-Step Deployment Sequence

**Important:** Deploy in this exact order to avoid network errors!

---

## 📋 Deployment Overview

```
Phase 1: Foundation (creates infrastructure_net, proxy_net)
  ├─ 01-core-infrastructure
  └─ 02-network-access

Phase 2: Monitoring (creates monitoring_net)
  └─ 03-monitoring (WITHOUT multi-network Homepage)

Phase 3: Application Stacks
  ├─ 09-communication (creates communication_net)
  ├─ 04-productivity (creates productivity_net)
  └─ 07-documents (creates documents_net)

Phase 4: Update Monitoring
  └─ Update Homepage with all networks
```

---

## 🎯 PHASE 1: Foundation (15 minutes)

### Step 1.1: Deploy Core Infrastructure
```bash
cd ~/homelab/01-core-infrastructure
docker compose up -d

# Verify
docker network ls | grep infrastructure
# Should show: infrastructure_net

docker compose ps
# Both containers should be healthy
```

**Networks created:**
- ✅ infrastructure_net (172.18.0.0/24)

---

### Step 1.2: Deploy Network Access
```bash
cd ~/homelab/02-network-access
docker compose up -d

# Verify
docker network ls | grep proxy
# Should show: proxy_net

docker compose ps
# Both containers should be running
```

**Networks created:**
- ✅ proxy_net

**Networks available now:**
- infrastructure_net
- proxy_net

---

## 📊 PHASE 2: Monitoring Stack (10 minutes)

### Step 2.1: Deploy Monitoring (Basic Homepage)
```bash
cd ~/homelab/03-monitoring

# Create compose with ONLY existing networks
cat > docker-compose.yml << 'EOF'
services:

  homepage:
    image: ghcr.io/gethomepage/homepage:v0.9.10
    container_name: homepage
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/London
    volumes:
      - ./homepage_config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "3005:3000"
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
      - infrastructure_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  uptime-kuma:
    image: louislam/uptime-kuma:1.23.17
    container_name: uptime_kuma
    restart: unless-stopped
    volumes:
      - ./uptime_kuma_data:/app/data
    ports:
      - '3001:3001'
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  dozzle:
    image: amir20/dozzle:v8.7.1
    container_name: dozzle
    restart: unless-stopped
    ports:
      - "8888:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - DOZZLE_LEVEL=info
      - DOZZLE_TAILSIZE=300
      - DOZZLE_NO_ANALYTICS=true
      - DOZZLE_BASE=/
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
      - infrastructure_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  monitoring_net:
    name: monitoring_net
    driver: bridge
  
  proxy_net:
    name: proxy_net
    external: true
  
  infrastructure_net:
    name: infrastructure_net
    external: true
EOF

# Deploy
docker compose up -d

# Verify
docker network ls | grep monitoring
# Should show: monitoring_net
```

**Networks created:**
- ✅ monitoring_net

**Networks available now:**
- infrastructure_net
- proxy_net
- monitoring_net

---

### Step 2.2: Create Homepage Config
```bash
cd ~/homelab/03-monitoring
mkdir -p homepage_config

# Settings
cat > homepage_config/settings.yaml << 'EOF'
title: Homelab Dashboard
favicon: https://gethomepage.dev/img/favicon.ico
theme: dark
color: slate

layout:
  Admin Panel:
    style: row
    columns: 3
  Services:
    style: row
    columns: 3
  Monitoring:
    style: row
    columns: 2

showStats: true
EOF

# Services (basic for now)
cat > homepage_config/services.yaml << 'EOF'
---
- Admin Panel:
    - Portainer:
        icon: portainer.png
        href: https://portainer.yourdomain.com
        description: Container Management
        
    - Nginx Proxy Manager:
        icon: nginx-proxy-manager.png
        href: https://npm.yourdomain.com
        description: Reverse Proxy
        
    - AdGuard Home:
        icon: adguard-home.png
        href: https://adguard.yourdomain.com
        description: DNS & Ad Blocking

- Monitoring:
    - Uptime Kuma:
        icon: uptime-kuma.png
        href: https://uptime.yourdomain.com
        description: Service Monitoring
        
    - Dozzle:
        icon: dozzle.png
        href: https://logs.yourdomain.com
        description: Docker Logs
EOF

# Widgets
cat > homepage_config/widgets.yaml << 'EOF'
---
- resources:
    backend: resources
    expanded: true
    cpu: true
    memory: true
    disk: /

- search:
    provider: google
    target: _blank

- datetime:
    text_size: xl
    format:
      dateStyle: long
      timeStyle: short
      hour12: false
EOF

# Docker
cat > homepage_config/docker.yaml << 'EOF'
---
my-docker:
  host: unix:///var/run/docker.sock
EOF

# Restart Homepage to load config
docker restart homepage
```

**Test Homepage:**
```bash
# Open in browser:
http://<your-ip>:3005

# Should see dashboard with current services
```

---

## 📬 PHASE 3: Application Stacks (30 minutes)

### Step 3.1: Deploy Ntfy (Communication Stack)
```bash
mkdir -p ~/homelab/09-communication
cd ~/homelab/09-communication

cat > docker-compose.yml << 'EOF'
services:

  ntfy:
    image: binwiederhier/ntfy:v2.11.0
    container_name: ntfy
    restart: unless-stopped
    command:
      - serve
    ports:
      - "8092:80"
    volumes:
      - ./ntfy_data:/var/cache/ntfy
      - ./ntfy_config:/etc/ntfy
    environment:
      - TZ=Europe/London
      - NTFY_BASE_URL=https://notify.yourdomain.com
      - NTFY_CACHE_FILE=/var/cache/ntfy/cache.db
      - NTFY_AUTH_FILE=/var/cache/ntfy/auth.db
      - NTFY_ATTACHMENT_CACHE_DIR=/var/cache/ntfy/attachments
      - NTFY_ENABLE_LOGIN=true
      - NTFY_BEHIND_PROXY=true
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - communication_net
      - proxy_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  communication_net:
    name: communication_net
    driver: bridge
  
  proxy_net:
    name: proxy_net
    external: true
EOF

# Deploy
docker compose up -d

# Verify
docker network ls | grep communication
# Should show: communication_net

# Test access
curl http://localhost:8092
```

**Networks created:**
- ✅ communication_net

---

### Step 3.2: Deploy Memos (Productivity Stack)
```bash
mkdir -p ~/homelab/04-productivity
cd ~/homelab/04-productivity

# Create .env for Telegram bot
cat > .env << 'EOF'
# Get token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
EOF

chmod 600 .env

cat > docker-compose.yml << 'EOF'
services:

  memos:
    image: neosmemo/memos:0.22.5
    container_name: memos
    restart: unless-stopped
    environment:
      - TZ=Europe/London
    volumes:
      - ./memos_data:/var/opt/memos
    ports:
      - "5230:5230"
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - productivity_net
      - proxy_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  productivity_net:
    name: productivity_net
    driver: bridge
  
  proxy_net:
    name: proxy_net
    external: true
EOF

# Deploy (just Memos for now, bot comes later)
docker compose up -d

# Verify
docker network ls | grep productivity
# Should show: productivity_net

# Test access
curl http://localhost:5230
```

**Networks created:**
- ✅ productivity_net

**Note:** We'll add the Telegram bot after setting up Memos account

---

### Step 3.3: Deploy Stirling-PDF (Documents Stack)
```bash
mkdir -p ~/homelab/07-documents
cd ~/homelab/07-documents

cat > docker-compose.yml << 'EOF'
services:

  stirling-pdf:
    image: stirlingtools/stirling-pdf:0.34.0
    container_name: stirling_pdf
    restart: unless-stopped
    environment:
      - DOCKER_ENABLE_SECURITY=false
      - SYSTEM_DEFAULTLOCALE=en-GB
      - UI_APPNAME=Stirling-PDF
      - LANGS=en_GB
      - INSTALL_BOOK_AND_ADVANCED_HTML_OPS=true
      - SECURITY_ENABLELOGIN=false
    ports:
      - '8080:8080'
    volumes:
      - ./stirling_config:/configs
      - ./stirling_logs:/logs
      - ./stirling_customFiles:/customFiles
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - documents_net
      - proxy_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  documents_net:
    name: documents_net
    driver: bridge
  
  proxy_net:
    name: proxy_net
    external: true
EOF

# Deploy
docker compose up -d

# Verify
docker network ls | grep documents
# Should show: documents_net

# Test access
curl http://localhost:8080
```

**Networks created:**
- ✅ documents_net

---

## 🔄 PHASE 4: Update Homepage with All Networks (5 minutes)

Now that all networks exist, update Homepage to monitor everything!

```bash
cd ~/homelab/03-monitoring

# Backup current compose
cp docker-compose.yml docker-compose.yml.backup

# Update with all networks
cat > docker-compose.yml << 'EOF'
services:

  homepage:
    image: ghcr.io/gethomepage/homepage:v0.9.10
    container_name: homepage
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/London
    volumes:
      - ./homepage_config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "3005:3000"
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
      - infrastructure_net
      - communication_net
      - productivity_net
      - documents_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  uptime-kuma:
    image: louislam/uptime-kuma:1.23.17
    container_name: uptime_kuma
    restart: unless-stopped
    volumes:
      - ./uptime_kuma_data:/app/data
    ports:
      - '3001:3001'
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  dozzle:
    image: amir20/dozzle:v8.7.1
    container_name: dozzle
    restart: unless-stopped
    ports:
      - "8888:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - DOZZLE_LEVEL=info
      - DOZZLE_TAILSIZE=300
      - DOZZLE_NO_ANALYTICS=true
      - DOZZLE_BASE=/
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - monitoring_net
      - proxy_net
      - infrastructure_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  monitoring_net:
    name: monitoring_net
    driver: bridge
  
  proxy_net:
    external: true
  infrastructure_net:
    external: true
  communication_net:
    external: true
  productivity_net:
    external: true
  documents_net:
    external: true
EOF

# Redeploy
docker compose up -d

# Verify Homepage can see all networks
docker inspect homepage | grep -A 20 Networks
```

---

### Update Homepage Services Config
```bash
cd ~/homelab/03-monitoring

cat > homepage_config/services.yaml << 'EOF'
---
- Admin Panel:
    - Portainer:
        icon: portainer.png
        href: https://portainer.yourdomain.com
        description: Container Management
        
    - Nginx Proxy Manager:
        icon: nginx-proxy-manager.png
        href: https://npm.yourdomain.com
        description: Reverse Proxy
        
    - AdGuard Home:
        icon: adguard-home.png
        href: https://adguard.yourdomain.com
        description: DNS & Ad Blocking

- Services:
    - Memos:
        icon: memos.png
        href: https://memos.yourdomain.com
        description: Quick Notes
        
    - Stirling PDF:
        icon: stirling-pdf.png
        href: https://pdf.yourdomain.com
        description: PDF Tools
        
    - Ntfy:
        icon: ntfy.png
        href: https://notify.yourdomain.com
        description: Push Notifications

- Monitoring:
    - Uptime Kuma:
        icon: uptime-kuma.png
        href: https://uptime.yourdomain.com
        description: Service Monitoring
        
    - Dozzle:
        icon: dozzle.png
        href: https://logs.yourdomain.com
        description: Docker Logs
EOF

# Restart Homepage to reload config
docker restart homepage
```

---

## ✅ PHASE 5: Verification (5 minutes)

### Check All Networks
```bash
docker network ls

# Should see:
# infrastructure_net
# proxy_net
# monitoring_net
# communication_net
# productivity_net
# documents_net
```

### Check All Containers
```bash
docker ps --format "table {{.Names}}\t{{.Networks}}\t{{.Status}}"

# Verify each container is on correct networks:
# adguard          -> infrastructure_net
# cloudflared      -> infrastructure_net
# nginx_proxy_manager -> proxy_net, infrastructure_net
# portainer        -> proxy_net, infrastructure_net
# homepage         -> ALL networks
# uptime_kuma      -> monitoring_net, proxy_net
# dozzle           -> monitoring_net, proxy_net, infrastructure_net
# ntfy             -> communication_net, proxy_net
# memos            -> productivity_net, proxy_net
# stirling_pdf     -> documents_net, proxy_net
```

### Test Connectivity
```bash
# Test if NPM can reach Memos (across networks)
docker exec nginx_proxy_manager ping -c 2 memos
# Should work (both on proxy_net)

# Test if Memos can reach AdGuard (across networks)
docker exec memos ping -c 2 adguard
# Should work (both have DNS configured, can resolve)

# Test if Homepage can see all services
curl http://localhost:3005
# Should load dashboard with all services
```

---

## 🌐 PHASE 6: Add to Cloudflare (Optional)

Add public hostnames for new services:

```bash
# In Cloudflare Zero Trust:
# Networks -> Tunnels -> Your tunnel -> Public Hostname

# Add:
# home.yourdomain.com -> homepage:3000
# notify.yourdomain.com -> ntfy:80
# memos.yourdomain.com -> memos:5230
# pdf.yourdomain.com -> stirling_pdf:8080
```

Then add Cloudflare Access policies to protect each!

---

## 📊 Network Diagram - What You Built

```
infrastructure_net (172.18.0.0/24)
├─ adguard (172.18.0.2)
└─ cloudflared

proxy_net (auto)
├─ npm
├─ portainer
├─ homepage
├─ uptime-kuma
├─ dozzle
├─ ntfy
├─ memos
└─ stirling_pdf

monitoring_net (auto)
├─ homepage
├─ uptime-kuma
└─ dozzle

communication_net (auto)
└─ ntfy

productivity_net (auto)
└─ memos

documents_net (auto)
└─ stirling_pdf
```

---

## 🎓 What You Learned

1. **Network Creation Order Matters**
   - External networks must exist before being referenced
   - Create foundation networks first

2. **Multiple Network Assignment**
   - Services can be on multiple networks
   - Homepage monitors across all networks
   - Public services need proxy_net + their own net

3. **Network Isolation**
   - Each stack has its own network
   - Services can only communicate within shared networks
   - Databases would be isolated to their stack network

4. **Practical Docker Networking**
   - How to create networks
   - How to assign services to networks
   - How to troubleshoot connectivity

---

## 🆘 Troubleshooting

### Error: network not found
```bash
# Check which networks exist
docker network ls

# If missing, deploy the stack that creates it
# OR temporarily remove from compose file
```

### Service can't reach another service
```bash
# Check what networks each is on
docker inspect <service1> | grep -A 10 Networks
docker inspect <service2> | grep -A 10 Networks

# They must share at least one network
```

### Homepage not showing services
```bash
# Make sure Homepage is on the service's network
docker inspect homepage | grep -A 20 Networks

# Restart Homepage
docker restart homepage
```

---

## 🎉 Success!

You now have a **production-grade multi-network architecture**!

**Total Networks:** 6
**Total Containers:** 10
**Security Level:** Enterprise-grade 🔒

**What's Next:**
- Add more services to existing networks
- Create new networks for new service categories
- Implement network policies for even finer control
- Learn about custom subnet ranges and IPAM

You're now a Docker networking pro! 🚀
