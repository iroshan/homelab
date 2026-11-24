# Step 0 — Prerequisites

Gather everything below before starting recovery. Keep a copy **outside Vaultwarden** (printed sheet, encrypted USB, or a secondary password manager) since Vaultwarden itself is what you're recovering.

---

## Accounts & Access

| Account | What you need | Used for |
|---|---|---|
| **GitHub** | Login + ability to add an SSH key | Cloning `iroshan/homelab` |
| **Google Account** | Login (for rclone OAuth) | Downloading Kopia + Vaultwarden backups from Google Drive |
| **Cloudflare** | Account login | Checking Tunnel health (token is inside restored `01-core-infrastructure/.env`) |
| **Tailscale** | Account login | Joining the new server to your tailnet (`TAILSCALE_IP` for NPM/Portainer/TrueLayer admin UIs) |
| **VPS Provider** | Oracle Cloud / Hetzner / etc. | Creating the new Ubuntu 24.04 server |

---

## Critical Credentials to Keep Offline

| Item | Why it's critical |
|---|---|
| **`KOPIA_PASSWORD`** | Decrypts the Google Drive backup (`gdrive-backups:homelab-backups`). **Without this, Kopia backups cannot be decrypted.** |
| **Vaultwarden Master Password** | Unlocks your vault once restored. |
| **Google / GitHub / Cloudflare / Tailscale logins** | Needed to bootstrap the new server before Vaultwarden is online. |

!!! tip "Good to know"
    Every `.env` file (Cloudflare tunnel token, Postgres password, Telegram bot tokens, Gemini/TrueLayer/TMDB API keys, Vaultwarden admin token) is stored **inside** the Kopia backup. As long as you have `KOPIA_PASSWORD` + Google Drive + GitHub, you can recover 100% of them.

---

## New Server Specification

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU (ARM64 or x86_64 — all stacks support both) |
| RAM | 4 GB | 8 GB+ |
| Disk | 40 GB | 100 GB SSD (current homelab data is ~770 MB) |
| OS | Ubuntu 22.04 LTS | **Ubuntu 24.04 LTS** |

---

## Checklist

- [ ] Can log into GitHub (`iroshan/homelab`)
- [ ] Can log into Google Drive and see `homelab-backups` and `vaultwarden-backups`
- [ ] Have `KOPIA_PASSWORD` accessible offline
- [ ] Can log into Tailscale and Cloudflare
- [ ] New Ubuntu 24.04 server created and reachable over SSH

**Next → [Step 1: Provision the server](./01-provision-server.md)**
