import { NextRequest } from "next/server";
import {
  getBotByPublicId, getUserById, getConvoBySession, createMessage, updateConvo, createNotification,
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
  if (!bot.enableContactForm) return corsJson({ error: "contact form disabled" }, 403);

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(data.name || "").trim().slice(0, 120);
  const email = String(data.email || "").trim().slice(0, 255);
  const phone = String(data.phone || "").trim().slice(0, 40);
  const message = String(data.message || "").trim().slice(0, 2000);
  const sessionId = String(data.session_id || "").trim();
  const pageUrl = String(data.page_url || "").slice(0, 500);
  if (!name || !email || !message) return corsJson({ error: "name, email, message required" }, 400);

  let contactLine = `Contact form submitted by ${name} <${email}>`;
  if (phone) contactLine += ` | phone: ${phone}`;

  const convo = sessionId ? getConvoBySession(bot._id, sessionId) : null;
  if (convo) {
    createMessage(convo._id, "system", `${contactLine}:\n${message}`);
    if (name && !convo.visitorName) updateConvo(convo._id, { visitorName: name });
  }

  const title = `Contact form: ${bot.name}`;
  const body =
    `From: ${name} <${email}>\n` +
    (phone ? `Phone: ${phone}\n` : "") +
    `Page: ${pageUrl || "(unknown)"}\n\n` +
    `Message:\n${message}`;

  createNotification({ userId: bot.userId, botId: bot._id, conversationId: convo ? convo._id : null, type: "contact", title, body });

  const owner = getUserById(bot.userId);
  let emailQueued = false;
  if (owner) {
    const recipient = owner.notifyEmail || owner.email;
    if (recipient && owner.smtpHost) {
      sendSmtpEmailAsync(owner, recipient, title, body);
      emailQueued = true;
    }
  }
  return corsJson({ ok: true, email_queued: emailQueued });
}
