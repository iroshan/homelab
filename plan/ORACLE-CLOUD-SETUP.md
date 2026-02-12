# 🚀 Oracle Cloud ARM64 Homelab Setup Guide
## Complete Step-by-Step Instructions

**Server Specs:** 2 CPU, 12GB RAM, ARM64 Architecture
**OS:** Ubuntu 24.04 ARM64 (assumed)

---

## 📋 PHASE 1: Initial Server Setup (30 minutes)

### Step 1.1: Connect to Your Server
```bash
# From your local machine
ssh ubuntu@<your-server-ip>
```

### Step 1.2: Update System
```bash
# Update package lists
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# Reboot if kernel was updated
sudo reboot

# Reconnect after reboot
ssh ubuntu@<your-server-ip>
```

### Step 1.3: Install Essential Tools
```bash
# Install basic tools
sudo apt install -y \
  curl \
  wget \
  git \
  nano \
  htop \
  net-tools \
  ufw \
  fail2ban

# Install Docker dependencies
sudo apt install -y \
  ca-certificates \
  gnupg \
  lsb-release
```

### Step 1.4: Set Timezone
```bash
# Set to London (or your timezone)
sudo timedatectl set-timezone Europe/London

# Verify
timedatectl
```

---

## 🐳 PHASE 2: Install Docker (15 minutes)

### Step 2.1: Install Docker for ARM64
```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package lists
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 2.2: Configure Docker for Ubuntu User
```bash
# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Apply group changes (logout and login)
exit

# Reconnect
ssh ubuntu@<your-server-ip>

# Test Docker without sudo
docker ps
# Should work without permission error
```

### Step 2.3: Configure Docker for ARM64
```bash
# Create daemon config
sudo mkdir -p /etc/docker

# Configure Docker daemon
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF

# Restart Docker
sudo systemctl restart docker

# Verify
docker info | grep -i "storage driver"
```

---

## 🔥 PHASE 3: Configure Firewall (10 minutes)

### Step 3.1: Set Up UFW (Uncomplicated Firewall)
```bash
# Check current status
sudo ufw status

# Allow SSH (CRITICAL - don't lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS for Nginx Proxy Manager
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow NPM admin interface
sudo ufw allow 81/tcp

# Allow Portainer
sudo ufw allow 9000/tcp

# Enable firewall
sudo ufw --force enable

# Verify
sudo ufw status verbose
```

### Step 3.2: Oracle Cloud Security List (IMPORTANT!)
```bash
# Oracle Cloud has BOTH instance firewall AND VCN Security Lists
# You need to open ports in BOTH places!

# Go to Oracle Cloud Console:
# 1. Navigate to: Compute > Instances > Your Instance
# 2. Click on the Subnet link
# 3. Click on the Default Security List
# 4. Add Ingress Rules:
#    - Source: 0.0.0.0/0
#    - Destination Port: 22, 80, 81, 443, 9000
#    - IP Protocol: TCP

# Or use Oracle Cloud CLI (if you have it configured):
# oci network security-list update --security-list-id <id> ...
```

---

## 📁 PHASE 4: Create Directory Structure (5 minutes)

### Step 4.1: Create Homelab Directory
```bash
# Create main directory
mkdir -p ~/homelab

# Create stack directories
cd ~/homelab
mkdir -p \
  01-core-infrastructure \
  02-network-access \
  03-monitoring \
  04-productivity \
  05-knowledge-base \
  06-media \
  07-documents \
  08-utilities \
  09-communication \
  10-backup \
  scripts

# Verify structure
tree -L 1 ~/homelab
# or if tree not installed:
ls -l ~/homelab
```

### Step 4.2: Set Proper Permissions
```bash
# Ensure ubuntu user owns everything
sudo chown -R ubuntu:ubuntu ~/homelab

# Set directory permissions
chmod -R 755 ~/homelab
```

---

## 🔐 PHASE 5: Create Environment Files (10 minutes)

### Step 5.1: Create Core Infrastructure .env
```bash
cat > ~/homelab/01-core-infrastructure/.env << 'EOF'
# Cloudflare Tunnel Token
# Get from: https://one.dash.cloudflare.com > Zero Trust > Networks > Tunnels
TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
EOF
```

### Step 5.2: Create Monitoring .env
```bash
cat > ~/homelab/03-monitoring/.env << 'EOF'
# Beszel Configuration
BESZEL_SSH_KEY=your_ssh_key_here
BESZEL_TOKEN=your_beszel_token_here
BESZEL_HUB_URL=http://beszel:8090
EOF
```

### Step 5.3: Create Productivity .env
```bash
cat > ~/homelab/04-productivity/.env << 'EOF'
# Placeholder for future secrets
EOF
```

### Step 5.4: Secure Environment Files
```bash
# Set restrictive permissions on .env files
find ~/homelab -name ".env" -exec chmod 600 {} \;

