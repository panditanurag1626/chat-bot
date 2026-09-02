import { NextRequest } from "next/server";
import {
  getBotByPublicId, getConvoBySession, createConvo, createMessage,
  hasAgentMessage, lastAgentMessageAt, updateConvo,
  listQasByBot, listApisByBot, listChildren, recentBotMessages,
  getUserById, incrementMonthlyUsage, currentPeriod,
} from "@/lib/repo";
import { accountState, withinMessageQuota } from "@/lib/access";
import { generateReplyWithMatch, OUT_OF_SCOPE, QAItem, ApiItem } from "@/lib/llm";
import { corsJson, corsPreflight, domainAllowed } from "@/lib/util";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

const AGENT_IDLE_MS = 10 * 60 * 1000;

export async function OPTIONS() {
  return corsPreflight();
}

function buildVisitorMeta(req: NextRequest, data: Record<string, unknown>): string {
  const meta: Record<string, string> = {};
  const take = (k: string, max = 300) => { const v = String(data[k] ?? "").trim(); if (v) meta[k] = v.slice(0, max); };
  take("referrer", 500);
  take("language");
  take("timezone");
  take("screen", 40);
  const ua = req.headers.get("user-agent") || String(data.userAgent || "");
  if (ua) meta.userAgent = ua.slice(0, 300);
  return Object.keys(meta).length ? JSON.stringify(meta) : "";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!bot.isActive) return corsJson({ error: "bot disabled" }, 423);

  const owner = getUserById(bot.userId);
  if (!owner || !accountState(owner).ok) return corsJson({ error: "subscription inactive" }, 423);

  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const userMsg = String(data.message || "").trim();
  const sessionId = String(data.session_id || "").trim() || randomBytes(9).toString("base64url");
  const pageUrl = String(data.page_url || "").slice(0, 500);
  const history = (Array.isArray(data.history) ? data.history : []) as { role?: string; content?: string }[];
  const visitorToken = String(data.visitor_token || "").trim().slice(0, 4000) || null;
  if (!userMsg) return corsJson({ error: "empty message" }, 400);

  // Enforce the account's monthly message quota.
  const quota = withinMessageQuota(owner);
  if (!quota.ok) {
    return corsJson({
      reply: "We're receiving a lot of messages right now. Please try again later or use the contact form.",
      mode: "ai", session_id: sessionId, quota_exceeded: true,
    });
  }

  let convo = getConvoBySession(bot._id, sessionId);
  if (!convo) convo = createConvo({ botId: bot._id, sessionId, pageUrl, visitorMeta: buildVisitorMeta(req, data) });

  const userMessage = createMessage(convo._id, "user", userMsg);
  incrementMonthlyUsage(owner._id, currentPeriod(), 1);

  // AI keeps replying until an agent is actively engaged (has sent ≥1 message).
  // If the agent hasn't replied in AGENT_IDLE_MS, hand the chat back to the AI.
  let replyMode = convo.mode;
  if (convo.mode === "awaiting" || convo.mode === "human") {
    const lastAgentAt = lastAgentMessageAt(convo._id);
    const idle = lastAgentAt ? Date.now() - lastAgentAt.getTime() : null;
    if (hasAgentMessage(convo._id) && idle !== null && idle <= AGENT_IDLE_MS) {
      return corsJson({ reply: null, mode: convo.mode, session_id: sessionId, message_id: userMessage._id });
    }
    if (idle !== null && idle > AGENT_IDLE_MS) {
      updateConvo(convo._id, { mode: "ai" });
      createMessage(convo._id, "system", "The agent is away. You're back to chatting with the AI.");
      replyMode = "ai";
    }
  }

  const qas: QAItem[] = listQasByBot(bot._id).map((q) => ({
    id: String(q._id), question: q.question, answer: q.answer, keywords: q.keywords,
  }));
  const apis: ApiItem[] = listApisByBot(bot._id).map((a) => ({
    id: String(a._id), name: a.name, description: a.description, url: a.url, method: a.method,
    authType: a.authType, token: a.token, headerName: a.headerName, keywords: a.keywords,
    enabled: a.enabled, alwaysInclude: a.alwaysInclude, useVisitorToken: a.useVisitorToken,
  }));

  const { reply, matched } = await generateReplyWithMatch(
    {
      id: String(bot._id), systemPrompt: bot.systemPrompt, enableLlm: bot.enableLlm,
      allowedDomains: bot.allowedDomains, domainCacheText: bot.domainCacheText, domainCacheAt: bot.domainCacheAt,
    },
    qas, apis, history, userMsg, visitorToken
  );

  const botMsg = createMessage(convo._id, "bot", reply);

  let options: { id: string; question: string }[] = [];
  if (matched && matched.id) {
    options = listChildren(bot._id, matched.id, true).map((c) => ({ id: String(c._id), question: c.question }));
  }

  let suggestContactForm = false;
  if (bot.enableContactForm && reply.trim() === OUT_OF_SCOPE.trim()) {
    const recent = recentBotMessages(convo._id, 2);
    if (recent.length >= 2 && recent.every((m) => (m.content || "").trim() === OUT_OF_SCOPE.trim())) {
      suggestContactForm = true;
    }
  }

  return corsJson({
    reply,
    mode: replyMode,
    session_id: sessionId,
    message_id: botMsg._id,
    created_at: botMsg.createdAt ? botMsg.createdAt.toISOString() : null,
    options,
    suggest_contact_form: suggestContactForm,
  });
}
