# 🌐 Homelab Network Architecture Guide
## Multi-Network Docker Setup - Learning Edition

---

## 🎓 What You'll Learn

By implementing this multi-network architecture, you'll understand:
- ✅ Network segmentation and isolation
- ✅ Service-to-service communication
- ✅ Security through network boundaries
- ✅ Docker networking fundamentals
- ✅ Troubleshooting connectivity issues
- ✅ Enterprise-grade homelab design

---

## 📊 Network Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE NETWORK                             │
│  • Access (Authentication)                                       │
│  • Tunnel (Encrypted Connection)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   YOUR ORACLE CLOUD SERVER                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  INFRASTRUCTURE_NET (172.18.0.0/24)                        │ │
│  │  • Cloudflared (tunnel endpoint)                           │ │
│  │  • AdGuard (DNS) - 172.18.0.2                             │ │
│  │  Purpose: Core infrastructure, isolated                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  PROXY_NET (Bridge)                                        │ │
│  │  • NPM (reverse proxy)                                     │ │
│  │  • Portainer (management)                                  │ │
│  │  • ALL public-facing services connect here                │ │
│  │  Purpose: Reverse proxy entry point                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ MONITORING  │  │  PRODUCTIVITY    │  │  COMMUNICATION  │   │
│  │   _NET      │  │      _NET        │  │      _NET       │   │
│  │             │  │                  │  │                 │   │
│  │ • Homepage  │  │ • Memos          │  │ • Ntfy          │   │
│  │ • Uptime    │  │ • Telegram Bot   │  │                 │   │
│  │ • Dozzle    │  │                  │  │                 │   │
│  └─────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐                         │
│  │ DOCUMENTS   │  │   UTILITIES      │                         │
│  │   _NET      │  │      _NET        │                         │
│  │             │  │                  │                         │
│  │ • Stirling  │  │ • IT-Tools       │                         │
│  │   PDF       │  │ • Others         │                         │
│  └─────────────┘  └──────────────────┘                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Network Definitions

### **1. infrastructure_net**
```yaml
Subnet: 172.18.0.0/24
Gateway: 172.18.0.1
Purpose: Core infrastructure services
Isolation: High (internal only, except proxy access)
```

**Services:**
- AdGuard (DNS) - Static IP: 172.18.0.2
- Cloudflared (tunnel)

**Why isolated?**
- Critical infrastructure
- DNS must be stable
- Compromised service can't reach user data

**Connects to:**
- proxy_net (so NPM can access AdGuard admin)

---

### **2. proxy_net**
```yaml
Subnet: Auto-assigned by Docker
Purpose: Reverse proxy hub - connects all public services
Isolation: Low (hub network)
```

**Services:**
- NPM (reverse proxy)
- Portainer (management)
- ALL services that need external access

**Why central hub?**
- NPM needs to reach all services
- Simplifies routing
- Single point for external traffic

**Connects to:**
- Everything that needs internet access

---

### **3. monitoring_net**
```yaml
Subnet: Auto-assigned
Purpose: Monitoring and observability tools
Isolation: Medium
```

**Services:**
- Homepage (dashboard)
- Uptime Kuma (monitoring)
- Dozzle (logs)

**Why separate?**
- Monitoring should see all services
- But services don't need to see monitoring
- Clear separation of concerns

**Special:** Homepage connects to multiple networks to monitor services

---

### **4. productivity_net**
```yaml
Subnet: Auto-assigned
Purpose: Productivity apps (notes, tasks, etc.)
Isolation: Medium
```

**Services:**
- Memos (notes)
- Telegram Bot (integration)

**Why separate?**
- Contains user data
- Bot needs to communicate with Memos only
- If bot compromised, can't reach other services

**Connects to:**
- proxy_net (for external access)
- Only services within stack talk to each other

---

### **5. communication_net**
```yaml
Subnet: Auto-assigned
Purpose: Notifications and messaging
Isolation: Medium
```

