# 🔍 Homelab Infrastructure Analysis & Security Report

This document provides a comprehensive overview of the current homelab deployment, network topology, security profile, backup configurations, and the verification of key systems.

---

## 🖥️ Current System Deployment Status

Only a subset of the services outlined in the original [restructure plan](homelab-restructure-plan.md) are currently deployed and active. The rest are prepared as empty skeleton directories.

### Active Services & Port Mapping

| Service Name | Stack Folder | Docker Container Name | Host Binding / Exposed Ports | Network Associations |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Tunnel** | `01-core-infrastructure` | `f075f3c9fe6d_cloudflared` | *None* | `infrastructure_net`, `proxy_net` |
| **Nginx Proxy Manager** | `02-network-access` | `nginx_proxy_manager` | `0.0.0.0:80`, `0.0.0.0:443`, `100.72.31.46:81` (Tailscale) | `infrastructure_net`, `proxy_net` |
| **Portainer CE** | `02-network-access` | `portainer` | `100.72.31.46:9000` (Tailscale) | `infrastructure_net`, `proxy_net` |
| **Homepage Dashboard** | `03-monitoring` | `775db7bd1684_homepage` | `127.0.0.1:3005` | `infrastructure_net`, `monitoring_net`, `proxy_net` |
| **Uptime Kuma** | `03-monitoring` | `uptime_kuma` | `127.0.0.1:3001` | `monitoring_net`, `proxy_net` |
| **Dozzle Log Viewer** | `03-monitoring` | `dozzle` | `127.0.0.1:8888` | `infrastructure_net`, `monitoring_net`, `proxy_net` |
| **Memos Note-Taking** | `04-productivity` | `memos` | `127.0.0.1:5230` | `productivity_net`, `proxy_net` |
| **Telegram Memos Bot** | `04-productivity` | `telegram_memos_bot` | *None* | `productivity_net` |
| **Affine PKM** | `05-pkm` | `affine` | `127.0.0.1:3010` | `pkm_net`, `proxy_net` |
| **Affine Redis** | `05-pkm` | `affine_redis` | *None* | `pkm_net` |
| **Affine PostgreSQL** | `05-pkm` | `affine_postgres` | *None* | `pkm_net` |
| **MkDocs Documentation** | `06-documentation` | `homelab-docs` | `127.0.0.1:8010` | `docs_net`, `proxy_net` |
| **Kopia Backup Server** | `10-backup` | `kopia` | `127.0.0.1:51515` | `backup_net`, `proxy_net` |
| **Ofelia Backup Scheduler**| `10-backup` | `backup-scheduler` | *None* | `backup_net` |
| **Vaultwarden Password Vault** | `11-security` | `vaultwarden` | *None* | `security_net`, `proxy_net` |
| **SQLite Backup Helper** | `11-security` | `sqlite-helper` | *None* | `security_net` |
| **Workout Tracker** | *Standalone* | `workout-tracker` | `127.0.0.1:5005` | `infrastructure_net` |

### Unused / Skeleton Directories
The following directories exist but have no services configured or running:
* `05-knowledge-base/` (Replaced by `05-pkm` running Affine)
* `06-media/` (Empty)
* `07-documents/` (Empty; `Stirling-PDF` and `Paperless` configs exist only in `plan/` layout files)
* `08-utilities/` (Empty)
* `09-communication/` (Empty)

---

## 🌐 Network Segmentation & Security Hardening

The deployment adopts a secure network layout, following the principles of least privilege and isolation:

1. **Edge/Ingress Layer (`proxy_net` & `infrastructure_net`):**
   * Public HTTP/S traffic hits Nginx Proxy Manager (NPM).
   * External routing via Cloudflare Tunnel (`cloudflared`) connects to internal services through the bridge networks.
2. **Administrative UI Port Hardening:**
   * **Nginx Proxy Manager Admin Panel** (port `81`) and **Portainer CE Console** (port `9000`) are explicitly bound to the Tailscale host interface (`100.72.31.46`). They cannot be accessed via the LAN or WAN without Tailscale connectivity.
3. **Localhost Hardening for Proxied Web Apps:**
   * Web dashboards like Homepage, Uptime Kuma, Dozzle, Memos, Affine, MkDocs, and Workout Tracker bind to `127.0.0.1` on the host, preventing direct network access. Access must go through NPM reverse proxy or a secure tunnel.
4. **Database & Backend Isolation:**
   * Redis, PostgreSQL, and Vaultwarden database engines stay isolated within stack-specific networks (`pkm_net`, `security_net`). They do not expose ports on the host and cannot communicate laterally across stacks.

---

## 💾 Backup Architecture & Verification

The homelab features a robust 3-stage automated backup loop coordinated via `ofelia` scheduler:

```
[1:00 AM] SQLite DB Backup (sqlite-helper) ➔ Output to host volume
     │
[1:15 AM] Upload SQLite to GDrive (rclone script inside Kopia)
     │
[2:00 AM] Kopia System Snapshot ➔ Deduplicated, encrypted sync to GDrive
```

### Critical Kopia Fix Applied (June 2026)

> [!IMPORTANT]
> **Issue Identified:** 
> The daily Kopia backup job (`backup-daily`) was failing with the error:
> `failed to open repository: cannot open storage: unable to start rclone: timed out waiting for rclone to start`.
> 
> **Cause:**
> The Kopia repository configuration file `/home/ubuntu/homelab/10-backup/kopia-config/repository.config` was set to `"startupTimeout": "0s"`. This prevented Kopia from waiting for the rclone process to initialize and authenticate with Google Drive, causing immediate timeouts.
> 
> **Resolution:**
> * Modified the configuration in `repository.config` to set `"startupTimeout": "45s"`.
> * Verified the repository status (`kopia repository status`) successfully opens the storage.
> * Manually triggered a Kopia snapshot (`kopia snapshot create /backup-source`), which completed successfully:
>   * *Snapshot Hash:* `k77761a739dd1443655c7625d7ce4a3bf` (151 MB, 1831 files)

---

## 📈 Optimization Recommendations

1. **Resolve Container Naming Inconsistencies:**
   * The Cloudflare Tunnel container is running as `f075f3c9fe6d_cloudflared` and Homepage is running as `775db7bd1684_homepage`.
   * **Recommendation:** Perform a clean `docker compose down && docker compose up -d` on `01-core-infrastructure` and `03-monitoring` to clear out transient containers and let the `container_name` property enforce clean names.
2. **Update Deprecated Documentation:**
   * Root `README.md` refers to `02-network` (WireGuard) and `09-communication` (Ntfy) which do not exist or are empty.
   * **Recommendation:** Keep the root documentation updated to align with the actual 11-stack structure.
