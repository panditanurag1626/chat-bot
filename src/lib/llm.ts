/**
 * Free LLM via HuggingFace router (OpenAI-compatible chat completions).
 * Port of the Flask app's llm.py.
 *
 *   generateReplyWithMatch(bot, qas, apis, history, userMsg, visitorToken)
 *   analyzeImage(imagePayload, prompt, model)
 *   extractQaFromUrl(url, maxPairs)
 */
import { updateBot } from "./repo";
import { fetchCleanText } from "./scrape";

const HF_TOKEN = (process.env.HF_TOKEN || "").trim();
const HF_MODEL = (process.env.HF_MODEL || "deepseek-ai/DeepSeek-V4-Flash").trim();
const HF_ROUTER = (process.env.HF_ROUTER || "https://router.huggingface.co/v1/chat/completions").trim();

const LLM_TIMEOUT_MS = 45000;

export const OUT_OF_SCOPE =
  "I'm sorry, I can only answer questions covered in our knowledge base. " +
  "Please rephrase your question or contact support.";

// ---- minimal shapes (lean docs) ----
export interface QAItem {
  id?: string;
  question: string;
  answer: string;
  keywords?: string;
}
export interface ApiItem {
  id?: string;
  name: string;
  description?: string;
  url: string;
  method?: string;
  authType?: string;
  token?: string;
  headerName?: string;
  keywords?: string;
  enabled?: boolean;
  alwaysInclude?: boolean;
  useVisitorToken?: boolean;
}
export interface BotLike {
  id: string;
  systemPrompt?: string;
  enableLlm?: boolean;
  allowedDomains?: string;
  domainCacheText?: string;
  domainCacheAt?: Date | null;
}
type HistItem = { role?: string; content?: string };
type ChatMsg = { role: string; content: unknown };

// ---------- Multilingual greeting handler (English / Hinglish / Hindi) ----------
const GREETING_PATTERNS: [string, string[]][] = [
  ["how_are_you", ["how are you", "how r u", "how do you do", "kaise ho", "kaisi ho", "kese ho", "kya haal", "aap kaise", "kaise hain", "kaisi hain", "aap kaisi", "kya hal", "कैसे हो", "कैसी हो", "आप कैसे", "कैसे हैं"]],
  ["namaste", ["namaste", "namaskar", "salaam", "salam", "aadab", "नमस्ते", "नमस्कार", "सलाम", "आदाब"]],
  ["thanks", ["thank you", "thanks", "thx", "thnx", "tysm", "shukriya", "dhanyawad", "dhanyavad", "thanku", "thnks", "धन्यवाद", "शुक्रिया"]],
  ["bye", ["bye", "goodbye", "good bye", "see you", "see ya", "alvida", "phir milenge", "fir milenge", "अलविदा", "फिर मिलेंगे"]],
  ["good_morning", ["good morning", "gm", "subah bakhair", "शुभ प्रभात", "सुप्रभात"]],
  ["good_evening", ["good evening", "good night", "gn", "shubh raatri", "शुभ संध्या", "शुभ रात्रि"]],
  ["hi", ["hi", "hii", "hiii", "hiiii", "hello", "helo", "hey", "heya", "hola", "yo", "hellooo", "हाय", "हैलो"]],
];

function detectGreeting(userMsg: string): string | null {
  let msg = (userMsg || "").toLowerCase().trim();
  msg = msg.replace(/[!?,.।]+$/, "").trim();
  if (!msg || msg.length > 60) return null;
  for (const [kind, words] of GREETING_PATTERNS) {
    for (const w of words) {
      const wl = w.toLowerCase();
      if (msg === wl || msg.startsWith(wl + " ") || msg.endsWith(" " + wl) || ` ${msg} `.includes(` ${wl} `)) {
        return kind;
      }
    }
  }
  return null;
}

function isDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text || "");
}

const HINGLISH_HINTS = new Set([
  "kaise", "kaisi", "kese", "kya", "haal", "hal", "shukriya", "namaste", "namaskar",
  "salaam", "aap", "alvida", "dhanyawad", "dhanyavad", "phir", "milenge", "ho", "hai",
  "hain", "main", "tum",
]);

