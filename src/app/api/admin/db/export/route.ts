import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportAllJson } from "@/lib/sqlite";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "superadmin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const body = JSON.stringify({ _meta: { exportedAt: new Date().toISOString(), app: "ChatBotAI", version: 3 }, ...exportAllJson() }, null, 2);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="chatbotai-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
