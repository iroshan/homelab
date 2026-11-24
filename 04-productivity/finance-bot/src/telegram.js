import {
  applyReceiptSplit,
  fetchTrueLayerHealth,
  findMatchingTransaction,
  getExpenseCategories,
  getFinanceSnapshot,
} from './actual.js';
import { writeExports } from './exporter.js';
import {
  askGemini,
  clearHistory,
  generateMonthlyReview,
  generateWeeklyDigest,
  isGeminiConfigured,
  parseReceiptPhoto,
} from './gemini.js';
import {
  addPendingReceipt,
  clearPendingReceipts,
  loadPendingReceipts,
  normalizeSplitsToTarget,
  removePendingReceipt,
} from './receipts.js';

const MAX_MSG_LEN = 3900;
// Active awaiting-confirmation receipt split per chat
const activeDrafts = new Map();

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

async function downloadTelegramFile(fileId) {
  const token = process.env.FINANCE_TELEGRAM_BOT_TOKEN.trim();
  const infoRes = await fetch(apiUrl(`getFile?file_id=${encodeURIComponent(fileId)}`));
  const info = await infoRes.json();
  if (!info.ok || !info.result?.file_path) {
    throw new Error('Could not fetch file path from Telegram.');
  }
  const filePath = info.result.file_path;
  const dlRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!dlRes.ok) throw new Error(`Failed to download photo (HTTP ${dlRes.status})`);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  const lower = filePath.toLowerCase();
  const mimeType = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  return { base64: buf.toString('base64'), mimeType };
}

function formatDraftPreview(parsed, splits, matchedTx) {
  const lines = [
    `*Receipt Scanned:* ${parsed.store || 'Unknown store'}`,
    `• Date: ${parsed.date || 'not readable'} | Total: £${Number(parsed.totalGBP).toFixed(2)}`,
    '',
    '*Proposed Split:*',
  ];
  for (const s of splits) {
    lines.push(`• ${s.category}: £${(Math.abs(s.amountCents) / 100).toFixed(2)} (${s.summary})`);
  }

  if (Array.isArray(parsed.nonGroceryItems) && parsed.nonGroceryItems.length > 0) {
    lines.push('', '*Non-grocery items spotted:*');
    for (const item of parsed.nonGroceryItems.slice(0, 10)) {
      lines.push(`• ${item.item} (£${Number(item.amountGBP || 0).toFixed(2)}) → ${item.category}`);
    }
  }

  lines.push('');
  if (matchedTx) {
    lines.push(
      `*Matched in Actual Budget:*`,
      `${matchedTx.date} | ${matchedTx.accountName} | ${matchedTx.payeeName} | ${matchedTx.amountGBP}`,
      matchedTx.alreadySplit ? '_(Note: this transaction is already split and will be replaced)_' : '',
      '',
      'Reply `/apply` to split this transaction in Actual Budget, or `/cancel`.'
    );
  } else {
    lines.push(
      '*Not synced from your bank yet.*',
      'Saved! Once your bank transaction syncs (every 6h), send `/receipts` to match & apply — or I will alert you automatically.'
    );
  }

  return lines.filter((l) => l !== '').join('\n');
}

async function handlePhotoMessage(msg) {
  const chatId = msg.chat?.id;
  if (!isGeminiConfigured()) {
    await sendTelegram(chatId, 'GEMINI_API_KEY is not configured yet, so receipt scanning is disabled.');
    return;
  }

  await sendTyping(chatId);
  await sendTelegram(chatId, 'Scanning receipt with Gemini...');

  try {
    // Pick highest resolution photo (or image document)
    let fileId = null;
    if (Array.isArray(msg.photo) && msg.photo.length > 0) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.document?.mime_type?.startsWith('image/')) {
      fileId = msg.document.file_id;
    }
    if (!fileId) return;

    const [{ base64, mimeType }, categories] = await Promise.all([
      downloadTelegramFile(fileId),
      getExpenseCategories(),
    ]);

    const parsed = await parseReceiptPhoto({
      imageBase64: base64,
      mimeType,
      categoryNames: categories.map((c) => c.name),
      userCaption: (msg.caption || '').trim(),
    });

    const matchedTx = await findMatchingTransaction({
      store: parsed.store,
      date: parsed.date,
      totalGBP: parsed.totalGBP,
    });

    const targetCents = matchedTx
      ? matchedTx.amountCents
      : -Math.round(Number(parsed.totalGBP) * 100);
    const splits = normalizeSplitsToTarget(parsed.splits, targetCents);

    if (matchedTx) {
      activeDrafts.set(String(chatId), {
        pendingId: null,
        parsed,
        splits,
        matchedTx,
      });
    } else {
      addPendingReceipt({
        store: parsed.store,
        date: parsed.date,
        totalGBP: parsed.totalGBP,
        splits: parsed.splits,
        nonGroceryItems: parsed.nonGroceryItems || [],
      });
    }

    await sendTelegram(chatId, formatDraftPreview(parsed, splits, matchedTx));
  } catch (err) {
    console.error('[receipt] Error:', err);
    await sendTelegram(chatId, `Could not process receipt: ${err.message}`);
  }
}

