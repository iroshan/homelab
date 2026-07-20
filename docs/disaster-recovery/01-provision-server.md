# Step 1 — Provision a New Server

This step gets a fresh Ubuntu server ready to run the homelab.

---

## 1.1 Create the Server

### Oracle Cloud (Recommended — Free Tier)

1. Log into [cloud.oracle.com](https://cloud.oracle.com)
2. Create Instance → **VM.Standard.A1.Flex** (Ampere ARM)
   - Shape: 4 OCPU, 24 GB RAM (free tier allowance)
   - Image: **Ubuntu 24.04 LTS**
   - Boot volume: 100 GB
3. Add your SSH public key
4. Note the public IP address

### Any Other Ubuntu VPS

Any Ubuntu 22.04/24.04 VPS with 4 GB+ RAM will work.

---

## 1.2 Initial Server Setup

SSH into the new server:

```bash
ssh ubuntu@<NEW_SERVER_IP>
```

Run initial hardening:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create ubuntu user (if not done by cloud provider)
# sudo adduser ubuntu && sudo usermod -aG sudo ubuntu

# Install essential tools
sudo apt install -y curl wget git unzip htop

# Set timezone
sudo timedatectl set-timezone Europe/London

# Enable UFW firewall (allow SSH + HTTP/S only)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 1.3 Install Docker

```bash
# Install Docker Engine (official script)
curl -fsSL https://get.docker.com | sudo sh

# Add ubuntu user to docker group (no sudo needed)
sudo usermod -aG docker ubuntu

# Log out and back in for group change to take effect
exit
# ssh ubuntu@<NEW_SERVER_IP>

# Verify
docker --version
docker compose version
```

Expected output: `Docker version 27.x.x` and `Docker Compose version v2.x.x`

---

## 1.4 Set Up SSH Key for GitHub

```bash
# Generate a new ED25519 SSH key
ssh-keygen -t ed25519 -C "iroshan464@gmail.com" -f ~/.ssh/id_ed25519 -N ""

# Print the public key — you'll add this to GitHub
cat ~/.ssh/id_ed25519.pub
```

Add the public key to GitHub:

1. Go to [github.com/settings/keys](https://github.com/settings/keys)
2. New SSH Key → paste the output above
3. Test: `ssh -T git@github.com` → "Hi iroshan!"

---

## 1.5 Clone the Homelab Repository

```bash
cd /home/ubuntu

# Clone infra configs
git clone git@github.com:iroshan/homelab.git homelab

# Verify structure
ls ~/homelab/
```

Expected directories: `01-core-infrastructure`, `02-network-access`, `03-monitoring`, etc.

---

## 1.6 Create Docker Networks

The stacks use named external networks. Create them before deploying:

```bash
docker network create infrastructure_net
docker network create proxy_net
docker network create monitoring_net
docker network create productivity_net
docker network create pkm_net
docker network create docs_net
docker network create backup_net
docker network create security_net
```

---

## Checklist

- [ ] New server is running Ubuntu 22.04/24.04
- [ ] Docker and Docker Compose installed and working
- [ ] SSH key added to GitHub; `ssh -T git@github.com` succeeds
- [ ] `~/homelab` repo cloned and directory structure is correct
- [ ] All Docker networks created

---

**Next → [Restore secrets from Kopia](./02-restore-secrets.md)**
