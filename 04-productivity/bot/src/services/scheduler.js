/**
 * Scheduler Service
 * Handles cron jobs for daily/weekly summaries
 */

const cron = require('node-cron');
const config = require('../config');
const memosAPI = require('./memos-api');
const { format } = require('date-fns');

class Scheduler {
    constructor(bot) {
        this.bot = bot;
        this.jobs = [];
    }

    /**
     * Start all scheduled jobs
     */
    start() {
        this.scheduleDailySummary();
        this.scheduleWeeklySummary();
        console.log('✅ Scheduler started');
    }

    /**
     * Schedule daily summary
     */
    scheduleDailySummary() {
        const [hour, minute] = config.bot.dailySummaryTime.split(':');
        const cronExpression = `${minute} ${hour} * * *`;

        const job = cron.schedule(cronExpression, async () => {
            console.log('Running daily summary...');
            await this.sendDailySummary();
        });

        this.jobs.push(job);
        console.log(`📅 Daily summary scheduled at ${config.bot.dailySummaryTime}`);
    }

    /**
     * Schedule weekly summary
     */
    scheduleWeeklySummary() {
        const [hour, minute] = config.bot.dailySummaryTime.split(':');
        const day = config.bot.weeklySummaryDay;
        const cronExpression = `${minute} ${hour} * * ${day}`;

        const job = cron.schedule(cronExpression, async () => {
            console.log('Running weekly summary...');
            await this.sendWeeklySummary();
        });

        this.jobs.push(job);
        console.log(`📅 Weekly summary scheduled on day ${day} at ${config.bot.dailySummaryTime}`);
    }

    /**
     * Send daily summary to users
     */
    async sendDailySummary() {
        // Get all users who have authenticated
        const userIds = Array.from(memosAPI.userTokens.keys());

        for (const userId of userIds) {
            try {
                const result = await memosAPI.listMemos(userId, 100);

                if (!result.success) continue;

                const memos = result.data;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Filter memos created today
                const todayMemos = memos.filter(memo => {
                    const memoDate = new Date(memo.createTime);
                    return memoDate >= today;
                });

                if (todayMemos.length === 0) {
                    await this.bot.telegram.sendMessage(
                        userId,
                        '📊 *Daily Summary*\n\nNo memos created today. Keep it up tomorrow! 💪',
                        { parse_mode: 'Markdown' }
                    );
                    continue;
                }

                // Extract tags
                const allTags = new Set();
                todayMemos.forEach(memo => {
                    const tags = memosAPI.extractTags(memo.content);
                    tags.forEach(tag => allTags.add(tag));
                });

                let message = `📊 *Daily Summary - ${format(today, 'MMM dd, yyyy')}*\n\n`;
                message += `📝 Memos created today: *${todayMemos.length}*\n`;

                if (allTags.size > 0) {
                    message += `🏷️ Tags used: ${Array.from(allTags).map(t => `#${t}`).join(', ')}\n`;
                }

                message += `\n✨ Great work today! Keep capturing your thoughts!`;

                await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error(`Error sending daily summary to ${userId}:`, error.message);
            }
        }
    }

    /**
     * Send weekly summary to users
     */
    async sendWeeklySummary() {
        const userIds = Array.from(memosAPI.userTokens.keys());

        for (const userId of userIds) {
            try {
                const result = await memosAPI.listMemos(userId, 200);

                if (!result.success) continue;

                const memos = result.data;
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);

                // Filter memos from last week
                const weekMemos = memos.filter(memo => {
                    const memoDate = new Date(memo.createTime);
                    return memoDate >= weekAgo && memoDate <= today;
                });

                if (weekMemos.length === 0) {
                    await this.bot.telegram.sendMessage(
                        userId,
                        '📊 *Weekly Summary*\n\nNo memos created this week. Start fresh this week! 💪',
                        { parse_mode: 'Markdown' }
                    );
                    continue;
                }

                // Extract and count tags
                const tagCounts = {};
                weekMemos.forEach(memo => {
                    const tags = memosAPI.extractTags(memo.content);
                    tags.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                });

                const topTags = Object.entries(tagCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                let message = `📊 *Weekly Summary - Week of ${format(weekAgo, 'MMM dd')}*\n\n`;
                message += `📝 Total memos: *${weekMemos.length}*\n`;
                message += `📊 Daily average: *${(weekMemos.length / 7).toFixed(1)}*\n\n`;

                if (topTags.length > 0) {
                    message += `🏷️ *Top tags:*\n`;
                    topTags.forEach(([tag, count]) => {
                        message += `   • #${tag} (${count})\n`;
                    });
                }

                message += `\n🎉 Keep up the great work! Your productivity is on fire! 🔥`;

                await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error(`Error sending weekly summary to ${userId}:`, error.message);
            }
        }
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.jobs.forEach(job => job.stop());
        console.log('Scheduler stopped');
    }
}

module.exports = Scheduler;