# Verify
find ~/homelab -name ".env" -ls
```

---

## 📥 PHASE 6: Download Docker Compose Files (5 minutes)

### Step 6.1: Get Your Compose Files
```bash
# I'll provide the compose files - you need to create them
# For now, let's create the critical ones

cd ~/homelab
```

### Step 6.2: Create Core Infrastructure Stack
```bash
cat > ~/homelab/01-core-infrastructure/docker-compose.yml << 'EOF'
services:
  
  # DNS & AD BLOCKING
  adguard:
    container_name: adguard
    image: adguard/adguardhome:v0.107.54
    restart: unless-stopped
    ports:
      - "5353:53/tcp"
      - "5353:53/udp"
      - "3000:3000/tcp"
    environment:
      - TZ=Europe/London
    volumes:
      - ./adguard_config/work:/opt/adguardhome/work
      - ./adguard_config/conf:/opt/adguardhome/conf
    networks:
      infrastructure_net:
        ipv4_address: 172.18.0.2
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # CLOUDFLARE TUNNEL
  cloudflared:
    image: cloudflare/cloudflared:2024.12.2
    container_name: cloudflared
    restart: unless-stopped
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - infrastructure_net
    depends_on:
      adguard:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  infrastructure_net:
    name: infrastructure_net
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.18.0.0/24
          gateway: 172.18.0.1
