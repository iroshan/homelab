import { GoogleGenAI } from '@google/genai';
import { buildMarkdownSummary } from './exporter.js';

const SYSTEM_INSTRUCTION = `You are a practical, insightful UK personal finance advisor connected (read-only) to the user's Actual Budget server.
Rules:
- Currency is GBP (£). Use UK conventions (DD/MM/YYYY, UK terminology like current account, direct debit, ISA, Council Tax, etc.).
- Base EVERY number strictly on the provided Actual Budget snapshot. Never invent transactions or balances.
- If most transactions are currently "Uncategorized", mention that gently and still infer spending patterns from the payee/merchant names.
- Note that if starting balances haven't been reconciled in Actual yet, raw balances may reflect only the synced lookback window.
- Keep responses concise, structured with short bullet points, and easy to read on a phone in Telegram (avoid huge markdown tables).
- Highlight actionable insights: top drains, recurring subscriptions, unusual spikes, and realistic next steps.`;

const MAX_HISTORY_TURNS = 6;
const HISTORY_TTL_MS = 30 * 60 * 1000;

let aiClient = null;
const chatHistory = new Map();

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

function getClient() {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not set in finance-bot.env');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
  }
  return aiClient;
}

function getModelChain() {
  const primary = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const fallbacks = [
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
  ];
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

async function generateWithFallback(contents, config) {
  const ai = getClient();
  const models = getModelChain();
  let lastErr = null;
  for (const model of models) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({ model, contents, config }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('504 TIMEOUT after 25s')), 25000)
        ),
      ]);
      return (response.text || '').trim();
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable =
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('TIMEOUT') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('404');
      console.warn(
        `[gemini] Model ${model} failed (${retryable ? 'trying fallback' : 'fatal'}): ${msg.slice(0, 140)}`
      );
      if (!retryable) throw err;
    }
  }
  throw lastErr;
}

export function clearHistory(chatId) {
  chatHistory.delete(String(chatId));
}

function buildCompactContext(snap) {
  // Include full markdown summary + up to 250 transactions in compact CSV for accurate Q&A
  const md = buildMarkdownSummary(snap);
  const compactTx = snap.transactions90d
    .slice(0, 250)
    .map((t) => `${t.date} | ${t.account} | ${t.payee} | ${t.category} | £${t.amountGBP}`)
    .join('\n');

  return `${md}\n## Full Transaction Feed (up to 250 most recent in 90d)\nDate | Account | Payee | Category | Amount\n${compactTx}`;
}

export async function askGemini(chatId, userPrompt, snap) {
  const key = String(chatId);
  const now = Date.now();

  let state = chatHistory.get(key);
  if (!state || now - state.updatedAt > HISTORY_TTL_MS) {
    state = { turns: [], updatedAt: now };
  }

  const contextBlock = buildCompactContext(snap);
  const historyText =
    state.turns.length > 0
      ? `\n\n## Recent Conversation\n${state.turns
          .map((t) => `User: ${t.user}\nAssistant: ${t.assistant}`)
          .join('\n\n')}`
      : '';

  const fullPrompt = `${contextBlock}${historyText}\n\n## Current User Question\n${userPrompt}`;

  const answer =
    (await generateWithFallback(fullPrompt, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
    })) || 'I could not generate a response.';

  state.turns.push({ user: userPrompt, assistant: answer.slice(0, 1200) });
  if (state.turns.length > MAX_HISTORY_TURNS) {
    state.turns = state.turns.slice(-MAX_HISTORY_TURNS);
  }
  state.updatedAt = now;
  chatHistory.set(key, state);

  return answer;
}

export async function generateWeeklyDigest(snap) {
  const prompt = `${buildCompactContext(snap)}

Write a crisp **Weekly UK Finance Digest** for Telegram covering:
1. Current account & credit card balances (concise).
2. Last 7 days total spend vs income, and top 5 spending areas (infer categories from payee names if uncategorized).
3. Any notable large purchases, spikes, or recurring charges spotted this week.
4. 2–3 practical, specific tips for next week.
Keep it under 280 words and easy to scan on a phone.`;

  return generateWithFallback(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.3,
  });
}

export async function generateMonthlyReview(snap) {
  const prompt = `${buildCompactContext(snap)}

Write a structured **Monthly UK Finance Review** for Telegram covering:
1. Income vs total spending and net cash flow (comparing this month vs last month if data exists).
2. Top spending categories / merchant groups (infer from payees if uncategorized).
3. Recurring subscriptions & regular bills spotted.
4. Credit card usage & balance check.
5. Top 3 actionable budget recommendations for next month.
Keep it under 380 words and mobile-friendly.`;

  return generateWithFallback(prompt, {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.3,
  });
}
