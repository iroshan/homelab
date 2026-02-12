# Productivity Stack - Memos + Telegram Bot

A comprehensive productivity bundle featuring:
- **Memos**: Self-hosted note-taking application
- **Telegram Bot**: Full-featured bot for managing memos via Telegram

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Telegram bot token (from @BotFather)
- Networks created (run `../shared/create_networks.sh` if needed)

### Deployment

1. **Create networks** (if not already created):
   ```bash
   cd /home/ubuntu/homelab/shared
   ./create_networks.sh
   ```

2. **Configure environment**:
   ```bash
   cd /home/ubuntu/homelab/04-productivity
   # Edit .env and add your Telegram bot token
   nano .env
   ```

3. **Start the stack**:
   ```bash
   docker-compose up -d
   ```

4. **Check logs**:
   ```bash
   docker-compose logs -f
   ```

## 📱 Using the Telegram Bot

### First-Time Setup

1. **Start conversation** with your bot on Telegram
2. Send `/start` to get welcome message
3. **Authenticate** with Memos:
   - Open Memos web interface (via Cloudflare tunnel)
   - Create account and log in
   - Go to Settings → Access Tokens
   - Create new token
   - Send to bot: `/settoken YOUR_TOKEN_HERE`

### Available Commands

#### Basic Commands
- `/start` - Welcome message and setup
- `/help` - Show all commands
- `/auth` - Authentication instructions

#### Note-Taking
- `/memo <text>` - Create a memo
- `/quick <text>` - Quick memo (alias)
- Send any text - Auto-saved as memo
- Send photo with caption - Saved as photo memo

#### Search & Browse
- `/list [count]` - Show recent memos (default 10)
- `/search <query>` - Search memos by keyword
- `/tag <name>` - Show memos with specific tag
- `/tags` - List all your tags

#### Statistics
- `/stats` - View your memo statistics

### Features

#### 📝 Quick Note-Taking
Just send any text message to the bot and it will automatically save it as a memo!

#### 🏷️ Auto-Tag Extraction
Use hashtags in your memos and they'll be automatically extracted:
```
/memo Meeting with client tomorrow #work #important
```

#### 📊 Automated Summaries
- **Daily Summary**: Sent at 20:00 (configurable in `.env`)
  - Number of memos created today
  - Tags used
  - Encouragement message

- **Weekly Digest**: Sent on Sundays
  - Total memos for the week
  - Daily average
  - Top 5 most used tags

#### 📸 Photo Memos
Send photos with captions to save visual notes!

## 🛠️ Configuration

### Environment Variables

Edit `/home/ubuntu/homelab/04-productivity/.env`:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Optional
BOT_ADMIN_USER_ID=your_telegram_user_id
DAILY_SUMMARY_TIME=20:00
WEEKLY_SUMMARY_DAY=0  # 0=Sunday, 1=Monday, etc.
TZ=Europe/London
```

### Accessing Memos Web Interface

Memos runs on port 5230. Configure Cloudflare tunnel to access it:
- Internal: `http://localhost:5230`
- External: Configure in Cloudflare tunnel settings

## 📂 Data Storage

- **Memos data**: `./memos_data` (SQLite database)
- All data persists across container restarts

## 🔧 Maintenance

### View Logs
```bash
cd /home/ubuntu/homelab/04-productivity
docker-compose logs -f telegram-memos-bot
docker-compose logs -f memos
```

### Restart Services
```bash
docker-compose restart
```

### Update Images
```bash
docker-compose pull
docker-compose up -d
```

### Rebuild Bot
```bash
docker-compose up -d --build telegram-memos-bot
```

## 🔍 Troubleshooting

### Bot not responding
1. Check logs: `docker logs telegram_memos_bot`
2. Verify bot token in `.env`
3. Ensure bot is running: `docker ps | grep telegram`

### Cannot create memos
1. Verify authentication: `/auth` and `/settoken`
2. Check Memos is running: `docker ps | grep memos`
3. Test connectivity: `docker exec telegram_memos_bot wget -O- http://memos:5230/api/v1/ping`

### Memos web interface not accessible
1. Check container: `docker ps | grep memos`
2. Verify port: `netstat -tulpn | grep 5230`
3. Check Cloudflare tunnel configuration

## 🌐 Network Architecture

This stack uses two networks:
- **productivity_net**: Internal communication between bot and Memos
- **proxy_net**: External access for Memos via Cloudflare tunnel

## 📚 Resources

- [Memos Documentation](https://www.usememos.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegraf Documentation](https://telegraf.js.org/)

## 🎯 Tips & Best Practices

1. **Use tags consistently** - Helps with organization and search
2. **Set up daily summaries** - Great for reviewing your day
3. **Use the web interface** for detailed viewing and editing
4. **Backup your data** - Copy `./memos_data` regularly
5. **Private bot** - Don't share your bot token publicly

---

**Enjoy your productivity boost! 🚀**
