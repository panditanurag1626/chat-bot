import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  countNotifications, listNotificationsByType, listBotsByUser, markNotificationsRead,
} from "@/lib/repo";
import { messageDeleteAction } from "@/app/actions/messages";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "Messages" };

const PER_PAGE = 20;

function fmt(d: Date | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString([], {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = Math.max(1, Number(sp.page) || 1);

  const total = countNotifications(user.id, { type: "contact" });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = listNotificationsByType(user.id, "contact", PER_PAGE, (page - 1) * PER_PAGE);

  const botById = new Map(listBotsByUser(user.id).map((b) => [b._id, b]));

  const unreadIds = items.filter((n) => !n.isRead).map((n) => n._id);
  if (unreadIds.length) markNotificationsRead(unreadIds);

  const parse = (body: string) => {
    const [meta, msg] = body.split("\n\nMessage:\n");
    const lines = meta.split("\n");
    const from = (lines.find((l) => l.startsWith("From: ")) || lines[0] || "").replace("From: ", "");
    const pageLine = (lines.find((l) => l.startsWith("Page: ")) || "").replace("Page: ", "");
    return { from, pageLine, msg: msg ?? body };
  };

  return (
    <>
      <div className="page-head">
        <h1><i className="fa-solid fa-envelope-open-text" /> Messages</h1>
        <p className="muted">Contact form submissions from your chatbots.</p>
      </div>
      <Flash searchParams={sp} />

      {items.length ? (
        <section className="panel msg-list-panel">
          <div className="msg-meta muted">
            Showing {(page - 1) * PER_PAGE + 1}–{(page - 1) * PER_PAGE + items.length} of {total} message{total !== 1 ? "s" : ""}
          </div>
          <ul className="msg-list">
            {items.map((n) => {
              const bot = n.botId ? botById.get(n.botId) : null;
              const { from, pageLine, msg } = parse(n.body);
              return (
                <li className="msg-item" key={n._id}>
                  <div className="msg-row">
                    <div className="msg-icon"><i className="fa-solid fa-envelope" /></div>
                    <div className="msg-content">
                      <div className="msg-head">
                        <strong>{from}</strong>
                        <span className="msg-time muted">{fmt(n.createdAt)}</span>
                      </div>
                      <div className="msg-context muted">
                        {bot && <span className="msg-pill"><i className="fa-solid fa-robot" /> {bot.name}</span>}
                        {pageLine && <span className="msg-pill"><i className="fa-solid fa-link" /> {pageLine}</span>}
                        {n.conversationId && (
                          <Link className="msg-pill msg-pill-link" href={`/agent/${n.conversationId}`}>
                            <i className="fa-solid fa-comments" /> View chat
                          </Link>
                        )}
                      </div>
                      <div className="msg-body">{msg}</div>
                    </div>
                    <form action={messageDeleteAction.bind(null, String(n._id))} className="msg-actions">
                      <button className="btn btn-icon btn-sm btn-danger" type="submit" title="Delete"><i className="fa-solid fa-trash" /></button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>

          {pages > 1 && (
            <nav className="qa-pagination">
              <Link className={`btn btn-sm${page <= 1 ? " disabled" : ""}`} href={page <= 1 ? "#" : `/messages?page=${page - 1}`}>
                <i className="fa-solid fa-chevron-left" /> Prev
              </Link>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
                p === page ? (
                  <span key={p} className="btn btn-sm qa-page-current">{p}</span>
                ) : (
                  <Link key={p} className="btn btn-sm" href={`/messages?page=${p}`}>{p}</Link>
                )
              )}
              <Link className={`btn btn-sm${page >= pages ? " disabled" : ""}`} href={page >= pages ? "#" : `/messages?page=${page + 1}`}>
                Next <i className="fa-solid fa-chevron-right" />
              </Link>
            </nav>
          )}
        </section>
      ) : (
        <section className="panel">
          <div className="empty-state">
            <i className="fa-regular fa-envelope-open" />
            <h3>No messages yet</h3>
            <p className="muted">Contact form submissions from your chatbot widgets will appear here.</p>
          </div>
        </section>
      )}
    </>
  );
}
