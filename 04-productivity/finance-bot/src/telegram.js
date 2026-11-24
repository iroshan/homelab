import { getFinanceSnapshot, fetchTrueLayerHealth } from './actual.js';
import { writeExports } from './exporter.js';
import {
  askGemini,
  clearHistory,
  generateMonthlyReview,
  generateWeeklyDigest,
  isGeminiConfigured,
} from './gemini.js';

const MAX_MSG_LEN = 3900;

export function isTelegramConfigured() {
  return Boolean(
    process.env.FINANCE_TELEGRAM_BOT_TOKEN &&
      process.env.FINANCE_TELEGRAM_BOT_TOKEN.trim() &&
      process.env.BOT_ADMIN_USER_ID &&
      process.env.BOT_ADMIN_USER_ID.trim()
  );
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${process.env.FINANCE_TELEGRAM_BOT_TOKEN.trim()}/${method}`;
}

function splitMessage(text) {
  if (text.length <= MAX_MSG_LEN) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_MSG_LEN) {
    let idx = remaining.lastIndexOf('\n', MAX_MSG_LEN);
    if (idx < MAX_MSG_LEN * 0.5) idx = MAX_MSG_LEN;
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendTelegram(chatId, text) {
  if (!process.env.FINANCE_TELEGRAM_BOT_TOKEN?.trim()) return;
  for (const chunk of splitMessage(text)) {
    // Try Markdown first, fall back to plain text if Markdown syntax fails
    const res = await fetch(apiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      await fetch(apiUrl('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: true,
        }),
      });
    }
  }
}

export async function sendAdminAlert(text) {
  const adminId = process.env.BOT_ADMIN_USER_ID?.trim();
  if (!adminId || !process.env.FINANCE_TELEGRAM_BOT_TOKEN?.trim()) return;
  await sendTelegram(adminId, text);
}

async function sendTyping(chatId) {
  try {
    await fetch(apiUrl('sendChatAction'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch {
    // non-fatal
  }
}

function formatQuickSummary(snap) {
  const lines = ['*Actual Budget Summary*', ''];
  lines.push('*Accounts:*');
  for (const a of snap.accounts) {
    lines.push(`• ${a.name}: ${a.balanceGBP}`);
  }
  lines.push(`• Net total: ${snap.netWorthGBP}`);
  lines.push('');
  lines.push(`*Last 7 days:* Spent ${snap.last7d.spentGBP} | In ${snap.last7d.incomeGBP}`);
  lines.push(`*Last 30 days:* Spent ${snap.last30d.spentGBP} | In ${snap.last30d.incomeGBP}`);
  lines.push(`*This month (${snap.currentMonth}):* Spent ${snap.thisMonth.spentGBP} | In ${snap.thisMonth.incomeGBP}`);
  if (snap.last30d.uncategorizedCount > 0) {
    lines.push(`*Uncategorized (30d):* ${snap.last30d.uncategorizedCount} txns (${snap.last30d.uncategorizedSpentGBP})`);
  }
  if (snap.last30d.topMerchants.length > 0) {
    lines.push('');
    lines.push('*Top 5 Merchants (30d):*');
    for (const m of snap.last30d.topMerchants.slice(0, 5)) {
      lines.push(`• ${m.name}: ${m.gbp}`);
    }
  }
  return lines.join('\n');
}

function formatBankHealth(health) {
  if (!health.ok) {
    return `Could not reach TrueLayer sync service (${health.error}).`;
  }
  if (health.connections.length === 0) {
    return 'No TrueLayer bank connections found.';
  }
  const lines = ['*UK Bank Open Banking Status*', ''];
  for (const c of health.connections) {
    const status = c.needsReauth ? 'NEEDS RE-AUTH' : 'OK';
    const expiry = c.consentExpiresAt ? c.consentExpiresAt.slice(0, 10) : 'unknown';
    const days = c.daysLeft !== null ? `${c.daysLeft} days left` : '';
    lines.push(`• Connection #${c.index}: ${status} — expires ${expiry} (${days})`);
  }
  lines.push('');
  lines.push('Manage connections: https://banksync.iroshan.uk');
  return lines.join('\n');
}