function greetingReply(kind: string, userMsg: string): string | undefined {
  let lang: "hi" | "hinglish" | "en";
  if (isDevanagari(userMsg)) lang = "hi";
  else if ((userMsg || "").toLowerCase().split(/\s+/).some((w) => HINGLISH_HINTS.has(w))) lang = "hinglish";
  else lang = "en";

  const replies: Record<string, Record<string, string>> = {
    hi: {
      en: "Hello! 👋 How can I help you today?",
      hinglish: "Hello! 👋 Main aapki kya madad kar sakta hun?",
      hi: "नमस्ते! 👋 मैं आपकी कैसे मदद कर सकता हूँ?",
    },
    how_are_you: {
      en: "I'm doing great, thanks for asking! How can I help you today?",
      hinglish: "Main bilkul theek hun, shukriya! Aap bataiye, main aapki kya madad kar sakta hun?",
      hi: "मैं बिल्कुल ठीक हूँ, धन्यवाद! बताइए, मैं आपकी क्या सहायता कर सकता हूँ?",
    },
    namaste: {
      en: "Namaste! 🙏 How can I assist you?",
      hinglish: "Namaste! 🙏 Main aapki kya madad kar sakta hun?",
      hi: "नमस्ते! 🙏 मैं आपकी कैसे मदद कर सकता हूँ?",
    },
    thanks: {
      en: "You're welcome! 😊 Let me know if there's anything else I can help with.",
      hinglish: "Aapka swagat hai! 😊 Aur kuch madad chahiye to bataiyega.",
      hi: "आपका स्वागत है! 😊 और कोई सहायता चाहिए तो बताइएगा।",
    },
    bye: {
      en: "Goodbye! 👋 Have a great day.",
      hinglish: "Alvida! 👋 Aapka din shubh ho.",
      hi: "अलविदा! 👋 आपका दिन शुभ हो।",
    },
    good_morning: {
      en: "Good morning! ☀️ How can I help you today?",
      hinglish: "Good morning! ☀️ Main aapki kya madad kar sakta hun?",
      hi: "सुप्रभात! ☀️ मैं आपकी कैसे मदद कर सकता हूँ?",
    },
    good_evening: {
      en: "Good evening! 🌙 How can I help you?",
      hinglish: "Good evening! 🌙 Main aapki kya madad kar sakta hun?",
      hi: "शुभ संध्या! 🌙 मैं आपकी कैसे मदद कर सकता हूँ?",
    },
  };
  return replies[kind]?.[lang];
}

