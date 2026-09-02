import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { listUsers, getPlan, countBotsByUser } from "@/lib/repo";
import { accountState } from "@/lib/access";
import { setAccountStatusAction } from "@/app/actions/admin";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const users = listUsers({ role: "user", search });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Accounts</h1>
          <p className="muted">{users.length} account{users.length === 1 ? "" : "s"}{search ? ` matching “${search}”` : ""}.</p>
        </div>
        <Link className="btn btn-primary" href="/admin/accounts/new"><i className="fa-solid fa-user-plus" /> New account</Link>
      </div>
      <Flash searchParams={sp} />

      <form method="get" className="search-bar">
        <i className="fa-solid fa-magnifying-glass" />
        <input name="q" defaultValue={search} placeholder="Search by email, name or company…" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {users.length === 0 ? (
        <div className="empty">No accounts found. <Link href="/admin/accounts/new">Create one</Link>.</div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table table-pro">
              <thead><tr><th>Account</th><th>Plan</th><th>Bots</th><th>Status</th><th>Expires</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {users.map((u) => {
                  const plan = u.planId ? getPlan(u.planId) : null;
                  const st = accountState(u);
                  const banned = u.status === "banned";
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="cell-user">
                          <span className="avatar">{(u.name || u.email)[0]?.toUpperCase()}</span>
                          <span><strong>{u.name || u.email.split("@")[0]}</strong><small className="muted">{u.email}{u.company ? ` · ${u.company}` : ""}</small></span>
                        </div>
                      </td>
                      <td>{plan ? <span className="badge badge-plan">{plan.name}</span> : <span className="muted">—</span>}</td>
                      <td>{countBotsByUser(u._id)}{plan && plan.maxBots >= 0 ? <span className="muted">/{plan.maxBots}</span> : ""}</td>
                      <td>
                        {st.ok ? <span className="badge badge-ok">Active</span>
                          : st.reason === "banned" ? <span className="badge badge-danger">Suspended</span>
                          : <span className="badge badge-warn">Expired</span>}
                      </td>
                      <td className="muted">{u.planExpiresAt ? new Date(u.planExpiresAt).toISOString().slice(0, 10) : "Unlimited"}</td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn btn-sm" href={`/admin/accounts/${u._id}`}><i className="fa-solid fa-gear" /> Manage</Link>
                          <form action={setAccountStatusAction}>
                            <input type="hidden" name="id" value={u._id} />
                            <input type="hidden" name="status" value={banned ? "active" : "banned"} />
                            <button className={`btn btn-sm ${banned ? "btn-primary" : "btn-danger"}`} type="submit">
                              <i className={`fa-solid ${banned ? "fa-unlock" : "fa-ban"}`} /> {banned ? "Unban" : "Ban"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
