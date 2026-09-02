import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  listBotsByUser, listConvosByBots, listMessagesByConvos, countQasByBots, countRatings,
} from "@/lib/repo";
import { bucketByDay } from "@/lib/stats";
import { LineChart, BotBarChart } from "@/components/charts";

export const metadata: Metadata = { title: "Dashboard - ChatBotAI" };

function fmtDate(d: Date | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default async function DashboardPage() {
  const user = await requireUser();

  const bots = listBotsByUser(user.id);
  const botIds = bots.map((b) => b._id);
  const botById = new Map(bots.map((b) => [b._id, b]));

  const convos = listConvosByBots(botIds);
  const convoIds = convos.map((c) => c._id);
  const msgs = listMessagesByConvos(convoIds);
  const qaCount = countQasByBots(botIds);
  const liveCount = convos.filter((c) => c.mode && c.mode !== "ai").length;

  const { labels, values } = bucketByDay(msgs.map((m) => m.createdAt!).filter(Boolean));

  const convoCount = new Map<number, number>();
  for (const c of convos) convoCount.set(c.botId, (convoCount.get(c.botId) || 0) + 1);
  const topBots = bots
    .map((b) => ({ bot: b, count: convoCount.get(b._id) || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const botMsgIds = msgs.filter((m) => m.role === "bot").map((m) => m._id);
  const ratingsUp = countRatings(botMsgIds, 1);
  const ratingsDown = countRatings(botMsgIds, -1);

  const msgCountByConvo = new Map<number, number>();
  for (const m of msgs) msgCountByConvo.set(m.conversationId, (msgCountByConvo.get(m.conversationId) || 0) + 1);
  const recentConvos = [...convos].sort((a, b) => +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0)).slice(0, 8);

  const totalMessages = msgs.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            Welcome back, {user.name || user.email.split("@")[0]}{" "}
            <i className="fa-solid fa-hand-wave" style={{ color: "#f59e0b" }} />
          </h1>
          <p className="muted">Here&apos;s what&apos;s happening across your chatbots.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{bots.length}</div><div className="stat-label"><i className="fa-solid fa-robot" /> Total bots</div></div>
        <div className="stat-card"><div className="stat-num">{convos.length}</div><div className="stat-label"><i className="fa-solid fa-comments" /> Conversations</div></div>
        <div className="stat-card"><div className="stat-num">{totalMessages}</div><div className="stat-label"><i className="fa-solid fa-message" /> Messages</div></div>
        <div className={`stat-card${liveCount ? " good" : ""}`}><div className="stat-num">{liveCount}</div><div className="stat-label"><i className="fa-solid fa-headset" /> Live now</div></div>
        <div className="stat-card"><div className="stat-num">{qaCount}</div><div className="stat-label"><i className="fa-solid fa-book" /> Q&amp;A pairs</div></div>
        <div className="stat-card good"><div className="stat-num">{ratingsUp}</div><div className="stat-label"><i className="fa-solid fa-thumbs-up" /> Helpful</div></div>
        <div className="stat-card bad"><div className="stat-num">{ratingsDown}</div><div className="stat-label"><i className="fa-solid fa-thumbs-down" /> Not helpful</div></div>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2><i className="fa-solid fa-chart-line" /> Messages — last 30 days</h2>
          {totalMessages === 0 ? (
            <p className="muted">No messages yet. Embed a bot on your site to start collecting chats.</p>
          ) : (
            <LineChart labels={labels} values={values} />
          )}
        </section>
        <section className="panel">
          <h2><i className="fa-solid fa-trophy" /> Top bots by conversation</h2>
          {topBots.length === 0 || topBots[0].count === 0 ? (
            <p className="muted">No conversations yet.</p>
          ) : (
            <BotBarChart labels={topBots.map((t) => t.bot.name)} values={topBots.map((t) => t.count)} />
          )}
        </section>
      </div>

      <section className="panel">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2><i className="fa-solid fa-clock-rotate-left" /> Recent conversations</h2>
          <Link className="btn btn-sm" href="/agent"><i className="fa-solid fa-headset" /> Live chats</Link>
        </div>
        {recentConvos.length === 0 ? (
          <p className="muted">No conversations yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Bot</th><th>Visitor</th><th>Status</th><th>Messages</th><th>Page</th></tr></thead>
              <tbody>
                {recentConvos.map((c) => {
                  const b = botById.get(c.botId);
                  return (
                    <tr key={c._id} className={c.mode !== "ai" ? "row-awaiting" : ""}>
                      <td>{fmtDate(c.createdAt)}</td>
                      <td>{b ? b.name : c.botId}</td>
                      <td>{c.visitorName || c.sessionId.slice(0, 10)}</td>
                      <td>
                        {c.mode === "awaiting" ? <span className="pill pill-warn">Awaiting</span> : c.mode === "human" ? <span className="pill pill-good">Live</span> : <span className="pill">AI</span>}
                      </td>
                      <td>{msgCountByConvo.get(c._id) || 0}</td>
                      <td>{c.pageUrl ? <a href={c.pageUrl} target="_blank" rel="noopener"><i className="fa-solid fa-arrow-up-right-from-square" /></a> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h2><i className="fa-solid fa-robot" /> Your chatbots</h2>
          <Link className="btn btn-sm" href="/bots">View all <i className="fa-solid fa-arrow-right" /></Link>
        </div>
        {bots.length === 0 ? (
          <div className="empty">No bots yet. Create your first chatbot above.</div>
        ) : (
          <div className="grid">
            {bots.slice(0, 6).map((b) => (
              <div className="card" key={b._id}>
                <div className="card-head" style={{ background: b.primaryColor }}>
                  <h3>{b.name}</h3>
                  <span className="pill">{b.publicId}</span>
                </div>
                <div className="card-body">
                  <p className="muted">{b.welcomeMessage.slice(0, 80)}{b.welcomeMessage.length > 80 ? "…" : ""}</p>
                  <div className="actions">
                    <Link className="btn btn-sm" href={`/bots/${b._id}`}><i className="fa-solid fa-pen-to-square" /> Edit</Link>
                    <Link className="btn btn-sm" href={`/bots/${b._id}/analytics`}><i className="fa-solid fa-chart-line" /></Link>
                    <Link className="btn btn-sm" href={`/bots/${b._id}/train`}><i className="fa-solid fa-graduation-cap" /></Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
