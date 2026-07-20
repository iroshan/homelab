# Step 2 — Restore Secrets from Kopia Backup

All `.env` files (secrets) are stored in the Kopia encrypted backup on Google Drive. This step recovers them onto the new server.

!!! danger "Critical: Kopia Password"
    You MUST have your `KOPIA_PASSWORD` to proceed. Without it, all backup data is permanently unrecoverable.

---

## 2.1 Install rclone on the New Server

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Verify
rclone version
```

---

## 2.2 Configure rclone for Google Drive

You need to re-authorise rclone with Google Drive. Do this from your laptop (it needs a browser), then copy the config to the server.

**On your laptop:**

```bash
# Install rclone on laptop if not already
# macOS: brew install rclone
# Ubuntu: curl https://rclone.org/install.sh | sudo bash

# Configure Google Drive remote
rclone config
```

Follow the prompts:
1. `n` → New remote
2. Name: `gdrive-backups`
3. Storage: `drive` (Google Drive)
4. Leave client_id and secret blank (use defaults)
5. Scope: `drive` (full access)
6. Auto config: `y` (opens browser)
7. Authorise with the **same Google account** that has your backups
8. `y` to confirm

Copy config to server:

```bash
# View your rclone config on laptop
cat ~/.config/rclone/rclone.conf

# Copy to server (replace SERVER_IP)
scp ~/.config/rclone/rclone.conf ubuntu@<SERVER_IP>:~/.config/rclone/rclone.conf
```

Or manually create on server:

```bash
mkdir -p ~/.config/rclone
nano ~/.config/rclone/rclone.conf
# Paste the [gdrive-backups] section from your laptop
```

**Verify connection on server:**

```bash
rclone ls gdrive-backups:homelab-backups --max-depth 1
```

You should see Kopia repository files.

---

## 2.3 Install Kopia on the New Server

```bash
# Add Kopia repository
curl -s https://kopia.io/signing-key | sudo gpg --dearmor -o /usr/share/keyrings/kopia-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/kopia-keyring.gpg] https://packages.kopia.io/apt/ stable main" | sudo tee /etc/apt/sources.list.d/kopia.list

# Install
sudo apt update && sudo apt install kopia -y

# Verify
kopia --version
```

---

## 2.4 Connect to the Kopia Repository

```bash
# Connect to Google Drive repository
kopia repository connect rclone \
  --remote-path=gdrive-backups:homelab-backups \
  --password=<YOUR_KOPIA_PASSWORD>
```

Replace `<YOUR_KOPIA_PASSWORD>` with your offline-stored Kopia password.

**Verify:**

```bash
# List available snapshots
kopia snapshot list
```

You should see dated snapshots of `/backup-source`.

---

## 2.5 Restore .env Files

The homelab source is backed up at `/backup-source` which maps to `/home/ubuntu/homelab`.

```bash
# Create a temp restore directory
mkdir -p /tmp/kopia-restore

# Restore the latest snapshot to temp
kopia snapshot restore latest /tmp/kopia-restore

# Find all .env files in the restore
find /tmp/kopia-restore -name ".env" | sort
```

Copy .env files to their correct locations:

```bash
# Core infrastructure
cp /tmp/kopia-restore/01-core-infrastructure/.env ~/homelab/01-core-infrastructure/.env

# Network access
cp /tmp/kopia-restore/02-network-access/.env ~/homelab/02-network-access/.env

# Monitoring
cp /tmp/kopia-restore/03-monitoring/.env ~/homelab/03-monitoring/.env 2>/dev/null || echo "no .env needed"

# Productivity
cp /tmp/kopia-restore/04-productivity/.env ~/homelab/04-productivity/.env

# PKM (Affine)
cp /tmp/kopia-restore/05-pkm/.env ~/homelab/05-pkm/.env

# Backup stack
cp /tmp/kopia-restore/10-backup/.env ~/homelab/10-backup/.env

# Security (Vaultwarden)
cp /tmp/kopia-restore/11-security/.env ~/homelab/11-security/.env

# Workout tracker
cp /tmp/kopia-restore/workout-tracker/.env ~/homelab/workout-tracker/.env 2>/dev/null || true
```

Also restore the rclone config for the Kopia container (different from system rclone):

```bash
cp -r /tmp/kopia-restore/10-backup/rclone-config ~/homelab/10-backup/rclone-config
```

---

## 2.6 Verify Secrets Are In Place

```bash
# Check key .env files exist and are non-empty
for env in \
  ~/homelab/01-core-infrastructure/.env \
  ~/homelab/02-network-access/.env \
  ~/homelab/04-productivity/.env \
  ~/homelab/05-pkm/.env \
  ~/homelab/10-backup/.env \
  ~/homelab/11-security/.env; do
    if [ -f "$env" ] && [ -s "$env" ]; then
        echo "✅ $env"
    else
        echo "❌ MISSING: $env"
    fi
done
```

---

## Checklist

- [ ] rclone installed and configured with Google Drive
- [ ] Kopia installed and connected to Google Drive repository
- [ ] Snapshot list shows recent snapshots
- [ ] All `.env` files restored to correct locations
- [ ] rclone config for Kopia container restored to `10-backup/rclone-config/`

---

**Next → [Deploy all stacks](./03-deploy-stacks.md)**
