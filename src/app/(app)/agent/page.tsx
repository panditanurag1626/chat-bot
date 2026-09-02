import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listBotsByUser, listLiveConvos, listMessagesByConvos, getUserById } from "@/lib/repo";

export const metadata: Metadata = { title: "Live Chats" };

function fmt(d: Date | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default async function AgentInboxPage() {
  const user = await requireUser();
  const botIds = listBotsByUser(user.id).map((b) => b._id);
  const convos = listLiveConvos(botIds, 100);

  const msgs = listMessagesByConvos(convos.map((c) => c._id));
  const lastByConvo = new Map<number, { role: string; content: string }[]>();
  for (const m of msgs) {
    if (!lastByConvo.has(m.conversationId)) lastByConvo.set(m.conversationId, []);
    lastByConvo.get(m.conversationId)!.push({ role: m.role, content: m.content });
  }
  const agentName = new Map<number, string>();
  for (const c of convos) {
    if (c.agentId && !agentName.has(c.agentId)) {
      const a = getUserById(c.agentId);
      if (a) agentName.set(c.agentId, a.name || a.email);
    }
  }

  return (
    <>
      <h1><i className="fa-solid fa-headset" /> Live Chats</h1>
      <p className="muted">Conversations where a visitor has asked to speak with a human, or you&apos;re already in a live chat.</p>

      {convos.length === 0 ? (
        <div className="empty">No live chats right now.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>When</th><th>Bot</th><th>Visitor</th><th>Status</th><th>Last messages</th><th>Page</th><th></th></tr>
            </thead>
            <tbody>
              {convos.map((c) => {
                const all = lastByConvo.get(c._id) || [];
                const last = all.length > 1 ? all.slice(-2) : all;
                return (
                  <tr key={c._id} className={`row-${c.mode}`}>
                    <td>{fmt(c.createdAt)}</td>
                    <td>{c.botId}</td>
                    <td>{c.visitorName || c.sessionId.slice(0, 10)}</td>
                    <td>
                      {c.mode === "awaiting" ? (
                        <span className="pill pill-warn"><i className="fa-solid fa-bell" /> Awaiting agent</span>
                      ) : c.mode === "human" ? (
                        <span className="pill pill-good"><i className="fa-solid fa-user-headset" /> Live with {c.agentId ? agentName.get(c.agentId) || "—" : "—"}</span>
                      ) : null}
                    </td>
                    <td className="muted">
                      {last.map((m, i) => (
                        <div key={i}><small><strong>{m.role}:</strong> {m.content.slice(0, 80)}</small></div>
                      ))}
                    </td>
                    <td>{c.pageUrl ? <a href={c.pageUrl} target="_blank" rel="noopener">link</a> : null}</td>
                    <td>
                      <Link className="btn btn-primary" href={`/agent/${c._id}`}>
                        <i className="fa-solid fa-comments" /> {c.mode === "awaiting" ? "Join" : "Open"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