// ---------- markdown stripping (plain-text bot replies) ----------
export function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/`+([^`]+)`+/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .trim();
}

function buildMessages(
  systemPrompt: string,
  history: HistItem[],
  userMsg: string,
  kbContext = "",
  websiteContext = "",
  apiContext = ""
): ChatMsg[] {
  const persona = (systemPrompt || "You are a helpful customer support assistant.").trim();
  const rules =
    "STRICT RULES — follow exactly:\n" +
    "1. Answer ONLY using the data sources below (Knowledge Base, Website Content, or API Data). Do NOT use outside knowledge.\n" +
    "2. Prefer the Knowledge Base, then API Data, then Website Content.\n" +
    "3. If none of them has the answer, reply with EXACTLY this sentence and nothing else:\n" +
    `   ${OUT_OF_SCOPE}\n` +
    "4. Output PLAIN TEXT only. No markdown. No asterisks (*, **). No hashes (#). No bullet stars. " +
    "If you must list items, use plain numbers like '1. ' or hyphens like '- '.\n" +
    "5. Keep replies short and direct, under 100 words.\n" +
    "6. Reply in the same language as the user (English, Hinglish, or Hindi).";
  const kbBlock = kbContext ? "KNOWLEDGE BASE (primary source):\n" + kbContext : "KNOWLEDGE BASE: (empty)";
  const siteBlock = websiteContext
    ? "WEBSITE CONTENT (secondary source — from the bot's allowed domains):\n" + websiteContext
    : "WEBSITE CONTENT: (none)";
  const apiBlock = apiContext
    ? "API DATA (fetched live from an external API based on the user's question):\n" + apiContext
    : "API DATA: (none)";
  const sys = `${persona}\n\n${rules}\n\n${kbBlock}\n\n${apiBlock}\n\n${siteBlock}`;

  const msgs: ChatMsg[] = [{ role: "system", content: sys }];
  for (const m of history.slice(-6)) {
    const role = m.role === "bot" ? "assistant" : "user";
    const content = (m.content || "").trim();
    if (content) msgs.push({ role, content });
  }
  msgs.push({ role: "user", content: userMsg });
  return msgs;
}

export interface InferenceResult {
  content: string;
  error: string | null;
}

function safeStatusHint(status: number): string {
  switch (status) {
    case 400: return "bad request — check request format";
    case 401: return "LLM authentication failed. Check HF_TOKEN and Inference Providers permission.";
    case 403: return "Hugging Face token does not have permission for Inference Providers.";
    case 404: return "Configured Hugging Face model or endpoint was not found.";
    case 405: return "method not allowed";
    case 408: return "request timeout";
    case 413: return "payload too large — reduce input size";
    case 429: return "Hugging Face inference credits/rate limit exceeded.";
    default:
      return status >= 500 && status < 600
        ? "Hugging Face inference provider is temporarily unavailable."
        : `HTTP ${status}`;
  }
}

function extractContent(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data)) {
    const s = data
      .map((c) => (c && typeof c === "object" ? extractContent(c) : typeof c === "string" ? c : ""))
      .filter(Boolean)
      .join("\n");
    return s.trim();
  }
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.choices) && (d.choices[0] as Record<string, unknown> | undefined)) {
    const choice = d.choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;
    if (message) {
      const msgContent = message.content;
      if (typeof msgContent === "string" && msgContent.trim()) return msgContent.trim();
      if (Array.isArray(msgContent)) {
        const parts = msgContent
          .map((p) => {
            if (typeof p === "string") return p;
            if (p && typeof p === "object") {
              const po = p as Record<string, unknown>;
              if (typeof po.text === "string") return po.text;
              return "";
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
        if (parts.trim()) return parts.trim();
      }
    }
    if (typeof choice.text === "string" && choice.text.trim()) return choice.text.trim();
  }
  if (d.message && typeof d.message === "object") {
    const m = d.message as Record<string, unknown>;
    if (typeof m.content === "string" && m.content.trim()) return m.content.trim();
  }
  for (const k of ["output_text", "text", "content", "answer", "response"]) {
    if (typeof d[k] === "string" && (d[k] as string).trim()) return (d[k] as string).trim();
  }
  return "";
}

function providerErrorMessage(status: number, bodyText: string, modelName = "", tokenLen = 0): string {
  let detail = "";
  try {
    const j = JSON.parse(bodyText || "");
    if (j && typeof j === "object") {
      const e = (j as Record<string, unknown>).error;
      if (typeof e === "string") detail = e;
      else if (e && typeof e === "object") {
        const m = (e as Record<string, unknown>).message;
        if (typeof m === "string") detail = m;
      }
    }
  } catch {
    /* body not JSON — fall back to raw text below */
  }
  if (!detail) detail = (bodyText || "").slice(0, 300).replace(/\s+/g, " ").trim();
  if (detail && detail.length > 400) detail = detail.slice(0, 400) + "…";

  const base = `LLM provider error: ${safeStatusHint(status)}`;
  if (status === 401 || status === 403) {
    const isHfRouter = /router\.huggingface\.co/i.test(process.env.HF_ROUTER || "");
    if (/invalid username or password|unauthorized|invalid api key|token/i.test(detail)) {
      const hint =
        `The Hugging Face API key is invalid or lacks permission. ` +
        `Login to https://huggingface.co/settings/tokens, generate a NEW token, and make sure ` +
        `"Make calls to Inference Providers" is enabled AND the account has Inference Provider credits. ` +
        `Then put it in .env.local as HF_TOKEN and restart the dev server.`;
      if (!isHfRouter) return `${base} (HTTP ${status}) — token length ${tokenLen}. ${hint}`;
      return `${base} (HTTP ${status}) — ${detail}. ${hint}`;
    }
    return `${base} (HTTP ${status}) — ${detail}${/model|not found/i.test(detail) ? ` — model '${modelName}' may not exist or may require gated access on this provider` : ""}`;
  }
  if (status === 404 || (status === 400 && /model|not found/i.test(detail))) {
    return `${base} — model '${modelName}' was not found on this provider/endpoint. Verify HF_MODEL in .env.local. Provider detail: ${detail}`;
  }
  if (status === 429) {
    return `${base} — ${detail || "rate limit or free-tier quota exceeded"}. Wait and retry, or add HF Inference credits.`;
  }
  return `${base} — ${detail}`;
}

