import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ownedConvo } from "@/lib/agentAuth";
import { createMessage, updateConvo } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ convoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { convoId } = await params;
  const owned = await ownedConvo(convoId, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  let text = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { content?: string };
    text = String(body.content || "").trim();
  } else {
    const fd = await req.formData();
    text = String(fd.get("content") || "").trim();
  }
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const msg = createMessage(convoId, "agent", text);
  if (owned.convo.mode !== "human") {
    updateConvo(convoId, { mode: "human", agentId: Number(user.id) });
  }
  return NextResponse.json({ ok: true, message_id: msg._id, content: text, created_at: msg.createdAt ? msg.createdAt.toISOString() : null });
}
