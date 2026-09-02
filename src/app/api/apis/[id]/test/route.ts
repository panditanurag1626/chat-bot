import { NextResponse } from "next/server";
import { asId } from "@/lib/sqlite";
import { getCurrentUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { getApi } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!asId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const api = getApi(id);
  if (!api) return NextResponse.json({ error: "not found" }, { status: 404 });
  const bot = await ownedBot(String(api.botId), user.id);
  if (!bot) return NextResponse.json({ error: "not found" }, { status: 404 });

  const headers: Record<string, string> = {};
  if (api.authType === "bearer" && api.token) headers["Authorization"] = `Bearer ${api.token}`;
  else if (api.authType === "header" && api.headerName && api.token) headers[api.headerName] = api.token;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(api.url, { method: api.method || "GET", headers, signal: ctrl.signal });
    const text = (await r.text()) || "";
    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      preview: text.slice(0, 600),
      content_type: r.headers.get("Content-Type") || "",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  } finally {
    clearTimeout(t);
  }
}