**Services:**
- Ntfy (notifications)

**Why separate?**
- Notification service used by many services
- Can add more communication tools later
- Clean separation from other stacks

---

### **6. documents_net**
```yaml
Subnet: Auto-assigned
Purpose: Document processing tools
Isolation: Low (stateless tools)
```

**Services:**
- Stirling-PDF (PDF toolkit)

**Why separate?**
- Document tools are stateless
- No sensitive data stored
- May add more tools (Paperless, etc.)

---

### **7. utilities_net**
```yaml
Subnet: Auto-assigned
Purpose: Utility and developer tools
Isolation: Low
```

**Services:**
- IT-Tools
- Other utilities

**Why separate?**
- Utility tools are standalone
- No databases or user data
- Easy to add/remove tools

---

## 🔄 Service Communication Patterns

### **Pattern 1: Public Service (Web App)**
```yaml
# Example: Memos
services:
  memos:
    networks:
      - productivity_net  # For internal communication
      - proxy_net         # For NPM to reach it
```

**Flow:**
```
User → Cloudflare → NPM (proxy_net) → Memos (productivity_net)
```

---

### **Pattern 2: Internal Service with Database**
```yaml
# Example: App + Database
services:
  app:
    networks:
      - myapp_net    # Internal communication
      - proxy_net    # External access
  
  database:
    networks:
      - myapp_net    # ONLY internal (no proxy_net!)
```

**Security:**
- Database not on proxy_net = not accessible externally
- Only app can reach database
- If app compromised, attacker still can't reach database directly from internet

---

### **Pattern 3: Monitoring Service**
```yaml
# Example: Homepage
services:
  homepage:
    networks:
      - monitoring_net      # Its own network
      - proxy_net           # External access
      - infrastructure_net  # Monitor core services
      - productivity_net    # Monitor productivity apps
      - documents_net       # Monitor document tools
```

**Why multiple networks?**
- Needs to monitor services across all stacks
- Still isolated in its own network
- Can reach out, but others can't reach in

---

### **Pattern 4: Pure Backend Service**
```yaml
# Example: Telegram Bot
services:
  bot:
    networks:
      - productivity_net  # Only internal (no proxy_net!)
```

**Security:**
- Not accessible from outside
- Can only talk to services in same network
- No HTTP port exposed

---

## 🛡️ Security Benefits Explained

### **Scenario 1: Service Compromise**

**Without network segmentation:**
```
Attacker compromises Stirling-PDF
  ↓
Can access ALL services
  ↓
Can access Memos database
  ↓
Can access Portainer
  ↓
Game over - full server access
```

**With network segmentation:**
```
Attacker compromises Stirling-PDF
  ↓
Only on documents_net
  ↓
CANNOT reach productivity_net (Memos blocked)
  ↓
CANNOT reach infrastructure_net (DNS blocked)
  ↓
CANNOT reach databases (not on network)
  ↓
Damage contained to documents_net only
```

---

### **Scenario 2: Database Protection**

**Without segmentation:**
```yaml
# Bad: Database accessible to everything
services:
  memos_db:
    networks:
      - homelab  # Everything can reach it!
```

**With segmentation:**
```yaml
# Good: Database isolated
services:
  memos:
    networks:
      - productivity_net  # App network
      - proxy_net         # Public access
  
  memos_db:
    networks:
      - productivity_net  # ONLY app network
      # NOT on proxy_net = not reachable from outside
```

**Result:**
- Only Memos app can talk to Memos database
- Even if NPM is compromised, can't reach database
- Defense in depth

---

### **Scenario 3: Monitoring Access**

**Why Homepage needs multiple networks:**
```yaml
# Homepage monitors everything
homepage:
  networks:
    - monitoring_net      # Its home
    - productivity_net    # To check Memos health
    - documents_net       # To check Stirling-PDF health
```

