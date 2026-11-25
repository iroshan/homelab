import fs from 'fs';
import path from 'path';
import * as api from '@actual-app/api';

const CACHE_DIR = path.join(process.cwd(), 'data', 'actual-cache');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for chat queries

let queue = Promise.resolve();
let initialized = false;
let cachedSnapshot = null;
let cachedAt = 0;

function withLock(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function gbp(amountCents) {
  const num = Number(amountCents || 0) / 100;
  const sign = num < 0 ? '-' : '';
  return `${sign}£${Math.abs(num).toFixed(2)}`;
}

async function ensureActual() {
  const serverURL = process.env.ACTUAL_SERVER_URL;
  const password = process.env.ACTUAL_PASSWORD;
  const syncId = process.env.ACTUAL_SYNC_ID;
  const encryptionPassword = process.env.ACTUAL_ENCRYPTION_PASSWORD || undefined;

  if (!serverURL || !password || !syncId) {
    throw new Error('Missing ACTUAL_SERVER_URL, ACTUAL_PASSWORD, or ACTUAL_SYNC_ID');
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  if (!initialized) {
    await api.init({ dataDir: CACHE_DIR, serverURL, password });
    initialized = true;
  }

  try {
    await api.downloadBudget(
      syncId,
      encryptionPassword ? { password: encryptionPassword } : undefined
    );
  } catch (err) {
    if (String(err?.code || err?.message || '').includes('out-of-sync')) {
      console.warn('[actual] Local cache out-of-sync — resetting cache and re-downloading...');
      try { await api.shutdown(); } catch {}
      initialized = false;
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      await api.init({ dataDir: CACHE_DIR, serverURL, password });
      initialized = true;
      await api.downloadBudget(
        syncId,
        encryptionPassword ? { password: encryptionPassword } : undefined
      );
    } else {
      throw err;
    }
  }
}

export async function fetchTrueLayerHealth() {
  const url = process.env.TRUELAYER_HEALTH_URL || 'http://truelayer2actual:3000/healthz';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, connections: [] };
    const data = await res.json();
    const now = Date.now();
    const connections = (data.connections || []).map((c, idx) => {
      const expiresMs = c.consentExpiresAt ? Date.parse(c.consentExpiresAt) : NaN;
      const daysLeft = Number.isFinite(expiresMs)
        ? Math.floor((expiresMs - now) / 86_400_000)
        : null;
      return {
        index: idx + 1,
        needsReauth: Boolean(c.needsReauth),
        consentExpiresAt: c.consentExpiresAt || null,
        daysLeft,
      };
    });
    return { ok: true, status: data.status, connections };
  } catch (err) {
    return { ok: false, error: err.message, connections: [] };
  }
}

