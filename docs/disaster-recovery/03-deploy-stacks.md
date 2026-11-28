# Step 3 — Deploy All Stacks

*(If you already ran `./scripts/restore-from-kopia.sh` without `--restore-only`, your stacks are already deployed — skip to [Step 5: Verify](./05-verify.md).)*

---

## 3.1 Ensure Tailscale IP Is Set

Admin ports (`81`, `9000`, `5007`) bind to `${TAILSCALE_IP}` in `02-network-access/.env` and `04-productivity/.env`. Always run this once on a new server:

```bash
cd ~/homelab
./scripts/set-tailscale-ip.sh
```

---

## 3.2 Deploy Everything in Order (Recommended)

```bash
cd ~/homelab
./scripts/deploy-all.sh
```

This creates all external Docker networks automatically and starts all 9 active stacks in order:

1. `01-core-infrastructure` — `cloudflared`
2. `02-network-access` — `nginx_proxy_manager`, `portainer`
3. `03-monitoring` — `uptime_kuma`, `dozzle`
4. `04-productivity` — `memos`, `telegram_memos_bot`, `actual-budget`, `truelayer2actual`, `actual-finance-bot`, `actual-ai` *(auto-builds local images on first deploy)*
5. `05-pkm` — `affine_postgres`, `affine_redis`, `affine_migration`, `affine`
6. `06-documentation` — `homelab-docs`
7. `06-media` — `aiostreams`, `aiometadata`, `aiometadata_redis`
8. `10-backup` — `kopia`, `backup-scheduler`
9. `11-security` — `vaultwarden`, `sqlite-helper` *(auto-builds `sqlite-helper`)*

To deploy or rebuild a single stack:

```bash
./scripts/deploy-all.sh --stack 04-productivity --build
```

---

## 3.3 Notes on Specific Stacks

- **`01-core-infrastructure` (`cloudflared`)**: Uses `TUNNEL_TOKEN` from `.env`. Make sure the old server's `cloudflared` is stopped so traffic routes cleanly to the new server. Check status at [one.cloudflare.com](https://one.cloudflare.com) → Networks → Tunnels.
- **`04-productivity` (`truelayer2actual`)**: Builds from a pinned GitHub commit automatically on first `docker compose up -d` (takes ~1–2 minutes).
- **Container UIDs**:
  - `actual-budget`, `truelayer2actual`, `actual-finance-bot` run as UID `1001:1001`.
  - `memos`, `vaultwarden`, `homelab-docs` run as UID `1000:1000`.
  - `affine_postgres` runs as UID `70`.
  - Both `migrate-to-new-server.sh` and `restore-from-kopia.sh` preserve exact numeric UIDs automatically. If you ever manually copy files and see `Permission denied` in container logs, fix ownership with `sudo chown -R <UID>:<GID> <data_dir>`.

---

## 3.4 Install the Hourly Git Config Backup Timer

```bash
sudo ~/homelab/scripts/install-git-timer.sh
```

**Next → [Step 4: Manual Data Restore Reference](./04-restore-data.md)** or **[Step 5: Verify](./05-verify.md)**
