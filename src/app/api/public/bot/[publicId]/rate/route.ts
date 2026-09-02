import { NextRequest } from "next/server";
import { getBotByPublicId, getMessage, getConvo, upsertRating } from "@/lib/repo";
import { corsJson, corsPreflight, domainAllowed } from "@/lib/util";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }
  if (!bot.enableFeedback) return corsJson({ error: "feedback disabled" }, 403);

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const msgId = Number(data.message_id);
  const score = data.score === 1 ? 1 : -1;
  const comment = String(data.comment || "").slice(0, 500);

  const msg = getMessage(msgId);
  if (!msg) return corsJson({ error: "message not found" }, 404);
  const convo = getConvo(msg.conversationId);
  if (!convo || convo.botId !== bot._id) return corsJson({ error: "forbidden" }, 403);

  upsertRating(msg._id, score, comment);
  return corsJson({ ok: true });
}
