# Step 2 — Restore Secrets & Data from Google Drive (Kopia)

You do **not** need to remember Kopia commands. Once `rclone` and `kopia` are installed on the new server, `./scripts/restore-from-kopia.sh` guides the entire restore automatically.

---

## 2.1 Install rclone and Kopia on the New Server

```bash
# Install rclone
curl -fsSL https://rclone.org/install.sh | sudo bash

# Install Kopia
curl -fsSL https://kopia.io/signing-key | sudo gpg --dearmor -o /usr/share/keyrings/kopia-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/kopia-keyring.gpg] https://packages.kopia.io/apt/ stable main" \
  | sudo tee /etc/apt/sources.list.d/kopia.list
sudo apt update && sudo apt install -y kopia
```

---

## 2.2 Authorize rclone with Google Drive

Because Google OAuth needs a web browser, run `rclone config` on your **laptop** (or use `rclone authorize "drive"` on your laptop) and copy `rclone.conf` to the new server:

**On your laptop:**

```bash
rclone config
```

Choose:
1. `n` → New remote
2. Name: **`gdrive-backups`** (exact name matters!)
3. Storage: `drive` (Google Drive)
4. `client_id` / `client_secret`: press Enter (defaults)
5. Scope: `1` (`drive` — full access)
6. Auto config: `y` → sign in with the Google account holding your backups
7. Confirm and quit (`q`)

Copy the config to the new server:

```bash
ssh ubuntu@<NEW_SERVER_IP> "mkdir -p ~/.config/rclone"
scp ~/.config/rclone/rclone.conf ubuntu@<NEW_SERVER_IP>:~/.config/rclone/rclone.conf
```

Verify on the **new server**:

```bash
rclone lsd gdrive-backups: | grep -E "homelab-backups|vaultwarden-backups"
```

---

## 2.3 Run the Guided Restore Script (Recommended)

```bash
cd ~/homelab
./scripts/restore-from-kopia.sh
```

What this single script does for you:
1. Prompts securely for your `KOPIA_PASSWORD`
2. Connects Kopia to `gdrive-backups:homelab-backups` (runs via `sudo` so restored files keep exact container UIDs like `70`, `999`, `1000`, `1001`)
3. Lists recent snapshots and lets you press **Enter** for the latest snapshot
4. Restores every `.env` / `*.env` file (including `actual-ai.env`, `finance-bot.env`, `truelayer.env`, `06-media/.env`, `02-network-access/.env`, etc.)
5. Restores all application data directories (`npm/data`, `npm/letsencrypt`, `portainer_data`, `uptime_kuma_data`, `memos_data`, `actual_data`, `truelayer_data`, `finance_bot_data`, `affine_data`, `postgres_data`, `postgres_backups`, `redis_data`, `06-media/data`, `vaultwarden_data`)
6. Copies `rclone.conf` into `10-backup/rclone-config/rclone.conf` (since Kopia excludes it)
7. Updates `TAILSCALE_IP` automatically to the new server's Tailscale IP
8. Creates Docker networks and starts all 9 stacks
9. Automatically checks `affine_postgres` health — and if the hot-copied Postgres directory fails to boot, cleanly reinitializes it from `05-pkm/postgres_backups/latest.sql.gz`
10. Reconnects the Kopia container to Google Drive and installs the hourly `homelab-git-backup.timer`

!!! tip "Want to inspect files before starting containers?"
    Run `./scripts/restore-from-kopia.sh --restore-only`. It restores all secrets and data and stops before starting Docker containers.

---

## 2.4 Verify Secret Files Are Present

```bash
for env in \
  ~/homelab/01-core-infrastructure/.env \
  ~/homelab/02-network-access/.env \
  ~/homelab/03-monitoring/.env \
  ~/homelab/04-productivity/.env \
  ~/homelab/04-productivity/actual-ai.env \
  ~/homelab/04-productivity/finance-bot.env \
  ~/homelab/04-productivity/truelayer.env \
  ~/homelab/05-pkm/.env \
  ~/homelab/06-media/.env \
  ~/homelab/10-backup/.env \
  ~/homelab/11-security/.env \
  ~/homelab/10-backup/rclone-config/rclone.conf; do
    if [ -s "$env" ]; then echo "✅ $env"; else echo "❌ MISSING: $env"; fi
done
```

**Next → [Step 3: Deploy stacks](./03-deploy-stacks.md)** *(or jump straight to [Step 5: Verify](./05-verify.md) if `restore-from-kopia.sh` already deployed everything!)*
