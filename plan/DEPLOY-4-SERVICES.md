# 🚀 Deploy 4 Essential Services
## Homepage, Ntfy, Memos, Stirling-PDF

**Total Time:** ~45 minutes
**Difficulty:** Easy

---

## 📋 What You're Installing:

1. **Homepage** - Your entrance point & dashboard
2. **Ntfy** - Push notifications to your phone
3. **Memos** - Quick notes with Telegram integration
4. **Stirling-PDF** - Swiss Army knife for PDFs

---

## 🎯 PART 1: Update Monitoring Stack (Homepage)

### Step 1.1: Backup Current Monitoring Stack
```bash
cd ~/homelab/03-monitoring
cp docker-compose.yml docker-compose.yml.backup
```

### Step 1.2: Update Docker Compose
```bash
cd ~/homelab/03-monitoring

# Replace with new compose that includes Homepage
cat > docker-compose.yml << 'EOF'
[PASTE THE CONTENT FROM 03-monitoring-docker-compose.yml]
EOF
```

**Or download the file I created and replace it.**

### Step 1.3: Create Homepage Configuration Directory
```bash
cd ~/homelab/03-monitoring
mkdir -p homepage_config

# Create settings file
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

# Create services file
cat > homepage_config/services.yaml << 'EOF'
---
# ADMIN PANEL
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

# SERVICES
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

# MONITORING
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

# Create widgets file
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

# Create docker file
cat > homepage_config/docker.yaml << 'EOF'
---
my-docker:
  host: unix:///var/run/docker.sock
EOF
```

### Step 1.4: Deploy Updated Monitoring Stack
```bash
cd ~/homelab/03-monitoring
docker compose up -d

# Watch logs
docker compose logs -f homepage

# Wait for "Listening on..." then Ctrl+C
```

### Step 1.5: Access Homepage
```bash
# Open in browser:
http://<your-ip>:3005

# You should see your beautiful dashboard! 🎉
```

---

## 📬 PART 2: Deploy Ntfy (Notifications)

### Step 2.1: Create Communication Stack
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
```

### Step 2.2: Deploy Ntfy
```bash
cd ~/homelab/09-communication
docker compose up -d

# Check logs
docker logs ntfy
```

### Step 2.3: Access Ntfy
```bash
# Open in browser:
http://<your-ip>:8092

# You should see Ntfy interface!
```

### Step 2.4: Set Up Ntfy Account
1. Open Ntfy in browser
2. Click **Account** (top right)
3. Click **Sign up**
4. Create username/password
5. **Subscribe to a topic** (e.g., "homelab")

### Step 2.5: Install Ntfy App on Phone
- **iOS:** https://apps.apple.com/app/ntfy/id1625396347
- **Android:** https://play.google.com/store/apps/details?id=io.heckel.ntfy

**In the app:**
1. Open app
2. Click **+** to add topic
3. Enter your topic name (e.g., "homelab")
4. Enter your server: `https://notify.yourdomain.com` (after you set up tunnel)

### Step 2.6: Test Notification
```bash
# Send test notification
curl -d "Hello from your homelab!" http://localhost:8092/homelab

# Should appear on your phone! 📱
```

---

## 📝 PART 3: Deploy Memos (Notes + Telegram)

### Step 3.1: Get Telegram Bot Token