export async function callInferenceDetailed(
  messages: ChatMsg[],
  model?: string,
  maxTokens = 512
): Promise<InferenceResult> {
  const token = HF_TOKEN || process.env.HF_TOKEN || "";
  const targetModel = (model || HF_MODEL || "").trim();
  const provider = (process.env.HF_PROVIDER || "auto").trim();

  if (!token) {
    return { content: "", error: "LLM configuration error: HF_TOKEN is missing." };
  }
  if (!targetModel) {
    return { content: "", error: "LLM configuration error: HF_MODEL is missing." };
  }
  if (!HF_ROUTER) {
    return { content: "", error: "LLM configuration error: HF_ROUTER is missing." };
  }

  // HF Inference Providers router expects "model[:provider]" — honor HF_PROVIDER (auto/fastest/preferred/or a provider name).
  const qualifiedModel = provider && provider !== "auto" && !targetModel.includes(":")
    ? `${targetModel}:${provider}`
    : provider === "auto" || provider === "fastest"
      ? `${targetModel}:fastest`
      : targetModel;

  // Safe server-side diagnostics — never log the key itself.
  console.warn(
    `[llm] request host=${new URL(HF_ROUTER).host} path=${new URL(HF_ROUTER).pathname} ` +
      `tokenConfigured=${token.length > 0} tokenLength=${token.length} ` +
      `model=${qualifiedModel} provider=${provider} maxTokens=${maxTokens}`
  );

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  let status = 0;
  try {
    const r = await fetch(HF_ROUTER, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: qualifiedModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.5,
      }),
      signal: ctrl.signal,
    });
    status = r.status;
    const bodyText = await r.text();
    if (!r.ok) {
      console.warn(`[llm] ${HF_ROUTER} status=${r.status} (${qualifiedModel})`);
      return { content: "", error: providerErrorMessage(r.status, bodyText, qualifiedModel, token.length) };
    }
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json") && !ct.includes("text/json")) {
      return {
        content: "",
        error: `LLM provider returned non-JSON content-type '${ct.split(";")[0]}' — expected chat completions JSON`,
      };
    }
    let data: unknown;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      return { content: "", error: `LLM provider returned invalid JSON — ${e instanceof Error ? e.message : e}` };
    }
    const content = extractContent(data);
    if (!content) {
      const keys = typeof data === "object" && data !== null ? Object.keys(data as Record<string, unknown>).join(", ") : typeof data;
      return { content: "", error: `LLM provider returned empty content. (request succeeded; response keys: ${keys})` };
    }
    return { content, error: null };
  } catch (e) {
    if (ctrl.signal.aborted) return { content: "", error: `LLM request timed out (${LLM_TIMEOUT_MS / 1000}s)` };
    console.warn(`[llm] request to ${HF_ROUTER} failed:`, e);
    const name = (e as Error)?.name || "";
    return {
      content: "",
      error: `LLM request failed after reaching HTTP ${status || "n/a"} — ${name ? name + ": " : ""}${e instanceof Error ? e.message : e}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callInference(messages: ChatMsg[], model?: string, maxTokens = 256): Promise<string> {
  const res = await callInferenceDetailed(messages, model, maxTokens);
  return res.content;
}

function matchQa(qas: QAItem[], userMsg: string): QAItem | null {
  if (!qas || !qas.length) return null;
  const msg = userMsg.toLowerCase().trim();
  const msgWords = new Set(msg.match(/\w+/g) || []);
  let best: QAItem | null = null;
  let bestScore = 0;
  for (const qa of qas) {
    let score = 0;
    const q = (qa.question || "").toLowerCase();
    if (q && msg.includes(q)) score += 5;
    const kws = (qa.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    for (const kw of kws) if (kw && msg.includes(kw)) score += 3;
    const qWords = new Set(q.match(/\w+/g) || []);
    for (const w of qWords) if (msgWords.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = qa;
    }
  }
  return bestScore >= 3 ? best : null;
}

// ---------- domain context (cached website knowledge) ----------
const DOMAIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DOMAIN_FETCH_CHAR_LIMIT = 6000;
const DOMAIN_FETCH_TIMEOUT = 8000;

function domainToUrl(domain: string): string | null {
  const d = (domain || "").trim().replace(/^\/+|\/+$/g, "");
  if (!d) return null;
  if (d.startsWith("http://") || d.startsWith("https://")) return d;
  return `https://${d}`;
}

async function getDomainContext(bot: BotLike): Promise<string> {
  const rawDomains = (bot.allowedDomains || "").trim();
  if (!rawDomains) return "";

  const fresh =
    bot.domainCacheAt != null && Date.now() - new Date(bot.domainCacheAt).getTime() < DOMAIN_CACHE_TTL_MS;
  if (fresh && bot.domainCacheText) return bot.domainCacheText;

  const domains = rawDomains.split(",").map((d) => d.trim()).filter(Boolean);
  const chunks: string[] = [];
  let remaining = DOMAIN_FETCH_CHAR_LIMIT;
  for (const domain of domains) {
    if (remaining <= 0) break;
    const url = domainToUrl(domain);
    if (!url) continue;
    try {
      const text = await fetchCleanText(url, remaining, DOMAIN_FETCH_TIMEOUT);
      if (text) {
        chunks.push(`[${domain}]\n${text}`);
        remaining -= text.length;
      }
    } catch (e) {
      console.warn(`[llm] domain fetch failed for ${url}:`, e);
    }
  }
  const combined = chunks.join("\n\n");
  try {
    updateBot(bot.id, { domainCacheText: combined, domainCacheAt: new Date() });
  } catch (e) {
    console.warn("[llm] domain cache save failed:", e);
  }
  return combined;
}

// ---------- external API grounding ----------
function matchApis(apis: ApiItem[], userMsg: string): ApiItem[] {
  if (!apis || !apis.length) return [];
  const msg = (userMsg || "").toLowerCase();
  const matched: ApiItem[] = [];
  const seen = new Set<string>();
  for (const api of apis) {
    if (api.enabled === false) continue;
    const key = api.id || api.url;
    if (api.alwaysInclude) {
      if (!seen.has(key)) {
        matched.push(api);
        seen.add(key);
      }
      continue;
    }
    const kws = (api.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    const nameWords = ((api.name || "").toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2);
    const triggers = [...kws, ...nameWords];
    if (triggers.length && triggers.some((t) => msg.includes(t))) {
      if (!seen.has(key)) {
        matched.push(api);
        seen.add(key);
      }
    }
  }
  return matched;
}

async function fetchApi(api: ApiItem, visitorToken?: string | null, timeoutMs = 10000, maxChars = 3000): Promise<string | null> {
  const useVisitor = !!api.useVisitorToken;
  const effectiveToken = (useVisitor ? visitorToken : api.token) || "";
  if (useVisitor && !visitorToken) {
    console.warn(`[bot_api] ${api.name}: visitor token required but missing — skipped`);
    return null;
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const auth = (api.authType || "none").toLowerCase();
  if (auth === "bearer" && effectiveToken) headers["Authorization"] = `Bearer ${effectiveToken}`;
  else if (auth === "header" && api.headerName && effectiveToken) headers[api.headerName] = effectiveToken;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(api.url, { method: api.method || "GET", headers, signal: ctrl.signal });
    const body = ((await r.text()) || "").slice(0, maxChars);
    let label = `[${api.name}] (${api.method || "GET"} ${api.url} → HTTP ${r.status})`;
    if (api.description) label += `\nPurpose: ${api.description}`;
    return `${label}\n${body}`;
  } catch (e) {
    console.warn(`[bot_api] fetch failed for ${api.name}:`, e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------- main reply ----------
export async function generateReplyWithMatch(
  bot: BotLike,
  qas: QAItem[],
  apis: ApiItem[],
  history: HistItem[],
  userMsg: string,
  visitorToken?: string | null
): Promise<{ reply: string; matched: QAItem | null }> {
  const greetingKind = detectGreeting(userMsg);
  if (greetingKind) {
    const reply = greetingReply(greetingKind, userMsg);
    if (reply) return { reply, matched: null };
  }

  const qa = matchQa(qas, userMsg);
  if (qa) return { reply: qa.answer, matched: qa };

  if (bot.enableLlm === false) {
    return { reply: "Sorry, I don't have an answer for that. Please try rephrasing your question.", matched: null };
  }

  // Knowledge base block (capped at ~6000 chars)
  const kbItems: string[] = [];
  let total = 0;
  for (const q of qas) {
    const line = `Q: ${q.question}\nA: ${q.answer}`;
    total += line.length;
    if (total > 6000) break;
    kbItems.push(line);
  }
  const kb = kbItems.join("\n\n");
  const website = await getDomainContext(bot);

  const apiChunks: string[] = [];
  for (const api of matchApis(apis, userMsg).slice(0, 3)) {
    const chunk = await fetchApi(api, visitorToken);
    if (chunk) apiChunks.push(chunk);
  }
  const apiContext = apiChunks.join("\n\n");

  const messages = buildMessages(bot.systemPrompt || "", history, userMsg, kb, website, apiContext);
  let text = await callInference(messages);

  if (!text) {
    return { reply: "I'm having trouble reaching the AI right now. Please try again in a moment.", matched: null };
  }
  for (const tok of ["USER:", "ASSISTANT:", "[INST]", "[/INST]", "</s>"]) {
    text = text.split(tok)[0];
  }
  return { reply: stripMarkdown(text.trim()), matched: null };
}

// ---------- vision (image analysis) ----------
export async function analyzeImage(imagePayload: string, prompt: string, model?: string): Promise<string> {
  if (!HF_TOKEN) return "Vision is unavailable: no HF token configured.";
  const target = model || "meta-llama/Llama-4-Scout-17B-16E-Instruct";
  const makeBody = (m: string) => ({
    model: m,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imagePayload } },
          { type: "text", text: prompt || "Describe this image." },
        ],
      },
    ],
    max_tokens: 400,
    temperature: 0.4,
  });
  const call = async (m: string): Promise<string> => {
    const r = await fetch(HF_ROUTER, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${HF_TOKEN}` },
      body: JSON.stringify(makeBody(m)),
    });
    if (!r.ok) throw new Error("vision http " + r.status);
    const data = await r.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  };
  try {
    return await call(target);
  } catch (e) {
    console.warn("[llm] vision call failed:", e);
    if (target !== "google/gemma-3-12b-it") {
      try {
        return await call("google/gemma-3-12b-it");
      } catch (e2) {
        console.warn("[llm] vision fallback failed:", e2);
      }
    }
    return "I couldn't analyze that image right now. Please try again.";
  }
}

// ---------- Module 4: auto-train ----------
export interface QaPair {
  question: string;
  answer: string;
}

const QA_WRAPPER_KEYS = ["data", "qa", "qa_pairs", "qa_pairs_list", "questions", "items", "pairs", "pairs_list"];

function stripCodeFences(s: string): string {
  const t = (s || "").trim();
  const m = t.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```$/);
  return m ? m[1].trim() : t;
}

/** Find the matching close index for the brace/bracket starting at `open`, skipping strings. */
function findMatching(s: string, open: "[" | "{", close: "]" | "}", start: number): number {
  const depth = { "[": 0, "{": 0 } as Record<string, number>;
  depth[open] = 1;
  let inStr = false;
  for (let i = start + 1; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth[open]++;
    else if (ch === close) {
      depth[open]--;
      if (depth[open] === 0) return i;
    }
  }
  return -1;
}

/** Pull the outermost JSON array (or wrapped object) out of a possibly-noisy LLM reply. */
function extractJsonData(raw: string): unknown {
  const s = stripCodeFences(raw);
  const firstBracket = s.indexOf("[");
  const firstBrace = s.indexOf("{");
  if (firstBracket !== -1) {
    const end = findMatching(s, "[", "]", firstBracket);
    if (end !== -1) {
      try {
        return JSON.parse(s.slice(firstBracket, end + 1));
      } catch {
        /* fall through to object-wrapped parse */
      }
    }
  }
  if (firstBrace !== -1) {
    const end = findMatching(s, "{", "}", firstBrace);
    if (end !== -1) {
      try {
        const obj = JSON.parse(s.slice(firstBrace, end + 1)) as Record<string, unknown>;
        for (const k of QA_WRAPPER_KEYS) {
          if (Array.isArray(obj[k])) return obj[k];
        }
        return []; // object with no known array wrapper — treat as no pairs
      } catch {
        /* no valid JSON found */
      }
    }
  }
  return undefined;
}

export async function extractQaFromText(
  text: string,
  maxPairs = 8,
  sourceLabel = "the provided content"
): Promise<{ pairs: QaPair[]; error: string | null }> {
  if (!text || text.length < 80) {
    return { pairs: [], error: "insufficient text was provided — no extractable content" };
  }

  const instruction =
    `From ${sourceLabel} below, extract up to ${maxPairs} useful FAQ-style ` +
    "question/answer pairs that a customer might ask. " +
    "If the content contains any usable information, return at least one pair. " +
    'Return STRICT JSON only: an array of objects with keys "question" and "answer". ' +
    "Do NOT use markdown, code fences, or any commentary outside the JSON. " +
    "Keep each answer under 60 words.";
  const messages: ChatMsg[] = [
    { role: "system", content: "You output strict JSON only. No prose, no code fences." },
    { role: "user", content: `${instruction}\n\nSOURCE CONTENT:\n${text}` },
  ];
  const res = await callInferenceDetailed(messages, undefined, 1200);
  if (res.error) return { pairs: [], error: res.error };
  if (!res.content) return { pairs: [], error: "model produced empty output" };

  const parsed = extractJsonData(res.content);
  if (parsed === undefined) {
    return { pairs: [], error: "model returned output that was not valid JSON" };
  }
  if (!Array.isArray(parsed)) {
    return { pairs: [], error: "model returned JSON that is not a list of Q&A pairs" };
  }

  const cleaned: QaPair[] = [];
  for (const p of parsed.slice(0, maxPairs)) {
    if (p && typeof p === "object") {
      const obj = p as Record<string, unknown>;
      if (obj.question && obj.answer) {
        cleaned.push({ question: String(obj.question).trim(), answer: String(obj.answer).trim() });
      }
    }
  }
  if (!cleaned.length) return { pairs: [], error: "model returned no valid Q&A pairs" };
  return { pairs: cleaned, error: null };
}

export async function extractQaFromUrl(
  url: string,
  maxPairs = 8
): Promise<{ pairs: QaPair[]; error: string | null }> {
  let text = "";
  try {
    text = await fetchCleanText(url);
  } catch (e) {
    return { pairs: [], error: `could not fetch URL: ${e}` };
  }
  if (!text || text.length < 80) {
    return {
      pairs: [],
      error:
        "page had no extractable content even after JS rendering — the URL may require login, block bots, or be empty",
    };
  }

  return extractQaFromText(text, maxPairs, "the website");
}
