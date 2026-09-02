import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { listPlans, countUsersOnPlan } from "@/lib/repo";
import { createPlanAction, updatePlanAction, deletePlanAction } from "@/app/actions/admin";
import Flash from "@/components/Flash";
import type { IPlan } from "@/lib/types";

export const metadata: Metadata = { title: "Plans" };

const FEATURES: { key: string; label: string }[] = [
  { key: "triggers", label: "Proactive triggers" },
  { key: "handoff", label: "Human handoff" },
  { key: "voice", label: "Voice input" },
  { key: "image", label: "Image upload" },
  { key: "apis", label: "External APIs" },
];

function parseFeatures(json: string): Record<string, boolean> {
  try { return JSON.parse(json || "{}"); } catch { return {}; }
}

function PlanFields({ plan }: { plan?: IPlan }) {
  const feats = parseFeatures(plan?.featuresJson || "{}");
  return (
    <>
      <div className="form-grid">
        <label>Name <input name="name" defaultValue={plan?.name ?? ""} required /></label>
        <label>Price ($) <input name="price" type="number" step="0.01" min="0" defaultValue={plan?.price ?? 0} /></label>
        <label>Billing
          <select name="billingPeriod" defaultValue={plan?.billingPeriod ?? "monthly"}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </label>
        <label>Duration (days, 0 = unlimited) <input name="durationDays" type="number" min="0" defaultValue={plan?.durationDays ?? 30} /></label>
        <label>Max bots (-1 = ∞) <input name="maxBots" type="number" min="-1" defaultValue={plan?.maxBots ?? 1} /></label>
        <label>Max messages/mo (-1 = ∞) <input name="maxMessagesPerMonth" type="number" min="-1" defaultValue={plan?.maxMessagesPerMonth ?? 1000} /></label>
        <label>Max agents (-1 = ∞) <input name="maxAgents" type="number" min="-1" defaultValue={plan?.maxAgents ?? 1} /></label>
        <label>Sort order <input name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} /></label>
      </div>
      <label>Description <input name="description" defaultValue={plan?.description ?? ""} /></label>
      <fieldset className="feature-set">
        <legend>Modules included</legend>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <label key={f.key} className="check">
              <input type="checkbox" name={`feat_${f.key}`} defaultChecked={feats[f.key] ?? false} /> {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" name="isActive" defaultChecked={plan ? plan.isActive : true} /> Active (selectable when creating accounts)
      </label>
    </>
  );
}

function limitText(n: number) { return n < 0 ? "Unlimited" : n.toLocaleString(); }

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const plans = listPlans();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Subscription plans</h1>
          <p className="muted">Define the packages you assign to accounts — limits and which modules they unlock.</p>
        </div>
      </div>
      <Flash searchParams={sp} />

      <div className="pricing-grid">
        {plans.map((p, i) => {
          const feats = parseFeatures(p.featuresJson);
          const enabled = FEATURES.filter((f) => feats[f.key]);
          return (
            <div key={p._id} className={`pricing-card${i === 1 ? " featured" : ""}`}>
              {!p.isActive && <span className="badge badge-warn pricing-flag">Inactive</span>}
              <h3 className="pricing-name">{p.name}</h3>
              <div className="pricing-price">
                <span className="amount">${p.price}</span>
                <span className="period">/{p.billingPeriod === "lifetime" ? "once" : p.billingPeriod === "yearly" ? "yr" : "mo"}</span>
              </div>
              <p className="pricing-desc muted">{p.description || "—"}</p>

              <ul className="pricing-limits">
                <li><i className="fa-solid fa-robot" /> {limitText(p.maxBots)} bots</li>
                <li><i className="fa-solid fa-message" /> {limitText(p.maxMessagesPerMonth)} msgs/mo</li>
                <li><i className="fa-solid fa-headset" /> {limitText(p.maxAgents)} agents</li>
                <li><i className="fa-solid fa-clock" /> {p.durationDays > 0 ? `${p.durationDays}-day term` : "No expiry"}</li>
              </ul>

              <div className="pricing-feats">
                {enabled.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>No extra modules</span> :
                  enabled.map((f) => <span key={f.key} className="feat-chip"><i className="fa-solid fa-check" /> {f.label}</span>)}
              </div>

              <div className="pricing-foot">
                <span className="muted"><i className="fa-solid fa-users" /> {countUsersOnPlan(p._id)} account(s)</span>
              </div>

              <details className="pricing-edit">
                <summary className="btn btn-sm"><i className="fa-solid fa-pen-to-square" /> Edit plan</summary>
                <form action={updatePlanAction} className="edit-form">
                  <input type="hidden" name="id" value={p._id} />
                  <PlanFields plan={p} />
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit"><i className="fa-solid fa-check" /> Save</button>
                  </div>
                </form>
                <form action={deletePlanAction} className="edit-form">
                  <input type="hidden" name="id" value={p._id} />
                  <button className="btn btn-link-danger" type="submit"><i className="fa-solid fa-trash" /> Delete this plan</button>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      <details className="panel add-plan" open={plans.length === 0}>
        <summary><i className="fa-solid fa-plus" /> Add new plan</summary>
        <form action={createPlanAction} className="edit-form" style={{ marginTop: 14 }}>
          <PlanFields />
          <div className="form-actions">
            <button className="btn btn-primary" type="submit"><i className="fa-solid fa-plus" /> Create plan</button>
          </div>
        </form>
      </details>
    </>
  );
}