**In Telegram:**
1. Search for **@BotFather**
2. Start chat
3. Send: `/newbot`
4. Choose a name: `My Homelab Memos Bot`
5. Choose username: `yourusername_memos_bot`
6. **Copy the token** (looks like: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### Step 3.2: Create Productivity Stack
```bash
mkdir -p ~/homelab/04-productivity
cd ~/homelab/04-productivity

# Create .env file
cat > .env << 'EOF'
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
EOF

chmod 600 .env

# Create docker-compose.yml
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

  telegram-memos-bot:
    image: ghcr.io/usememos/telegram-integration:latest
    container_name: telegram_memos_bot
    restart: unless-stopped
    depends_on:
      - memos
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - MEMOS_API=http://memos:5230/api/v1
      - MEMOS_ACCESS_TOKEN=your_memos_access_token
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    networks:
      - productivity_net
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
```

### Step 3.3: Deploy Memos (Without Bot First)
```bash
cd ~/homelab/04-productivity

# Deploy only Memos first
docker compose up -d memos

# Check logs
docker logs memos
```

### Step 3.4: Set Up Memos Account
```bash
# Open in browser:
http://<your-ip>:5230

# 1. Create admin account
# 2. Login
# 3. Go to Settings (gear icon)
# 4. Go to "API" or "Access Tokens"
# 5. Create a new token
# 6. Copy the token
```

### Step 3.5: Add Memos Token and Start Bot
```bash
cd ~/homelab/04-productivity
nano .env

# Add the Memos token:
# TELEGRAM_BOT_TOKEN=123456:ABC...
# MEMOS_ACCESS_TOKEN=your_copied_token_here

# Save and deploy the bot
docker compose up -d telegram-memos-bot

# Check logs
docker logs telegram_memos_bot
```

### Step 3.6: Connect Telegram Bot
**In Telegram:**
1. Search for your bot (the username you created)
2. Start chat
3. Send: `/start`
4. The bot should respond!
5. Try sending a message - it should create a memo!

---

## 📄 PART 4: Deploy Stirling-PDF

### Step 4.1: Create Documents Stack
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
```

### Step 4.2: Deploy Stirling-PDF
```bash
cd ~/homelab/07-documents
docker compose up -d

# Check logs
docker logs stirling_pdf

# Wait for "Started Application"
```

### Step 4.3: Access Stirling-PDF
```bash
# Open in browser:
http://<your-ip>:8080

# You should see the PDF toolkit! 🎉
```

---

## 🌐 PART 5: Add to Cloudflare Tunnel

### Step 5.1: Add Public Hostnames

**In Cloudflare Zero Trust:**
1. **Networks** → **Tunnels** → Your tunnel → **Public Hostname**
2. **Add these hostnames:**

| Service | Subdomain | URL | No TLS Verify? |
|---------|-----------|-----|----------------|
| Homepage | `home` or `dash` | `homepage:3000` | ✓ |
| Ntfy | `notify` | `ntfy:80` | ✓ |
| Memos | `memos` | `memos:5230` | ✓ |
| Stirling-PDF | `pdf` | `stirling_pdf:8080` | ✓ |

---

## 🔐 PART 6: Add Cloudflare Access Protection

### Step 6.1: Protect Each Service

**For each service, create an Access Application:**

**Homepage:**
```
Name: Homepage Dashboard
Subdomain: home (or dash)
Domain: yourdomain.com
Policy: Allow → Homelab Admins
```

**Ntfy:**
```
Name: Ntfy Notifications
Subdomain: notify
Domain: yourdomain.com
Policy: Allow → Homelab Admins
```

**Memos:**
```
Name: Memos Notes
Subdomain: memos
Domain: yourdomain.com
Policy: Allow → Homelab Admins
```

**Stirling-PDF:**
```
Name: Stirling PDF
Subdomain: pdf
Domain: yourdomain.com
Policy: Allow → Homelab Admins
```

---

## ✅ PART 7: Final Testing

### Test All Services:

```bash
# Check all containers running
docker ps

# Should see:
# - homepage
# - uptime_kuma
# - dozzle
# - ntfy
# - memos
# - telegram_memos_bot
# - stirling_pdf
```

### Access via Domain:

- [ ] **Homepage:** https://home.yourdomain.com ✓
- [ ] **Ntfy:** https://notify.yourdomain.com ✓
- [ ] **Memos:** https://memos.yourdomain.com ✓
- [ ] **Stirling-PDF:** https://pdf.yourdomain.com ✓

### Test Integrations:

**Telegram → Memos:**
1. Send message to your bot in Telegram
2. Check Memos web interface
3. Should see the message as a memo! ✓

**Ntfy Phone App:**
1. Send notification: `curl -d "Test" http://localhost:8092/homelab`
2. Should receive on phone! ✓

**Homepage Dashboard:**
1. Should show all services
2. Should show Docker stats
3. Click any service → should open ✓

---

## 🎯 What You Now Have:

✅ **Homepage** - Beautiful dashboard entrance point
✅ **Ntfy** - Push notifications to phone
✅ **Memos** - Quick notes accessible from anywhere
✅ **Telegram Bot** - Send notes from Telegram
✅ **Stirling-PDF** - Comprehensive PDF tools

All protected with Cloudflare Access! 🔐

---

## 💡 Pro Tips:

### Homepage Customization:
```bash
# Edit services
nano ~/homelab/03-monitoring/homepage_config/services.yaml

# Edit widgets
nano ~/homelab/03-monitoring/homepage_config/widgets.yaml

# After changes:
cd ~/homelab/03-monitoring
docker restart homepage
```

### Ntfy Integration with Uptime Kuma:
1. In Uptime Kuma, edit a monitor
2. Set up Notification → ntfy
3. Server URL: `http://ntfy:80/homelab`
4. Now get alerts when services go down!

### Memos Quick Capture:
- **From Telegram:** Just message your bot
- **From Web:** Bookmark https://memos.yourdomain.com
- **From API:** 
  ```bash
  curl -X POST https://memos.yourdomain.com/api/v1/memo \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"content":"Quick note"}'
  ```

### Stirling-PDF Bookmarklet:
Create a browser bookmark that opens Stirling-PDF for quick access!

---

## 🆘 Troubleshooting:

### Homepage Not Showing Services:
```bash
# Check Homepage can access Docker socket
docker exec homepage ls -l /var/run/docker.sock

# Should show the socket file
```

### Telegram Bot Not Responding:
```bash
# Check bot logs
docker logs telegram_memos_bot

# Verify Memos token is correct
docker exec memos cat /var/opt/memos/memos_prod.db
```

### Ntfy Not Receiving on Phone:
```bash
# Check Ntfy is accessible
curl http://localhost:8092/v1/health

# Make sure you subscribed to correct topic
# Make sure server URL is correct in app
```

---

**Total Services Running Now:** 11
**RAM Usage:** ~4-5GB
**Disk Usage:** ~2-3GB
**Oracle Cloud ARM64:** Still plenty of resources left! 💪

---

## 🚀 What's Next?

Now that you have the essentials, you can add:
- **Paperless-NGX** - Document management system
- **Actual Budget** - Personal finance tracking
- **IT-Tools** - Developer utilities collection
- **More from your original list!**

Want me to create guides for those too? 😊
