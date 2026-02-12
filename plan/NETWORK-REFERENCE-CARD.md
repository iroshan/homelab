# 🗺️ Network Reference Card
## Quick Lookup for Service Network Assignments

---

## 📋 Service → Network Mapping

### **Core Infrastructure**
| Service | Networks | Reason |
|---------|----------|--------|
| **adguard** | infrastructure_net | Core DNS service, isolated |
| **cloudflared** | infrastructure_net | Tunnel endpoint, core service |

---

### **Network & Management**
| Service | Networks | Reason |
|---------|----------|--------|
| **npm** | proxy_net<br>infrastructure_net | Reverse proxy hub<br>Access to AdGuard admin |
| **portainer** | proxy_net<br>infrastructure_net | Container management<br>Manage all containers |

---

### **Monitoring**
| Service | Networks | Reason |
|---------|----------|--------|
| **homepage** | monitoring_net<br>proxy_net<br>infrastructure_net<br>communication_net<br>productivity_net<br>documents_net | Dashboard for everything<br>External access<br>Monitor core services<br>Monitor communication<br>Monitor productivity<br>Monitor documents |
| **uptime-kuma** | monitoring_net<br>proxy_net | Uptime monitoring<br>External access |
| **dozzle** | monitoring_net<br>proxy_net<br>infrastructure_net | Log viewer<br>External access<br>See all container logs |

---

### **Communication**
| Service | Networks | Reason |
|---------|----------|--------|
| **ntfy** | communication_net<br>proxy_net | Notifications service<br>External access |

---

### **Productivity**
| Service | Networks | Reason |
|---------|----------|--------|
| **memos** | productivity_net<br>proxy_net | Notes service<br>External access |
| **telegram-bot** | productivity_net | Bot for Memos<br>Internal only (no external access needed) |

---

### **Documents**
| Service | Networks | Reason |
|---------|----------|--------|
| **stirling-pdf** | documents_net<br>proxy_net | PDF toolkit<br>External access |

---

## 🌐 Network Purposes

| Network | Purpose | Who Creates It | Services Count |
|---------|---------|----------------|----------------|
| **infrastructure_net** | Core services (DNS, tunnel) | 01-core-infrastructure | 2 |
| **proxy_net** | Reverse proxy hub | 02-network-access | 8+ |
| **monitoring_net** | Monitoring tools | 03-monitoring | 3 |
| **communication_net** | Notifications | 09-communication | 1 |
| **productivity_net** | Productivity apps | 04-productivity | 2 |
| **documents_net** | Document tools | 07-documents | 1 |

---

## 🎯 Network Rules Cheat Sheet

### **Rule 1: Public Services**
```
If users access it → Must be on proxy_net
Example: Memos, Stirling-PDF, Ntfy
```

### **Rule 2: Databases**
```
Database → NEVER on proxy_net
Database → ONLY on app's private network
Example: outline-db ONLY on knowledge_net
```

### **Rule 3: Stack Isolation**
```
Services in same stack → Share private network
Different stacks → Separate networks
Example: Memos + Bot both on productivity_net
```

### **Rule 4: Monitoring**
```
Homepage → Connects to ALL networks
Other monitoring → Only monitoring_net + proxy_net
```

---

## 🔍 Quick Diagnostics

### Check Service Networks
```bash
docker inspect <service> | grep -A 10 Networks
```

### Check Network Members
```bash
docker network inspect <network_name>
```

### Test Connectivity
```bash
docker exec <service1> ping <service2>
```

### List All Networks
```bash
docker network ls
```

---

## 📊 Network Topology Map

```
                    [Internet]
                         |
                         v
                 [Cloudflare]
                         |
                         v
            [infrastructure_net (172.18.0.0/24)]
            /                                   \
    [cloudflared]                           [adguard]
           |                                 172.18.0.2
           |
           v
       [proxy_net] ←──────────────────┐
           |                          |
    ┌──────┴──────┬──────┬──────┐    |
    |             |      |      |    |
   [npm]    [portainer] [memos] ...  |
                                     |
    [monitoring_net]                 |
           |                         |
    ┌──────┴──────┬──────┐          |
    |             |      |          |
[homepage]────────┘   [uptime] [dozzle]
    |
    ├─→ [communication_net] → [ntfy]
    ├─→ [productivity_net] → [memos] [bot]
    └─→ [documents_net] → [stirling-pdf]
```

---

## 🚦 Deployment Checklist

- [ ] Deploy 01-core-infrastructure (creates infrastructure_net)
- [ ] Deploy 02-network-access (creates proxy_net)
- [ ] Deploy 03-monitoring basic (creates monitoring_net)
- [ ] Deploy 09-communication (creates communication_net)
- [ ] Deploy 04-productivity (creates productivity_net)
- [ ] Deploy 07-documents (creates documents_net)
- [ ] Update 03-monitoring with all networks
- [ ] Verify all services can communicate

---

## 🔧 Common Fixes

### Service can't resolve hostname
```bash
# Add explicit DNS
dns:
  - 172.18.0.2  # AdGuard
  - 1.1.1.1
  - 8.8.8.8
```

### NPM can't reach service
```bash
# Make sure both are on proxy_net
networks:
  - proxy_net  # Add to both
```

### Homepage can't monitor service
```bash
# Add service's network to Homepage
homepage:
  networks:
    - monitoring_net
    - <service_network>  # Add this
```

---

## 💡 Pro Tips

1. **Always use service names, not IPs**
   - ✅ `http://memos:5230`
   - ❌ `http://172.19.0.5:5230`

2. **Check networks before debugging**
   - 90% of issues are wrong network assignment

3. **Document your network additions**
   - Keep this reference updated

4. **Test connectivity early**
   - Use `ping` and `curl` before configuring services

5. **Restart services after network changes**
   - `docker compose up -d` applies changes

---

**Print this and keep it handy!** 📌
