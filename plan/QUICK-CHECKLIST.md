# ✅ Quick Setup Checklist - Oracle Cloud ARM64

## Before You Start
- [ ] Have your Oracle Cloud instance IP address
- [ ] Have SSH access: `ssh ubuntu@<your-ip>`
- [ ] Have Cloudflare account (for tunnel - optional but recommended)

---

## PART 1: Automated Setup (10 minutes)

### 1. Download and run the quick setup script
```bash
# SSH into your server
ssh ubuntu@<your-ip>

# Download the script
wget https://raw.githubusercontent.com/YOUR_REPO/quick-setup.sh
# OR upload it manually

# Make executable
chmod +x quick-setup.sh

# Run it
./quick-setup.sh
```

**What it does:**
- Updates system
- Installs Docker
- Configures firewall
- Creates directory structure
- Sets up environment files

### 2. Log out and back in
```bash
exit
ssh ubuntu@<your-ip>
```

### 3. Verify Docker works
```bash
docker ps
# Should work without "permission denied"
```

---

## PART 2: Oracle Cloud Console (5 minutes)

### 4. Configure Security List (CRITICAL!)

**In Oracle Cloud Console:**

1. Go to: **Hamburger Menu** → **Compute** → **Instances**
2. Click your instance name
3. Under **Instance Details**, find **Primary VNIC**
4. Click the **Subnet** link
5. Click **Default Security List** (or your security list name)
6. Click **Add Ingress Rules**

**Add these rules ONE BY ONE:**

| Source CIDR | IP Protocol | Source Port | Dest Port | Description |
|-------------|-------------|-------------|-----------|-------------|
| 0.0.0.0/0 | TCP | All | 80 | HTTP |
| 0.0.0.0/0 | TCP | All | 443 | HTTPS |
| 0.0.0.0/0 | TCP | All | 81 | NPM Admin |
| 0.0.0.0/0 | TCP | All | 9000 | Portainer |
| 0.0.0.0/0 | TCP | All | 3000 | AdGuard |
| 0.0.0.0/0 | TCP | All | 3001 | Uptime Kuma |
| 0.0.0.0/0 | TCP | All | 8888 | Dozzle |

**OR** if you want everything open (less secure):
- Source CIDR: `0.0.0.0/0`
- IP Protocol: `TCP`
- Source Port: `All`
- Destination Port: `All`

---

## PART 3: Deploy Core Services (20 minutes)

### 5. Get Cloudflare Tunnel Token (Optional but Recommended)

1. Go to: https://one.dash.cloudflare.com
2. Click **Zero Trust** → **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Choose **Cloudflared**
5. Name it: `homelab-oracle`
6. Click **Save tunnel**
7. **COPY THE TOKEN** (long string starting with `eyJ...`)

### 6. Configure Environment Files
```bash
# Edit core infrastructure env
nano ~/homelab/01-core-infrastructure/.env

# Replace:
# TUNNEL_TOKEN=REPLACE_WITH_YOUR_TOKEN
# With your actual token from step 5

# Save: Ctrl+O, Enter, Ctrl+X
```

### 7. Create Docker Compose Files
```bash
# Download the compose files I provided earlier
# Or create them manually using the examples

cd ~/homelab/01-core-infrastructure
# Paste the core-infrastructure compose file here

cd ~/homelab/02-network-access
# Paste the network-access compose file here

cd ~/homelab/03-monitoring
# Paste the monitoring compose file here
```

### 8. Deploy Core Infrastructure
```bash
cd ~/homelab/01-core-infrastructure
docker compose up -d

# Watch logs (Ctrl+C to exit)
docker compose logs -f

# Wait for "AdGuard Home is available"
# Then Ctrl+C
```

### 9. Configure System DNS
```bash
sudo mkdir -p /etc/systemd/resolved.conf.d

sudo tee /etc/systemd/resolved.conf.d/adguard.conf > /dev/null <<EOF
[Resolve]
DNS=127.0.0.1:5353
FallbackDNS=1.1.1.1 8.8.8.8
DNSStubListener=no
EOF

sudo systemctl restart systemd-resolved

# Test
nslookup google.com
```

