# ⚡ Cloudflare Access Quick Start Checklist

## 30-Minute Setup for Zero Trust Authentication

---

## ✅ Prerequisites

- [ ] Domain added to Cloudflare (free plan works!)
- [ ] Cloudflare tunnel token (from earlier setup)
- [ ] Services running (Portainer, NPM, AdGuard, etc.)

---

## 🚀 Part 1: Set Up Tunnel (5 min)

### If you haven't already:

1. **Go to:** https://one.dash.cloudflare.com
2. **Navigate to:** Networks → Tunnels → Create a tunnel
3. **Name it:** `homelab-oracle`
4. **Copy the token**
5. **Add to server:**
   ```bash
   cd ~/homelab/01-core-infrastructure
   nano .env
   # Paste: TUNNEL_TOKEN=eyJ...
   docker compose restart cloudflared
   ```

---

## 🌐 Part 2: Add Public Hostnames (10 min)

**In Cloudflare Zero Trust:**

1. **Go to:** Networks → Tunnels → Your tunnel → Public Hostname
2. **Click:** Add a public hostname

**Add these one by one:**

| Service | Subdomain | URL | No TLS Verify? |
|---------|-----------|-----|----------------|
| Portainer | `portainer` | `portainer:9000` | ✓ |
| NPM Admin | `npm` | `nginx_proxy_manager:81` | ✓ |
| AdGuard | `adguard` | `adguard:3000` | ✓ |
| Uptime Kuma | `uptime` | `uptime_kuma:3001` | ✓ |
| Dozzle | `logs` | `dozzle:8080` | ✓ |

**Important:** 
- Use HTTP (not HTTPS) for URL
- Check "No TLS Verify" under Advanced
- Use container names (not IPs)

**Test:** Visit `https://portainer.yourdomain.com` - should work!

---

## 🔐 Part 3: Set Up Authentication (10 min)

### Step 3.1: Create Access Group

1. **Go to:** Access → Access Groups
2. **Click:** Add a Group
3. **Name:** `Homelab Admins`
4. **Include → Emails:** `your.email@gmail.com`
5. **Click:** Save

### Step 3.2: Enable Login Method

1. **Go to:** Settings → Authentication
2. **Login methods:**
   - Email OTP (already enabled)
   - OR add Google/GitHub

**Recommended:** Add Google for easier login

---

## 🛡️ Part 4: Protect Your Services (5 min each)

### Protect Portainer:

1. **Go to:** Access → Applications → Add an application
2. **Select:** Self-hosted
3. **Fill in:**
   - **Name:** `Portainer`
   - **Subdomain:** `portainer`
   - **Domain:** `yourdomain.com`
   - **Session:** `24 hours`
4. **Click:** Next
5. **Policy:**
   - **Name:** `Allow Admins`
   - **Action:** Allow
   - **Include → Access groups:** `Homelab Admins`
6. **Click:** Next → Next → Add application

### Repeat for Other Services:

**NPM:**
- Name: `Nginx Proxy Manager`
- Subdomain: `npm`

**AdGuard:**
- Name: `AdGuard Home`
- Subdomain: `adguard`

**Uptime Kuma:**
- Name: `Uptime Kuma`
- Subdomain: `uptime`

**Dozzle:**
- Name: `Dozzle Logs`
- Subdomain: `logs`

---

## ✅ Part 5: Test (5 min)

### Test Authentication:

1. **Open incognito window**
2. **Go to:** `https://portainer.yourdomain.com`
3. **You should see:** Cloudflare Access login
4. **Enter your email**
5. **Get OTP code** (or login with Google)
6. **Should redirect** to Portainer

### Test All Services:

- [ ] `https://portainer.yourdomain.com` → Auth required ✓
- [ ] `https://npm.yourdomain.com` → Auth required ✓
- [ ] `https://adguard.yourdomain.com` → Auth required ✓
- [ ] `https://uptime.yourdomain.com` → Auth required ✓
- [ ] `https://logs.yourdomain.com` → Auth required ✓

---

## 🎯 What You Just Did

**Before:**
```
Internet → Service (anyone can access!)
```

**After:**
```
Internet → Cloudflare Access (login required) → Service
```

**Security Layers Now:**
1. 🔒 Cloudflare Access authentication
2. 🔒 Cloudflare Tunnel encryption
3. 🔒 Service's own login (if applicable)
4. 🔒 Firewalls

---

## 💡 Quick Tips

**Session Too Short?**
- Edit application → Change session duration to 7 days

**Want to Add Someone?**
- Access Groups → Homelab Admins → Add their email

**Need More Security?**
- Add IP restrictions
- Require MFA
- Add country-based rules

**View Who Accessed What?**
- Logs → Access (see all login activity)

---

## 🆘 Common Issues

### "Can't authenticate"
```bash
# Clear cookies for *.yourdomain.com
# Try incognito window
# Check email in Access Group is correct
```

### "Redirect loop"
```bash
# In tunnel public hostname settings:
# Verify "No TLS Verify" is checked
# Verify URL is HTTP (not HTTPS)
```

### "Service not accessible"
```bash
# Check tunnel is running:
docker logs cloudflared

# Should see: "Registered tunnel connection"
```

---

## 🎉 You're Done!

All your admin panels are now protected with:
- ✅ Email/Google authentication
- ✅ Session management
- ✅ Access logging
- ✅ Easy to add/remove users

**Total time:** ~30 minutes
**Security improvement:** 🚀🚀🚀

---

## 📝 Quick Reference

**Add new user:**
1. Access → Access Groups → Homelab Admins
2. Add email → Save

**Remove access:**
1. Access → Access Groups → Homelab Admins
2. Remove email → Save
3. Access → Users → Revoke session (if needed)

**View logs:**
1. Logs → Access
2. See all authentication attempts

**Add new service:**
1. Networks → Tunnels → Public Hostname → Add
2. Access → Applications → Add application
3. Use existing "Allow Admins" policy

---

**Next:** Set up the rest of your homelab services! 🚀
