/**
 * Memo creation commands
 */

module.exports = (bot, memosAPI) => {
    // Memo command
    bot.command(['memo', 'note', 'quick'], async (ctx) => {
        const userId = ctx.from.id;

        // Check authentication
        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const text = ctx.message.text.split(' ').slice(1).join(' ');

        if (!text) {
            await ctx.reply('📝 Usage: /memo <your note here>\n\nExample:\n`/memo Remember to buy milk #shopping`', {
                parse_mode: 'Markdown',
            });
            return;
        }

        // Create the memo
        const result = await memosAPI.createMemo(userId, text);

        if (result.success) {
            const tags = memosAPI.extractTags(text);
            let response = '✅ Memo created successfully!';

            if (tags.length > 0) {
                response += `\n🏷️ Tags: ${tags.map(t => `#${t}`).join(', ')}`;
            }

            await ctx.reply(response);
        } else {
            await ctx.reply(`❌ Failed to create memo: ${result.error}`);
        }
    });

    // Handle photos with captions
    bot.on('photo', async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const caption = ctx.message.caption || '[Photo]';
        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        // Create memo with photo reference
        const content = `${caption}\n\n📷 Photo ID: ${photoId}`;
        const result = await memosAPI.createMemo(userId, content);

        if (result.success) {
            await ctx.reply('✅ Photo memo saved!');
        } else {
            await ctx.reply(`❌ Failed to save photo: ${result.error}`);
        }
    });

    // Handle plain text messages as quick memos
    bot.on('text', async (ctx) => {
        const userId = ctx.from.id;
        const text = ctx.message.text;

        // Ignore if it's a command
        if (text.startsWith('/')) {
            return;
        }

        // Check authentication
        if (!memosAPI.getUserToken(userId)) {
            return; // Silently ignore for unauthenticated users
        }

        // Auto-save as memo
        const result = await memosAPI.createMemo(userId, text);

        if (result.success) {
            const tags = memosAPI.extractTags(text);
            let response = '✅ Saved';

            if (tags.length > 0) {
                response += ` 🏷️ ${tags.map(t => `#${t}`).join(' ')}`;
            }

            await ctx.reply(response, {
                reply_parameters: { message_id: ctx.message.message_id },
            });
        }
    });

    // Stats command
    bot.command('stats', async (ctx) => {
        const userId = ctx.from.id;

        if (!memosAPI.getUserToken(userId)) {
            await ctx.reply('❌ Please authenticate first using /auth');
            return;
        }

        const result = await memosAPI.listMemos(userId, 1000);

        if (result.success) {
            const memos = result.data;
            const allTags = new Set();

            memos.forEach(memo => {
                const tags = memosAPI.extractTags(memo.content);
                tags.forEach(tag => allTags.add(tag));
            });

            const statsMessage = `
📊 *Your Memo Statistics*

📝 Total memos: *${memos.length}*
🏷️ Unique tags: *${allTags.size}*

Keep up the great work! 🎉
      `;

            await ctx.reply(statsMessage.trim(), { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(`❌ Failed to fetch stats: ${result.error}`);
        }
    });
};
