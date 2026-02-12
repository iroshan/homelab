# 🏗️ Cloudflare Access Architecture Diagram

## How It All Works Together

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        THE INTERNET                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User visits:
                              │ https://portainer.yourdomain.com
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE NETWORK                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            CLOUDFLARE ACCESS (Zero Trust)                  │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  1. Check: Is user authenticated?                    │ │ │
│  │  │     ├─ NO  → Show login page (email/Google/GitHub)  │ │ │
│  │  │     └─ YES → Continue to step 2                      │ │ │
│  │  │                                                        │ │ │
│  │  │  2. Check: Is user in allowed Access Group?          │ │ │
│  │  │     ├─ NO  → Deny access (show 403)                  │ │ │
│  │  │     └─ YES → Continue to step 3                      │ │ │
│  │  │                                                        │ │ │
│  │  │  3. Check: Does user meet policy requirements?       │ │ │
│  │  │     (Country, IP, Device, MFA, etc.)                 │ │ │
│  │  │     ├─ NO  → Deny access                             │ │ │
│  │  │     └─ YES → Allow & create session                  │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                            │                               │ │
│  │                            │ ✅ User authorized            │ │
│  │                            ▼                               │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │         CLOUDFLARE TUNNEL (Encrypted)                │ │ │
│  │  │  • End-to-end encryption                             │ │ │
│  │  │  • No ports opened on server                         │ │ │
│  │  │  • Outbound-only connection                          │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Encrypted tunnel
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR ORACLE CLOUD SERVER                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cloudflared Container (Running on your server)         │   │
│  │  • Maintains persistent connection to Cloudflare        │   │
│  │  • Receives encrypted requests                          │   │
│  │  • Forwards to local services                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Docker Network: infrastructure_net          │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │  │
│  │  │  AdGuard    │  │    NPM       │  │   Portainer    │ │  │
│  │  │  :3000      │  │    :81       │  │   :9000        │ │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐                      │  │
│  │  │ Uptime Kuma │  │   Dozzle     │                      │  │
│  │  │  :3001      │  │   :8080      │                      │  │
│  │  └─────────────┘  └──────────────┘                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  🔥 UFW Firewall: Only ports 80, 443 exposed (for NPM)         │
│  🔒 Oracle Cloud Security: Ingress rules configured             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Request Flow (Step-by-Step)

### Without Cloudflare Access (Before):
```
1. User → https://portainer.yourdomain.com
2. Cloudflare Tunnel → portainer:9000
3. Portainer responds
4. User sees Portainer (⚠️ NO AUTHENTICATION!)
```

### With Cloudflare Access (After):
```
1. User → https://portainer.yourdomain.com

2. Cloudflare Access intercepts:
   "Hold on! Who are you?"
   
3. User not authenticated:
   → Show login page
   → User enters email
   → Gets OTP code (or uses Google/GitHub)
   → Enters code
   
4. Cloudflare Access verifies:
   ✓ Email is in "Homelab Admins" group
   ✓ Meets policy requirements
   ✓ Creates 24-hour session
   
5. Cloudflare Tunnel (encrypted):
   → Forwards request to cloudflared container
   
6. Cloudflared container:
   → Routes to portainer:9000
   
7. Portainer responds:
   → Back through tunnel
   → To Cloudflare
   → To user
   
8. User sees Portainer (✅ AUTHENTICATED!)
```

---

## 🔐 Security Layers Explained

```
┌────────────────────────────────────────────────────────┐
│ Layer 1: CLOUDFLARE ACCESS (Identity)                  │
│ • Who you are (email, Google, GitHub)                  │
│ • Are you in the allowed group?                        │
│ • Session management (logout = can't access)           │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: CLOUDFLARE ACCESS POLICIES (Rules)            │
│ • Country restrictions (UK only?)                      │
│ • IP allowlist (home network only?)                    │
│ • MFA required (2FA?)                                  │
│ • Device posture (Warp client installed?)             │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Layer 3: CLOUDFLARE TUNNEL (Transport)                 │
│ • End-to-end encryption                                │
│ • No exposed ports (outbound only)                     │
│ • DDoS protection                                      │
│ • Hidden origin (server IP never exposed)             │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Layer 4: APPLICATION AUTH (Service-specific)           │
│ • Portainer login (if enabled)                         │
│ • Uptime Kuma login                                    │
│ • AdGuard password                                     │
│ • Double authentication!                               │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Layer 5: NETWORK SEGMENTATION (Docker)                 │
│ • Services on isolated networks                        │
│ • Databases not exposed                                │
│ • Internal-only communication                          │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ Layer 6: FIREWALLS (Infrastructure)                    │
│ • UFW on server (ports closed)                         │
│ • Oracle Cloud Security Lists                          │
│ • Only essential ports open                            │
└────────────────────────────────────────────────────────┘
```

---

## 🔍 What Each Component Does

### Cloudflare Access (Zero Trust)
```
Role: Identity & Access Management
Features:
  • User authentication
  • Session management
  • Access policies
  • Audit logging
  • MFA enforcement
  
Think of it as: Your bouncer at the door
```

### Cloudflare Tunnel
```
Role: Secure Network Connection
Features:
  • Encrypted tunnel
  • No inbound ports needed
  • Hidden origin server
  • DDoS protection
  • Automatic failover
  
Think of it as: Secret underground passage to your server
```

