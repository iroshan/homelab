# Git Version Control Implementation Guide

**Status:** ✅ Deployed and Operational  
**Date:** 2026-02-12  
**Repository:** https://github.com/iroshan/homelab

## Overview

Version control for entire homelab configuration with automated backups to private GitHub repository.

## Quick Facts

- **Platform:** Git + GitHub
- **Repository:** Private
- **Files Tracked:** 98 configuration files
- **Automation:** Hourly automated commits
- **Security:** Comprehensive .gitignore excludes all secrets

## What's Tracked

**Included:**
- All docker-compose.yml files
- Scripts and automation
- Documentation (plan folder)
- Shared network configs
- README and setup guides

**Excluded:**
- .env files (passwords, tokens)
- kopia-config/ (backup passwords)
- rclone-config/ (OAuth tokens)
- Data directories
- SSL certificates
- Logs and cache

## Setup Steps

### 1. Initialize Repository

```bash
cd /home/ubuntu/homelab
git init
git branch -m main
```

### 2. Create .gitignore

Comprehensive exclusion patterns for sensitive data.

### 3. Configure Git

```bash
./scripts/setup-git.sh
```

Choose SSH or token authentication.

### 4. Create GitHub Repository

- URL: https://github.com/new
- Name: homelab
- Visibility: **Private**
- Don't initialize with README

### 5. Connect and Push

```bash
git remote add origin git@github.com:USERNAME/homelab.git
git add -A
git commit -m "Initial commit"
git push -u origin main
```

### 6. Enable Automation

```bash
./scripts/setup-git-automation.sh
```

Sets up systemd timer for hourly backups.

## Automated Backups

**Script:** `scripts/git-backup.sh`

**What it does:**
1. Detects changes
2. Commits with auto-generated message  
3. Pushes to GitHub
4. Logs all actions

**Schedule:** Hourly via systemd timer

**Manual run:**
```bash
./scripts/git-backup.sh
```

## Common Commands

### View History
```bash
git log --oneline -10
```

### Check Status
```bash
git status
```

### Manual Commit
```bash
git add -A
git commit -m "Your message"
git push
```

### Restore File
```bash
git checkout HEAD~1 -- path/to/file
```

## Disaster Recovery

### Full System Loss

```bash
# Clone repository
git clone git@github.com:USERNAME/homelab.git /home/ubuntu/homelab

# Restore .env files from Kopia backup
# Deploy services
./scripts/deploy-all.sh
```

### Accidental Change

```bash
# Revert last commit
git revert HEAD
git push
```

## Security

- **Repository:** Private on GitHub
- **Authentication:** SSH key (ed25519)
- **Secrets:** Excluded via .gitignore
- **Verification:** No sensitive data in commits

## Monitoring

```bash
# View recent auto-commits
git log --grep="AUTO" --oneline -5

# Check backup log
tail -f ~/homelab/git-backup.log

# Verify systemd timer
sudo systemctl status homelab-git-backup.timer
```

## Files Reference

- `scripts/git-backup.sh` - Automated backup
- `scripts/setup-git.sh` - Initial setup
- `scripts/setup-git-automation.sh` - Enable hourly backups
- `.gitignore` - Exclusion patterns
- `SETUP-GIT.md` - User guide

## Combined with Kopia

**Two-layer backup strategy:**

- **Git:** Configuration files, version history
- **Kopia:** Data, secrets, complete state

Together provide complete protection and easy recovery.

---

**Last Updated:** 2026-02-12  
**Status:** ✅ Production Ready
