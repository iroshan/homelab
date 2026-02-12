# Documentation Site - Quick Reference

## Status
✅ **OPERATIONAL** | Access: http://localhost:8010

## Quick Access

**Local:**
```
http://localhost:8010
```

**Network:**
```
http://SERVER_IP:8010
```

## Quick Commands

### Management
```bash
# View logs
docker logs homelab-docs -f

# Restart
cd 06-documentation && docker compose restart

# Update
docker compose pull && docker compose up -d
```

### Editing Docs
```bash
# Edit any markdown file
nano plan/GUIDE.md

# Refresh browser - see changes instantly
```

## Features

✅ Material Design UI  
✅ Full-text search  
✅ Dark/light mode  
✅ Mobile-friendly  
✅ Live reload  
✅ Syntax highlighting  

## Navigation

- **Home** - Overview
- **Getting Started** - Setup guides
- **Infrastructure** - Architecture docs
- **Deployment** - Deployment guides
- **Cloudflare** - Zero-trust setup
- **Backup** - Kopia & Git guides
- **Version Control** - Git docs

## Configuration

**File:** `mkdocs.yml`

**Add navigation:**
```yaml
nav:
  - Guide: plan/FILE.md
```

## Integration

**NGINX Proxy:**
- Forward `docs.domain.com` to `homelab-docs:8000`

**Cloudflare:**
- Add ingress for `homelab-docs:8000`

## Troubleshooting

**Not loading:**
```bash
docker ps | grep homelab-docs
docker logs homelab-docs
```

**Page not found:**
- Check file exists
- Verify path in mkdocs.yml

---
**Container:** homelab-docs  
**Port:** 8010  
**Docs:** [DOCS-SITE-IMPLEMENTATION-GUIDE.md](./DOCS-SITE-IMPLEMENTATION-GUIDE.md)
