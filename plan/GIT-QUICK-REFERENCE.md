# Git Version Control - Quick Reference

## Status
✅ **OPERATIONAL** | Repository: github.com/iroshan/homelab

## Quick Commands

### View Changes
```bash
git status
git log --oneline -10
```

### Manual Backup
```bash
./scripts/git-backup.sh
```

### Manual Commit
```bash
git add -A
git commit -m "Your message"
git push
```

### Restore File
```bash
git checkout HEAD -- path/to/file
```

### View File History
```bash
git log --oneline -- path/to/file
```

## Automation

**Status:** Systemd timer (hourly)

**Check:**
```bash
sudo systemctl status homelab-git-backup.timer
```

**Logs:**
```bash
tail -f ~/homelab/git-backup.log
```

## What's Tracked

✅ docker-compose files  
✅ Scripts  
✅ Documentation  
✅ Network configs  

❌ .env files  
❌ Secrets  
❌ Data directories  

## Repository

- **URL:** https://github.com/iroshan/homelab
- **Branch:** main
- **Visibility:** Private
- **Auth:** SSH (ed25519)

## Disaster Recovery

```bash
git clone git@github.com:iroshan/homelab.git /home/ubuntu/homelab
# Restore .env from Kopia
# Deploy: ./scripts/deploy-all.sh
```

---
**Docs:** [GIT-IMPLEMENTATION-GUIDE.md](./GIT-IMPLEMENTATION-GUIDE.md)
