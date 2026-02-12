# 🔐 Cloudflare Access Setup Guide
## Protect Your Homelab with Zero Trust Authentication

---

## 📋 Overview

**What is Cloudflare Access?**
A Zero Trust authentication layer that sits in front of your services. Users must authenticate (email, Google, GitHub, etc.) before accessing your apps.

**What You'll Protect:**
- ✅ Portainer (container management)
- ✅ AdGuard Admin (DNS settings)
- ✅ Nginx Proxy Manager Admin (reverse proxy settings)
- ✅ Uptime Kuma (monitoring dashboard)
- ✅ Dozzle (logs viewer)
- ✅ Any other admin panels

**What You WON'T Protect:**
- ❌ Public-facing services (like a blog)
- ❌ API endpoints that need direct access
- ❌ Services that handle their own auth (unless you want double protection)

---

## 🚀 PART 1: Set Up Cloudflare Tunnel (If Not Done)

### Step 1.1: Create a Cloudflare Tunnel

1. **Go to:** https://one.dash.cloudflare.com
2. **Navigate to:** Networks → Tunnels
3. **Click:** Create a tunnel
4. **Select:** Cloudflared
5. **Name:** `homelab-oracle` (or whatever you like)
6. **Click:** Save tunnel
7. **Copy the token** (starts with `eyJ...`)

### Step 1.2: Add Token to Your Server

```bash
# On your Oracle server
cd ~/homelab/01-core-infrastructure
nano .env

# Replace the placeholder with your actual token:
TUNNEL_TOKEN=eyJhIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw...

# Save: Ctrl+O, Enter, Ctrl+X

# Restart cloudflared to use new token
docker compose restart cloudflared

# Verify it's connected
docker logs cloudflared
# Should see: "Registered tunnel connection"
```

---

## 🌐 PART 2: Create Public Hostnames (Tunnels)

### Step 2.1: Add Your First Service (Portainer Example)

**In Cloudflare Zero Trust Dashboard:**

1. **Go to:** Networks → Tunnels
2. **Click** on your tunnel name
3. **Go to:** Public Hostname tab
4. **Click:** Add a public hostname

**Configure Portainer:**
- **Subdomain:** `portainer`
- **Domain:** `yourdomain.com` (select from dropdown)
- **Type:** HTTP
- **URL:** `portainer:9000`

**Advanced settings (click the arrow):**
- **No TLS Verify:** ✓ (check this)
- Click **Save hostname**

### Step 2.2: Add Other Services

Repeat for each service:

| Service | Subdomain | URL | Port |
|---------|-----------|-----|------|
| Portainer | `portainer` | `portainer:9000` | 9000 |
| NPM Admin | `npm` | `nginx_proxy_manager:81` | 81 |
| AdGuard | `adguard` | `adguard:3000` | 3000 |
| Uptime Kuma | `uptime` | `uptime_kuma:3001` | 3001 |
| Dozzle | `logs` | `dozzle:8080` | 8080 |

**Important Notes:**
- Use **container names** (not localhost or IP)
- Always use **HTTP** (not HTTPS) for internal connections
- Always check **No TLS Verify** in advanced settings

### Step 2.3: Test Access (Before Adding Auth)

```bash
# In your browser, test each URL:
https://portainer.yourdomain.com
https://npm.yourdomain.com
https://adguard.yourdomain.com

# Should work WITHOUT authentication (for now)
```

---

## 🔐 PART 3: Set Up Cloudflare Access (Authentication)

### Step 3.1: Create an Access Group

**This defines WHO can access your services**

1. **Go to:** Access → Access Groups
2. **Click:** Add a Group
3. **Name:** `Homelab Admins`
4. **Define the group:**
   - **Include:**
     - **Selector:** Emails
     - **Value:** `your.email@gmail.com` (your email)
     - Click **Add include**
   
5. **Click:** Save

**You can add multiple emails:**
```
your.email@gmail.com
trusted.friend@gmail.com
family.member@gmail.com
```

### Step 3.2: Configure an Authentication Method

1. **Go to:** Settings → Authentication
2. **Login methods** section
3. **Select one (or more):**

**Option A: Email OTP (Simplest)**
- Already enabled by default
- Users get a code via email
- No extra setup needed

