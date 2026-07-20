# Step 0 — Prerequisites

Gather everything below before starting recovery. Most of these are account credentials you should have stored outside Vaultwarden (since Vaultwarden is what we're recovering).

!!! warning "Before you start"
    Keep a printed or offline copy of your critical credentials. You cannot access Vaultwarden if it's not running yet.

---

## Accounts & Access

| Account | What you need | Where to get it |
|---|---|---|
| **GitHub** | Username + password or SSH key | github.com login |
| **Google Drive** | Google account login | google.com login |
| **Cloudflare** | Account login + Zone API token | cloudflare.com login |
| **Oracle Cloud / VPS** | Login to create/access a new server | your provider's console |

---

## Critical Credentials to Have Offline

Store these somewhere safe **outside** your server (printed, USB drive, or trusted password manager not on this server):

| Item | Notes |
|---|---|
| `KOPIA_PASSWORD` | Encrypts Kopia backups — **without this, data is unrecoverable** |
| Cloudflare Tunnel token | Used in `01-core-infrastructure/.env` |
| Google OAuth credentials | Used to re-authorise rclone |
| GitHub SSH private key (or PAT) | To clone the homelab repo |

!!! tip "Kopia Password"
    The Kopia password (`KOPIA_PASSWORD`) is the most critical single credential. Without it, all backup data is permanently unrecoverable — it's encrypted AES-256.

---

## New Server Specification

Minimum recommended spec for full homelab restore:

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 50 GB | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Network | 1 Gbps port | 1 Gbps port |

Oracle Cloud Free Tier (Ampere A1) provides 4 OCPU / 24 GB RAM — plenty of headroom.

---

## Tools to Install on Your Recovery Machine

(Laptop/desktop you're working from, not the server)

```bash
# SSH client (usually pre-installed on Mac/Linux)
ssh --version

# Optional: VS Code or any text editor for reviewing configs
```

---

## Checklist

- [ ] I can log into GitHub and access `iroshan/homelab`
- [ ] I can log into Google Drive and see the `homelab-backups` folder
- [ ] I have the **Kopia password** written down / accessible offline
- [ ] I have access to Cloudflare account and can view tunnel tokens
- [ ] I have a new server provisioned (or VPS account to create one)
- [ ] I know the new server's IP address and have SSH access

---

**Ready? → [Provision the server](./01-provision-server.md)**
