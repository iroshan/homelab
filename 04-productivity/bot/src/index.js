/**
 * Telegram Memos Bot - Main Entry Point
 * A comprehensive bot for interacting with Memos via Telegram
 */

const { Telegraf } = require('telegraf');
const http = require('http');
const config = require('./config');
const memosAPI = require('./services/memos-api');
const Scheduler = require('./services/scheduler');

// Import command handlers
const startCommands = require('./commands/start');
const memoCommands = require('./commands/memo');
const searchCommands = require('./commands/search');

// Validate configuration
if (!config.botToken) {
    console.error('❌ BOT_TOKEN environment variable is required');
    process.exit(1);
}

// Initialize bot
const bot = new Telegraf(config.botToken);

// Health check endpoint for Docker
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(3000, () => {
    console.log('🏥 Health check server running on port 3000');
});

// Error handling
bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again later.').catch(console.error);
});

// Initialize command handlers
startCommands(bot, memosAPI);
memoCommands(bot, memosAPI);
searchCommands(bot, memosAPI);

// Initialize scheduler
const scheduler = new Scheduler(bot);

// Graceful shutdown
process.once('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    scheduler.stop();
    bot.stop('SIGINT');
    healthServer.close();
});

process.once('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    scheduler.stop();
    bot.stop('SIGTERM');
    healthServer.close();
});

// Start the bot
async function start() {
    try {
        console.log('🚀 Starting Telegram Memos Bot...');

        // Check Memos connectivity
        console.log(`📡 Connecting to Memos at ${config.memos.url}...`);
        const isHealthy = await memosAPI.healthCheck();

        if (!isHealthy) {
            console.warn('⚠️  Warning: Cannot reach Memos API. Bot will start anyway.');
        } else {
            console.log('✅ Memos API is reachable');
        }

        // Start scheduler
        scheduler.start();

        // Launch bot
        await bot.launch();

        console.log('✅ Bot started successfully!');
        console.log(`📅 Timezone: ${config.timezone}`);
        console.log(`🔔 Daily summaries at: ${config.bot.dailySummaryTime}`);

        if (config.bot.adminUserId) {
            console.log(`👤 Admin user ID: ${config.bot.adminUserId}`);
        }

        console.log('\n🎉 Telegram Memos Bot is now running!');
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the application
start();
