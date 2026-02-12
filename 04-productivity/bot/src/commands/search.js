/**
 * Search and list commands
 */

const { format, parseISO } = require('date-fns');

module.exports = (bot, memosAPI) => {
    // List recent memos
    bot.command('list', async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const args = ctx.message.text.split(' ').slice(1);
        const limit = parseInt(args[0]) || 10;

        const result = await memosAPI.listMemos(userId, limit);

        if (!result.success) {
            await ctx.reply(`❌ Failed to list memos: ${result.error}`);
            return;
        }

        const memos = result.data;

        if (memos.length === 0) {
            await ctx.reply('📝 No memos found. Create your first memo with /memo!');
            return;
        }

        let message = `📋 *Your Recent Memos* (${memos.length})\n\n`;

        memos.slice(0, limit).forEach((memo, index) => {
            const content = memo.content.length > 100
                ? memo.content.substring(0, 100) + '...'
                : memo.content;

            const date = memo.createTime ? format(parseISO(memo.createTime), 'MMM dd, HH:mm') : 'Unknown';

            message += `${index + 1}. ${content}\n`;
            message += `   _${date}_\n\n`;
        });

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // Search memos
    bot.command(['search', 'find'], async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const query = ctx.message.text.split(' ').slice(1).join(' ');

        if (!query) {
            await ctx.reply('🔍 Usage: /search <query>\n\nExample:\n`/search meeting notes`', {
                parse_mode: 'Markdown',
            });
            return;
        }

        const result = await memosAPI.searchMemos(userId, query, 10);

        if (!result.success) {
            await ctx.reply(`❌ Search failed: ${result.error}`);
            return;
        }

        const memos = result.data;

        if (memos.length === 0) {
            await ctx.reply(`🔍 No memos found matching "${query}"`);
            return;
        }

        let message = `🔍 *Search Results for "${query}"*\n\n`;
        message += `Found ${memos.length} memo(s)\n\n`;

        memos.forEach((memo, index) => {
            const content = memo.content.length > 100
                ? memo.content.substring(0, 100) + '...'
                : memo.content;

            const date = memo.createTime ? format(parseISO(memo.createTime), 'MMM dd') : 'Unknown';

            message += `${index + 1}. ${content}\n`;
            message += `   _${date}_\n\n`;
        });

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // List all tags
    bot.command('tags', async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const result = await memosAPI.listMemos(userId, 1000);

        if (!result.success) {
            await ctx.reply(`❌ Failed to fetch tags: ${result.error}`);
            return;
        }

        const memos = result.data;
        const tagCounts = {};

        memos.forEach(memo => {
            const tags = memosAPI.extractTags(memo.content);
            tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        if (Object.keys(tagCounts).length === 0) {
            await ctx.reply('🏷️ No tags found. Start using #hashtags in your memos!');
            return;
        }

        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1]);

        let message = `🏷️ *Your Tags* (${sortedTags.length})\n\n`;

        sortedTags.forEach(([tag, count]) => {
            message += `#${tag} (${count})\n`;
        });

        message += `\n💡 Use /tag <name> to see memos with a specific tag`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // Get memos by tag
    bot.command('tag', async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const tag = ctx.message.text.split(' ').slice(1).join(' ').replace('#', '');

        if (!tag) {
            await ctx.reply('🏷️ Usage: /tag <tagname>\n\nExample:\n`/tag work`', {
                parse_mode: 'Markdown',
            });
            return;
        }

        const result = await memosAPI.getMemosByTag(userId, tag, 20);

        if (!result.success) {
            await ctx.reply(`❌ Failed to fetch memos: ${result.error}`);
            return;
        }

        const memos = result.data;

        if (memos.length === 0) {
            await ctx.reply(`🏷️ No memos found with tag #${tag}`);
            return;
        }

        let message = `🏷️ *Memos tagged with #${tag}*\n\n`;
        message += `Found ${memos.length} memo(s)\n\n`;

        memos.forEach((memo, index) => {
            const content = memo.content.length > 100
                ? memo.content.substring(0, 100) + '...'
                : memo.content;

            const date = memo.createTime ? format(parseISO(memo.createTime), 'MMM dd') : 'Unknown';

            message += `${index + 1}. ${content}\n`;
            message += `   _${date}_\n\n`;
        });

        await ctx.reply(message, { parse_mode: 'Markdown' });
    });
};