export async function getFinanceSnapshot({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  return withLock(async () => {
    if (!forceRefresh && cachedSnapshot && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedSnapshot;
    }

    await ensureActual();

    const now = new Date();
    const todayStr = formatDate(now);
    const d90 = new Date(now);
    d90.setDate(d90.getDate() - 90);
    const start90Str = formatDate(d90);

    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const start30Str = formatDate(d30);

    const d7 = new Date(now);
    d7.setDate(d7.getDate() - 7);
    const start7Str = formatDate(d7);

    const currentMonth = todayStr.slice(0, 7);
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevMonth = formatDate(prevMonthDate).slice(0, 7);

    const [accountsRaw, categoriesRaw, categoryGroupsRaw, payeesRaw] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getCategoryGroups(),
      api.getPayees(),
    ]);

    const categoryMap = new Map();
    const groupMap = new Map(categoryGroupsRaw.map((g) => [g.id, g.name]));
    for (const c of categoriesRaw) {
      categoryMap.set(c.id, {
        name: c.name,
        group: groupMap.get(c.group_id) || 'Other',
        isIncome: Boolean(c.is_income),
      });
    }

    const payeeMap = new Map(payeesRaw.map((p) => [p.id, p.name || p.transfer_acct || 'Unknown']));
    const openAccounts = accountsRaw.filter((a) => !a.closed);

    const accounts = [];
    const allTransactions = [];

    for (const acc of openAccounts) {
      const [bal, txs] = await Promise.all([
        api.getAccountBalance(acc.id),
        api.getTransactions(acc.id, start90Str, todayStr),
      ]);

      accounts.push({
        id: acc.id,
        name: acc.name,
        offbudget: Boolean(acc.offbudget),
        balanceCents: Number(bal || 0),
        balanceGBP: gbp(bal),
        txCount90d: txs.length,
      });

      for (const tx of txs) {
        if (tx.tombstone) continue;
        // Skip internal transfer legs when calculating net spending, but keep flagged
        const isTransfer = Boolean(tx.transfer_id);
        const catInfo = tx.category ? categoryMap.get(tx.category) : null;
        const payeeName =
          payeeMap.get(tx.payee) || tx.imported_payee || tx.notes || 'Unknown';

        allTransactions.push({
          date: tx.date,
          account: acc.name,
          offbudget: Boolean(acc.offbudget),
          payee: String(payeeName).replace(/\s+/g, ' ').trim(),
          category: catInfo ? catInfo.name : isTransfer ? 'Transfer' : 'Uncategorized',
          categoryGroup: catInfo ? catInfo.group : isTransfer ? 'Transfer' : 'Uncategorized',
          isIncomeCategory: catInfo ? catInfo.isIncome : false,
          isTransfer,
          amountCents: Number(tx.amount || 0),
          amountGBP: (Number(tx.amount || 0) / 100).toFixed(2),
          notes: (tx.notes || '').replace(/\s+/g, ' ').trim(),
          cleared: Boolean(tx.cleared),
        });
      }
    }

    allTransactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    // Fetch current month budget summary + per-category budgeted/spent/balance
    let budgetSummary = null;
    try {
      const bm = await api.getBudgetMonth(currentMonth);
      if (bm) {
        const categories = [];
        for (const grp of bm.categoryGroups || []) {
          if (grp.is_income) continue;
          for (const c of grp.categories || []) {
            if (c.hidden) continue;
            const budgetedCents = Number(c.budgeted || 0);
            const spentCents = Number(c.spent || 0);
            const balanceCents = Number(c.balance || 0);
            if (budgetedCents === 0 && spentCents === 0) continue;
            categories.push({
              group: grp.name,
              name: c.name,
              budgetedCents,
              spentCents,
              balanceCents,
              budgetedGBP: gbp(budgetedCents),
              spentGBP: gbp(Math.abs(spentCents)),
              remainingGBP: gbp(balanceCents),
            });
          }
        }
        budgetSummary = {
          month: currentMonth,
          totalIncomeCents: Number(bm.totalIncome || 0),
          totalBudgetedCents: Number(bm.totalBudgeted || 0),
          totalSpentCents: Number(bm.totalSpent || 0),
          toBudgetCents: Number(bm.toBudget || 0),
          totalBudgetedGBP: gbp(Math.abs(bm.totalBudgeted || 0)),
          totalSpentGBP: gbp(Math.abs(bm.totalSpent || 0)),
          categories,
        };
      }
    } catch {
      budgetSummary = null;
    }

    // Aggregate helper (excludes internal transfers and Starting Balances)
    function summarizePeriod(txList) {
      let spentCents = 0;
      let incomeCents = 0;
      let uncategorizedCount = 0;
      let uncategorizedSpentCents = 0;
      const byCategory = new Map();
      const byMerchant = new Map();

      const nonMeta = txList.filter(
        (tx) => !tx.offbudget && !tx.isTransfer && tx.category !== 'Starting Balances'
      );

      for (const tx of nonMeta) {
        if (tx.amountCents < 0) {
          const abs = Math.abs(tx.amountCents);
          spentCents += abs;
          byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + abs);
          byMerchant.set(tx.payee, (byMerchant.get(tx.payee) || 0) + abs);
          if (tx.category === 'Uncategorized') {
            uncategorizedCount += 1;
            uncategorizedSpentCents += abs;
          }
        } else if (tx.amountCents > 0) {
          incomeCents += tx.amountCents;
        }
      }

      const topCategories = [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name, cents]) => ({ name, cents, gbp: gbp(cents) }));

      const topMerchants = [...byMerchant.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, cents]) => ({ name, cents, gbp: gbp(cents) }));

      return {
        txCount: nonMeta.length,
        spentCents,
        spentGBP: gbp(spentCents),
        incomeCents,
        incomeGBP: gbp(incomeCents),
        netCents: incomeCents - spentCents,
        netGBP: gbp(incomeCents - spentCents),
        uncategorizedCount,
        uncategorizedSpentGBP: gbp(uncategorizedSpentCents),
        topCategories,
        topMerchants,
      };
    }

    const tx7d = allTransactions.filter((t) => t.date >= start7Str);
    const tx30d = allTransactions.filter((t) => t.date >= start30Str);
    const txCurrentMonth = allTransactions.filter((t) => monthKey(t.date) === currentMonth);
    const txPrevMonth = allTransactions.filter((t) => monthKey(t.date) === prevMonth);

    // Detect recurring/subscription candidates across 90 days
    const merchantHistory = new Map();
    for (const tx of allTransactions) {
      if (tx.offbudget || tx.isTransfer || tx.category === 'Starting Balances' || tx.amountCents >= 0) continue;
      const key = tx.payee.toLowerCase();
      if (!merchantHistory.has(key)) {
        merchantHistory.set(key, {
          payee: tx.payee,
          months: new Set(),
          amounts: [],
          dates: [],
        });
      }
      const entry = merchantHistory.get(key);
      entry.months.add(monthKey(tx.date));
      entry.amounts.push(Math.abs(tx.amountCents));
      entry.dates.push(tx.date);
    }

    const recurringCandidates = [...merchantHistory.values()]
      .filter((m) => m.months.size >= 2 || m.amounts.length >= 3)
      .map((m) => {
        const avg = Math.round(m.amounts.reduce((a, b) => a + b, 0) / m.amounts.length);
        const min = Math.min(...m.amounts);
        const max = Math.max(...m.amounts);
        const consistent = max - min <= Math.max(100, avg * 0.15);
        return {
          payee: m.payee,
          occurrences: m.amounts.length,
          monthsCount: m.months.size,
          avgGBP: gbp(avg),
          avgCents: avg,
          consistent,
          lastDate: m.dates[0],
        };
      })
      .sort((a, b) => Number(b.consistent) - Number(a.consistent) || b.avgCents - a.avgCents)
      .slice(0, 20);

    const netWorthCents = accounts.reduce((sum, a) => sum + a.balanceCents, 0);
    const bankHealth = await fetchTrueLayerHealth();

    cachedSnapshot = {
      generatedAt: now.toISOString(),
      currentMonth,
      prevMonth,
      accounts,
      netWorthCents,
      netWorthGBP: gbp(netWorthCents),
      budgetSummary,
      last7d: summarizePeriod(tx7d),
      last30d: summarizePeriod(tx30d),
      thisMonth: summarizePeriod(txCurrentMonth),
      lastMonth: summarizePeriod(txPrevMonth),
      recurringCandidates,
      transactions90d: allTransactions,
      bankHealth,
    };
    cachedAt = Date.now();
    return cachedSnapshot;
  });
}

