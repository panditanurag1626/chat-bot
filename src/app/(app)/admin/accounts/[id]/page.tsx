import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import {
  getUserById, listPlans, getPlan, countBotsByUser,
  getMonthlyUsage, currentPeriod,
} from "@/lib/repo";
import { accountState } from "@/lib/access";
import { updateAccountAction, setAccountStatusAction, deleteAccountAction } from "@/app/actions/admin";
import Flash from "@/components/Flash";
import PasswordInput from "@/components/PasswordInput";

export const metadata: Metadata = { title: "Manage account" };

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const user = getUserById(id);
  if (!user || user.role === "superadmin") notFound();

  const plans = listPlans();
  const plan = user.planId ? getPlan(user.planId) : null;
  const st = accountState(user);
  const banned = user.status === "banned";
  const bots = countBotsByUser(user._id);
  const used = getMonthlyUsage(user._id, currentPeriod());
  const msgLimit = plan ? plan.maxMessagesPerMonth : 0;
  const expiresStr = user.planExpiresAt ? new Date(user.planExpiresAt).toISOString().slice(0, 10) : "";

  return (
    <>
      <p className="muted"><Link href="/admin/accounts">← Back to accounts</Link></p>
      <div className="page-head">
        <div className="cell-user">
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>{(user.name || user.email)[0]?.toUpperCase()}</span>
          <div>
            <h1 style={{ marginBottom: 2 }}>{user.name || user.email.split("@")[0]}</h1>
            <p className="muted" style={{ margin: 0 }}>{user.email}{user.company ? ` · ${user.company}` : ""}</p>
          </div>
        </div>
        <span>
          {st.ok ? <span className="badge badge-ok">Active</span>
            : st.reason === "banned" ? <span className="badge badge-danger">Suspended</span>
            : <span className="badge badge-warn">Expired</span>}
        </span>
      </div>
      <Flash searchParams={sp} />

      <div className="metric-grid">
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#8b5cf6" }}><i className="fa-solid fa-box-open" /></div><div className="metric-body"><div className="metric-value">{plan ? plan.name : "—"}</div><div className="metric-label">Current plan</div></div></div>
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#3b82f6" }}><i className="fa-solid fa-robot" /></div><div className="metric-body"><div className="metric-value">{bots}{plan && plan.maxBots >= 0 ? ` / ${plan.maxBots}` : ""}</div><div className="metric-label">Bots</div></div></div>
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#10b981" }}><i className="fa-solid fa-message" /></div><div className="metric-body"><div className="metric-value">{used}{msgLimit >= 0 ? ` / ${msgLimit}` : ""}</div><div className="metric-label">Messages this month</div></div></div>
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#f59e0b" }}><i className="fa-solid fa-clock" /></div><div className="metric-body"><div className="metric-value" style={{ fontSize: 18 }}>{expiresStr || "Unlimited"}</div><div className="metric-label">Expires</div></div></div>
      </div>

      <section className="panel" style={{ maxWidth: 640 }}>
        <h2><i className="fa-solid fa-sliders" /> Subscription &amp; profile</h2>
        <form action={updateAccountAction}>
          <input type="hidden" name="id" value={user._id} />
          <div className="form-grid">
            <label>Full name <input name="name" defaultValue={user.name} /></label>
            <label>Company <input name="company" defaultValue={user.company} /></label>
            <label>Plan
              <select name="planId" defaultValue={user.planId ?? ""}>
                <option value="">No plan</option>
                {plans.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
            <label>Expiry
              <select name="expiryMode" defaultValue="keep">
                <option value="keep">Keep current ({expiresStr || "unlimited"})</option>
                <option value="plan">Reset from plan duration (renew)</option>
                <option value="custom">Custom date…</option>
                <option value="unlimited">Unlimited (no expiry)</option>
              </select>
            </label>
            <label>Custom expiry date <input type="date" name="expiresAt" defaultValue={expiresStr} /></label>
            <label>Reset password (blank = keep) <PasswordInput name="password" minLength={6} /></label>
          </div>
          <div className="form-actions"><button className="btn btn-primary" type="submit"><i className="fa-solid fa-check" /> Save changes</button></div>
        </form>
      </section>

      <section className="panel danger-zone" style={{ maxWidth: 640 }}>
        <h2><i className="fa-solid fa-triangle-exclamation" /> Danger zone</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <form action={setAccountStatusAction}>
            <input type="hidden" name="id" value={user._id} />
            <input type="hidden" name="status" value={banned ? "active" : "banned"} />
            <button className={`btn ${banned ? "btn-primary" : "btn-danger"}`} type="submit">
              <i className={`fa-solid ${banned ? "fa-unlock" : "fa-ban"}`} /> {banned ? "Unban account" : "Ban account"}
            </button>
          </form>
          <form action={deleteAccountAction}>
            <input type="hidden" name="id" value={user._id} />
            <button className="btn btn-link-danger" type="submit">
              <i className="fa-solid fa-trash" /> Delete account &amp; all data
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