EOF
```

### Step 6.3: Create Network Access Stack
```bash
cat > ~/homelab/02-network-access/docker-compose.yml << 'EOF'
services:

  # NGINX PROXY MANAGER
  npm:
    image: 'jc21/nginx-proxy-manager:2.11.3'
    container_name: nginx_proxy_manager
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    environment:
      - TZ=Europe/London
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    volumes:
      - ./npm/data:/data
      - ./npm/letsencrypt:/etc/letsencrypt
    networks:
      - proxy_net
      - infrastructure_net
    healthcheck:
      test: ["CMD", "/bin/check-health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    security_opt:
      - no-new-privileges:true
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # PORTAINER
  portainer:
    image: portainer/portainer-ce:2.21.4
    container_name: portainer
    restart: unless-stopped
    environment:
      - TZ=Europe/London
    dns:
      - 172.18.0.2
      - 1.1.1.1
      - 8.8.8.8
    security_opt:
      - no-new-privileges:true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./portainer_data:/data
    ports:
      - "9000:9000"
    networks:
      - proxy_net
      - infrastructure_net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  proxy_net:
    name: proxy_net
    driver: bridge
    
  infrastructure_net:
    name: infrastructure_net
    external: true
EOF
```

### Step 6.4: Create Basic Monitoring Stack
```bash
cat > ~/homelab/03-monitoring/docker-compose.yml << 'EOF'
services:

  # UPTIME MONITORING
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

  # LOGS VIEWER
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

networks:
  monitoring_net:
    name: monitoring_net
    driver: bridge
    
  proxy_net:
    name: proxy_net
    external: true
EOF
```

---

## 🚀 PHASE 7: Deploy Stack by Stack (30 minutes)

### Step 7.1: Deploy Core Infrastructure (DNS)
```bash
cd ~/homelab/01-core-infrastructure

# IMPORTANT: Add your Cloudflare tunnel token to .env first!
nano .env
# Replace: TUNNEL_TOKEN=your_cloudflare_tunnel_token_here

# Deploy
docker compose up -d

# Watch logs
docker compose logs -f

# Wait until you see AdGuard is ready (Ctrl+C to exit logs)
# Should see: "AdGuard Home is available at..."

# Verify containers are running
docker compose ps

# Test AdGuard is accessible
curl http://localhost:3000
# Should return HTML

# Check AdGuard health
docker inspect adguard | grep -A 10 Health
```

### Step 7.2: Configure System DNS (CRITICAL!)
```bash
# Point your server to use AdGuard on port 5353
sudo mkdir -p /etc/systemd/resolved.conf.d

sudo tee /etc/systemd/resolved.conf.d/adguard.conf > /dev/null <<EOF
[Resolve]
DNS=127.0.0.1:5353
FallbackDNS=1.1.1.1 8.8.8.8
DNSStubListener=no
EOF

# Restart systemd-resolved
sudo systemctl restart systemd-resolved

# Verify DNS is working
nslookup google.com
# Should show server: 127.0.0.1:5353
```

### Step 7.3: Initial AdGuard Setup
```bash
# Open in browser: http://<your-server-ip>:3000

# Setup wizard:
# 1. Click "Get Started"
# 2. Admin interface: Keep default (3000)
# 3. DNS interface: Keep default (53)
# 4. Create admin username/password
# 5. Configure devices: Skip for now
# 6. Finish setup

# IMPORTANT: Enable encryption in AdGuard settings
# Settings > Encryption Settings
# Enable "Redirect to HTTPS automatically"
```

### Step 7.4: Deploy Network Access (NPM + Portainer)
```bash
cd ~/homelab/02-network-access

# Deploy
docker compose up -d

# Watch logs
docker compose logs -f

# Wait for both services to be ready
# Ctrl+C to exit

# Verify
docker compose ps
```

### Step 7.5: Initial NPM Setup
```bash
# Open in browser: http://<your-server-ip>:81

# Default credentials:
# Email: admin@example.com
# Password: changeme

# IMMEDIATELY change these on first login!

# Setup:
# 1. Login with defaults
# 2. Change email and password
# 3. Dashboard should now be visible
```

### Step 7.6: Initial Portainer Setup
```bash
# Open in browser: http://<your-server-ip>:9000

# Setup:
# 1. Create admin user (username + password)
# 2. Select "Get Started"
# 3. Click on "local" environment
# 4. You should see your running containers
```

### Step 7.7: Deploy Monitoring
```bash
cd ~/homelab/03-monitoring

# Deploy
docker compose up -d

# Watch logs
docker compose logs -f

# Verify
docker compose ps

# Access services:
# Uptime Kuma: http://<your-server-ip>:3001
# Dozzle: http://<your-server-ip>:8888
```

### Step 7.8: Initial Uptime Kuma Setup
```bash
# Open: http://<your-server-ip>:3001

# Setup:
# 1. Create admin account
# 2. Add your first monitor:
#    - Monitor Type: HTTP(s)
#    - Friendly Name: "Nginx Proxy Manager"
#    - URL: http://npm:81
#    - Heartbeat Interval: 60 seconds
# 3. Save

# Add more monitors for:
# - Portainer: http://portainer:9000
# - AdGuard: http://adguard:3000
```

---

## ✅ PHASE 8: Verification (10 minutes)

### Step 8.1: Check All Containers Running
```bash
# List all running containers
docker ps

# Expected output: 6 containers
# - adguard
# - cloudflared
# - nginx_proxy_manager
# - portainer
# - uptime_kuma
# - dozzle

# Check for any restarting containers
docker ps -a | grep -i restarting
# Should be empty
```

### Step 8.2: Test DNS Resolution
```bash
# From the host
nslookup google.com
# Should resolve using 127.0.0.1

# From inside a container
docker exec nginx_proxy_manager nslookup google.com
# Should resolve using 172.18.0.2 (AdGuard)
```

### Step 8.3: Test Container Communication
```bash
# Test if npm can reach adguard
docker exec nginx_proxy_manager ping -c 3 adguard
# Should work

# Test if uptime-kuma can reach npm
docker exec uptime_kuma ping -c 3 npm
# Should work
```

### Step 8.4: Check Disk Space
```bash
# Check Docker disk usage
docker system df

# Check overall disk usage
df -h

# You should have plenty of space with 2 CPU / 12GB RAM instance
```

### Step 8.5: Check Memory Usage
```bash
# Check current memory usage
free -h

# Watch live stats
docker stats --no-stream

# With these 6 containers, you should be using ~2-3GB RAM
# Still have ~9GB free for more services
```

---

## 🎯 PHASE 9: Next Steps

### Option A: Add More Services Now
```bash
# You can now start adding services from your original compose file
# Use the categorization I provided earlier

# Example: Add Homepage dashboard
cd ~/homelab/03-monitoring

# Edit docker-compose.yml and add homepage service
# Then:
docker compose up -d
```

### Option B: Configure Cloudflare Tunnel
```bash
# In Cloudflare Zero Trust dashboard:
# 1. Create Public Hostnames for your services:
#    - npm.yourdomain.com -> http://nginx_proxy_manager:81
#    - portainer.yourdomain.com -> http://portainer:9000
#    - uptime.yourdomain.com -> http://uptime_kuma:3001
#    - adguard.yourdomain.com -> http://adguard:3000

# Then access your services via:
# https://npm.yourdomain.com
# https://portainer.yourdomain.com
# etc.
```

### Option C: Set Up SSL in NPM
```bash
# In NPM (http://<ip>:81):
# 1. SSL Certificates > Add SSL Certificate
# 2. Choose "Let's Encrypt"
# 3. Enter your domain and email
# 4. Enable "Force SSL"
# 5. Save

# Then create Proxy Hosts:
# 1. Proxy Hosts > Add Proxy Host
# 2. Domain: portainer.yourdomain.com
# 3. Forward to: portainer:9000
# 4. Select your SSL certificate
# 5. Enable "Force SSL", "HTTP/2", "HSTS"
# 6. Save
```

---

## 🔒 PHASE 10: Security Hardening (20 minutes)

### Step 10.1: Configure Fail2Ban
```bash
# Install fail2ban (if not already)
sudo apt install -y fail2ban

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit config
sudo nano /etc/fail2ban/jail.local

# Find [sshd] section and ensure:
# enabled = true
# port = 22
# logpath = /var/log/auth.log

# Restart fail2ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status sshd
```

### Step 10.2: Disable Password Authentication (Use SSH Keys)
```bash
# First, make sure you have SSH key set up!
# On your LOCAL machine:
# ssh-copy-id ubuntu@<your-server-ip>

# Then on server:
sudo nano /etc/ssh/sshd_config

# Change these lines:
# PasswordAuthentication no
# PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd

# Test in NEW terminal (don't close current one!):
ssh ubuntu@<your-server-ip>
# Should work without password
```

### Step 10.3: Set Up Automatic Updates
```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Enable automatic updates
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes"

# Verify
sudo systemctl status unattended-upgrades
```

### Step 10.4: Set Up Docker Log Rotation
```bash
# Already configured in daemon.json, but verify:
docker info | grep -i "log options"
# Should show: max-size=10m, max-file=3
```

---

## 📊 System Status Commands

```bash
# Quick health check
echo "=== Docker Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Memory Usage ==="
free -h
echo ""
echo "=== Disk Usage ==="
df -h
echo ""
echo "=== Network Status ==="
docker network ls
```

---

## 🆘 Troubleshooting

### Container won't start
```bash
# Check logs
docker logs <container-name>

# Check for port conflicts
sudo lsof -i :<port-number>

# Try recreating
docker compose down
docker compose up -d
```

### Can't access services from internet
```bash
# Check Oracle Cloud Security List (most common issue!)
# Go to: Compute > Instances > Subnet > Security List
# Add Ingress Rule: 0.0.0.0/0 -> Port -> TCP

# Check UFW
sudo ufw status

# Check container is actually listening
docker ps
```

### DNS not working
```bash
# Check AdGuard is running
docker ps | grep adguard

# Check DNS config
cat /etc/systemd/resolved.conf.d/adguard.conf

# Restart resolved
sudo systemctl restart systemd-resolved

# Test
nslookup google.com
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Server updated and rebooted
- [ ] Docker installed and working without sudo
- [ ] Firewall configured (UFW + Oracle Cloud)
- [ ] Directory structure created
- [ ] Core infrastructure deployed (AdGuard + Cloudflare)
- [ ] System DNS pointing to AdGuard
- [ ] Network access deployed (NPM + Portainer)
- [ ] Monitoring deployed (Uptime Kuma + Dozzle)
- [ ] All services accessible via IP
- [ ] DNS resolution working
- [ ] Container communication working
- [ ] Security hardened (Fail2Ban, SSH keys)

---

## 🎉 You're Done!

Your base homelab is now running!

**Access Points:**
- AdGuard: http://<ip>:3000
- NPM Admin: http://<ip>:81
- Portainer: http://<ip>:9000
- Uptime Kuma: http://<ip>:3001
- Dozzle: http://<ip>:8888

**Next:** Start migrating your other services stack by stack!