export async function shutdownActual() {
  if (initialized) {
    try {
      await api.shutdown();
    } catch {
      // ignore shutdown error
    }
    initialized = false;
  }
}

async function safeSync() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await api.sync();
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function getExpenseCategories() {
  return withLock(async () => {
    await ensureActual();
    const [groups, cats] = await Promise.all([api.getCategoryGroups(), api.getCategories()]);
    const incomeGroupIds = new Set(groups.filter((g) => g.is_income).map((g) => g.id));
    return cats
      .filter((c) => !c.is_income && !incomeGroupIds.has(c.group_id) && !c.hidden)
      .map((c) => ({ id: c.id, name: c.name }));
  });
}

/**
 * Find best matching unsplit Actual Budget transaction for a scanned receipt.
 * Matches within +/-7 days of receiptDate (or last 14 days if missing) and +/-5p of totalGBP.
 */
export async function findMatchingTransaction({ store, date, totalGBP }) {
  return withLock(async () => {
    await ensureActual();
    const targetCents = -Math.round(Math.abs(Number(totalGBP || 0)) * 100);
    if (!targetCents) return null;

    const now = new Date();
    const refDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : now;
    const start = new Date(refDate);
    start.setDate(start.getDate() - (date ? 7 : 14));
    const end = new Date(refDate);
    end.setDate(end.getDate() + 7);
    if (end > now) end.setTime(now.getTime() + 86_400_000);

    const [accounts, payees] = await Promise.all([api.getAccounts(), api.getPayees()]);
    const payeeMap = new Map(payees.map((p) => [p.id, p.name || '']));
    const storeTokens = String(store || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);

    const candidates = [];
    for (const acc of accounts.filter((a) => !a.closed)) {
      const txs = await api.getTransactions(acc.id, formatDate(start), formatDate(end));
      for (const tx of txs) {
        if (tx.tombstone || tx.transfer_id || tx.is_child) continue;
        const amtDiff = Math.abs(Number(tx.amount || 0) - targetCents);
        if (amtDiff > 5) continue; // within 5p

        const payeeName = payeeMap.get(tx.payee) || tx.imported_payee || '';
        const haystack = `${payeeName} ${tx.imported_payee || ''} ${tx.notes || ''}`.toLowerCase();
        const storeMatch = storeTokens.some((tok) => haystack.includes(tok));
        const dayDiff = Math.abs(
          Math.round((Date.parse(`${tx.date}T12:00:00Z`) - refDate.getTime()) / 86_400_000)
        );

        // Lower score = better match
        const score = amtDiff * 100 + dayDiff * 5 - (storeMatch ? 50 : 0) + (tx.is_parent ? 40 : 0);
        candidates.push({
          score,
          storeMatch,
          alreadySplit: Boolean(tx.is_parent),
          id: tx.id,
          accountId: acc.id,
          accountName: acc.name,
          date: tx.date,
          amountCents: Number(tx.amount),
          amountGBP: gbp(tx.amount),
          payeeId: tx.payee,
          payeeName: payeeName || 'Unknown',
          importedPayee: tx.imported_payee || null,
          importedId: tx.imported_id || null,
          cleared: Boolean(tx.cleared),
          notes: tx.notes || '',
        });
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0] || null;
  });
}

/**
 * Apply a confirmed receipt split to an existing Actual Budget transaction.
 * Preserves imported_id, payee, date, cleared status, and exact total amount.
 */
export async function applyReceiptSplit(tx, splits, receiptStore) {
  return withLock(async () => {
    await ensureActual();
    const cats = await api.getCategories();
    const catByLower = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
    const fallbackCat = catByLower.get('general') || catByLower.get('groceries') || cats[0];

    const resolvedSplits = splits.map((s) => {
      const match = catByLower.get(String(s.category || '').toLowerCase()) || fallbackCat;
      return {
        categoryId: match.id,
        categoryName: match.name,
        amountCents: s.amountCents,
        summary: s.summary || match.name,
      };
    });

    const receiptNote = `[Receipt${receiptStore ? `: ${receiptStore}` : ''}]`;

    if (resolvedSplits.length === 1) {
      const only = resolvedSplits[0];
      const newNotes = [tx.notes, `${receiptNote} ${only.summary}`].filter(Boolean).join(' | ').slice(0, 250);
      await api.updateTransaction(tx.id, {
        category: only.categoryId,
        notes: newNotes,
      });
    } else {
      // Replace single transaction with a split parent+subtransactions, preserving imported_id
      await api.deleteTransaction(tx.id);
      await api.addTransactions(
        tx.accountId,
        [
          {
            date: tx.date,
            amount: tx.amountCents,
            payee: tx.payeeId || undefined,
            payee_name: tx.payeeId ? undefined : tx.payeeName,
            imported_payee: tx.importedPayee || undefined,
            imported_id: tx.importedId || undefined,
            cleared: tx.cleared,
            notes: [tx.notes, `${receiptNote} split (${resolvedSplits.length} categories)`]
              .filter(Boolean)
              .join(' | ')
              .slice(0, 250),
            subtransactions: resolvedSplits.map((s) => ({
              amount: s.amountCents,
              category: s.categoryId,
              notes: s.summary.slice(0, 150),
            })),
          },
        ],
        { runTransfers: false, learnCategories: false }
      );
    }

    await safeSync();
    // Bust cached snapshot so next /summary reflects the split immediately
    cachedSnapshot = null;
    cachedAt = 0;

    return {
      appliedCount: resolvedSplits.length,
      splits: resolvedSplits,
    };
  });
}
