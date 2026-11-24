# Step 1 — Provision a New Server

Prepare a fresh Ubuntu 24.04 server with Docker, Tailscale, firewall rules, and your homelab repo.

---

## 1.1 Base System & Firewall

SSH into the new server:

```bash
ssh ubuntu@<NEW_SERVER_IP>
```

Update packages, set timezone, install essentials, and enable UFW:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip htop rsync ca-certificates gnupg

sudo timedatectl set-timezone Europe/London

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 1.2 Install Docker & Tailscale

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

# Tailscale (used for private admin ports: NPM :81, Portainer :9000, TrueLayer :5007)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Log out and back in so the `docker` group takes effect, then verify:

```bash
docker --version
docker compose version
tailscale ip -4
```

---

## 1.3 Set Up GitHub SSH Key

```bash
ssh-keygen -t ed25519 -C "iroshan464@gmail.com" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Add the printed public key at [github.com/settings/keys](https://github.com/settings/keys), then test:

```bash
ssh -T git@github.com
# Expected: Hi iroshan! You've successfully authenticated...
```

---

## 1.4 Clone the Repository

*(If you are doing **Option A: Planned Live Migration** with `migrate-to-new-server.sh`, skip cloning here — the script transfers `~/homelab` and gives you the git reconnect commands.)*

For **Option B (Disaster Recovery)**:

```bash
cd /home/ubuntu
git clone --depth 1 git@github.com:iroshan/homelab.git homelab
cd ~/homelab
```

---

## 1.5 Create All Docker Networks

```bash
~/homelab/shared/create_networks.sh
```

This creates all required external networks (`infrastructure_net`, `proxy_net`, `monitoring_net`, `productivity_net`, `finance_net`, `pkm_net`, `knowledge_net`, `docs_net`, `media_net`, `documents_net`, `utilities_net`, `communication_net`, `backup_net`, `security_net`).

---

## Checklist

- [ ] Ubuntu 24.04 updated, timezone `Europe/London`, UFW enabled
- [ ] Docker + Compose working without `sudo`
- [ ] Tailscale connected (`tailscale ip -4` returns a `100.x.y.z` address)
- [ ] GitHub SSH key added and `ssh -T git@github.com` works
- [ ] `~/homelab` cloned and networks created

**Next → [Step 2: Restore secrets & data from Kopia](./02-restore-secrets.md)**
