import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { listConvosByBot, listMessagesByConvos, listRatingsByMessages } from "@/lib/repo";

function fmt(d: Date | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default async function ConversationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();

  const convos = listConvosByBot(id, 100);
  const convoIds = convos.map((c) => c._id);
  const msgs = listMessagesByConvos(convoIds);
  const botMsgIds = msgs.filter((m) => m.role === "bot").map((m) => m._id);
  const ratings = listRatingsByMessages(botMsgIds);
  const ratingByMsg = new Map(ratings.map((r) => [r.messageId, r.score]));

  const msgsByConvo = new Map<number, typeof msgs>();
  for (const m of msgs) {
    if (!msgsByConvo.has(m.conversationId)) msgsByConvo.set(m.conversationId, []);
    msgsByConvo.get(m.conversationId)!.push(m);
  }

  return (
    <>
      {convos.length === 0 ? (
        <div className="empty">No conversations yet.</div>
      ) : (
        convos.map((c) => {
          const cmsgs = msgsByConvo.get(c._id) || [];
          return (
            <details className="panel" key={c._id}>
              <summary>
                <strong>{fmt(c.createdAt)}</strong> — {c.sessionId}
                {c.pageUrl && <span className="muted"> {c.pageUrl}</span>} ({cmsgs.length} messages)
              </summary>
              <div className="convo">
                {cmsgs.map((m) => {
                  const score = ratingByMsg.get(m._id);
                  return (
                    <div className={`convo-msg convo-${m.role}`} key={m._id}>
                      <span className="role">{m.role}</span>
                      <span className="content">{m.content}</span>
                      {m.imageUrl && <img src={m.imageUrl} alt="" />}
                      {m.role === "bot" && score !== undefined && (
                        <small className="muted"> · {score === 1 ? <i className="fa-solid fa-thumbs-up" /> : <i className="fa-solid fa-thumbs-down" />}</small>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })
      )}
    </>
  );
}
