import 'dotenv/config';
import http from 'http';
import { getFinanceSnapshot, fetchTrueLayerHealth, shutdownActual } from './actual.js';
import { writeExports } from './exporter.js';
import { generateMonthlyReview, generateWeeklyDigest, isGeminiConfigured } from './gemini.js';
import { isTelegramConfigured, sendAdminAlert, startTelegramBot } from './telegram.js';

const HEALTH_PORT = Number(process.env.HEALTH_PORT || 3001);
const EXPORT_INTERVAL_HOURS = Number(process.env.EXPORT_INTERVAL_HOURS || 6);
const WEEKLY_DAY = Number(process.env.WEEKLY_DIGEST_DAY ?? 0); // 0 = Sunday
const WEEKLY_HOUR = Number(process.env.WEEKLY_DIGEST_HOUR ?? 20); // 20:00 Europe/London
const MONTHLY_HOUR = Number(process.env.MONTHLY_DIGEST_HOUR ?? 9); // 09:00 on 1st of month
const REAUTH_WARN_DAYS = Number(process.env.REAUTH_WARN_DAYS ?? 14);

let lastExportAt = null;
let lastExportError = null;
let lastWeeklySentDate = null;
let lastMonthlySentMonth = null;
let lastReauthAlertDate = null;

async function runExport(label = 'scheduled') {
  try {
    const snap = await getFinanceSnapshot({ forceRefresh: true });
    const res = writeExports(snap);
    lastExportAt = new Date().toISOString();
    lastExportError = null;
    console.log(`[export] (${label}) Exported ${res.txCount} transactions -> ${res.mdPath}`);
    return snap;
  } catch (err) {
    lastExportError = err.message;
    console.error(`[export] (${label}) Failed:`, err.message);
    return null;
  }
}

async function checkSchedules() {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const monthKey = dateKey.slice(0, 7);
  const dayOfWeek = now.getDay(); // local TZ (Europe/London)
  const dayOfMonth = now.getDate();
  const hour = now.getHours();

  // 1. Daily UK bank consent expiry check at 09:00
  if (hour === 9 && lastReauthAlertDate !== dateKey && isTelegramConfigured()) {
    lastReauthAlertDate = dateKey;
    const health = await fetchTrueLayerHealth();
    const warnings = health.connections.filter(
      (c) => c.needsReauth || (c.daysLeft !== null && c.daysLeft <= REAUTH_WARN_DAYS)
    );
    if (warnings.length > 0) {
      const lines = ['*UK Bank Re-auth Reminder*', ''];
      for (const w of warnings) {
        lines.push(
          `• Connection #${w.index}: ${w.needsReauth ? 'Needs re-auth now' : `Expires in ${w.daysLeft} days (${w.consentExpiresAt?.slice(0, 10)})`}`
        );
      }
      lines.push('', 'Reconnect at https://banksync.iroshan.uk');
      await sendAdminAlert(lines.join('\n'));
    }
  }

  if (!isTelegramConfigured() || !isGeminiConfigured()) return;

  // 2. Weekly digest (default: Sunday at 20:00)
  if (dayOfWeek === WEEKLY_DAY && hour === WEEKLY_HOUR && lastWeeklySentDate !== dateKey) {
    lastWeeklySentDate = dateKey;
    console.log('[schedule] Sending weekly finance digest...');
    const snap = await getFinanceSnapshot({ forceRefresh: true });
    const digest = await generateWeeklyDigest(snap);
    await sendAdminAlert(digest);
  }

  // 3. Monthly review (1st of the month at 09:00)
  if (dayOfMonth === 1 && hour === MONTHLY_HOUR && lastMonthlySentMonth !== monthKey) {
    lastMonthlySentMonth = monthKey;
    console.log('[schedule] Sending monthly finance review...');
    const snap = await getFinanceSnapshot({ forceRefresh: true });
    const review = await generateMonthlyReview(snap);
    await sendAdminAlert(review);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        telegramEnabled: isTelegramConfigured(),
        geminiEnabled: isGeminiConfigured(),
        lastExportAt,
        lastExportError,
      })
    );
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(HEALTH_PORT, '127.0.0.1', () => {
  console.log(`[finance-bot] Health server listening on 127.0.0.1:${HEALTH_PORT}`);
  console.log(
    `[finance-bot] Features: exporter=ON (every ${EXPORT_INTERVAL_HOURS}h), telegram=${isTelegramConfigured() ? 'ON' : 'WAITING_FOR_TOKEN'}, gemini=${isGeminiConfigured() ? 'ON' : 'WAITING_FOR_API_KEY'}`
  );
});

// Initial export shortly after boot, then every EXPORT_INTERVAL_HOURS
setTimeout(() => void runExport('startup'), 5000);
const exportTimer = setInterval(
  () => void runExport('scheduled'),
  EXPORT_INTERVAL_HOURS * 60 * 60 * 1000
);

// Check digest & re-auth schedules every 10 minutes
const scheduleTimer = setInterval(() => {
  void checkSchedules().catch((err) => console.error('[schedule] Error:', err.message));
}, 10 * 60 * 1000);

const bot = startTelegramBot();

async function shutdown(signal) {
  console.log(`[finance-bot] Received ${signal}, shutting down...`);
  clearInterval(exportTimer);
  clearInterval(scheduleTimer);
  bot.stop();
  server.close();
  await shutdownActual();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
