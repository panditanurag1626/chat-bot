import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ownedBotForQa } from "@/lib/owner";
import { setQaShowInMenu } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedBotForQa(id, user.id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { show_in_menu?: boolean };
  const show = !!body.show_in_menu;
  setQaShowInMenu(id, show);
  return NextResponse.json({ ok: true, show_in_menu: show });
}
