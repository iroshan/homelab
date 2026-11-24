import fs from 'fs';
import path from 'path';

const PENDING_FILE = path.join(process.cwd(), 'data', 'pending-receipts.json');
const MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

export function loadPendingReceipts() {
  try {
    if (!fs.existsSync(PENDING_FILE)) return [];
    const list = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    if (!Array.isArray(list)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return list.filter((r) => Date.parse(r.createdAt || '') > cutoff);
  } catch {
    return [];
  }
}

export function savePendingReceipts(list) {
  fs.mkdirSync(path.dirname(PENDING_FILE), { recursive: true });
  const tmp = `${PENDING_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmp, PENDING_FILE);
}

export function addPendingReceipt(receipt) {
  const list = loadPendingReceipts();
  const id = `rcpt_${Date.now().toString(36)}`;
  const entry = {
    id,
    createdAt: new Date().toISOString(),
    notifiedMatch: false,
    ...receipt,
  };
  list.push(entry);
  savePendingReceipts(list);
  return entry;
}

export function removePendingReceipt(id) {
  const list = loadPendingReceipts().filter((r) => r.id !== id);
  savePendingReceipts(list);
}

export function markPendingNotified(id) {
  const list = loadPendingReceipts().map((r) =>
    r.id === id ? { ...r, notifiedMatch: true } : r
  );
  savePendingReceipts(list);
}

export function clearPendingReceipts() {
  savePendingReceipts([]);
}

/**
 * Normalize splits so every amount is a negative integer in pence and
 * the sum matches targetTotalCents (negative integer) exactly.
 */
export function normalizeSplitsToTarget(rawSplits, targetTotalCents) {
  const absTarget = Math.abs(Math.round(targetTotalCents));
  const grouped = new Map();

  for (const s of rawSplits || []) {
    const cat = String(s.category || 'Groceries').trim();
    const pence = Math.round(Math.abs(Number(s.amountGBP || 0)) * 100);
    if (pence <= 0) continue;
    const prev = grouped.get(cat) || { category: cat, pence: 0, summaries: [] };
    prev.pence += pence;
    if (s.summary) prev.summaries.push(String(s.summary).trim());
    grouped.set(cat, prev);
  }

  let items = [...grouped.values()];
  if (items.length === 0) {
    return [{ category: 'Groceries', amountCents: -absTarget, summary: 'Receipt total' }];
  }

  // Scale/adjust rounding so sum === absTarget to the exact penny
  const rawSum = items.reduce((acc, x) => acc + x.pence, 0);
  if (rawSum !== absTarget && rawSum > 0) {
    const scale = absTarget / rawSum;
    items = items.map((x) => ({ ...x, pence: Math.max(1, Math.round(x.pence * scale)) }));
    const scaledSum = items.reduce((acc, x) => acc + x.pence, 0);
    const diff = absTarget - scaledSum;
    if (diff !== 0) {
      // Apply penny difference to largest category split
      items.sort((a, b) => b.pence - a.pence);
      items[0].pence += diff;
    }
  }

  return items
    .filter((x) => x.pence > 0)
    .map((x) => ({
      category: x.category,
      amountCents: -x.pence,
      summary: x.summaries.join('; ').slice(0, 120) || x.category,
    }));
}
