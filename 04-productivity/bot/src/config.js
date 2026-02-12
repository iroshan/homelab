/**
 * Configuration module for Telegram Memos Bot
 */

module.exports = {
    // Telegram Bot Token
    botToken: process.env.BOT_TOKEN || '',

    // Memos API Configuration
    memos: {
        url: process.env.MEMOS_URL || 'http://memos:5230',
        apiBase: '/api/v1',
    },

    // Bot Settings
    bot: {
        adminUserId: process.env.BOT_ADMIN_USER_ID || null,
        dailySummaryTime: process.env.DAILY_SUMMARY_TIME || '20:00',
        weeklySummaryDay: parseInt(process.env.WEEKLY_SUMMARY_DAY || '0'),
    },

    // Timezone
    timezone: process.env.TZ || 'Europe/London',
};
