import { NextRequest } from "next/server";
import { getBotByPublicId, getConvoBySession, listMessagesAfter, getUserById } from "@/lib/repo";
import { corsJson, corsPreflight, domainAllowed } from "@/lib/util";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const bot = getBotByPublicId(publicId);
  if (!bot) return corsJson({ error: "not found" }, 404);
  if (!domainAllowed(bot.allowedDomains, req.headers.get("Origin") || "")) {
    return corsJson({ error: "domain not allowed" }, 403);
  }

  const sessionId = (req.nextUrl.searchParams.get("session_id") || "").trim();
  const afterId = Number(req.nextUrl.searchParams.get("after_id") || 0) || 0;
  if (!sessionId) return corsJson({ messages: [], mode: "ai" });

  const convo = getConvoBySession(bot._id, sessionId);
  if (!convo) return corsJson({ messages: [], mode: "ai" });

  const newMsgs = listMessagesAfter(convo._id, afterId);
  let agentName: string | null = null;
  if (convo.agentId) {
    const agent = getUserById(convo.agentId);
    if (agent) agentName = agent.name || agent.email;
  }

  return corsJson({
    mode: convo.mode,
    agent_name: agentName,
    messages: newMsgs.map((m) => ({ id: m._id, role: m.role, content: m.content, image_url: m.imageUrl, created_at: m.createdAt ? m.createdAt.toISOString() : null })),
  });
}
