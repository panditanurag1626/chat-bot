import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { listUsers, listPlans, getPlan, getMonthlyUsage, currentPeriod, countBotsByUser } from "@/lib/repo";
import { accountState } from "@/lib/access";
import { DoughnutChart, VBarChart } from "@/components/charts";

export const metadata: Metadata = { title: "Analytics" };

function monthLabel(d: Date) {
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export default async function AdminAnalyticsPage() {
  await requireSuperAdmin();
  const users = listUsers({ role: "user" });
  const plans = listPlans();

  // Plan distribution
  const planCounts = plans.map((p) => ({ name: p.name, count: users.filter((u) => u.planId === p._id).length }));
  const noPlan = users.filter((u) => !u.planId).length;
  const distLabels = [...planCounts.map((p) => p.name), ...(noPlan ? ["No plan"] : [])];
  const distValues = [...planCounts.map((p) => p.count), ...(noPlan ? [noPlan] : [])];

  // Status breakdown
  const active = users.filter((u) => accountState(u).ok).length;
  const banned = users.filter((u) => u.status === "banned").length;
  const expired = users.filter((u) => u.status !== "banned" && u.planExpiresAt && new Date(u.planExpiresAt).getTime() < Date.now()).length;

  // Signups per month (last 6 months) — uses createdAt
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: monthLabel(d) });
  }
  const signupByMonth = months.map((m) => users.filter((u) => u.createdAt && new Date(u.createdAt).toISOString().slice(0, 7) === m.key).length);

  // Revenue by plan (monthly equivalent, active accounts only)
  const revByPlan = plans.map((p) => {
    const monthly = p.billingPeriod === "yearly" ? p.price / 12 : p.billingPeriod === "lifetime" ? 0 : p.price;
    const count = users.filter((u) => u.planId === p._id && accountState(u).ok).length;
    return { name: p.name, rev: Math.round(monthly * count) };
  });
  const mrr = revByPlan.reduce((s, r) => s + r.rev, 0);

  // Top accounts by messages this month
  const period = currentPeriod();
  const usage = users
    .map((u) => ({ u, msgs: getMonthlyUsage(u._id, period), bots: countBotsByUser(u._id) }))
    .sort((a, b) => b.msgs - a.msgs)
    .slice(0, 8);
  const totalMsgs = users.reduce((s, u) => s + getMonthlyUsage(u._id, period), 0);

  const metrics = [
    { label: "Monthly recurring revenue", value: `$${mrr}`, icon: "fa-sack-dollar", c: "#14b8a6" },
    { label: "Messages this month", value: totalMsgs.toLocaleString(), icon: "fa-message", c: "#3b82f6" },
    { label: "Active accounts", value: active, icon: "fa-circle-check", c: "#10b981" },
    { label: "Avg. revenue / account", value: `$${active ? Math.round(mrr / active) : 0}`, icon: "fa-chart-pie", c: "#8b5cf6" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted">Revenue, subscriptions and usage across the platform.</p>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((m) => (
          <div key={m.label} className="metric">
            <div className="metric-icon" style={{ ["--c" as string]: m.c }}><i className={`fa-solid ${m.icon}`} /></div>
            <div className="metric-body">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="panel">
          <h2><i className="fa-solid fa-user-plus" /> New accounts — last 6 months</h2>
          {users.length === 0 ? <p className="muted">No data yet.</p> : <VBarChart labels={months.map((m) => m.label)} values={signupByMonth} color="#3b82f6" />}
        </section>
        <section className="panel">
          <h2><i className="fa-solid fa-sack-dollar" /> Revenue by plan (monthly)</h2>
          {mrr === 0 ? <p className="muted">No active paid subscriptions yet.</p> : <VBarChart labels={revByPlan.map((r) => r.name)} values={revByPlan.map((r) => r.rev)} color="#14b8a6" money />}
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2><i className="fa-solid fa-box-open" /> Plan distribution</h2>
          {users.length === 0 ? <p className="muted">No accounts yet.</p> : <DoughnutChart labels={distLabels} values={distValues} />}
        </section>
        <section className="panel">
          <h2><i className="fa-solid fa-shield-halved" /> Account status</h2>
          {users.length === 0 ? <p className="muted">No accounts yet.</p> : <DoughnutChart labels={["Active", "Suspended", "Expired"]} values={[active, banned, expired]} />}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2><i className="fa-solid fa-fire" /> Top accounts by usage ({period})</h2>
        </div>
        {usage.length === 0 ? (
          <div className="empty">No usage recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="table table-pro">
              <thead><tr><th>Account</th><th>Plan</th><th>Bots</th><th>Messages this month</th></tr></thead>
              <tbody>
                {usage.map(({ u, msgs, bots }) => {
                  const plan = u.planId ? getPlan(u.planId) : null;
                  const limit = plan ? plan.maxMessagesPerMonth : 0;
                  const pct = limit > 0 ? Math.min(100, Math.round((msgs / limit) * 100)) : 0;
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar">{(u.name || u.email)[0]?.toUpperCase()}</span>
                          <span><strong>{u.name || u.email.split("@")[0]}</strong><small className="muted">{u.email}</small></span>
                        </div>
                      </td>
                      <td>{plan ? <span className="badge badge-plan">{plan.name}</span> : <span className="muted">—</span>}</td>
                      <td>{bots}</td>
                      <td style={{ minWidth: 180 }}>
                        <div className="usage-row">
                          <span>{msgs.toLocaleString()}{limit > 0 ? <span className="muted"> / {limit.toLocaleString()}</span> : ""}</span>
                          {limit > 0 && <div className="usage-bar"><span style={{ width: `${pct}%`, background: pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981" }} /></div>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
