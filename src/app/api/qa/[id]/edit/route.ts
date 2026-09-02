import { NextResponse } from "next/server";
import { asId } from "@/lib/sqlite";
import { getCurrentUser } from "@/lib/auth";
import { ownedBotForQa } from "@/lib/owner";
import { getQa, getQaInBot, updateQaContent } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedBotForQa(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const qa = getQa(id);
  if (!qa) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields: { question?: string; answer?: string; keywords?: string; parentId?: number | null } = {};
  if (body.question != null) fields.question = String(body.question).trim() || qa.question;
  if (body.answer != null) fields.answer = String(body.answer).trim() || qa.answer;
  fields.keywords = String(body.keywords || "").trim();

  const parentRaw = String(body.parent_id ?? "").trim();
  if (parentRaw === "") {
    fields.parentId = null;
  } else {
    const pid = asId(parentRaw);
    if (pid && pid !== qa._id && getQaInBot(pid, owned.qaBotId)) fields.parentId = pid;
    else fields.parentId = null;
  }
  updateQaContent(id, fields);

  const updated = getQa(id)!;
  return NextResponse.json({
    ok: true,
    qa: {
      id: String(updated._id),
      question: updated.question,
      answer: updated.answer,
      keywords: updated.keywords,
      parent_id: updated.parentId ? String(updated.parentId) : null,
      source: updated.source,
    },
  });
}
