import {
  applyReceiptSplit,
  fetchTrueLayerHealth,
  findMatchingTransaction,
  getExpenseCategories,
  getFinanceSnapshot,
  undoReceiptSplit,
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
  getUndoEntry,
  isHighConfidenceMatch,
  loadPendingReceipts,
  normalizeSplitsToTarget,
  removePendingReceipt,
  removeUndoEntry,
  saveUndoEntry,
} from './receipts.js';

const MAX_MSG_LEN = 3900;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
// Drafts awaiting confirmation, keyed by draftId
const draftsById = new Map();

function storeDraft(draft) {
  const now = Date.now();
  for (const [k, v] of draftsById) {
    if (now - v.createdAt > DRAFT_TTL_MS) draftsById.delete(k);
  }
  const id = `drft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const record = { id, createdAt: now, ...draft };
  draftsById.set(id, record);
  return record;
}

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

async function tgPost(method, payload) {
  const res = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: res.ok }));
}

export async function sendTelegram(chatId, text, options = {}) {
  if (!process.env.FINANCE_TELEGRAM_BOT_TOKEN?.trim()) return null;
  const chunks = splitMessage(text);
  let lastMsg = null;

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const basePayload = {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
      ...(i === 0 && options.replyToMessageId
        ? { reply_to_message_id: options.replyToMessageId }
        : {}),
      ...(isLast && options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    };

    let data = await tgPost('sendMessage', { ...basePayload, parse_mode: 'Markdown' });
    if (!data.ok) {
      data = await tgPost('sendMessage', basePayload);
    }
    if (data.ok) lastMsg = data.result;
  }
  return lastMsg;
}

export async function editTelegramMessage(chatId, messageId, text, options = {}) {
  const basePayload = {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, MAX_MSG_LEN),
    disable_web_page_preview: true,
    ...(options.replyMarkup !== undefined ? { reply_markup: options.replyMarkup } : {}),
  };
  let data = await tgPost('editMessageText', { ...basePayload, parse_mode: 'Markdown' });
  if (!data.ok) {
    data = await tgPost('editMessageText', basePayload);
  }
  return data;
}

export async function sendAdminAlert(text, options = {}) {
  const adminId = process.env.BOT_ADMIN_USER_ID?.trim();
  if (!adminId || !process.env.FINANCE_TELEGRAM_BOT_TOKEN?.trim()) return null;
  return sendTelegram(adminId, text, options);
}

async function sendTyping(chatId) {
  try {
    await tgPost('sendChatAction', { chat_id: chatId, action: 'typing' });
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
  const info = await (await fetch(apiUrl(`getFile?file_id=${encodeURIComponent(fileId)}`))).json();
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

function formatAppliedMessage(parsed, matchedTx, applyRes, { auto = false } = {}) {
  const heading = auto
    ? `*Auto-applied receipt!* (${parsed.store || 'Receipt'})`
    : `*Split applied in Actual Budget!* (${parsed.store || 'Receipt'})`;
  const lines = [
    heading,
    `${matchedTx.date} | ${matchedTx.accountName} | ${matchedTx.payeeName} (${matchedTx.amountGBP})`,
    '',
  ];
  for (const s of applyRes.splits) {
    lines.push(`• ${s.categoryName}: £${(Math.abs(s.amountCents) / 100).toFixed(2)}`);
  }
  return lines.join('\n');
}

function formatDraftPreview(parsed, splits, matchedTx) {
  const lines = [
    `*Receipt Scanned:* ${parsed.store || 'Unknown store'}`,
    `• Date: ${parsed.date || 'not readable'} | Total: £${Number(parsed.totalGBP).toFixed(2)}`,
    '',
    splits.length === 1 ? '*Category:*' : '*Proposed Split:*',
  ];
  for (const s of splits) {
    lines.push(`• ${s.category}: £${(Math.abs(s.amountCents) / 100).toFixed(2)} (${s.summary})`);
  }

  const bigNonGrocery = (parsed.nonGroceryItems || []).filter(
    (item) => Number(item.amountGBP || 0) >= 5
  );
  if (bigNonGrocery.length > 0) {
    lines.push('', '*Non-grocery items (£5+):*');
    for (const item of bigNonGrocery.slice(0, 10)) {
      lines.push(`• ${item.item} (£${Number(item.amountGBP || 0).toFixed(2)}) → ${item.category}`);
    }
  }

  lines.push('');
  if (matchedTx) {
    lines.push(
      `*Matched in Actual Budget:*`,
      `${matchedTx.date} | ${matchedTx.accountName} | ${matchedTx.payeeName} | ${matchedTx.amountGBP}`,
      matchedTx.alreadySplit ? '_(Note: already split — tapping Apply replaces it)_' : ''
    );
  } else {
    lines.push(
      '*Waiting for bank sync.*',
      'Saved! As soon as it clears from your bank, I will auto-apply it (or send you a 1-tap button).'
    );
  }

  return lines.filter((l) => l !== '').join('\n');
}

/**
 * Execute an Actual Budget split/categorization, save Undo entry, and refresh exports.
 */
export async function commitReceiptMatch({ parsed, splits, matchedTx, pendingId = null }) {
  const res = await applyReceiptSplit(matchedTx, splits, parsed.store);
  if (pendingId) removePendingReceipt(pendingId);

  const undoRecord = saveUndoEntry({
    ...res.undoPayload,
    store: parsed.store || matchedTx.payeeName,
    splits: res.splits.map((s) => ({
      categoryName: s.categoryName,
      amountCents: s.amountCents,
    })),
  });

  const snap = await getFinanceSnapshot({ forceRefresh: true });
  writeExports(snap);

  return { res, undoRecord };
}

export function buildUndoMarkup(undoId) {
  return {
    inline_keyboard: [[{ text: '↩️ Undo', callback_data: `undo:${undoId}` }]],
  };
}

export function buildConfirmMarkup(draftId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Apply', callback_data: `apply:${draftId}` },
        { text: '❌ Discard', callback_data: `discard:${draftId}` },
      ],
    ],
  };
}

/**
 * Re-usable handler for matched pending receipts (used by /receipts and scheduled sync).
 * Returns { autoApplied, needsConfirm, stillWaiting }.
 */
export async function processPendingReceiptMatch(r, { forceConfirm = false } = {}) {
  const matchedTx = await findMatchingTransaction({
    store: r.store,
    date: r.date,
    totalGBP: r.totalGBP,
  });
  if (!matchedTx) return { status: 'waiting' };

  const splits = normalizeSplitsToTarget(r.splits, matchedTx.amountCents);
  const autoOk = !forceConfirm && isHighConfidenceMatch(r, matchedTx);

  if (autoOk) {
    const { res, undoRecord } = await commitReceiptMatch({
      parsed: r,
      splits,
      matchedTx,
      pendingId: r.id,
    });
    return {
      status: 'auto_applied',
      text: formatAppliedMessage(r, matchedTx, res, { auto: true }),
      replyMarkup: buildUndoMarkup(undoRecord.id),
    };
  }

  const draft = storeDraft({
    pendingId: r.id,
    parsed: r,
    splits,
    matchedTx,
  });
  return {
    status: 'needs_confirm',
    draft,
    text: formatDraftPreview(r, splits, matchedTx),
    replyMarkup: buildConfirmMarkup(draft.id),
  };
}

async function handlePhotoMessage(msg) {
  const chatId = msg.chat?.id;
  if (!isGeminiConfigured()) {
    await sendTelegram(chatId, 'GEMINI_API_KEY is not configured yet, so receipt scanning is disabled.');
    return;
  }

  await sendTyping(chatId);
  const statusMsg = await sendTelegram(chatId, 'Scanning receipt with Gemini...', {
    replyToMessageId: msg.message_id,
  });

  const replyOrEdit = async (text, replyMarkup) => {
    if (statusMsg?.message_id) {
      await editTelegramMessage(chatId, statusMsg.message_id, text, { replyMarkup });
    } else {
      await sendTelegram(chatId, text, {
        replyToMessageId: msg.message_id,
        replyMarkup,
      });
    }
  };

  try {
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

    if (matchedTx && isHighConfidenceMatch(parsed, matchedTx)) {
      const { res, undoRecord } = await commitReceiptMatch({
        parsed,
        splits,
        matchedTx,
      });
      await replyOrEdit(
        formatAppliedMessage(parsed, matchedTx, res, { auto: true }),
        buildUndoMarkup(undoRecord.id)
      );
      return;
    }

    if (matchedTx) {
      const draft = storeDraft({
        pendingId: null,
        parsed,
        splits,
        matchedTx,
      });
      await replyOrEdit(
        formatDraftPreview(parsed, splits, matchedTx),
        buildConfirmMarkup(draft.id)
      );
      return;
    }

    const pendingEntry = addPendingReceipt({
      store: parsed.store,
      date: parsed.date,
      totalGBP: parsed.totalGBP,
      confidence: parsed.confidence || 'medium',
      splits: parsed.splits,
      nonGroceryItems: parsed.nonGroceryItems || [],
    });

    await replyOrEdit(formatDraftPreview(parsed, splits, null), {
      inline_keyboard: [[{ text: '❌ Discard', callback_data: `drop_pending:${pendingEntry.id}` }]],
    });
  } catch (err) {
    console.error('[receipt] Error:', err);
    await replyOrEdit(`Could not process receipt: ${err.message}`);
  }
}

async function handleCallbackQuery(query) {
  const adminId = String(process.env.BOT_ADMIN_USER_ID || '').trim();
  const fromId = String(query.from?.id || '');
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = String(query.data || '');

  if (!adminId || fromId !== adminId) {
    await tgPost('answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Unauthorized.',
      show_alert: true,
    });
    return;
  }

  const [action, id] = data.split(':', 2);

  try {
    if (action === 'apply') {
      const draft = draftsById.get(id);
      if (!draft) {
        await tgPost('answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'This preview expired. Run /receipts to check again.',
        });
        return;
      }
      await tgPost('answerCallbackQuery', { callback_query_id: query.id, text: 'Applying...' });
      const { res, undoRecord } = await commitReceiptMatch(draft);
      draftsById.delete(id);
      await editTelegramMessage(
        chatId,
        messageId,
        formatAppliedMessage(draft.parsed, draft.matchedTx, res, { auto: false }),
        { replyMarkup: buildUndoMarkup(undoRecord.id) }
      );
      return;
    }

    if (action === 'discard') {
      const draft = draftsById.get(id);
      if (draft?.pendingId) removePendingReceipt(draft.pendingId);
      draftsById.delete(id);
      await tgPost('answerCallbackQuery', { callback_query_id: query.id, text: 'Discarded' });
      await editTelegramMessage(chatId, messageId, 'Discarded receipt split.', {
        replyMarkup: { inline_keyboard: [] },
      });
      return;
    }

    if (action === 'drop_pending') {
      removePendingReceipt(id);
      await tgPost('answerCallbackQuery', { callback_query_id: query.id, text: 'Removed' });
      await editTelegramMessage(chatId, messageId, 'Removed saved pending receipt.', {
        replyMarkup: { inline_keyboard: [] },
      });
      return;
    }

    if (action === 'undo') {
      const entry = getUndoEntry(id);
      if (!entry) {
        await tgPost('answerCallbackQuery', {
          callback_query_id: query.id,
          text: 'Undo entry no longer available.',
        });
        return;
      }
      await tgPost('answerCallbackQuery', { callback_query_id: query.id, text: 'Reverting...' });
      await undoReceiptSplit(entry);
      removeUndoEntry(id);
      const snap = await getFinanceSnapshot({ forceRefresh: true });
      writeExports(snap);
      await editTelegramMessage(
        chatId,
        messageId,
        `↩️ *Undone!* Reverted *${entry.store || entry.originalTx.payeeName}* (${(
          Math.abs(entry.originalTx.amountCents) / 100
        ).toFixed(2)} GBP) back to its original state.`,
        { replyMarkup: { inline_keyboard: [] } }
      );
      return;
    }

    if (action === 'apply_all') {
      await tgPost('answerCallbackQuery', {
        callback_query_id: query.id,
        text: 'Applying all matched receipts...',
      });
      const draftIds = [...draftsById.keys()];
      let applied = 0;
      const lines = ['*Applied all matched receipts:*', ''];
      for (const dId of draftIds) {
        const draft = draftsById.get(dId);
        if (!draft) continue;
        const { res } = await commitReceiptMatch(draft);
        draftsById.delete(dId);
        applied++;
        const splitStr = res.splits
          .map((s) => `${s.categoryName} £${(Math.abs(s.amountCents) / 100).toFixed(2)}`)
          .join(', ');
        lines.push(`• ${draft.parsed.store}: ${splitStr}`);
      }
      await editTelegramMessage(
        chatId,
        messageId,
        applied > 0 ? lines.join('\n') : 'No pending drafts left to apply.',
        { replyMarkup: { inline_keyboard: [] } }
      );
      return;
    }

    await tgPost('answerCallbackQuery', { callback_query_id: query.id });
  } catch (err) {
    console.error('[telegram] Callback error:', err);
    await tgPost('answerCallbackQuery', {
      callback_query_id: query.id,
      text: `Error: ${err.message.slice(0, 150)}`,
      show_alert: true,
    });
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
          '• *Send receipt photos* (one or an album) — high-confidence matches auto-apply with a 1-tap *Undo* button (non-grocery splits only for £5+ items).',
          '• *Ask any question* in plain English about your UK finances',
          '',
          '*Commands:*',
          '• /summary — Instant balances & 7d/30d spending',
          '• /budget — Live monthly budget vs spent per category',
          '• /weekly — AI weekly review & tips',
          '• /monthly — AI monthly review & subscription audit',
          '• /receipts — Match & auto-apply any saved pending receipts',
          '• /cancel all — Clear all saved pending receipts',
          '• /banks — UK bank Open Banking consent status',
          '• /export — Refresh Google Drive Gemini export files',
          '• /refresh — Pull fresh data from Actual Budget',
          '• /reset — Clear chat memory',
        ].join('\n')
      );
      return;
    }

    if (cmd === '/cancel') {
      draftsById.clear();
      if (arg === 'all') {
        clearPendingReceipts();
        await sendTelegram(chatId, 'Cleared all pending drafts and saved receipts.');
      } else {
        await sendTelegram(chatId, 'Cleared active receipt previews (use `/cancel all` to also clear saved pending receipts).');
      }
      return;
    }

    if (cmd === '/apply') {
      const latest = [...draftsById.values()].pop();
      if (!latest) {
        await sendTelegram(chatId, 'No pending draft waiting — send a receipt photo or tap /receipts.');
        return;
      }
      await sendTyping(chatId);
      const { res, undoRecord } = await commitReceiptMatch(latest);
      draftsById.delete(latest.id);
      await sendTelegram(
        chatId,
        formatAppliedMessage(latest.parsed, latest.matchedTx, res, { auto: false }),
        { replyMarkup: buildUndoMarkup(undoRecord.id) }
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
      const waitingLines = [];
      let confirmCount = 0;
      let autoCount = 0;

      for (const r of pending) {
        const outcome = await processPendingReceiptMatch(r);
        if (outcome.status === 'auto_applied') {
          autoCount++;
          await sendTelegram(chatId, outcome.text, { replyMarkup: outcome.replyMarkup });
        } else if (outcome.status === 'needs_confirm') {
          confirmCount++;
          await sendTelegram(chatId, outcome.text, { replyMarkup: outcome.replyMarkup });
        } else {
          waitingLines.push(
            `• ${r.store || 'Receipt'} (£${Number(r.totalGBP).toFixed(2)}, ${r.date || 'no date'})`
          );
        }
      }

      if (confirmCount >= 2) {
        await sendTelegram(chatId, `${confirmCount} receipts ready to apply:`, {
          replyMarkup: {
            inline_keyboard: [[{ text: `✅ Apply All (${confirmCount})`, callback_data: 'apply_all:now' }]],
          },
        });
      }

      if (waitingLines.length > 0) {
        await sendTelegram(
          chatId,
          ['*Still waiting for bank sync:*', ...waitingLines, '', 'Tap `/cancel all` to clear old ones.'].join('\n')
        );
      } else if (autoCount === 0 && confirmCount === 0) {
        await sendTelegram(chatId, 'No pending receipts matched yet.');
      }
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

    if (cmd === '/budget') {
      await sendTyping(chatId);
      const snap = await getFinanceSnapshot({ forceRefresh: true });
      const bs = snap.budgetSummary;
      if (!bs || !bs.categories?.length) {
        await sendTelegram(chatId, 'No monthly budget targets set yet.');
        return;
      }
      const lines = [
        `*Monthly Budget (${bs.month})*`,
        `Total budgeted: ${bs.totalBudgetedGBP} | Spent: ${bs.totalSpentGBP}`,
        '',
      ];
      for (const c of bs.categories) {
        const flag = c.balanceCents < 0 ? ' ⚠️' : '';
        lines.push(`• ${c.name}: ${c.spentGBP} / ${c.budgetedGBP} (left: ${c.remainingGBP})${flag}`);
      }
      await sendTelegram(chatId, lines.join('\n'));
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
          apiUrl(
            `getUpdates?timeout=30&offset=${offset}&allowed_updates=${encodeURIComponent(
              JSON.stringify(['message', 'callback_query'])
            )}`
          ),
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
            if (update.callback_query) {
              await handleCallbackQuery(update.callback_query);
            } else if (update.message) {
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
