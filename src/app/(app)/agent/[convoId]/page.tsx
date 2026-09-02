import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ownedConvo } from "@/lib/agentAuth";
import { listMessages, updateConvo, createMessage } from "@/lib/repo";
import { agentReleaseAction } from "@/app/actions/agent";
import { convoTagAction } from "@/app/actions/modules";
import AgentChat from "@/components/AgentChat";

export const metadata: Metadata = { title: "Live chat" };

export default async function AgentChatPage({ params }: { params: Promise<{ convoId: string }> }) {
  const { convoId } = await params;
  const user = await requireUser();
  const owned = await ownedConvo(convoId, user.id);
  if (!owned) notFound();
  const { convo, bot } = owned;

  // Auto-join: take ownership if no agent yet.
  if (convo.mode === "awaiting" || convo.agentId == null) {
    updateConvo(convoId, { mode: "human", agentId: Number(user.id), agentJoinedAt: new Date() });
    createMessage(convoId, "system", `${user.name || user.email} joined the chat.`);
  }

  const initial = listMessages(convoId).map((m) => ({ id: m._id, role: m.role, content: m.content, image_url: m.imageUrl, created_at: m.createdAt?.toISOString() }));

  // Parse the visitor metadata captured at chat start.
  let meta: Record<string, string> = {};
  try { meta = convo.visitorMeta ? JSON.parse(convo.visitorMeta) : {}; } catch { meta = {}; }
  const tags = (convo.tags || "").split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <>
      <Link className="muted" href="/agent">← Back to live chats</Link>
      <div className="page-head">
        <h1><i className="fa-solid fa-headset" /> {bot.name} — {convo.visitorName || convo.sessionId.slice(0, 10)}</h1>
        <form action={agentReleaseAction.bind(null, convoId)} className="inline">
          <button className="btn btn-danger" type="submit"><i className="fa-solid fa-power-off" /> End chat</button>
        </form>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <AgentChat convoId={convoId} initial={initial} />

        <aside className="panel" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}><i className="fa-solid fa-circle-info" /> Visitor</h2>
          <dl style={{ fontSize: 13, margin: 0 }}>
            <VRow label="Name" value={convo.visitorName} />
            <VRow label="Email" value={convo.visitorEmail} />
            <VRow label="Session" value={convo.sessionId.slice(0, 16)} />
            <VRow label="Current page" value={convo.pageUrl} link />
            <VRow label="Referrer" value={meta.referrer} link />
            <VRow label="Language" value={meta.language} />
            <VRow label="Timezone" value={meta.timezone} />
            <VRow label="Screen" value={meta.screen} />
            <VRow label="Device" value={meta.userAgent} />
            <VRow label="Started" value={convo.createdAt ? new Date(convo.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} />
          </dl>

          <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid var(--border)" }} />
          <h2 style={{ marginTop: 0, fontSize: 16 }}><i className="fa-solid fa-tags" /> Tags</h2>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {tags.map((t) => <span key={t} className="badge badge-plan">{t}</span>)}
            </div>
          )}
          <form action={convoTagAction}>
            <input type="hidden" name="convo_id" value={convoId} />
            <label style={{ fontSize: 13 }}>Tags (comma separated)
              <input name="tags" defaultValue={tags.join(", ")} placeholder="vip, refund" />
            </label>
            <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}><i className="fa-solid fa-check" /> Save</button>
          </form>
        </aside>
      </div>
    </>
  );
}

function VRow({ label, value, link }: { label: string; value?: string; link?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 6, padding: "3px 0", borderBottom: "1px solid #f3f3f3" }}>
      <dt className="muted" style={{ minWidth: 80, flexShrink: 0 }}>{label}</dt>
      <dd style={{ margin: 0, wordBreak: "break-word", overflow: "hidden" }}>
        {link ? <a href={value} target="_blank" rel="noopener" style={{ fontSize: 12 }}>{value.slice(0, 40)}</a> : <span style={{ fontSize: 12 }}>{value.slice(0, 60)}</span>}
      </dd>
    </div>
  );
}
