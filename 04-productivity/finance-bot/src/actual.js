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

  await api.downloadBudget(
    syncId,
    encryptionPassword ? { password: encryptionPassword } : undefined
  );
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

    // Fetch current month budget summary if available
    let budgetSummary = null;
    try {
      const bm = await api.getBudgetMonth(currentMonth);
      if (bm) {
        budgetSummary = {
          month: currentMonth,
          totalIncomeCents: Number(bm.totalIncome || 0),
          totalBudgetedCents: Number(bm.totalBudgeted || 0),
          totalSpentCents: Number(bm.totalSpent || 0),
          toBudgetCents: Number(bm.toBudget || 0),
        };
      }
    } catch {
      budgetSummary = null;
    }

    // Aggregate helper (excludes internal transfers)
    function summarizePeriod(txList) {
      let spentCents = 0;
      let incomeCents = 0;
      let uncategorizedCount = 0;
      let uncategorizedSpentCents = 0;
      const byCategory = new Map();
      const byMerchant = new Map();

      for (const tx of txList) {
        if (tx.isTransfer) continue;
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
        txCount: txList.filter((t) => !t.isTransfer).length,
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
      if (tx.isTransfer || tx.amountCents >= 0) continue;
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
