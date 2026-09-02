import { triggerAddAction, triggerToggleAction, triggerDeleteAction } from "@/app/actions/modules";
import type { ITrigger } from "@/lib/types";

const CONDITION_LABELS: Record<string, string> = {
  time_on_page: "Time on page (seconds)",
  page_url: "Page URL contains",
  scroll: "Scrolled past (%)",
  exit_intent: "Exit intent (no value needed)",
};

export default function TriggersSection({
  botId,
  triggers,
  allowed,
}: {
  botId: string;
  triggers: ITrigger[];
  allowed: boolean;
}) {
  return (
    <div>
      <h2><i className="fa-solid fa-bolt" /> Proactive Triggers</h2>
      <p className="muted">Automatically greet or nudge visitors based on behaviour — like Crisp &amp; tawk.to. Great for boosting engagement and conversions.</p>

      {!allowed && <div className="empty">Triggers are not included in this account&apos;s plan.</div>}

      {allowed && (
        <>
          {triggers.length > 0 && (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table className="table">
                <thead><tr><th>Name</th><th>When</th><th>Message</th><th>On</th><th></th></tr></thead>
                <tbody>
                  {triggers.map((t) => (
                    <tr key={t._id}>
                      <td><strong>{t.name}</strong></td>
                      <td className="muted"><small>{CONDITION_LABELS[t.conditionType] || t.conditionType}{t.conditionValue ? `: ${t.conditionValue}` : ""}</small></td>
                      <td className="muted"><small>{t.message.slice(0, 50)}</small></td>
                      <td>
                        <form action={triggerToggleAction}>
                          <input type="hidden" name="id" value={t._id} />
                          <button className={`btn ${t.enabled ? "btn-primary" : ""}`} type="submit">{t.enabled ? "On" : "Off"}</button>
                        </form>
                      </td>
                      <td>
                        <form action={triggerDeleteAction}>
                          <input type="hidden" name="id" value={t._id} />
                          <button className="btn" type="submit" style={{ color: "#c00" }}><i className="fa-solid fa-trash" /></button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <details className="card" style={{ padding: 14 }} open={triggers.length === 0}>
            <summary style={{ cursor: "pointer" }}><strong><i className="fa-solid fa-plus" /> Add trigger</strong></summary>
            <form action={triggerAddAction.bind(null, botId)} style={{ marginTop: 12 }}>
              <label>Name <input name="name" placeholder="Welcome after 5s" /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>Condition
                  <select name="condition_type" defaultValue="time_on_page">
                    <option value="time_on_page">Time on page (seconds)</option>
                    <option value="page_url">Page URL contains</option>
                    <option value="scroll">Scrolled past (%)</option>
                    <option value="exit_intent">Exit intent</option>
                  </select>
                </label>
                <label>Value <input name="condition_value" placeholder="5  /  /pricing  /  60" /></label>
              </div>
              <label>Message <textarea name="message" rows={2} required placeholder="👋 Need help choosing a plan?" /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>Delay (seconds) <input name="delay_seconds" type="number" min="0" defaultValue={5} /></label>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
                  <label className="check" style={{ margin: 0 }}><input type="checkbox" name="once_per_session" defaultChecked /> Once per session</label>
                  <label className="check" style={{ margin: 0 }}><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}><i className="fa-solid fa-plus" /> Add trigger</button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
