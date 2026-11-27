import fs from 'fs';
import path from 'path';

const PENDING_FILE = path.join(process.cwd(), 'data', 'pending-receipts.json');
const UNDO_FILE = path.join(process.cwd(), 'data', 'undo-receipts.json');
const MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000; // 10 days
const MAX_UNDO_ENTRIES = 20;

export const MIN_NON_PRIMARY_SPLIT_PENCE = 500; // £5.00

function atomicWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

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
  atomicWriteJson(PENDING_FILE, list);
}

export function addPendingReceipt(receipt) {
  const list = loadPendingReceipts();
  const id = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
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

// --- Undo store (persisted across restarts) ---

export function loadUndoEntries() {
  try {
    if (!fs.existsSync(UNDO_FILE)) return [];
    const list = JSON.parse(fs.readFileSync(UNDO_FILE, 'utf8'));
    if (!Array.isArray(list)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return list.filter((u) => Date.parse(u.appliedAt || '') > cutoff);
  } catch {
    return [];
  }
}

export function saveUndoEntry(entry) {
  const list = loadUndoEntries();
  const id = `undo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const record = { id, appliedAt: new Date().toISOString(), ...entry };
  list.push(record);
  atomicWriteJson(UNDO_FILE, list.slice(-MAX_UNDO_ENTRIES));
  return record;
}

export function getUndoEntry(id) {
  return loadUndoEntries().find((u) => u.id === id) || null;
}

export function removeUndoEntry(id) {
  atomicWriteJson(
    UNDO_FILE,
    loadUndoEntries().filter((u) => u.id !== id)
  );
}

/**
 * Determine whether a matched transaction is high-confidence enough to auto-apply.
 */
export function isHighConfidenceMatch(parsed, matchedTx) {
  if (!matchedTx || matchedTx.alreadySplit) return false;
  if (String(parsed?.confidence || 'medium').toLowerCase() === 'low') return false;
  if (!matchedTx.storeMatch) return false;
  return matchedTx.amtDiff <= 5;
}

/**
 * Normalize splits so every amount is a negative integer in pence,
 * minor secondary splits under minSplitPence (£5 default) fold into the
 * primary category, and the sum matches targetTotalCents to the exact penny.
 */
export function normalizeSplitsToTarget(
  rawSplits,
  targetTotalCents,
  { minSplitPence = MIN_NON_PRIMARY_SPLIT_PENCE } = {}
) {
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

  // Fold trivial non-primary splits (< £5) into the largest (primary) category
  if (items.length > 1 && minSplitPence > 0) {
    items.sort((a, b) => b.pence - a.pence);
    const primary = items[0];
    const kept = [primary];
    for (let i = 1; i < items.length; i++) {
      if (items[i].pence < minSplitPence) {
        primary.pence += items[i].pence;
        if (items[i].summaries.length > 0) {
          primary.summaries.push(...items[i].summaries);
        }
      } else {
        kept.push(items[i]);
      }
    }
    items = kept;
  }

  // Scale/adjust rounding so sum === absTarget to the exact penny
  const rawSum = items.reduce((acc, x) => acc + x.pence, 0);
  if (rawSum !== absTarget && rawSum > 0) {
    const scale = absTarget / rawSum;
    items = items.map((x) => ({ ...x, pence: Math.max(1, Math.round(x.pence * scale)) }));
    const scaledSum = items.reduce((acc, x) => acc + x.pence, 0);
    const diff = absTarget - scaledSum;
    if (diff !== 0) {
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
