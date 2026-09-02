import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { listUsers, listPlans, getPlan } from "@/lib/repo";
import { accountState } from "@/lib/access";

export const metadata: Metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  const users = listUsers({ role: "user" });
  const plans = listPlans();

  const active = users.filter((u) => accountState(u).ok).length;
  const banned = users.filter((u) => u.status === "banned").length;
  const expired = users.filter((u) => u.status !== "banned" && u.planExpiresAt && new Date(u.planExpiresAt).getTime() < Date.now()).length;
  const mrr = users.reduce((sum, u) => {
    if (!accountState(u).ok || !u.planId) return sum;
    const p = getPlan(u.planId);
    if (!p) return sum;
    const monthly = p.billingPeriod === "yearly" ? p.price / 12 : p.billingPeriod === "lifetime" ? 0 : p.price;
    return sum + monthly;
  }, 0);

  // Accounts expiring within 7 days
  const soon = users.filter((u) => {
    if (!u.planExpiresAt) return false;
    const d = new Date(u.planExpiresAt).getTime() - Date.now();
    return d > 0 && d < 7 * 86400000;
  });

  const metrics = [
    { label: "Total accounts", value: users.length, icon: "fa-users", c: "#3b82f6", href: "/admin/accounts" },
    { label: "Active", value: active, icon: "fa-circle-check", c: "#10b981", href: "/admin/accounts" },
    { label: "Suspended", value: banned, icon: "fa-ban", c: "#ef4444", href: "/admin/accounts" },
    { label: "Expired", value: expired, icon: "fa-clock-rotate-left", c: "#f59e0b", href: "/admin/accounts" },
    { label: "Active plans", value: plans.filter((p) => p.isActive).length, icon: "fa-box-open", c: "#8b5cf6", href: "/admin/plans" },
    { label: "Est. MRR", value: `$${mrr.toFixed(0)}`, icon: "fa-sack-dollar", c: "#14b8a6", href: "/admin/analytics" },
  ];

  const recent = users.slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Platform health and the latest customer accounts.</p>
        </div>
        <Link className="btn btn-primary" href="/admin/accounts/new"><i className="fa-solid fa-user-plus" /> New account</Link>
      </div>

      <div className="metric-grid">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} className="metric">
            <div className="metric-icon" style={{ ["--c" as string]: m.c }}><i className={`fa-solid ${m.icon}`} /></div>
            <div className="metric-body">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {soon.length > 0 && (
        <div className="alert-banner">
          <i className="fa-solid fa-triangle-exclamation" />
          <span><strong>{soon.length}</strong> account{soon.length === 1 ? "" : "s"} expiring within 7 days — review renewals in <Link href="/admin/accounts">Accounts</Link>.</span>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2><i className="fa-solid fa-clock-rotate-left" /> Recent accounts</h2>
          <Link className="btn btn-sm" href="/admin/accounts">View all <i className="fa-solid fa-arrow-right" /></Link>
        </div>
        {recent.length === 0 ? (
          <div className="empty">No customer accounts yet. <Link href="/admin/accounts/new">Create one</Link>.</div>
        ) : (
          <div className="table-wrap">
            <table className="table table-pro">
              <thead><tr><th>Account</th><th>Plan</th><th>Status</th><th>Expires</th><th></th></tr></thead>
              <tbody>
                {recent.map((u) => {
                  const plan = u.planId ? getPlan(u.planId) : null;
                  const st = accountState(u);
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar" style={{ ["--c" as string]: "#e60012" }}>{(u.name || u.email)[0]?.toUpperCase()}</span>
                          <span><strong>{u.name || u.email.split("@")[0]}</strong><small className="muted">{u.email}</small></span>
                        </div>
                      </td>
                      <td>{plan ? <span className="badge badge-plan">{plan.name}</span> : <span className="muted">—</span>}</td>
                      <td>
                        {st.ok ? <span className="badge badge-ok">Active</span>
                          : st.reason === "banned" ? <span className="badge badge-danger">Suspended</span>
                          : <span className="badge badge-warn">Expired</span>}
                      </td>
                      <td className="muted">{u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 10) : "Unlimited"}</td>
                      <td><Link className="btn btn-sm" href={`/admin/accounts/${u._id}`}>Manage</Link></td>
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
