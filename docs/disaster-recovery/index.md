# 🆘 Disaster Recovery Runbook

!!! danger "Emergency? Start here."
    This runbook covers complete server loss. If you can still access your server, check [Quick Reference](../plan/QUICK-REFERENCE.md) instead.

---

## Scenario

Your server is gone. VPS destroyed, drive failed, data wiped. You have:

- ✅ This documentation (you're reading it)
- ✅ Access to **Google Drive** (Kopia backup — all data and secrets)
- ✅ Access to **GitHub** (this repo — all infra configs)
- ✅ Access to **Cloudflare** (tunnel and DNS)
- ✅ A new server to provision (or the ability to create one)

---

## Recovery Time Estimate

| Phase | Step | Time |
|---|---|---|
| 0 | Gather prerequisites | 15 min |
| 1 | Provision new server | 20 min |
| 2 | Restore secrets from Kopia | 15 min |
| 3 | Deploy all stacks | 20 min |
| 4 | Restore application data | 30 min |
| 5 | Verify everything works | 15 min |
| **Total** | **Full recovery** | **~2 hours** |

---

## Recovery Steps

1. [**Prerequisites →**](./00-prerequisites.md) — what to gather before you start
2. [**Provision server →**](./01-provision-server.md) — fresh Ubuntu + Docker
3. [**Restore secrets →**](./02-restore-secrets.md) — get `.env` files from Kopia/Google Drive
4. [**Deploy stacks →**](./03-deploy-stacks.md) — bring all services back up
5. [**Restore data →**](./04-restore-data.md) — restore Vaultwarden, Affine, Memos data
6. [**Verify →**](./05-verify.md) — confirm everything is healthy

---

## Architecture Overview

```
Internet → Cloudflare Tunnel → Nginx Proxy Manager → Services
                                        ↓
              01-core-infra → 02-network → 03-monitoring
                                        ↓
              04-productivity → 05-pkm → 11-security (Vaultwarden)
                                        ↓
                           10-backup (Kopia + Ofelia)
```

**Key accounts you need:**

| Account | Used For |
|---|---|
| GitHub (`iroshan/homelab`) | Infrastructure configs (this repo) |
| Google Drive | Kopia encrypted backups (data + secrets) |
| Cloudflare | DNS + Tunnel (external access) |
| Oracle Cloud (or other VPS) | Server hosting |
