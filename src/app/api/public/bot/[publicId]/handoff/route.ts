import { NextRequest } from "next/server";
import {
  getBotByPublicId, getUserById, getConvoBySession, createConvo, createMessage, updateConvo, createNotification,
} from "@/lib/repo";
import { sendSmtpEmailAsync } from "@/lib/smtp";
import { corsJson, corsPreflight, domainAllowed } from "@/lib/util";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!bot.isActive) return corsJson({ error: "bot disabled" }, 423);
  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }
  if (!bot.enableHumanHandoff) return corsJson({ error: "handoff disabled" }, 403);

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = String(data.session_id || "").trim();
  const pageUrl = String(data.page_url || "").slice(0, 500);
  const visitorName = String(data.visitor_name || "").slice(0, 120);
  if (!sessionId) return corsJson({ error: "session_id required" }, 400);

  let convo = getConvoBySession(bot._id, sessionId);
  if (!convo) convo = createConvo({ botId: bot._id, sessionId, pageUrl });

  const previousMode = convo.mode;
  const patch: Record<string, unknown> = {};
  if (convo.mode === "ai") patch.mode = "awaiting";
  if (visitorName && !convo.visitorName) patch.visitorName = visitorName;
  if (Object.keys(patch).length) updateConvo(convo._id, patch);
  const newMode = patch.mode ? "awaiting" : convo.mode;
  createMessage(convo._id, "system", "The visitor has requested to chat with a human agent.");

  if (previousMode === "ai" && newMode === "awaiting") {
    try {
      const owner = getUserById(bot.userId);
      const visitor = visitorName || convo.visitorName || "A visitor";
      const title = `Live chat requested: ${bot.name}`;
      const body =
        `${visitor} requested a human agent on '${bot.name}'.\n` +
        `Page: ${convo.pageUrl || "(unknown)"}\n` +
        `Open the dashboard to take over: /agent`;
      createNotification({ userId: bot.userId, botId: bot._id, conversationId: convo._id, type: "handoff", title, body });
      if (owner) {
        const recipient = owner.notifyEmail || owner.email;
        if (recipient && owner.smtpHost) sendSmtpEmailAsync(owner, recipient, title, body);
      }
    } catch (e) {
      console.warn("[handoff] notification failed:", e);
    }
  }

  return corsJson({ ok: true, mode: newMode });
}
