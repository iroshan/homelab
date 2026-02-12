# Documentation Site - MkDocs Material

Beautiful, searchable web-based documentation for your homelab.

## 🚀 Quick Start

```bash
docker compose up -d
```

**Access:** http://localhost:8010

## Features

- 🎨 **Material Design** - Beautiful, modern UI
- 🔍 **Full-text Search** - Find anything instantly
- 📱 **Mobile Friendly** - Responsive design
- 🌙 **Dark Mode** - Auto-switching light/dark themes
- ⚡ **Live Reload** - Edit markdown, see changes instantly
- 📝 **Syntax Highlighting** - Beautiful code blocks
- 🗂️ **Organized Navigation** - All docs categorized

## What's Included

All your homelab documentation is automatically available:

- **Getting Started** - Setup guides and quick references
- **Infrastructure** - Network architecture and planning
- **Deployment** - Step-by-step deployment guides
- **Cloudflare** - Zero-trust and tunnel configuration
- **Backup** - Kopia and Git backup documentation
- **Version Control** - Git workflow and commands

## Usage

### Browse Documentation

1. Open http://localhost:8010
2. Use navigation sidebar or tabs
3. Search using the search bar (top right)

### Edit Documentation

Just edit any markdown file:

```bash
nano plan/BACKUP-QUICK-REFERENCE.md
```

Changes appear instantly in browser (auto-reload)!

### Add New Documentation

1. Create markdown file in appropriate location
2. Add to `../mkdocs.yml` nav section
3. Refresh browser

## Configuration

**MkDocs config:** `/home/ubuntu/homelab/mkdocs.yml`

Edit to:
- Change theme colors
- Add/remove navigation items
- Enable additional features
- Configure plugins

## Management

### View Logs
```bash
docker logs homelab-docs -f
```

### Restart
```bash
docker compose restart
```

### Update
```bash
docker compose pull
docker compose up -d
```

## Integration

### With NGINX Proxy Manager (Optional)

Add proxy host:
- **Domain:** `docs.yourdomain.com`
- **Forward to:** `homelab-docs` port `8000`
- **Enable SSL:** Let's Encrypt

### With Git

All documentation is version controlled:
- Changes auto-committed hourly
- Full history available
- Easy rollback if needed

## Accessing from Network

**Local network:**
```
http://SERVER_IP:8010
```

**Via proxy:**
```
https://docs.yourdomain.com
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs homelab-docs

# Verify mkdocs.yml syntax
docker run --rm -v /home/ubuntu/homelab:/docs squidfunk/mkdocs-material build --strict
```

### Search not working
- Refresh browser cache (Ctrl+Shift+R)
- Restart container

### Page not found
- Check file exists in homelab directory
- Verify path in mkdocs.yml nav section

## Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/)

---

**Port:** 8010  
**Container:** homelab-docs  
**Image:** squidfunk/mkdocs-material:latest
