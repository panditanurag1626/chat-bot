import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { listPlans } from "@/lib/repo";
import { createAccountAction } from "@/app/actions/admin";
import { WEBSITE_TYPE_OPTIONS } from "@/lib/presets";
import Flash from "@/components/Flash";
import PasswordInput from "@/components/PasswordInput";

export const metadata: Metadata = { title: "New account" };

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const plans = listPlans(true);

  return (
    <>
      <p className="muted"><Link href="/admin/accounts">← Back to accounts</Link></p>
      <div className="page-head">
        <div>
          <h1>New account</h1>
          <p className="muted">Provision a customer account and assign a subscription plan.</p>
        </div>
      </div>
      <Flash searchParams={sp} />

      <form action={createAccountAction} className="panel" style={{ maxWidth: 640 }}>
        <h2><i className="fa-solid fa-user" /> Account details</h2>
        <div className="form-grid">
          <label>Full name <input name="name" placeholder="John / Acme Pvt Ltd" /></label>
          <label>Company <input name="company" placeholder="Optional" /></label>
          <label>Email <input name="email" type="email" required placeholder="customer@company.com" /></label>
          <label>Password <PasswordInput name="password" required minLength={6} placeholder="••••••••" /></label>
        </div>

        <h2 style={{ marginTop: 18 }}><i className="fa-solid fa-box-open" /> Subscription</h2>
        <div className="form-grid">
          <label>Subscription plan
            <select name="planId" defaultValue={plans[0]?._id ?? ""}>
              <option value="">No plan (no access until assigned)</option>
              {plans.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.durationDays > 0 ? `${p.durationDays}d` : "unlimited"} · {p.maxBots < 0 ? "∞" : p.maxBots} bots · {p.maxMessagesPerMonth < 0 ? "∞" : p.maxMessagesPerMonth} msgs/mo
                </option>
              ))}
            </select>
          </label>
          <label>Website type (seeds a starter bot)
            <select name="websiteType" defaultValue="custom">
              {WEBSITE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit"><i className="fa-solid fa-check" /> Create account</button>
        </div>
      </form>
    </>
  );
}
