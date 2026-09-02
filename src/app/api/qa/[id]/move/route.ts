import { NextResponse } from "next/server";
import { asId } from "@/lib/sqlite";
import { getCurrentUser } from "@/lib/auth";
import { ownedBotForQa } from "@/lib/owner";
import { getQa, getQaInBot, listSiblings, setQaParentPosition } from "@/lib/repo";

export const runtime = "nodejs";

function isDescendantOf(qaId: number, candidateParentId: number): boolean {
  let cur: number | null = candidateParentId;
  const seen = new Set<number>();
  while (cur != null && !seen.has(cur)) {
    if (cur === qaId) return true;
    seen.add(cur);
    cur = getQa(cur)?.parentId ?? null;
  }
  return false;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedBotForQa(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  const botId = owned.qaBotId;
  const qaId = asId(id)!;

  const data = (await req.json().catch(() => ({}))) as { parent_id?: string | number | null; position?: number };
  const newPos0 = Number.isFinite(Number(data.position)) ? Number(data.position) : 0;

  let newParentId: number | null = null;
  const raw = data.parent_id;
  if (raw != null && raw !== "" && raw !== "null" && raw !== "0" && raw !== 0) {
    const pid = asId(raw);
    if (!pid) return NextResponse.json({ error: "invalid parent" }, { status: 400 });
    const parent = getQaInBot(pid, botId);
    if (!parent || pid === qaId || isDescendantOf(qaId, pid)) {
      return NextResponse.json({ error: "invalid parent" }, { status: 400 });
    }
    newParentId = pid;
  }

  const siblings = listSiblings(botId, newParentId, qaId);
  const newPos = Math.max(0, Math.min(newPos0, siblings.length));
  const order = [...siblings.map((s) => s._id)];
  order.splice(newPos, 0, qaId);
  order.forEach((sid, i) => setQaParentPosition(sid, newParentId, i));

  return NextResponse.json({ ok: true, parent_id: newParentId, position: newPos });
}