async function handleMessage(msg) {
  const adminId = String(process.env.BOT_ADMIN_USER_ID || '').trim();
  const fromId = String(msg.from?.id || '');
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const hasImage =
    (Array.isArray(msg.photo) && msg.photo.length > 0) ||
    Boolean(msg.document?.mime_type?.startsWith('image/'));

  if ((!text && !hasImage) || !chatId) return;

  if (!adminId || fromId !== adminId) {
    console.warn(`[telegram] Ignored unauthorized message from userId=${fromId}`);
    return;
  }

  if (hasImage) {
    await handlePhotoMessage(msg);
    return;
  }

  const cmd = text.split(/\s+/)[0].toLowerCase().split('@')[0];
  const arg = text.slice(cmd.length).trim().toLowerCase();

  try {
    if (cmd === '/start' || cmd === '/help') {
      await sendTelegram(
        chatId,
        [
          '*Actual Budget + Gemini Finance Bot*',
          '',
          '• *Send a receipt photo* (with optional note) to auto-split supermarket non-grocery items!',
          '• *Ask any question* in plain English about your UK finances',
          '',
          '*Commands:*',
          '• /summary — Instant balances & 7d/30d spending',
          '• /weekly — AI weekly review & tips',
          '• /monthly — AI monthly review & subscription audit',
          '• /receipts — Match saved receipts waiting for bank sync',
          '• /apply — Confirm & apply the last receipt split',
          '• /cancel — Cancel pending split (or `/cancel all`)',
          '• /banks — UK bank Open Banking consent status',
          '• /export — Refresh Google Drive Gemini export files',
          '• /refresh — Pull fresh data from Actual Budget',
          '• /reset — Clear chat memory',
        ].join('\n')
      );
      return;
    }

    if (cmd === '/cancel') {
      activeDrafts.delete(String(chatId));
      if (arg === 'all') {
        clearPendingReceipts();
        await sendTelegram(chatId, 'Cleared active draft and all saved pending receipts.');
      } else {
        await sendTelegram(chatId, 'Cancelled pending receipt split.');
      }
      return;
    }

    if (cmd === '/apply') {
      const draft = activeDrafts.get(String(chatId));
      if (!draft || !draft.matchedTx) {
        await sendTelegram(chatId, 'No matched receipt split waiting. Send a receipt photo or run /receipts first.');
        return;
      }
      await sendTyping(chatId);
      const res = await applyReceiptSplit(draft.matchedTx, draft.splits, draft.parsed.store);
      activeDrafts.delete(String(chatId));
      if (draft.pendingId) removePendingReceipt(draft.pendingId);

      // Refresh exports right away so Consumer Gemini sees the split
      const snap = await getFinanceSnapshot({ forceRefresh: true });
      writeExports(snap);

      const summaryLines = res.splits.map(
        (s) => `• ${s.categoryName}: £${(Math.abs(s.amountCents) / 100).toFixed(2)}`
      );
      await sendTelegram(
        chatId,
        [
          `*Split applied in Actual Budget!*`,
          `${draft.matchedTx.date} | ${draft.matchedTx.accountName} | ${draft.matchedTx.payeeName}`,
          ...summaryLines,
        ].join('\n')
      );
      return;
    }

    if (cmd === '/receipts') {
      const pending = loadPendingReceipts();
      if (pending.length === 0) {
        await sendTelegram(chatId, 'No saved receipts waiting for bank sync. Send a receipt photo anytime!');
        return;
      }
      await sendTyping(chatId);
      let matchedAny = false;
      const lines = ['*Saved Pending Receipts:*', ''];
      for (const r of pending) {
        const matchedTx = await findMatchingTransaction({
          store: r.store,
          date: r.date,
          totalGBP: r.totalGBP,
        });
        if (matchedTx && !matchedAny) {
          matchedAny = true;
          const splits = normalizeSplitsToTarget(r.splits, matchedTx.amountCents);
          activeDrafts.set(String(chatId), {
            pendingId: r.id,
            parsed: r,
            splits,
            matchedTx,
          });
          await sendTelegram(chatId, formatDraftPreview(r, splits, matchedTx));
          return;
        }
        lines.push(
          `• ${r.store || 'Receipt'} (£${Number(r.totalGBP).toFixed(2)}, ${r.date || 'no date'}) — still waiting for bank sync`
        );
      }
      lines.push('', 'Send `/cancel all` to clear old saved receipts.');
      await sendTelegram(chatId, lines.join('\n'));
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