**Option B: Google OAuth (Recommended)**
- Click **Add new** under Login methods
- Select **Google**
- Follow the wizard (it's automatic)
- Click **Save**

**Option C: GitHub**
- Click **Add new**
- Select **GitHub**
- Follow the wizard
- Click **Save**

**Recommended:** Enable Google + Email OTP for backup

---

## 🛡️ PART 4: Create Access Policies

**Policies determine WHICH apps require authentication**

### Step 4.1: Protect Portainer

1. **Go to:** Access → Applications
2. **Click:** Add an application
3. **Select:** Self-hosted
4. **Configure:**

**Application Configuration:**
- **Application name:** `Portainer`
- **Session Duration:** `24 hours`
- **Application domain:**
  - **Subdomain:** `portainer`
  - **Domain:** `yourdomain.com`
- **Accept all available identity providers:** ✓ (keep checked)

**Click:** Next

**Add a Policy:**
- **Policy name:** `Allow Homelab Admins`
- **Action:** Allow
- **Session duration:** `24 hours`
- **Configure rules:**
  - **Include:**
    - **Selector:** Access groups
    - **Value:** `Homelab Admins`
  - **Click:** Add include

**Click:** Next

**Additional settings:**
- Skip this page (click Next)

**Click:** Add application

### Step 4.2: Test Portainer Access

```bash
# Open in PRIVATE/INCOGNITO window (to test fresh):
https://portainer.yourdomain.com

# You should see:
# 1. Cloudflare Access login page
# 2. Enter your email
# 3. Get OTP code (if using email) or login with Google
# 4. After auth → redirected to Portainer

# Success! 🎉
```

### Step 4.3: Protect Other Services

**Repeat Step 4.1 for each service:**

**NPM Admin:**
```
Application name: Nginx Proxy Manager
Application domain: npm.yourdomain.com
Policy: Allow Homelab Admins
```

**AdGuard:**
```
Application name: AdGuard Home
Application domain: adguard.yourdomain.com
Policy: Allow Homelab Admins
```

**Uptime Kuma:**
```
Application name: Uptime Kuma
Application domain: uptime.yourdomain.com
Policy: Allow Homelab Admins
```

**Dozzle:**
```
Application name: Dozzle Logs
Application domain: logs.yourdomain.com
Policy: Allow Homelab Admins
```

---

## 🎯 PART 5: Advanced Configurations

### 5.1: Require MFA (Multi-Factor Authentication)

**For extra security on critical services:**

1. **Go to:** Access → Applications
2. **Edit** the Portainer application
3. **Go to:** Policies tab
4. **Edit** your policy
5. **Add a Require:**
   - **Selector:** Authentication Method
   - **Value:** `Require MFA` or `Require WARP`
6. **Save**

### 5.2: Set Up Different Access Levels

**Example: Allow different people to access different services**

**Create groups:**
1. **Homelab Admins** (you) - Full access
2. **Family Members** - Limited access
3. **Friends** - Read-only services

**In Access Groups:**
```yaml
Group: Homelab Admins
  - your.email@gmail.com

Group: Family Members
  - family1@gmail.com
  - family2@gmail.com

Group: Friends  
  - friend@gmail.com
```

**Then create different policies:**

**Portainer Policy:**
- Include: `Homelab Admins` only

**Uptime Kuma Policy:**
- Include: `Homelab Admins`
- Include: `Family Members`

**Public Services:**
- Include: `Everyone` (or no Access policy at all)

### 5.3: Add Location-Based Rules

**Only allow access from certain countries:**

1. **Edit a policy**
2. **Add a Require:**
   - **Selector:** Country
   - **Value:** `United Kingdom` (or your country)
3. **Save**

### 5.4: Set Up IP Allowlist

**Allow access only from specific IPs (like home/office):**

1. **Edit a policy**
2. **Add an Include:**
   - **Selector:** IP ranges
   - **Value:** `203.0.113.0/24` (your home IP range)
3. **Save**

---

## 🔧 PART 6: Configuration Best Practices

### 6.1: Services That SHOULD Have Access Protection

**Critical Admin Panels:**
- ✅ Portainer
- ✅ NPM Admin (port 81)
- ✅ AdGuard Admin
- ✅ Dozzle (logs)
- ✅ Any database admin tools
- ✅ Backup management UIs
- ✅ File browsers

### 6.2: Services That SHOULDN'T Have Access Protection

**Public-Facing Services:**
- ❌ Your blog/website
- ❌ Public status pages
- ❌ RSS feeds
- ❌ API endpoints (unless they have their own auth)

**Services with Built-in Auth:**
- 🤔 Uptime Kuma (has login)
- 🤔 Outline (has login)
- 🤔 Paperless (has login)

**Decision:** Add Cloudflare Access as a **second layer** of security, or skip if the built-in auth is strong enough.

### 6.3: Recommended Session Durations

```
Critical Services (Portainer, NPM): 2-4 hours
Monitoring (Uptime Kuma, Dozzle): 8-24 hours
Less Critical Services: 24 hours - 7 days
```

Shorter sessions = more secure but more annoying
Longer sessions = more convenient but less secure

---

## 📊 PART 7: Monitoring & Logs

### 7.1: View Access Logs

1. **Go to:** Logs → Access
2. **See who accessed what and when**
3. **Filter by:**
   - Application
   - User email
   - Action (allow/block)
   - Date range

### 7.2: Set Up Alerts

1. **Go to:** Settings → Notifications
2. **Add webhook** or **email notifications** for:
   - Failed login attempts
   - New device logins
   - Access from unexpected locations

---

## 🆘 PART 8: Troubleshooting

### Issue: "Access Denied" or Can't Login

**Solution:**
1. Check you're in the Access Group
2. Verify email is spelled correctly
3. Check policy includes your group
4. Try different auth method (email vs Google)

### Issue: Redirect Loop

**Solution:**
```bash
# In Cloudflare Tunnel settings:
# Make sure "No TLS Verify" is enabled for the public hostname

# Also verify the service URL uses HTTP (not HTTPS):
# ✅ GOOD: http://portainer:9000
# ❌ BAD:  https://portainer:9000
```

### Issue: "Invalid Token" or Can't Authenticate

**Solution:**
1. **Clear browser cookies** for `*.yourdomain.com`
2. **Try incognito/private window**
3. **Check Cloudflare Access is enabled** for that domain

### Issue: Service Works Without Tunnel But Not Through It

**Solution:**
```bash
# Test internal connectivity:
docker exec cloudflared ping portainer
# Should work

# Check service is on the right network:
docker network inspect infrastructure_net
# Should show portainer, npm, etc.

# Verify tunnel is connected:
docker logs cloudflared
# Should see: "Registered tunnel connection"
```

---

## ✅ PART 9: Verification Checklist

After setup, verify:

- [ ] Cloudflare Tunnel connected (check logs)
- [ ] Public hostnames created for all services
- [ ] Access group created with your email
- [ ] Authentication method configured (Google/Email)
- [ ] Access policies created for each service
- [ ] Can access services via subdomain
- [ ] Authentication works (prompted for login)
- [ ] After auth, redirected to service
- [ ] Session persists (don't need to login every time)
- [ ] Can logout and re-auth successfully

---

## 🎉 Example Final Setup

**Your Services:**
```
https://portainer.yourdomain.com  → Cloudflare Auth → Portainer
https://npm.yourdomain.com        → Cloudflare Auth → NPM Admin
https://adguard.yourdomain.com    → Cloudflare Auth → AdGuard
https://uptime.yourdomain.com     → Cloudflare Auth → Uptime Kuma
https://logs.yourdomain.com       → Cloudflare Auth → Dozzle
```

**Access Flow:**
1. User goes to `https://portainer.yourdomain.com`
2. Cloudflare Access checks if authenticated
3. If not, shows login page
4. User authenticates (email/Google/GitHub)
5. Cloudflare validates against Access Group
6. If allowed, redirects to Portainer
7. Session valid for 24 hours (or your configured duration)

**Security Layers:**
1. 🔒 Cloudflare Access (authentication)
2. 🔒 Service's own login (if applicable)
3. 🔒 Cloudflare Tunnel (encrypted)
4. 🔒 Oracle Cloud Firewall
5. 🔒 UFW Firewall on server

---

## 💡 Pro Tips

1. **Use different emails for different access levels**
   ```
   admin@yourdomain.com → Full access
   readonly@yourdomain.com → Monitoring only
   ```

2. **Set up Cloudflare Warp** for extra security
   - Forces users to use Cloudflare's VPN
   - Adds device posture checks

3. **Enable session revocation**
   - Go to Access → Users
   - Can manually revoke any active session

4. **Use temporary access**
   - Create a policy with time-based rules
   - Perfect for giving contractors temporary access

5. **Monitor failed attempts**
   - Set up alerts for multiple failed logins
   - Could indicate someone trying to access your services

---

## 📝 Quick Commands Reference

```bash
# Check tunnel status
docker logs cloudflared

# Restart tunnel (after config changes)
cd ~/homelab/01-core-infrastructure
docker compose restart cloudflared

# Test service connectivity from tunnel
docker exec cloudflared ping portainer

# View all networks
docker network ls

# Check which containers are on which network
docker network inspect infrastructure_net
```

---

## 🔗 Useful Links

- **Cloudflare Zero Trust Dashboard:** https://one.dash.cloudflare.com
- **Access Documentation:** https://developers.cloudflare.com/cloudflare-one/policies/access/
- **Tunnel Documentation:** https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

---

**You're all set!** Your sensitive services are now protected with enterprise-grade authentication. 🎉
