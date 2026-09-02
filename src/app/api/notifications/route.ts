import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listRecentNotifications, countNotifications } from "@/lib/repo";
import { notifyExpiringAccounts } from "@/lib/expiry";

export const runtime = "nodejs";

// Strip internal dedupe markers like "[exp:12:2026-07-01]" before showing to the user.
const clean = (s: string) => s.replace(/\s*\[exp:[^\]]+\]/g, "").trim();

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Super admins get live subscription-expiry alerts generated on the fly.
  if (user.role === "superadmin") {
    try { notifyExpiringAccounts(); } catch {}
  }

  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const rows = listRecentNotifications(user.id, 30, unreadOnly);
  const unreadCount = countNotifications(user.id, { unread: true });

  return NextResponse.json({
    unread: unreadCount,
    items: rows.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: clean(n.body),
      type: n.type,
      is_read: n.isRead,
      conversation_id: n.conversationId ? String(n.conversationId) : null,
      bot_id: n.botId ? String(n.botId) : null,
      created_at: (n.createdAt ?? new Date()).toISOString(),
    })),
  });
}