### 10. Set Up AdGuard
```bash
# In browser: http://<your-ip>:3000
```
- Click **Get Started**
- Set admin username/password
- Finish setup

### 11. Deploy Network Access
```bash
cd ~/homelab/02-network-access
docker compose up -d
docker compose logs -f
# Ctrl+C after services start
```

### 12. Set Up NPM
```bash
# In browser: http://<your-ip>:81

# Login:
# Email: admin@example.com
# Password: changeme

# IMMEDIATELY change these!
```

### 13. Set Up Portainer
```bash
# In browser: http://<your-ip>:9000

# Create admin account
```

### 14. Deploy Monitoring
```bash
cd ~/homelab/03-monitoring
docker compose up -d
docker compose logs -f
# Ctrl+C after services start
```

### 15. Set Up Uptime Kuma
```bash
# In browser: http://<your-ip>:3001

# Create admin account
# Add first monitor for NPM
```

---

## PART 4: Verification (5 minutes)

### 16. Check Everything Running
```bash
docker ps
# Should see 6 containers running
```

### 17. Test Access to All Services

- [ ] AdGuard: http://\<ip>:3000 ✓
- [ ] NPM Admin: http://\<ip>:81 ✓
- [ ] Portainer: http://\<ip>:9000 ✓
- [ ] Uptime Kuma: http://\<ip>:3001 ✓
- [ ] Dozzle: http://\<ip>:8888 ✓

### 18. Check Health
```bash
cd ~/homelab/01-core-infrastructure
docker compose ps
# All should show "healthy" or "running"

cd ~/homelab/02-network-access
docker compose ps

cd ~/homelab/03-monitoring
docker compose ps
```

---

## ✅ SUCCESS!

You now have:
- ✅ Docker running on ARM64
- ✅ AdGuard DNS with ad blocking
- ✅ Cloudflare tunnel (if configured)
- ✅ Nginx Proxy Manager for reverse proxy
- ✅ Portainer for container management
- ✅ Uptime Kuma for monitoring
- ✅ Dozzle for log viewing

---

## Next Steps

### Option A: Add More Services
Follow the categorization in `homelab-restructure-plan.md` to add your other services stack by stack.

### Option B: Set Up Domains
In Cloudflare Zero Trust dashboard, create public hostnames:
- `npm.yourdomain.com` → `http://nginx_proxy_manager:81`
- `portainer.yourdomain.com` → `http://portainer:9000`
- etc.

### Option C: Configure SSL
In NPM, add SSL certificates and create proxy hosts for your domains.

---

## Troubleshooting

### Can't access services from internet?
1. Check Oracle Cloud Security List (most common issue!)
2. Check UFW: `sudo ufw status`
3. Check container is running: `docker ps`

### Container keeps restarting?
```bash
docker logs <container-name>
```

### DNS not working?
```bash
# Check AdGuard running
docker ps | grep adguard

# Check system DNS
cat /etc/systemd/resolved.conf.d/adguard.conf

# Restart
sudo systemctl restart systemd-resolved
```

---

## Important Commands

```bash
# View all containers
docker ps

# View logs
docker logs <container-name>

# Restart container
docker restart <container-name>

# Deploy stack
cd ~/homelab/XX-stack-name
docker compose up -d

# Stop stack
docker compose stop

# Update stack
docker compose pull
docker compose up -d
```

---

## Security Reminder

- [ ] Changed NPM default password
- [ ] Created strong AdGuard password
- [ ] Created strong Portainer password
- [ ] Set up SSH keys (optional but recommended)
- [ ] Configured Cloudflare tunnel for encrypted access
- [ ] Enabled UFW firewall
- [ ] Configured Fail2Ban

---

**Total Time:** ~45 minutes
**Result:** Production-ready homelab base stack!

Now you can start adding your 40+ other services! 🚀
