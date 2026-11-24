# 🆘 Server Migration & Disaster Recovery Runbook

Choose the scenario that matches your situation:

| Scenario | Time | Tooling | When to use |
|---|---|---|---|
| **Option A: Planned Server Move** | **~45 min** | `./scripts/migrate-to-new-server.sh` | Current server is still online; you just want to move to a new VPS cleanly (no Kopia needed!) |
| **Option B: Emergency Disaster Recovery** | **~1.5–2 hrs** | `./scripts/restore-from-kopia.sh` | Old server is gone/wiped; restoring everything from GitHub + Google Drive |

---

## How Your Backups Work (2-Minute Plain-English Guide)

You have **three independent backup layers** running automatically:

1. **GitHub (`iroshan/homelab`) — hourly (`homelab-git-backup.timer`)**
   - Stores all `docker-compose.yml` files, scripts, docs, and custom app code (`finance-bot`, `telegram-memos-bot`).
   - **Never** stores `.env` secrets or application data.
2. **Kopia → Google Drive (`gdrive-backups:homelab-backups`) — daily at 02:00**
   - Think of **Kopia** as encrypted Time Machine for `/home/ubuntu/homelab`: it compresses, deduplicates, and AES-256 encrypts **all `.env` secret files + all application data** (~770 MB total) and uploads them to Google Drive using `rclone`.
   - You don't need to memorize Kopia commands — `./scripts/restore-from-kopia.sh` handles connecting, picking a snapshot, restoring with exact Linux permissions, and starting your stacks.
   - Before Kopia runs at `02:00`, consistent database dumps run automatically:
     - `01:00` — **Vaultwarden** online SQLite backup (`vw-backup`) → uploaded to `gdrive-backups:vaultwarden-backups` at `01:15` (30 daily copies)
     - `01:05` — **Affine PostgreSQL** logical `pg_dump` (`affine-pg-backup`) → saved to `05-pkm/postgres_backups/latest.sql.gz` (7 daily copies, included in Kopia)
3. **Actual Budget Gemini Exports → Google Drive (`ActualBudget-Gemini`) — every 6h**
   - Exports `finance-summary.md` and `transactions-90d.csv` for Gemini (not a DB backup; the actual DB is in Kopia under `04-productivity/actual_data`).

---

## Option A: Planned Server Move (Fastest — Old Server Still Online)

1. Provision the new Ubuntu 24.04 server with Docker + Tailscale ([Step 1](./01-provision-server.md)).
2. On the **old server**, preview then run the migration script:
   ```bash
   cd ~/homelab
   ./scripts/migrate-to-new-server.sh --dry-run ubuntu@<NEW_SERVER_IP>
   ./scripts/migrate-to-new-server.sh ubuntu@<NEW_SERVER_IP>
   ```
   This takes fresh Postgres + Vaultwarden dumps, cleanly stops containers on the old server, and `rsync`s everything (preserving numeric UIDs/permissions) directly to the new server.
3. On the **new server**, run the 4 commands printed at the end of the script:
   ```bash
   cd ~/homelab
   git init && git remote add origin git@github.com:iroshan/homelab.git
   git fetch origin && git reset --mixed origin/main
   ./scripts/set-tailscale-ip.sh
   ./scripts/deploy-all.sh
   sudo ./scripts/install-git-timer.sh
   ```
4. Verify everything ([Step 5](./05-verify.md)). Keep the old server stopped for 24–48h as an instant rollback.

---

## Option B: Full Disaster Recovery Steps (Old Server Gone)

| Phase | Step | Time |
|---|---|---|
| 0 | [Prerequisites](./00-prerequisites.md) — gather offline credentials | 10 min |
| 1 | [Provision server](./01-provision-server.md) — Ubuntu + Docker + Tailscale + clone repo | 20 min |
| 2 | [Restore secrets & data](./02-restore-secrets.md) — rclone + `./scripts/restore-from-kopia.sh` | 20 min |
| 3 | [Deploy stacks](./03-deploy-stacks.md) — automated via `./scripts/deploy-all.sh` | 15 min |
| 4 | [Manual data restore reference](./04-restore-data.md) — per-service recovery if ever needed | 15 min |
| 5 | [Verify](./05-verify.md) — confirm all containers, URLs, and backups are healthy | 10 min |

---

## Active Stack Architecture

```
Internet → Cloudflare Tunnel (01-core-infrastructure)
              ├── Nginx Proxy Manager (02-network-access) → all web services
              └── finance_net → Actual Budget (04-productivity)

Stacks (9 active):
  01-core-infrastructure  → cloudflared
  02-network-access       → nginx_proxy_manager, portainer
  03-monitoring           → uptime_kuma, dozzle
  04-productivity         → memos, telegram_memos_bot, actual-budget,
                            truelayer2actual, actual-finance-bot, actual-ai
  05-pkm                  → affine, affine_postgres, affine_redis
  06-documentation        → homelab-docs
  06-media                → aiostreams, aiometadata, aiometadata_redis, nzbdavex
  10-backup               → kopia, backup-scheduler (Ofelia)
  11-security             → vaultwarden, sqlite-helper
```
