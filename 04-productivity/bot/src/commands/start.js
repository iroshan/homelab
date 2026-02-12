/**
 * Start command - Welcome message and setup instructions
 */

const config = require('../config');

module.exports = (bot, memosAPI) => {
    bot.command('start', async (ctx) => {
        const userId = ctx.from.id;

        const welcomeMessage = `
👋 *Welcome to Memos Bot!*

I'm your personal note-taking assistant, powered by Memos.

🎯 *What I can do:*
📝 Quick note-taking
🔍 Search your memos
🏷️ Tag management
📌 Pin important notes
📊 Daily & weekly summaries

📚 *Getting Started:*
1. First, you need to authenticate with your Memos account
2. Use /auth to set up your access token
3. Start taking notes!

💡 *Quick Tips:*
• Send any message to create a memo
• Use #tags to organize your notes
• Type /help to see all commands

Ready to boost your productivity? 🚀
    `;

        await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    });

    bot.command('help', async (ctx) => {
        const helpMessage = `
📖 *Command Reference*

*Note Taking:*
/memo \`<text>\` - Create a new memo
/quick \`<text>\` - Quick memo (alias)

*Search & Browse:*
/list - Show recent memos
/search \`<query>\` - Search memos
/tag \`<tagname>\` - Show memos with tag

*Organization:*
/tags - List all your tags
/pin \`<memo_id>\` - Pin a memo
/delete \`<memo_id>\` - Delete a memo

*Settings:*
/auth - Set up authentication
/stats - View your statistics
/help - Show this help message

*Features:*
🔔 Daily summaries at ${config.bot.dailySummaryTime}
📊 Weekly digest on Sundays
🏷️ Automatic tag extraction from #hashtags
📌 Pin important memos for quick access

💬 *Pro Tip:* Just send me any text and I'll save it as a memo!
    `;

        await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    bot.command('auth', async (ctx) => {
        const authMessage = `
🔐 *Authentication Setup*

To use this bot, you need to authenticate with your Memos account.

*Steps:*
1. Open your Memos instance: ${config.memos.url}
2. Log in to your account
3. Go to Settings → Access Tokens
4. Create a new access token
5. Send it to me using:
   \`/settoken YOUR_TOKEN_HERE\`

⚠️ *Important:* Your token will be stored securely and used only to interact with your Memos account.

Need help? Check the Memos documentation or contact your admin.
    `;

        await ctx.reply(authMessage, { parse_mode: 'Markdown' });
    });

    bot.command('settoken', async (ctx) => {
        const userId = ctx.from.id;
        const args = ctx.message.text.split(' ').slice(1);

        if (args.length === 0) {
            await ctx.reply('❌ Please provide your access token:\n`/settoken YOUR_TOKEN_HERE`', {
                parse_mode: 'Markdown',
            });
            return;
        }

        const token = args[0];

        // Store the token
        memosAPI.setUserToken(userId, token);

        // Test the token
        const healthCheck = await memosAPI.listMemos(userId, 1);

        if (healthCheck.success) {
            await ctx.reply('✅ Authentication successful! You can now use all bot features. 🎉');

            // Delete the message containing the token for security
            try {
                await ctx.deleteMessage();
            } catch (e) {
                // Ignore if we can't delete (e.g., message too old)
            }
        } else {
            await ctx.reply('❌ Authentication failed. Please check your token and try again.');
            memosAPI.userTokens.delete(userId.toString());
        }
    });
};
