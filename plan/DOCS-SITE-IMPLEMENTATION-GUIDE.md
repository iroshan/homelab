# Documentation Site Implementation Guide

**Status:** ✅ Deployed and Operational  
**Date:** 2026-02-12  
**Access:** http://localhost:8010

## Overview

Web-based documentation viewer using MkDocs with Material theme for beautiful, searchable access to all homelab guides.

## Quick Facts

- **Platform:** MkDocs Material
- **Container:** homelab-docs
- **Port:** 8010
- **Features:** Search, dark mode, mobile-friendly, live reload
- **Weight:** Lightweight (no database, ~50MB RAM)

## What It Provides

**Interface:**
- Material Design UI
- Dark/light mode auto-switching
- Full-text search
- Mobile responsive
- Syntax highlighting

**Content:**
- All markdown documentation
- Organized navigation
- Auto-generated TOC
- Code copy buttons
- Permanent links

## Setup

### Deployment

```bash
cd 06-documentation
docker compose up -d
```

### Access

- **Local:** http://localhost:8010
- **Network:** http://SERVER_IP:8010

### Structure

```
homelab/
├── mkdocs.yml           # Site configuration
├── docs/                # Symlinks to markdown files
│   ├── index.md        # Home (→ README.md)
│   ├── SETUP-GIT.md
│   └── plan/           # All guides
└── 06-documentation/
    ├── docker-compose.yml
    └── README.md
```

## Usage

### Browse Documentation

Open http://localhost:8010 and navigate using:
- Top tabs for main sections
- Sidebar for detailed navigation
- Search bar (top right)

### Edit Documentation

1. Edit any markdown file:
   ```bash
   nano plan/BACKUP-QUICK-REFERENCE.md
   ```

2. Save file

3. Refresh browser - changes appear instantly!

### Add New Documentation

1. Create markdown file
2. Add to `mkdocs.yml` nav:
   ```yaml
   nav:
     - My Guide: plan/MY-GUIDE.md
   ```
3. Auto-reloads in browser

## Configuration

**File:** `mkdocs.yml`

**Change theme colors:**
```yaml
theme:
  palette:
    - scheme: default
      primary: teal  # Change color
```

**Add navigation:**
```yaml
nav:
  - Section:
      - Guide: plan/GUIDE.md
```

## Management

### View Logs
```bash
docker logs homelab-docs -f
```

### Restart
```bash
cd 06-documentation
docker compose restart
```

### Update
```bash
docker compose pull
docker compose up -d
```

## Integration

### With NGINX Proxy

Add proxy host:
- Domain: `docs.yourdomain.com`
- Forward to: `homelab-docs:8000`
- SSL: Enable Let's Encrypt

### With Cloudflare Tunnel

```yaml
ingress:
  - hostname: docs.yourdomain.com
    service: http://homelab-docs:8000
```

## Troubleshooting

### Site Not Loading

```bash
# Check container
docker ps | grep homelab-docs

# View logs
docker logs homelab-docs

# Restart
docker compose restart
```

### Page Not Found

- Verify file exists
- Check path in mkdocs.yml
- Ensure symlink in docs/ directory

### Search Not Working

- Clear browser cache (Ctrl+Shift+R)
- Restart container

## Features

**Navigation:**
- Instant loading
- URL tracking
- Expandable sections
- Back to top button

**Search:**
- Full-text across all docs
- Search suggestions
- Result highlighting

**Content:**
- Code copy buttons
- Syntax highlighting
- Tables and diagrams
- Alert boxes (admonitions)

## Benefits

- 📚 Organized documentation
- 🔍 Instant search
- 📱 Mobile-friendly
- ⚡ Fast loading
- 🎨 Beautiful UI
- 🔄 Live reload
- 💾 No database needed

## Files Reference

- `mkdocs.yml` - Configuration
- `06-documentation/docker-compose.yml` - Deployment
- `06-documentation/README.md` - Usage guide
- `docs/` - Symlinks (excluded from Git)

## Resources

- [MkDocs](https://www.mkdocs.org/)
- [Material Theme](https://squidfunk.github.io/mkdocs-material/)

---

**Last Updated:** 2026-02-12  
**Status:** ✅ Production Ready
