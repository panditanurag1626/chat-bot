import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ownedConvo } from "@/lib/agentAuth";
import { listMessagesAfter } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ convoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { convoId } = await params;
  const owned = await ownedConvo(convoId, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const afterId = Number(req.nextUrl.searchParams.get("after_id") || 0) || 0;
  const msgs = listMessagesAfter(convoId, afterId);
  return NextResponse.json({
    mode: owned.convo.mode,
    messages: msgs.map((m) => ({ id: m._id, role: m.role, content: m.content, image_url: m.imageUrl, created_at: m.createdAt ? m.createdAt.toISOString() : null })),
  });
}
