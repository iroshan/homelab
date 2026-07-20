# Git Version Control Setup Guide

**Status:** Ready for GitHub connection  
**Created:** 2026-02-12

## ✅ What's Been Set Up

- [x] Git repository initialized
- [x] `.gitignore` created (excludes all sensitive data)
- [x] `README.md` created
- [x] Automation scripts ready
- [ ] **YOU NEED TO DO:** Configure Git user and connect to GitHub

## 🚀 Complete Setup (3 Steps)

### Step 1: Run Git Setup Script

This configures your Git username/email and GitHub authentication:

```bash
cd /home/ubuntu/homelab
./scripts/setup-git.sh
```

**Choose your authentication method:**
- **Option 1: SSH Key (Recommended)** - More secure, no password needed
- **Option 2: Personal Access Token** - Works with HTTPS

Follow the prompts!

---

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name:** `homelab`
3. **Visibility:** ⚠️ **Private** (IMPORTANT!)
4. **Do NOT** check "Initialize with README"
5. Click **"Create repository"**

---

### Step 3: Connect and Push

After creating the GitHub repo, GitHub will show you commands. Run these:

```bash
cd /home/ubuntu/homelab

# Add remote (replace USERNAME with your GitHub username)
git remote add origin git@github.com:USERNAME/homelab.git
# Or if using HTTPS: git remote add origin https://github.com/USERNAME/homelab.git

# Make initial commit
git commit -m "Initial commit: Homelab infrastructure"

# Push to GitHub
git push -u origin main
```

**Verify:** Check https://github.com/USERNAME/homelab - you should see all your files!

---

## 🔒 Security Check

**Before pushing, verify no sensitive data:**

```bash
# This should return "✅ No sensitive files staged"
git status | grep -E "\.env|kopia-config|rclone-config" || echo "✅ No sensitive files staged"

# View what will be committed
git status
```

**What's excluded (not in Git):**
- ❌ `.env` files (passwords, tokens)
- ❌ `kopia-config/` (repository passwords)
- ❌ `rclone-config/` (OAuth tokens)
- ❌ Data directories
- ❌ Logs and cache

---

## 🔄 Enable Automated Backups

Once GitHub is connected, automated backups will run **every hour**.

**Manual backup** (test it):
```bash
./scripts/git-backup.sh
```

**Check logs:**
```bash
tail -f /var/log/git-backup.log
```

---

## 📝 Daily Workflow

Git now tracks your configuration changes automatically!

**Manual commit** (if you want):
```bash
git add -A
git commit -m "Updated XYZ configuration"
git push
```

**View history:**
```bash
git log --oneline -10
```

---

## ⚠️ Troubleshooting

### "Permission denied (publickey)"

SSH key not added to GitHub. Run:
```bash
cat ~/.ssh/id_ed25519.pub
```
Add this key at https://github.com/settings/ssh/new

### "Authentication failed" (HTTPS)

Token expired or incorrect. Create new token:
https://github.com/settings/tokens/new
Required scope: `repo` (all)

---

## 🎉 Next Steps After Setup

1. ✅ Verify first push successful on GitHub
2. ✅ Test automated backup: `./scripts/git-backup.sh`
3. ✅ Make a test change and see it auto-commit (wait 1 hour or run script manually)

---

**Need help?** Check the full guide: [`plan/GIT-IMPLEMENTATION-GUIDE.md`](../plan/GIT-IMPLEMENTATION-GUIDE.md)
