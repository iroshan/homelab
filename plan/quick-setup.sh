#!/bin/bash
# =============================================================================
# Oracle Cloud ARM64 Homelab Quick Setup Script
# =============================================================================
# This script automates the initial server setup
# Run as: bash quick-setup.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}==>${NC} ${1}"
}

print_success() {
    echo -e "${GREEN}✓${NC} ${1}"
}

print_error() {
    echo -e "${RED}✗${NC} ${1}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} ${1}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "Don't run this script as root! Run as ubuntu user."
   exit 1
fi

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Oracle Cloud ARM64 Homelab Quick Setup              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# STEP 1: System Update
# =============================================================================
print_step "Step 1: Updating system..."
sudo apt update
sudo apt upgrade -y
print_success "System updated"

# =============================================================================
# STEP 2: Install Essential Packages
# =============================================================================
print_step "Step 2: Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    nano \
    htop \
    net-tools \
    ufw \
    fail2ban \
    ca-certificates \
    gnupg \
    lsb-release \
    unattended-upgrades

print_success "Essential packages installed"

# =============================================================================
# STEP 3: Install Docker
# =============================================================================
print_step "Step 3: Installing Docker..."

# Add Docker's GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

print_success "Docker installed"

# =============================================================================
# STEP 4: Configure Docker
# =============================================================================
print_step "Step 4: Configuring Docker..."

sudo mkdir -p /etc/docker
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

sudo systemctl restart docker

print_success "Docker configured"

# =============================================================================
# STEP 5: Configure Firewall
# =============================================================================
print_step "Step 5: Configuring firewall..."

# Allow essential ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 81/tcp    # NPM Admin
sudo ufw allow 9000/tcp  # Portainer

# Enable firewall
sudo ufw --force enable

print_success "Firewall configured"
print_warning "Don't forget to open ports in Oracle Cloud Security List!"

# =============================================================================
# STEP 6: Set Timezone
# =============================================================================
print_step "Step 6: Setting timezone to Europe/London..."
sudo timedatectl set-timezone Europe/London
print_success "Timezone set"

# =============================================================================
# STEP 7: Create Directory Structure
# =============================================================================
print_step "Step 7: Creating homelab directory structure..."

mkdir -p ~/homelab/{01-core-infrastructure,02-network-access,03-monitoring,04-productivity,05-knowledge-base,06-media,07-documents,08-utilities,09-communication,10-backup,scripts}

print_success "Directory structure created"

# =============================================================================
# STEP 8: Create Environment Files
# =============================================================================
print_step "Step 8: Creating environment files..."

cat > ~/homelab/01-core-infrastructure/.env << 'EOF'
# Cloudflare Tunnel Token
# Get from: https://one.dash.cloudflare.com
TUNNEL_TOKEN=REPLACE_WITH_YOUR_TOKEN
EOF

cat > ~/homelab/03-monitoring/.env << 'EOF'
# Beszel Configuration (optional for now)
BESZEL_SSH_KEY=
BESZEL_TOKEN=
BESZEL_HUB_URL=
EOF

# Secure .env files
find ~/homelab -name ".env" -exec chmod 600 {} \;

print_success "Environment files created"

# =============================================================================
# STEP 9: Enable Automatic Updates
# =============================================================================
print_step "Step 9: Enabling automatic updates..."
sudo dpkg-reconfigure --priority=low unattended-upgrades < /dev/null
print_success "Automatic updates enabled"

# =============================================================================
# COMPLETE
# =============================================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete!                                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
print_success "Base system setup complete!"
echo ""
print_warning "IMPORTANT NEXT STEPS:"
echo "1. Log out and log back in for Docker group to take effect:"
echo "   exit"
echo "   ssh ubuntu@<your-ip>"
echo ""
echo "2. Verify Docker works without sudo:"
echo "   docker ps"
echo ""
echo "3. Configure Oracle Cloud Security List (go to web console)"
echo "   Add ingress rules for ports: 22, 80, 81, 443, 9000, 3000, 3001, 8888"
echo ""
echo "4. Edit Cloudflare tunnel token:"
echo "   nano ~/homelab/01-core-infrastructure/.env"
echo ""
echo "5. Continue with manual deployment steps from ORACLE-CLOUD-SETUP.md"
echo ""
print_warning "Oracle Cloud Security List setup is REQUIRED!"
echo "Without it, you won't be able to access your services from the internet."
echo ""