### Cloudflared Container
```
Role: Local Tunnel Endpoint
Features:
  • Maintains connection to Cloudflare
  • Routes traffic to services
  • Runs inside your Docker network
  • Auto-reconnects if disconnected
  
Think of it as: Your server's mailman
```

### Access Groups
```
Role: Define Who Can Access
Features:
  • List of allowed emails
  • Can use Google Workspace groups
  • Can use GitHub teams
  • Easy to add/remove people
  
Think of it as: Guest list at a party
```

### Access Policies
```
Role: Define Rules for Access
Features:
  • Which group can access which app
  • Time-based access (business hours only?)
  • Location restrictions
  • Device requirements
  
Think of it as: Rules for different rooms in your house
```

---

## 📊 Data Flow Comparison

### Traditional Setup (No Cloudflare):
```
User → Your Public IP:9000 → Portainer
Problems:
  ❌ Server IP exposed
  ❌ Open port on internet
  ❌ No authentication layer
  ❌ Vulnerable to attacks
  ❌ Need to manage SSL certs
```

### With NPM Only:
```
User → Your Public IP:443 → NPM → Portainer
Better, but:
  ❌ Server IP still exposed
  ❌ Port still open
  ❌ Authentication only within app
  ✓ SSL handled by NPM
```

### With Cloudflare Tunnel (No Access):
```
User → Cloudflare → Tunnel → Portainer
Better:
  ✓ Server IP hidden
  ✓ No open ports
  ✓ Encrypted tunnel
  ✓ SSL handled by Cloudflare
  ❌ No authentication layer
```

### With Cloudflare Tunnel + Access (BEST):
```
User → CF Access (auth) → CF Tunnel → Portainer
Best:
  ✓ Server IP hidden
  ✓ No open ports
  ✓ Encrypted tunnel
  ✓ SSL handled by Cloudflare
  ✓ Authentication required
  ✓ Session management
  ✓ Access logs
  ✓ Can add MFA, country restrictions, etc.
```

---

## 🎯 Why This Setup is Secure

### 1. No Direct Access
```
Attacker can't even find your server:
• IP is hidden behind Cloudflare
• No ports exposed to internet
• Can't port scan you
• Can't brute force anything
```

### 2. Multiple Authentication Factors
```
Even if attacker knows your domain:
• Must authenticate via email/Google/GitHub
• Must be in allowed Access Group
• Must meet policy requirements (location, IP, MFA)
• Session expires after X hours
```

### 3. Encrypted Everything
```
Traffic is encrypted:
• Between user and Cloudflare (SSL/TLS)
• Between Cloudflare and your server (tunnel)
• Can't be intercepted or read
```

### 4. Complete Audit Trail
```
You can see:
• Who accessed what
• When they accessed it
• From where (IP, country)
• Which device
• Success or failure
```

### 5. Easy Revocation
```
If something's wrong:
• Remove from Access Group (instant)
• Revoke active session (kicks them out)
• Change policy (apply immediately)
• Disable entire tunnel (nuclear option)
```

---

## 💡 Common Configurations

### Configuration 1: Maximum Security
```yaml
Access Group: Only your email
Policy Requirements:
  - Your email
  - Your home IP only
  - MFA required
  - UK only
Session Duration: 2 hours

Use for: Production admin panels
```

### Configuration 2: Team Access
```yaml
Access Group: Team emails
Policy Requirements:
  - Team group
  - Company IPs or Warp
  - MFA optional
Session Duration: 8 hours

Use for: Shared monitoring dashboards
```

### Configuration 3: Read-Only Access
```yaml
Access Group: Friends/Family
Policy Requirements:
  - Their emails
  - No IP restrictions
  - No MFA
Session Duration: 24 hours

Use for: Status pages, non-sensitive services
```

### Configuration 4: Public with Rate Limiting
```yaml
No Access Policy (Public)
But with Cloudflare features:
  - Rate limiting
  - Bot protection
  - Country blocking
  
Use for: Public blog, status page
```

---

## 🔄 Session Flow

```
Day 1, 9:00 AM:
  User visits: https://portainer.yourdomain.com
  → Not authenticated
  → Shows login page
  → User enters email
  → Gets OTP code
  → Enters code
  → Creates 24-hour session
  → Redirected to Portainer
  
Day 1, 3:00 PM:
  User visits: https://portainer.yourdomain.com
  → Session still valid (15 hours left)
  → Direct access to Portainer
  → No login required
  
Day 2, 10:00 AM:
  User visits: https://portainer.yourdomain.com
  → Session expired (25 hours passed)
  → Shows login page again
  → Must re-authenticate
```

---

## 📈 Scaling This Setup

### Adding New Services:
```
1. Add service to Docker
2. Add Public Hostname in tunnel
3. Add Access Application
4. Use existing "Homelab Admins" policy
   
Time: 5 minutes per service
```

### Adding New Users:
```
1. Add email to Access Group
2. User gets invite email
3. User authenticates
4. Access granted

Time: 1 minute per user
```

### Removing Access:
```
1. Remove from Access Group
2. Revoke active session (optional)

Immediate effect
```

---

**This architecture gives you enterprise-level security for your homelab!** 🚀