**Security:**
- Homepage can READ from services (health checks)
- Services CANNOT write to Homepage
- One-way communication = safer

---

## 📋 Network Assignment Rules

### **Rule 1: All Public Services Need proxy_net**
```yaml
# If users access it via domain, add proxy_net
networks:
  - proxy_net
  - <their_own_net>
```

### **Rule 2: Databases NEVER on proxy_net**
```yaml
# Databases stay internal only
networks:
  - <app_name>_net  # Only their app's network
```

### **Rule 3: Services in Same Stack Share Network**
```yaml
# App and its dependencies together
services:
  app:
    networks:
      - myapp_net
  
  database:
    networks:
      - myapp_net  # Same network
  
  cache:
    networks:
      - myapp_net  # Same network
```

### **Rule 4: Infrastructure Services Isolated**
```yaml
# Core services in infrastructure_net
# Plus proxy_net ONLY if admin access needed
networks:
  - infrastructure_net
  - proxy_net  # Only if has web UI
```

---

## 🔧 Common Network Configurations

### **Configuration 1: Simple Web App (No Database)**
```yaml
services:
  stirling-pdf:
    networks:
      - documents_net  # Its own network
      - proxy_net      # For NPM access

networks:
  documents_net:
    name: documents_net
    driver: bridge
  proxy_net:
    name: proxy_net
    external: true  # Created by another stack
```

---

### **Configuration 2: App with Database**
```yaml
services:
  outline:
    networks:
      - knowledge_net  # Internal communication
      - proxy_net      # External access
  
  outline-db:
    networks:
      - knowledge_net  # ONLY internal (secure!)
  
  outline-redis:
    networks:
      - knowledge_net  # ONLY internal

networks:
  knowledge_net:
    name: knowledge_net
    driver: bridge
  proxy_net:
    external: true
```

---

### **Configuration 3: Multi-Service Stack**
```yaml
services:
  app1:
    networks:
      - mystack_net
      - proxy_net
  
  app2:
    networks:
      - mystack_net
      - proxy_net
  
  shared_db:
    networks:
      - mystack_net  # Both apps can access
  
  app1_cache:
    networks:
      - mystack_net  # Only app1 uses, but accessible to app2

networks:
  mystack_net:
    name: mystack_net
    driver: bridge
  proxy_net:
    external: true
```

---

## 🎓 Learning Exercises

### **Exercise 1: Trace a Request**

Trace this request: `https://memos.yourdomain.com`

```
1. User browser → Cloudflare Access
   Network: Internet
   
2. Cloudflare Access → Cloudflare Tunnel
   Network: Cloudflare internal
   
3. Cloudflared container → NPM container
   Network: infrastructure_net + proxy_net
   
4. NPM → Memos container
   Network: proxy_net
   
5. Memos → Memos database
   Network: productivity_net (internal)
   
6. Response travels back same path
```

**Question:** Why can't you access the database directly from internet?
**Answer:** Database is ONLY on productivity_net, not on proxy_net. NPM can't route to it!

---

### **Exercise 2: Plan a New Service**

You want to add Paperless-NGX (document management):
- Has web UI
- Uses PostgreSQL database
- Uses Redis cache
- Needs external access

**Which networks?**

```yaml
# Solution:
services:
  paperless:
    networks:
      - documents_net  # Or create paperless_net
      - proxy_net      # For web access
  
  paperless-db:
    networks:
      - documents_net  # ONLY internal
  
  paperless-redis:
    networks:
      - documents_net  # ONLY internal
```

---

### **Exercise 3: Troubleshoot Connectivity**

Service A can't reach Service B. Why?

**Checklist:**
1. Are they on the same network? ❌ Most common issue
2. Is the service name spelled correctly?
3. Is the port correct?
4. Is DNS resolution working?
5. Firewall rules blocking?

**Debug commands:**
```bash
# Check what networks a container is on
docker inspect <container> | grep -A 10 Networks

# Test connectivity
docker exec <container-a> ping <container-b>

# Check if service is listening
docker exec <container-b> netstat -tlnp
```