async function handleMessage(msg) {
  const adminId = String(process.env.BOT_ADMIN_USER_ID || '').trim();
  const fromId = String(msg.from?.id || '');
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();

  if (!text || !chatId) return;

  if (!adminId || fromId !== adminId) {
    console.warn(`[telegram] Ignored unauthorized message from userId=${fromId}`);
    return;
  }

  const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];

  try {
    if (cmd === '/start' || cmd === '/help') {
      await sendTelegram(
        chatId,
        [
          '*Actual Budget + Gemini Finance Bot*',
          '',
          'Ask me anything about your UK finances in plain English, or use:',
          '• /summary — Instant balances & 7d/30d spending',
          '• /weekly — AI weekly review & tips',
          '• /monthly — AI monthly review & subscription audit',
          '• /banks — UK bank Open Banking consent status',
          '• /export — Refresh Google Drive Gemini export files',
          '• /refresh — Pull fresh data from Actual Budget',
          '• /reset — Clear chat memory',
        ].join('\n')
      );
      return;
    }

    if (cmd === '/reset') {
      clearHistory(chatId);
      await sendTelegram(chatId, 'Conversation history cleared.');
      return;
    }

    if (cmd === '/banks') {
      const health = await fetchTrueLayerHealth();
      await sendTelegram(chatId, formatBankHealth(health));
      return;
    }

    if (cmd === '/summary' || cmd === '/refresh') {
      await sendTyping(chatId);
      const snap = await getFinanceSnapshot({ forceRefresh: true });
      await sendTelegram(chatId, formatQuickSummary(snap));
      return;
    }

    if (cmd === '/export') {
      await sendTyping(chatId);
      const snap = await getFinanceSnapshot({ forceRefresh: true });
      const res = writeExports(snap);
      await sendTelegram(
        chatId,
        `Refreshed export files (${res.txCount} transactions from the last 90 days). Google Drive sync runs automatically on schedule.`
      );
      return;
    }

    if (!isGeminiConfigured()) {
      await sendTelegram(
        chatId,
        'GEMINI_API_KEY is not configured yet in `finance-bot.env`. You can still use /summary, /banks, and /export.'
      );
      return;
    }

    await sendTyping(chatId);
    const snap = await getFinanceSnapshot({ forceRefresh: cmd === '/weekly' || cmd === '/monthly' });

    if (cmd === '/weekly') {
      const digest = await generateWeeklyDigest(snap);
      await sendTelegram(chatId, digest);
      return;
    }

    if (cmd === '/monthly') {
      const review = await generateMonthlyReview(snap);
      await sendTelegram(chatId, review);
      return;
    }

    // Free-form AI finance question
    const answer = await askGemini(chatId, text, snap);
    await sendTelegram(chatId, answer);
  } catch (err) {
    console.error('[telegram] Error handling message:', err);
    await sendTelegram(chatId, `Sorry, something went wrong: ${err.message}`);
  }
}

export function startTelegramBot() {
  if (!isTelegramConfigured()) {
    console.log(
      '[telegram] FINANCE_TELEGRAM_BOT_TOKEN or BOT_ADMIN_USER_ID not set — Telegram polling disabled (exporter still active).'
    );
    return { stop: () => {} };
  }

  let running = true;
  let offset = 0;

  async function pollLoop() {
    console.log('[telegram] Polling started (locked to BOT_ADMIN_USER_ID).');
    while (running) {
      try {
        const res = await fetch(
          apiUrl(`getUpdates?timeout=30&offset=${offset}&allowed_updates=["message"]`),
          { signal: AbortSignal.timeout(40000) }
        );
        if (!res.ok) {
          const body = await res.text();
          console.error(`[telegram] getUpdates HTTP ${res.status}: ${body.slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            if (update.message) {
              await handleMessage(update.message);
            }
          }
        }
      } catch (err) {
        if (!running) break;
        if (err.name !== 'TimeoutError' && err.name !== 'AbortError') {
          console.error('[telegram] Poll error:', err.message);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  void pollLoop();

  return {
    stop: () => {
      running = false;
    },
  };
}
