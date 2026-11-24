import fs from 'fs';
import path from 'path';

const EXPORTS_DIR = process.env.EXPORTS_DIR || '/app/exports';

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildMarkdownSummary(snap) {
  const lines = [];
  lines.push('# UK Personal Finance Snapshot (Actual Budget)');
  lines.push('');
  lines.push(`- **Generated:** ${snap.generatedAt}`);
  lines.push(`- **Currency:** GBP (£)`);
  lines.push(`- **Net Total Across Open Accounts:** ${snap.netWorthGBP}`);
  lines.push('');

  lines.push('## Accounts & Balances');
  lines.push('| Account | Type | Balance (GBP) | 90d Txns |');
  lines.push('| :--- | :--- | ---: | ---: |');
  for (const acc of snap.accounts) {
    lines.push(
      `| ${acc.name} | ${acc.offbudget ? 'Off-budget' : 'On-budget'} | ${acc.balanceGBP} | ${acc.txCount90d} |`
    );
  }
  lines.push('');

  const periods = [
    ['Last 7 Days', snap.last7d],
    ['Last 30 Days', snap.last30d],
    [`This Month (${snap.currentMonth})`, snap.thisMonth],
    [`Last Month (${snap.prevMonth})`, snap.lastMonth],
  ];

  lines.push('## Cash Flow Overview (Excluding Internal Transfers)');
  lines.push('| Period | Income | Spending | Net | Transactions | Uncategorized |');
  lines.push('| :--- | ---: | ---: | ---: | ---: | ---: |');
  for (const [label, p] of periods) {
    lines.push(
      `| ${label} | ${p.incomeGBP} | ${p.spentGBP} | ${p.netGBP} | ${p.txCount} | ${p.uncategorizedCount} (${p.uncategorizedSpentGBP}) |`
    );
  }
  lines.push('');

  lines.push('## Top Spending Categories (Last 30 Days)');
  if (snap.last30d.topCategories.length === 0) {
    lines.push('_No spending transactions in the last 30 days._');
  } else {
    lines.push('| Category | Spent (30d) |');
    lines.push('| :--- | ---: |');
    for (const c of snap.last30d.topCategories) {
      lines.push(`| ${c.name} | ${c.gbp} |`);
    }
  }
  lines.push('');

  lines.push('## Top Merchants (Last 30 Days)');
  if (snap.last30d.topMerchants.length === 0) {
    lines.push('_No spending transactions in the last 30 days._');
  } else {
    lines.push('| Merchant / Payee | Spent (30d) |');
    lines.push('| :--- | ---: |');
    for (const m of snap.last30d.topMerchants) {
      lines.push(`| ${m.name} | ${m.gbp} |`);
    }
  }
  lines.push('');

  lines.push('## Recurring / Frequent Payments (Last 90 Days)');
  if (snap.recurringCandidates.length === 0) {
    lines.push('_Not enough multi-month history yet to detect recurring charges._');
  } else {
    lines.push('| Payee | Occurrences | Months | Avg Amount | Likely Fixed Sub? | Last Seen |');
    lines.push('| :--- | ---: | ---: | ---: | :---: | :--- |');
    for (const r of snap.recurringCandidates) {
      lines.push(
        `| ${r.payee} | ${r.occurrences} | ${r.monthsCount} | ${r.avgGBP} | ${r.consistent ? 'Yes' : 'Variable'} | ${r.lastDate} |`
      );
    }
  }
  lines.push('');

  lines.push('## Recent Transactions (Last 60 Entries)');
  lines.push('| Date | Account | Payee | Category | Amount (£) | Notes |');
  lines.push('| :--- | :--- | :--- | :--- | ---: | :--- |');
  for (const tx of snap.transactions90d.slice(0, 60)) {
    const cleanPayee = tx.payee.replace(/\|/g, '/');
    const cleanNotes = tx.notes.replace(/\|/g, '/').slice(0, 60);
    lines.push(
      `| ${tx.date} | ${tx.account} | ${cleanPayee} | ${tx.category} | ${tx.amountGBP} | ${cleanNotes} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

export function buildTransactionsCsv(snap) {
  const header = ['Date', 'Account', 'Payee', 'Category', 'CategoryGroup', 'Amount_GBP', 'IsTransfer', 'Cleared', 'Notes'];
  const rows = [header.join(',')];
  for (const tx of snap.transactions90d) {
    rows.push(
      [
        tx.date,
        tx.account,
        tx.payee,
        tx.category,
        tx.categoryGroup,
        tx.amountGBP,
        tx.isTransfer ? 'true' : 'false',
        tx.cleared ? 'true' : 'false',
        tx.notes,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return rows.join('\n') + '\n';
}

export function writeExports(snap) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const mdPath = path.join(EXPORTS_DIR, 'finance-summary.md');
  const csvPath = path.join(EXPORTS_DIR, 'transactions-90d.csv');

  // Atomic write via temp files
  const mdTmp = `${mdPath}.tmp`;
  const csvTmp = `${csvPath}.tmp`;
  fs.writeFileSync(mdTmp, buildMarkdownSummary(snap), 'utf8');
  fs.writeFileSync(csvTmp, buildTransactionsCsv(snap), 'utf8');
  fs.renameSync(mdTmp, mdPath);
  fs.renameSync(csvTmp, csvPath);

  return { mdPath, csvPath, txCount: snap.transactions90d.length };
}