---

## 🗺️ Network Deployment Order

**Critical:** Networks must be created in order!

### **Phase 1: Foundation**
```bash
# Deploy infrastructure (creates infrastructure_net)
cd ~/homelab/01-core-infrastructure
docker compose up -d

# Deploy network access (creates proxy_net)
cd ~/homelab/02-network-access
docker compose up -d
```

**Networks now exist:**
- infrastructure_net ✓
- proxy_net ✓

---

### **Phase 2: Monitoring**
```bash
# Deploy monitoring (creates monitoring_net)
cd ~/homelab/03-monitoring
docker compose up -d
```

**Networks now exist:**
- infrastructure_net ✓
- proxy_net ✓
- monitoring_net ✓

---

### **Phase 3: Application Stacks**
```bash
# Each stack creates its own network

# Communication (creates communication_net)
cd ~/homelab/09-communication
docker compose up -d

# Productivity (creates productivity_net)
cd ~/homelab/04-productivity
docker compose up -d

# Documents (creates documents_net)
cd ~/homelab/07-documents
docker compose up -d
```

**All networks now exist!**

---

### **Phase 4: Update Homepage**

After all stacks deployed, update Homepage to monitor them:

```bash
cd ~/homelab/03-monitoring
nano docker-compose.yml

# Add all networks to homepage:
    networks:
      - monitoring_net
      - proxy_net
      - infrastructure_net
      - communication_net
      - productivity_net
      - documents_net
      - utilities_net

# Restart
docker compose up -d homepage
```

---

## 🔍 Troubleshooting Guide

### **Error: network not found**
```
network productivity_net declared as external, but could not be found
```

**Cause:** Network doesn't exist yet
**Fix:** Deploy the stack that creates it first, or remove from compose temporarily

---

### **Error: can't reach service**
```
curl: (6) Could not resolve host: memos
```

**Cause:** Services not on same network
**Fix:** Add both services to a common network

**Example:**
```yaml
# NPM trying to reach Memos
npm:
  networks:
    - proxy_net  # Add this to both
memos:
  networks:
    - proxy_net  # Add this to both
```

---

### **Error: port already in use**
```
bind: address already in use
```

**Cause:** Another container using the port
**Fix:** 
```bash
# Find what's using it
sudo lsof -i :8080

# Stop that container or change port
```

---

## 📚 Key Concepts to Remember

### **1. External vs Internal Networks**
```yaml
# External = created outside this compose file
proxy_net:
  external: true  # Must already exist!

# Internal = created by this compose file
myapp_net:
  driver: bridge  # Created when deployed
```

---

### **2. Service Name = Hostname**
```yaml
services:
  memos:  # ← This becomes hostname "memos"
    # Other services can reach it at: http://memos:5230
```

---

### **3. Multiple Networks = Multiple IPs**
```yaml
# A container on 3 networks has 3 IP addresses
# One for each network it's on
networks:
  - network1  # Gets IP in 172.19.0.0/24
  - network2  # Gets IP in 172.20.0.0/24
  - network3  # Gets IP in 172.21.0.0/24
```

---

## 🎯 Summary

**What you learned:**
- ✅ Network segmentation protects against lateral movement
- ✅ Databases should never be on proxy_net
- ✅ Services in same stack share a network
- ✅ Monitoring services connect to multiple networks
- ✅ Networks must exist before being referenced as external
- ✅ Service names become DNS hostnames

**Security benefits:**
- 🔒 Compromised service contained to its network
- 🔒 Databases isolated from internet
- 🔒 Clear boundaries between service types
- 🔒 Defense in depth

**Next level:**
- Add network policies (restrict specific ports)
- Implement custom subnet ranges
- Set up VLANs for physical network segregation
- Add firewall rules per network

---

This is **production-grade network architecture** for your homelab! 🚀
