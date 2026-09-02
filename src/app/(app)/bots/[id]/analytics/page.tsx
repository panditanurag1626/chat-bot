import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ownedBot } from "@/lib/owner";
import { listConvosByBots, listMessagesByConvos, countRatings } from "@/lib/repo";
import { bucketByDay } from "@/lib/stats";
import { LineChart } from "@/components/charts";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const bot = await ownedBot(id, user.id);
  if (!bot) notFound();

  const convos = listConvosByBots([id]);
  const convoIds = convos.map((c) => c._id);
  const msgs = listMessagesByConvos(convoIds);

  const { labels, values } = bucketByDay(msgs.map((m) => m.createdAt!).filter(Boolean));

  const userMsgs = msgs.filter((m) => m.role === "user" && m.content).map((m) => m.content.trim());
  const counts = new Map<string, number>();
  for (const t of userMsgs) counts.set(t, (counts.get(t) || 0) + 1);
  const topQuestions = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const botMsgIds = msgs.filter((m) => m.role === "bot").map((m) => m._id);
  const up = countRatings(botMsgIds, 1);
  const down = countRatings(botMsgIds, -1);

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{convos.length}</div><div className="stat-label">Conversations</div></div>
        <div className="stat-card"><div className="stat-num">{msgs.length}</div><div className="stat-label">Total messages</div></div>
        <div className="stat-card"><div className="stat-num">{userMsgs.length}</div><div className="stat-label">User messages</div></div>
        <div className="stat-card"><div className="stat-num">{msgs.filter((m) => m.role === "bot").length}</div><div className="stat-label">Bot replies</div></div>
        <div className="stat-card good"><div className="stat-num">{up}</div><div className="stat-label"><i className="fa-solid fa-thumbs-up" /> Helpful</div></div>
        <div className="stat-card bad"><div className="stat-num">{down}</div><div className="stat-label"><i className="fa-solid fa-thumbs-down" /> Not helpful</div></div>
      </div>

      <div className="panel">
        <h2>Messages — last 30 days</h2>
        <LineChart labels={labels} values={values} color={bot.primaryColor} fillColor={`${bot.primaryColor}33`} height={100} />
      </div>

      <div className="panel">
        <h2>Top user questions</h2>
        {topQuestions.length === 0 ? (
          <p className="muted">No user messages yet.</p>
        ) : (
          <ol className="topq">
            {topQuestions.map(([q, count], i) => (
              <li key={i}><span className="topq-count">{count}×</span> {q}</li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
